import { tool } from "ai";
import { z } from "zod";
import { createControlClient } from "./server";
import { dispatchJobFromPayload } from "./server";
import { sqlEscape } from "./sql";
import { sanitizeHtml, sanitizeUrl, sanitizeContext } from "./sanitize";

/** Context passed from the chat route to tools that need it. */
export interface ChatToolContext {
  operatorId: string;
  conversationSummary?: string;
  refContext?: string;
}

/** Default context for backward compatibility. */
const defaultCtx: ChatToolContext = { operatorId: "operator" };

/**
 * Request-scoped context using AsyncLocalStorage.
 * Each request gets its own isolated context — no race conditions.
 */
import { AsyncLocalStorage } from "node:async_hooks";
const toolCtxStore = new AsyncLocalStorage<ChatToolContext>();

/** Get current request's tool context (falls back to default). */
function getToolCtx(): ChatToolContext {
  return toolCtxStore.getStore() ?? defaultCtx;
}

/** Run a callback with tool context scoped to this request. */
export function withToolContext<T>(ctx: ChatToolContext, fn: () => T): T {
  return toolCtxStore.run(ctx, fn);
}

/** @deprecated Use withToolContext instead. Kept for backward compat. */
export function setChatToolContext(_ctx: ChatToolContext) { /* no-op — use withToolContext */ }
export function clearChatToolContext() { /* no-op */ }

export const chatTools = {
  handoff_to_agent: tool({
    description:
      "Delegate a task to a specialist agent for sustained execution. Use 'voyager' for coding tasks (write code, fix bugs, debug, refactor, create tests). Use 'saturn' for operations tasks (run deployments, rollback production, incident triage, infrastructure changes). Only delegate when the task requires agent execution — use other tools for quick lookups.",
    inputSchema: z.object({
      agentId: z.enum(["voyager", "saturn"]).describe("'voyager' for coding, 'saturn' for operations"),
      goal: z.string().describe("Full task description including file names, error details, and context"),
    }),
    execute: async ({ agentId, goal }) => {
      try {
        const result = await dispatchJobFromPayload({
          agentId,
          goal,
          context: {
            operatorId: getToolCtx().operatorId,
            conversationContext: getToolCtx().conversationSummary?.slice(0, 1000),
            refContext: getToolCtx().refContext?.slice(0, 1000),
            channel: "web",
          },
        });
        const runId =
          (result as Record<string, unknown>).workflow &&
          typeof (result as Record<string, unknown>).workflow === "object"
            ? ((result as Record<string, unknown>).workflow as Record<string, unknown>).runId
            : (result as Record<string, unknown>).workflowRunId;

        return {
          success: true,
          agentId,
          runId: runId ?? "unknown",
          message: `Task delegated to ${agentId}. Tracking as run ${runId ?? "unknown"}. You'll see a completion message when it finishes.`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Delegation failed",
        };
      }
    },
  }),

  chain_tasks: tool({
    description: "Execute multiple agent tasks in sequence. The second task waits for the first to complete. Use when the user says 'fix AND deploy', 'refactor then test', or any compound instruction requiring ordered execution.",
    inputSchema: z.object({
      steps: z.array(z.object({
        agentId: z.enum(["voyager", "saturn"]).describe("Agent for this step"),
        goal: z.string().describe("Goal for this step"),
      })).describe("Tasks to execute in order (max 3)"),
    }),
    execute: async ({ steps }) => {
      if (steps.length === 0) return { success: false, message: "No steps provided." };
      if (steps.length > 3) return { success: false, message: "Maximum 3 chained steps." };

      try {
        // Store the chain plan in SpacetimeDB
        const client = createControlClient();
        const chainId = `chain_${Date.now().toString(36)}`;
        await client.callReducer("upsert_memory_document", [
          chainId,
          getToolCtx().operatorId,
          "task_chains",
          `Chain: ${steps.map((s) => s.goal.slice(0, 30)).join(" → ")}`,
          JSON.stringify({
            steps: steps.map((s, i) => ({ ...s, index: i, status: i === 0 ? "dispatching" : "waiting" })),
            createdAt: Date.now(),
          }),
          "chain",
          "{}",
        ]);

        // Dispatch the first step immediately
        const first = steps[0]!;
        const result = await dispatchJobFromPayload({
          agentId: first.agentId,
          goal: first.goal,
          context: {
            operatorId: getToolCtx().operatorId,
            chainId,
            chainStep: 0,
            nextSteps: steps.slice(1).map((s) => `${s.agentId}: ${s.goal}`),
            conversationContext: getToolCtx().conversationSummary?.slice(0, 500),
          },
        });

        const runId = (result as Record<string, unknown>).workflow &&
          typeof (result as Record<string, unknown>).workflow === "object"
            ? ((result as Record<string, unknown>).workflow as Record<string, unknown>).runId
            : (result as Record<string, unknown>).workflowRunId;

        const stepSummary = steps.map((s, i) => `${i + 1}. ${s.agentId}: ${s.goal}`).join("\n");
        return {
          success: true,
          chainId,
          totalSteps: steps.length,
          currentStep: 1,
          runId: runId ?? "unknown",
          message: `Task chain started (${steps.length} steps):\n${stepSummary}\n\nStep 1 dispatched to ${first.agentId}. Remaining steps will execute when each completes.`,
        };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Chain dispatch failed" };
      }
    },
  }),

  search_memory: tool({
    description:
      "Search stored facts, preferences, and ingested knowledge in the knowledge base. Use for 'what do you know about X', 'search memory for X', or recalling saved information. This searches the knowledge base, NOT chat history — use search_history for past conversations.",
    inputSchema: z.object({
      query: z.string().describe("Search query for the knowledge base"),
    }),
    execute: async ({ query }) => {
      try {
        const client = createControlClient();
        const results = (await client.sql(
          `SELECT title, content, agent_id, namespace FROM memory_document WHERE content LIKE '%${sqlEscape(query)}%' LIMIT 5`,
        )) as Array<Record<string, unknown>>;

        if (results.length === 0) {
          return { found: false, message: "No matching memories found." };
        }

        return {
          found: true,
          count: results.length,
          memories: results.map((r) => ({
            title: String(r.title ?? ""),
            content: String(r.content ?? "").slice(0, 500),
            agent: String(r.agent_id ?? ""),
            namespace: String(r.namespace ?? ""),
          })),
        };
      } catch {
        return { found: false, message: "Memory search unavailable." };
      }
    },
  }),

  get_run_status: tool({
    description:
      "Check the full status of a mission/run by its ID, including error details and tool calls. Use when asking 'what happened', 'why did it fail', or checking task progress.",
    inputSchema: z.object({
      runId: z.string().describe("The run ID to check (e.g., run_abc123)"),
    }),
    execute: async ({ runId }) => {
      try {
        const client = createControlClient();
        const runs = (await client.sql(
          `SELECT run_id, agent_id, goal, status, current_stage FROM workflow_run WHERE run_id = '${sqlEscape(runId)}'`,
        )) as Array<Record<string, unknown>>;

        if (runs.length === 0) {
          return { found: false, message: `Run ${runId} not found.` };
        }

        const run = runs[0]!;

        // Load tool calls and errors for forensic depth
        let toolCalls: string[] = [];
        let lastOutput = "";
        try {
          const tcRows = (await client.sql(
            `SELECT tool_name, status, output_json FROM tool_call_record WHERE run_id = '${sqlEscape(runId)}' ORDER BY created_at_micros DESC LIMIT 5`,
          )) as Array<Record<string, unknown>>;
          toolCalls = tcRows.map((tc) => `${tc.tool_name} (${tc.status})`);

          // Get the last meaningful output
          const outputRow = tcRows.find((tc) => tc.output_json && String(tc.output_json).length > 5);
          if (outputRow) lastOutput = sanitizeContext(String(outputRow.output_json).slice(0, 500), 500);
        } catch { /* best-effort */ }

        // Load taxonomy messages for this run (errors, results)
        let errorInfo = "";
        try {
          const msgs = (await client.sql(
            `SELECT content FROM chat_message WHERE conversation_id = '${sqlEscape(runId)}' ORDER BY created_at_micros DESC LIMIT 3`,
          )) as Array<Record<string, unknown>>;
          if (msgs.length > 0) {
            errorInfo = msgs.map((m) => sanitizeContext(String(m.content).slice(0, 200), 200)).join("; ");
          }
        } catch { /* best-effort */ }

        return {
          found: true,
          runId: String(run.run_id),
          agent: String(run.agent_id),
          goal: String(run.goal),
          status: String(run.status),
          stage: String(run.current_stage),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          lastOutput: lastOutput || undefined,
          details: errorInfo || undefined,
        };
      } catch {
        return { found: false, message: "Run status check unavailable." };
      }
    },
  }),

  remember: tool({
    description:
      "Store an important fact or preference for future reference. Use when the user says 'remember that...' or shares a preference/constraint.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the memory"),
      content: z.string().describe("The fact or preference to remember"),
    }),
    execute: async ({ title, content }) => {
      try {
        const client = createControlClient();
        await client.callReducer("upsert_memory_document", [
          `mem_${Date.now().toString(36)}`,
          "cadet",
          "assistant",
          title,
          content,
          "conversation",
          "{}",
        ]);
        return { stored: true, message: `Remembered: "${title}"` };
      } catch {
        return { stored: false, message: "Could not store memory." };
      }
    },
  }),

  // ── Knowledge & Research tools (T11) ──────────────────────────────

  ingest_url: tool({
    description:
      "Fetch a URL and PERMANENTLY STORE its content in the knowledge base. Use ONLY when the user explicitly wants to save/remember a link for later. If the user just wants to read a page, use fetch_url instead.",
    inputSchema: z.object({
      url: z.string().url().describe("The URL to fetch and store"),
      title: z.string().describe("A short title for this knowledge entry"),
    }),
    execute: async ({ url, title }) => {
      try {
        const safeUrl = sanitizeUrl(url);
        if (!safeUrl) return { stored: false, message: "URL blocked: invalid or private network address" };

        const res = await fetch(safeUrl, { signal: AbortSignal.timeout(10_000), redirect: "error" });
        if (!res.ok) return { stored: false, message: `Failed to fetch: ${res.status}` };

        const html = await res.text();
        // Sanitize HTML: strip tags, scripts, injection patterns
        const text = sanitizeHtml(html, 4000);

        const client = createControlClient();
        await client.callReducer("upsert_memory_document", [
          `url_${Date.now().toString(36)}`,
          "cadet",
          "knowledge",
          title,
          text,
          "url_ingest",
          JSON.stringify({ url }),
        ]);
        return { stored: true, message: `Stored "${title}" (${text.length} chars from ${url})` };
      } catch (error) {
        return { stored: false, message: error instanceof Error ? error.message : "Fetch failed" };
      }
    },
  }),

  // ── Reminder tools (T12) ──────────────────────────────────────────

  set_reminder: tool({
    description:
      "Set a reminder for the user. The reminder will be checked periodically and delivered. Use when the user says 'remind me to...' or 'in 30 minutes...'",
    inputSchema: z.object({
      title: z.string().describe("What to remind about"),
      minutesFromNow: z.number().describe("How many minutes from now to trigger the reminder"),
    }),
    execute: async ({ title, minutesFromNow }) => {
      try {
        const triggerAt = Date.now() + minutesFromNow * 60_000;
        const client = createControlClient();
        await client.callReducer("upsert_memory_document", [
          `reminder_${Date.now().toString(36)}`,
          "cadet",
          "reminders",
          title,
          JSON.stringify({ triggerAt, title, delivered: false }),
          "reminder",
          "{}",
        ]);
        const when = minutesFromNow < 60
          ? `${minutesFromNow} minutes`
          : `${(minutesFromNow / 60).toFixed(1)} hours`;
        return { set: true, message: `Reminder set: "${title}" in ${when}` };
      } catch {
        return { set: false, message: "Could not set reminder." };
      }
    },
  }),

  list_reminders: tool({
    description: "List the user's upcoming reminders.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const client = createControlClient();
        const rows = (await client.sql(
          `SELECT title, content FROM memory_document WHERE namespace = 'reminders' AND source_kind = 'reminder' LIMIT 10`,
        )) as Array<Record<string, unknown>>;

        const reminders = rows.map((r) => {
          try {
            const data = JSON.parse(String(r.content)) as { title: string; triggerAt: number; delivered: boolean };
            return { title: data.title, triggerAt: new Date(data.triggerAt).toISOString(), delivered: data.delivered };
          } catch {
            return { title: String(r.title), triggerAt: "unknown", delivered: false };
          }
        });

        return { count: reminders.length, reminders };
      } catch {
        return { count: 0, reminders: [] };
      }
    },
  }),

  // ── DevOps tools (T13) ────────────────────────────────────────────

  check_deployment: tool({
    description:
      "Check the status of recent Vercel deployments (read-only). Does NOT trigger deployments — use handoff_to_agent with saturn to actually deploy. Use when checking deploy status, verifying a deploy succeeded, or viewing recent deploy history.",
    inputSchema: z.object({
      limit: z.number().optional().describe("Number of deployments to check (default 3)"),
    }),
    execute: async ({ limit }) => {
      try {
        const { getVercelAccessToken } = await import("./token-store");
        // Try to get a token for any operator — in practice this would be scoped
        const token = process.env.VERCEL_TOKEN;
        if (!token) return { found: false, message: "No Vercel access token available. Connect your Vercel account in Settings." };

        const teamId = process.env.VERCEL_TEAM_ID;
        const projectId = process.env.VERCEL_PROJECT_ID;
        const params = new URLSearchParams({ limit: String(limit ?? 3) });
        if (teamId) params.set("teamId", teamId);
        if (projectId) params.set("projectId", projectId);

        const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) return { found: false, message: `Vercel API error: ${res.status}` };

        const data = await res.json() as { deployments: Array<{ uid: string; url: string; state: string; created: number; meta?: { githubCommitMessage?: string } }> };
        return {
          found: true,
          deployments: data.deployments.map((d) => ({
            id: d.uid,
            url: d.url,
            state: d.state,
            created: new Date(d.created).toISOString(),
            commit: d.meta?.githubCommitMessage ?? "",
          })),
        };
      } catch (error) {
        return { found: false, message: error instanceof Error ? error.message : "Deployment check failed" };
      }
    },
  }),

  // ── Team tools (T14) ──────────────────────────────────────────────

  list_recent_runs: tool({
    description:
      "List recent agent runs with their status. Filter by agent, date, or both.",
    inputSchema: z.object({
      limit: z.number().optional().describe("Number of runs to show (default 10)"),
      agentId: z.string().optional().describe("Filter by agent: 'voyager', 'saturn', etc."),
      since: z.string().optional().describe("Only show runs after: 'today', 'yesterday', 'this_week', or ISO date"),
    }),
    execute: async ({ limit, agentId, since }) => {
      try {
        const client = createControlClient();
        const conditions: string[] = [];
        if (agentId) conditions.push(`agent_id = '${sqlEscape(agentId)}'`);
        if (since) {
          let sinceMs: number;
          const now = Date.now();
          if (since === "today") sinceMs = new Date().setHours(0, 0, 0, 0);
          else if (since === "yesterday") sinceMs = new Date().setHours(0, 0, 0, 0) - 86400000;
          else if (since === "this_week") sinceMs = now - 7 * 86400000;
          else sinceMs = new Date(since).getTime();
          if (!isNaN(sinceMs)) conditions.push(`updated_at_micros >= ${sinceMs * 1000}`);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const rows = (await client.sql(
          `SELECT run_id, agent_id, goal, status, current_stage FROM workflow_run ${whereClause} ORDER BY updated_at_micros DESC LIMIT ${limit ?? 10}`,
        )) as Array<Record<string, unknown>>;

        return {
          count: rows.length,
          runs: rows.map((r) => ({
            runId: String(r.run_id),
            agent: String(r.agent_id),
            goal: String(r.goal).slice(0, 100),
            status: String(r.status),
            stage: String(r.current_stage),
          })),
        };
      } catch {
        return { count: 0, runs: [] };
      }
    },
  }),

  create_pr: tool({
    description:
      "Create a GitHub pull request. Repo owner/name are auto-detected from active sessions if not provided.",
    inputSchema: z.object({
      repoOwner: z.string().optional().describe("GitHub repo owner (auto-detected if omitted)"),
      repoName: z.string().optional().describe("GitHub repo name (auto-detected if omitted)"),
      baseBranch: z.string().optional().describe("Base branch (default: main)"),
      headBranch: z.string().describe("Head branch with changes"),
      title: z.string().describe("PR title"),
      body: z.string().optional().describe("PR description (auto-generated if omitted)"),
    }),
    execute: async ({ repoOwner, repoName, baseBranch, headBranch, title, body }) => {
      try {
        // Auto-detect repo from active session if not provided
        let owner = repoOwner;
        let name = repoName;
        if (!owner || !name) {
          try {
            const client = createControlClient();
            const rows = (await client.sql(
              "SELECT repo_url FROM agent_session WHERE status = 'active' AND repo_url != '' ORDER BY updated_at_micros DESC LIMIT 1",
            )) as Record<string, unknown>[];
            if (rows.length > 0) {
              const match = String(rows[0]!.repo_url).match(/github\.com[/:]([^/]+)\/([^/.]+)/);
              if (match) { owner = owner ?? match[1]; name = name ?? match[2]; }
            }
          } catch { /* fall through */ }
        }
        if (!owner || !name) return { created: false, message: "Could not determine repo. Provide repoOwner and repoName, or start a session with a GitHub repo." };

        const { createPullRequest } = await import("./github-pr");
        const pr = await createPullRequest({
          operatorId: getToolCtx().operatorId,
          repoOwner: owner!,
          repoName: name!,
          baseBranch: baseBranch ?? "main",
          headBranch,
          title,
          body: body ?? `PR created by Cadet agent\n\nBranch: ${headBranch}`,
        });
        if (!pr) return { created: false, message: "PR creation failed — check GitHub token" };
        return { created: true, prUrl: pr.prUrl, prNumber: pr.prNumber };
      } catch (error) {
        return { created: false, message: error instanceof Error ? error.message : "PR creation failed" };
      }
    },
  }),

  compose_standup: tool({
    description:
      "Compose a standup summary from recent runs, approvals, and agent activity. Use when the user asks for a status report or daily standup.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const client = createControlClient();
        const [runs, approvals, agents] = await Promise.all([
          client.sql("SELECT agent_id, goal, status FROM workflow_run ORDER BY updated_at_micros DESC LIMIT 10") as Promise<Array<Record<string, unknown>>>,
          client.sql("SELECT title, status, risk FROM approval_request ORDER BY updated_at_micros DESC LIMIT 5") as Promise<Array<Record<string, unknown>>>,
          client.sql("SELECT agent_id, display_name FROM agent_record") as Promise<Array<Record<string, unknown>>>,
        ]);

        const completed = runs.filter((r) => r.status === "completed").length;
        const running = runs.filter((r) => r.status === "running").length;
        const failed = runs.filter((r) => r.status === "failed").length;
        const pending = approvals.filter((a) => a.status === "pending").length;

        return {
          summary: {
            totalRuns: runs.length,
            completed,
            running,
            failed,
            pendingApprovals: pending,
            activeAgents: agents.length,
          },
          recentGoals: runs.slice(0, 5).map((r) => ({
            agent: String(r.agent_id),
            goal: String(r.goal).slice(0, 80),
            status: String(r.status),
          })),
        };
      } catch {
        return { summary: null, recentGoals: [] };
      }
    },
  }),

  // ── Skills tools ──────────────────────────────────────────────────

  list_skills: tool({
    description: "List available agent skills. Skills are on-demand knowledge documents that provide context for specific tasks.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { listSkills } = await import("./agent-runtime/skills");
        const skills = await listSkills();
        return { count: skills.length, skills: skills.map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category })) };
      } catch { return { count: 0, skills: [] }; }
    },
  }),

  load_skill: tool({
    description: "Load a specific skill's full content. Use after list_skills to get detailed guidance on a topic.",
    inputSchema: z.object({ skillId: z.string().describe("Skill ID to load") }),
    execute: async ({ skillId }) => {
      try {
        const { viewSkill } = await import("./agent-runtime/skills");
        const skill = await viewSkill(skillId);
        if (!skill) return { found: false, message: `Skill '${skillId}' not found` };
        return { found: true, name: skill.name, content: skill.content };
      } catch { return { found: false, message: "Failed to load skill" }; }
    },
  }),

  // ── Search tools ──────────────────────────────────────────────────

  search_history: tool({
    description: "Search past chat conversations, agent run transcripts, and thread messages. Use for 'what happened yesterday', 'find that conversation about X', or reviewing session history. This searches chat/run history, NOT the knowledge base — use search_memory for stored facts.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      type: z.enum(["chat", "run", "memory", "thread"]).optional().describe("Filter by type"),
      since: z.string().optional().describe("Only show results after: 'today', 'yesterday', 'this_week', or ISO date"),
    }),
    execute: async ({ query, type, since }) => {
      try {
        const { searchSessions } = await import("./agent-runtime/session-search");
        // If since is provided, append it to the query for keyword matching
        const enrichedQuery = since ? `${query} ${since}` : query;
        const results = await searchSessions(enrichedQuery, { type, limit: 10 });
        return { count: results.length, results: results.map((r) => ({ type: r.type, id: r.id, title: r.title, preview: r.content.slice(0, 100) })) };
      } catch { return { count: 0, results: [] }; }
    },
  }),

  // ── Checkpoint tools ──────────────────────────────────────────────

  rollback: tool({
    description: "Rollback a sandbox to a previous checkpoint. Use when the user says 'undo', 'revert', 'go back', or the agent made bad changes. Session ID is optional — defaults to the most recent active session.",
    inputSchema: z.object({
      sessionId: z.string().optional().describe("Session ID (auto-detected if omitted)"),
      checkpointId: z.string().optional().describe("Specific checkpoint ID (defaults to latest)"),
    }),
    execute: async ({ sessionId, checkpointId }) => {
      try {
        const { listCheckpoints } = await import("./agent-runtime/checkpoints");

        // Auto-discover session if not provided
        let targetSessionId = sessionId;
        if (!targetSessionId) {
          const client = createControlClient();
          const rows = (await client.sql(
            "SELECT session_id FROM agent_session WHERE status = 'active' ORDER BY updated_at_micros DESC LIMIT 1",
          )) as Record<string, unknown>[];
          if (rows.length === 0) return { success: false, message: "No active sessions found. Nothing to rollback." };
          targetSessionId = String(rows[0]!.session_id);
        }

        const checkpoints = await listCheckpoints(targetSessionId);
        if (checkpoints.length === 0) return { success: false, message: `No checkpoints found for session ${targetSessionId}. The agent may not have created any checkpoints yet.` };

        const target = checkpointId ? checkpoints.find((c) => c.checkpointId === checkpointId) : checkpoints[0];
        if (!target) return { success: false, message: "Checkpoint not found" };

        // Get the operator's Vercel token to perform the rollback
        try {
          const { getVercelAccessToken } = await import("./token-store");
          const token = await getVercelAccessToken(getToolCtx().operatorId);
          if (token) {
            const { rollbackToCheckpoint } = await import("./agent-runtime/checkpoints");
            const { newSandboxId } = await rollbackToCheckpoint(target.checkpointId, token);
            return {
              success: true,
              message: `Rolled back to checkpoint "${target.label}" (turn ${target.turnNumber}). New sandbox: ${newSandboxId}`,
              checkpoint: { id: target.checkpointId, label: target.label, turn: target.turnNumber },
              newSandboxId,
            };
          }
        } catch { /* token unavailable — fall through to guidance */ }

        return {
          success: true,
          message: `Found checkpoint "${target.label}" (turn ${target.turnNumber}). Connect your Vercel account in Settings to enable automatic rollback.`,
          checkpoint: { id: target.checkpointId, label: target.label, turn: target.turnNumber },
          sessionId: targetSessionId,
        };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : "Rollback failed" };
      }
    },
  }),

  // ── Provider routing tools ────────────────────────────────────────

  set_routing: tool({
    description: "Set the AI provider routing strategy. Use when the user asks to optimize for cost, speed, or quality.",
    inputSchema: z.object({
      strategy: z.enum(["cost", "speed", "quality", "balanced"]).describe("Routing strategy"),
    }),
    execute: async ({ strategy }) => {
      try {
        const { saveOperatorRouting } = await import("./agent-runtime/provider-routing");
        await saveOperatorRouting(getToolCtx().operatorId, { strategy });
        return { set: true, message: `Routing strategy set to '${strategy}'` };
      } catch {
        return { set: false, message: "Could not save routing preference" };
      }
    },
  }),

  // ── Missing tools identified by QA audit ──────────────────────────

  cancel_run: tool({
    description: "Cancel a running agent execution. Use when the user says 'cancel', 'stop', 'abort' a running task.",
    inputSchema: z.object({
      runId: z.string().optional().describe("Run ID to cancel (defaults to most recent running)"),
    }),
    execute: async ({ runId }) => {
      try {
        const client = createControlClient();
        let targetRunId = runId;
        if (!targetRunId) {
          const rows = (await client.sql(
            "SELECT run_id FROM workflow_run WHERE status = 'running' ORDER BY updated_at_micros DESC LIMIT 1",
          )) as Record<string, unknown>[];
          if (rows.length === 0) return { cancelled: false, message: "No running tasks found." };
          targetRunId = String(rows[0]!.run_id);
        }
        await client.callReducer("update_run_status", [targetRunId, "cancelled"]);
        // Also cancel the agent session if one exists
        try {
          const { requestCancel } = await import("./agent-runtime/session");
          const sesRows = (await client.sql(
            `SELECT session_id FROM agent_session WHERE status = 'active' ORDER BY updated_at_micros DESC LIMIT 1`,
          )) as Record<string, unknown>[];
          if (sesRows.length > 0) await requestCancel(String(sesRows[0]!.session_id));
        } catch { /* session cancel is best-effort */ }
        return { cancelled: true, message: `Cancelled run ${targetRunId}` };
      } catch (error) {
        return { cancelled: false, message: error instanceof Error ? error.message : "Cancel failed" };
      }
    },
  }),

  delete_memory: tool({
    description: "Delete stored memories matching a query. Deletes ALL matches when deleteAll is true, otherwise just the first. Use for 'forget X', 'forget everything about Y', 'remove all notes about Z'.",
    inputSchema: z.object({
      query: z.string().describe("Search query to find memories to delete"),
      deleteAll: z.boolean().optional().describe("Delete all matches (default: false, deletes first match only)"),
    }),
    execute: async ({ query, deleteAll }) => {
      try {
        const client = createControlClient();
        const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
        if (keywords.length === 0) return { deleted: 0, message: "Please specify what to forget." };
        const conditions = keywords.map((k) => `title LIKE '%${sqlEscape(k)}%' OR content LIKE '%${sqlEscape(k)}%'`).join(" OR ");
        const limit = deleteAll ? 20 : 1;
        const rows = (await client.sql(
          `SELECT document_id, title FROM memory_document WHERE (${conditions}) LIMIT ${limit}`,
        )) as Record<string, unknown>[];
        if (rows.length === 0) return { deleted: 0, message: "No matching memories found." };

        const deleted: string[] = [];
        for (const row of rows) {
          await client.callReducer("delete_memory_document", [String(row.document_id)]);
          deleted.push(String(row.title));
        }
        return { deleted: deleted.length, message: `Deleted ${deleted.length} memor${deleted.length === 1 ? "y" : "ies"}: ${deleted.map((t) => `"${t}"`).join(", ")}` };
      } catch (error) {
        return { deleted: 0, message: error instanceof Error ? error.message : "Delete failed" };
      }
    },
  }),

  list_agents: tool({
    description: "List available agents and their capabilities. Use when the user asks 'what agents do you have', 'who can help', or 'list agents'.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { AGENT_REGISTRY } = await import("./agent-runtime/registry");
        return {
          agents: AGENT_REGISTRY.map((a) => ({
            id: a.id,
            name: a.name,
            capabilities: [...a.capabilities],
            description: a.description,
          })),
          orchestrators: [
            { id: "cadet", name: "Cadet", role: "Router — handles conversations, delegates to specialists" },
            { id: "voyager", name: "Voyager", role: "Coding — writes code, fixes bugs, creates PRs" },
            { id: "saturn", name: "Saturn", role: "Operations — deploys, monitors, incident response" },
          ],
        };
      } catch {
        return { agents: [], orchestrators: [] };
      }
    },
  }),

  // ── Internet access tools (Agent Reach pattern) ───────────────────

  fetch_url: tool({
    description: "Read a web page, YouTube video, GitHub repo/issue, or RSS feed without saving it. Auto-detects type. Use when the user shares a link or asks to read/check something. Does NOT store content — use ingest_url to save for later.",
    inputSchema: z.object({
      url: z.string().describe("URL to fetch, or search query for web search"),
    }),
    execute: async ({ url }) => {
      try {
        const { fetchFromChannel } = await import("./agent-runtime/internet-channels");
        const result = await fetchFromChannel(url);
        return { success: result.success, channel: result.channel, content: result.content.slice(0, 3000), metadata: result.metadata };
      } catch (error) {
        return { success: false, content: error instanceof Error ? error.message : "Fetch failed" };
      }
    },
  }),

  search_web: tool({
    description: "Search the web for current information. Use when the user asks about something you don't know, recent events, or needs live data.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
    }),
    execute: async ({ query }) => {
      try {
        const { searchWeb } = await import("./agent-runtime/internet-channels");
        const result = await searchWeb(query);
        return { success: result.success, content: result.content, resultCount: result.metadata.resultCount };
      } catch (error) {
        return { success: false, content: error instanceof Error ? error.message : "Search failed" };
      }
    },
  }),

  check_channels: tool({
    description: "Check which internet channels are available. Shows web, search, YouTube, GitHub, RSS status.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { checkChannelStatus } = await import("./agent-runtime/internet-channels");
        return { channels: await checkChannelStatus() };
      } catch { return { channels: [] }; }
    },
  }),

  // ── Approval management ───────────────────────────────────────────

  list_approvals: tool({
    description: "List pending approval requests that need your attention. Use when the user asks about approvals, pending reviews, or what needs sign-off.",
    inputSchema: z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional().describe("Filter by status (default: pending)"),
    }),
    execute: async ({ status }) => {
      try {
        const client = createControlClient();
        const where = `WHERE status = '${sqlEscape(status ?? "pending")}'`;
        const rows = (await client.sql(
          `SELECT approval_id, run_id, agent_id, title, detail, risk, status FROM approval_request ${where} ORDER BY updated_at_micros DESC LIMIT 10`,
        )) as Record<string, unknown>[];
        return { count: rows.length, approvals: rows.map((r) => ({ id: r.approval_id, runId: r.run_id, agent: r.agent_id, title: r.title, risk: r.risk, status: r.status })) };
      } catch { return { count: 0, approvals: [] }; }
    },
  }),

  resolve_approval: tool({
    description: "Approve or reject a pending approval request. Use when the user says 'approve it', 'reject that', or makes a decision on a pending approval.",
    inputSchema: z.object({
      approvalId: z.string().describe("Approval ID to resolve"),
      decision: z.enum(["approved", "rejected"]).describe("The decision"),
      note: z.string().optional().describe("Optional note explaining the decision"),
    }),
    execute: async ({ approvalId, decision, note }) => {
      try {
        const { resolveApprovalRecord } = await import("./durable-approval");
        await resolveApprovalRecord(approvalId, { status: decision, comment: note ?? "" } as never);

        // Resume any suspended workflow hook
        try {
          const env = (await import("./env")).getServerEnv();
          if (env.workflowEnabled) {
            const { resumeHook } = await import("workflow/api");
            await resumeHook(approvalId, {
              approved: decision === "approved",
              comment: note ?? "",
              operatorId: getToolCtx().operatorId,
            });
          }
        } catch { /* hook may not exist */ }

        return { resolved: true, approvalId, decision, message: `Approval ${approvalId} ${decision}.` };
      } catch (error) {
        return { resolved: false, message: error instanceof Error ? error.message : "Failed to resolve approval" };
      }
    },
  }),
};
