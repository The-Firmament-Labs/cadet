/**
 * Context Assembly
 *
 * Builds the optimal context for any agent interaction by pulling from
 * all SpacetimeDB sources. This is the single module responsible for
 * answering: "what does the agent need to know right now?"
 *
 * SpacetimeDB tables used:
 * - chat_message: past conversation turns
 * - workflow_run: previous agent runs and their outcomes
 * - memory_document: stored knowledge, learnings, preferences
 * - tool_call_record: what tools agents used and what they produced
 * - agent_session: active sandbox sessions
 * - message_event: thread messages from Slack/Discord/GitHub
 *
 * The assembled context is token-budget aware — it fills the most
 * valuable context first and stops when the budget is reached.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";
import { sanitizeContext, fenceContext } from "../sanitize";
import type { MessageKind } from "./message-taxonomy";

export interface AssembledContext {
  /** Fenced context blocks ready to inject into system prompt */
  systemBlocks: string[];
  /** Plain text summary for passing through handoffs */
  plainSummary: string;
  /** Token estimate */
  tokenEstimate: number;
  /** What sources contributed */
  sources: string[];
}

interface AssemblyOptions {
  operatorId: string;
  /** Current goal/topic for relevance filtering */
  goal?: string;
  /** Max tokens for assembled context */
  tokenBudget?: number;
  /** Include past chat messages */
  includeChat?: boolean;
  /** Include recent run history */
  includeRuns?: boolean;
  /** Include relevant memories */
  includeMemory?: boolean;
  /** Include learnings from past runs */
  includeLearnings?: boolean;
  /** Include active session info */
  includeSessions?: boolean;
  /** Number of past chat turns to include */
  chatTurns?: number;
}

const DEFAULT_OPTIONS: Required<Omit<AssemblyOptions, "operatorId" | "goal">> = {
  tokenBudget: 4000,
  includeChat: true,
  includeRuns: true,
  includeMemory: true,
  includeLearnings: true,
  includeSessions: true,
  chatTurns: 10,
};

/**
 * Assemble the best possible context from SpacetimeDB for an agent interaction.
 * Fills the token budget with the most valuable context first.
 */
export async function assembleContext(opts: AssemblyOptions): Promise<AssembledContext> {
  const config = { ...DEFAULT_OPTIONS, ...opts };
  const client = createControlClient();
  const blocks: string[] = [];
  const plainParts: string[] = [];
  const sources: string[] = [];
  let tokensUsed = 0;
  const budget = config.tokenBudget;

  // Priority 1: User prompts — what the user actually wants (grounding)
  if (config.includeChat && tokensUsed < budget) {
    try {
      const userRows = (await client.sql(
        `SELECT content, metadata_json FROM chat_message WHERE operator_id = '${sqlEscape(config.operatorId)}' AND metadata_json LIKE '%"kind":"user_prompt"%' ORDER BY created_at_micros DESC LIMIT ${Math.ceil(config.chatTurns / 2)}`,
      )) as Record<string, unknown>[];

      if (userRows.length > 0) {
        const promptBlock = userRows.reverse().map((r) =>
          `> ${sanitizeContext(String(r.content ?? ""), 200)}`,
        ).join("\n");

        const promptTokens = estimateTokens(promptBlock);
        if (tokensUsed + promptTokens <= budget) {
          blocks.push(fenceContext("user-requests", promptBlock));
          plainParts.push("User requests:\n" + promptBlock);
          tokensUsed += promptTokens;
          sources.push(`user-prompts (${userRows.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 2: Agent responses — what agents actually did/said
  if (config.includeChat && tokensUsed < budget) {
    try {
      const agentRows = (await client.sql(
        `SELECT content, metadata_json FROM chat_message WHERE operator_id = '${sqlEscape(config.operatorId)}' AND metadata_json LIKE '%"kind":"agent_response"%' ORDER BY created_at_micros DESC LIMIT ${Math.ceil(config.chatTurns / 2)}`,
      )) as Record<string, unknown>[];

      if (agentRows.length > 0) {
        const responseBlock = agentRows.reverse().map((r) => {
          const content = sanitizeContext(String(r.content ?? ""), 200);
          let toolInfo = "";
          try {
            const meta = JSON.parse(String(r.metadata_json ?? "{}")) as { toolsUsed?: string[] };
            if (meta.toolsUsed?.length) toolInfo = ` [tools: ${meta.toolsUsed.join(", ")}]`;
          } catch { /* */ }
          return `Agent: ${content}${toolInfo}`;
        }).join("\n");

        const respTokens = estimateTokens(responseBlock);
        if (tokensUsed + respTokens <= budget) {
          blocks.push(fenceContext("agent-responses", responseBlock));
          plainParts.push("Agent responses:\n" + responseBlock);
          tokensUsed += respTokens;
          sources.push(`agent-responses (${agentRows.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 3: A2A results — what delegated agents produced (handoff outcomes)
  if (config.includeRuns && tokensUsed < budget) {
    try {
      const resultRows = (await client.sql(
        `SELECT content, metadata_json FROM chat_message WHERE operator_id = '${sqlEscape(config.operatorId)}' AND (metadata_json LIKE '%"kind":"a2a_result"%' OR metadata_json LIKE '%agent-completion%') ORDER BY created_at_micros DESC LIMIT 3`,
      )) as Record<string, unknown>[];

      if (resultRows.length > 0) {
        const resultBlock = resultRows.map((r) => {
          const content = sanitizeContext(String(r.content ?? ""), 200);
          let meta = "";
          try {
            const parsed = JSON.parse(String(r.metadata_json ?? "{}")) as Record<string, unknown>;
            if (parsed.runId) meta = ` (run: ${parsed.runId})`;
            if (parsed.prUrl) meta += ` PR: ${parsed.prUrl}`;
            if (parsed.agentId) meta = ` [${parsed.agentId}]` + meta;
          } catch { /* */ }
          return `Result${meta}: ${content}`;
        }).join("\n");

        const resultTokens = estimateTokens(resultBlock);
        if (tokensUsed + resultTokens <= budget) {
          blocks.push(fenceContext("delegated-agent-results", resultBlock));
          plainParts.push(resultBlock);
          tokensUsed += resultTokens;
          sources.push(`a2a-results (${resultRows.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 3b: Fallback — if no taxonomy messages exist yet, load raw chat history
  if (config.includeChat && tokensUsed < budget && sources.length === 0) {
    try {
      const rows = (await client.sql(
        `SELECT role, content FROM chat_message WHERE operator_id = '${sqlEscape(config.operatorId)}' ORDER BY created_at_micros DESC LIMIT ${config.chatTurns}`,
      )) as Record<string, unknown>[];

      if (rows.length > 0) {
        const chatBlock = rows.reverse().map((r) =>
          `${String(r.role ?? "user")}: ${sanitizeContext(String(r.content ?? ""), 200)}`,
        ).join("\n");

        const chatTokens = estimateTokens(chatBlock);
        if (tokensUsed + chatTokens <= budget) {
          blocks.push(fenceContext("recent-conversation", chatBlock));
          plainParts.push("Conversation:\n" + chatBlock);
          tokensUsed += chatTokens;
          sources.push(`chat-fallback (${rows.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 3: Relevant memories (keyword-filtered by goal)
  if (config.includeMemory && config.goal && tokensUsed < budget) {
    try {
      const keywords = config.goal.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
      if (keywords.length > 0) {
        const conditions = keywords.map((k) => `(title LIKE '%${sqlEscape(k)}%' OR content LIKE '%${sqlEscape(k)}%')`).join(" OR ");
        const memories = (await client.sql(
          `SELECT title, content FROM memory_document WHERE namespace != 'batches' AND namespace != 'webhooks' AND (${conditions}) ORDER BY updated_at_micros DESC LIMIT 5`,
        )) as Record<string, unknown>[];

        if (memories.length > 0) {
          const memBlock = memories.map((m) =>
            `- ${sanitizeContext(String(m.title), 60)}: ${sanitizeContext(String(m.content), 150)}`,
          ).join("\n");

          const memTokens = estimateTokens(memBlock);
          if (tokensUsed + memTokens <= budget) {
            blocks.push(fenceContext("relevant-knowledge", memBlock));
            plainParts.push("Knowledge:\n" + memBlock);
            tokensUsed += memTokens;
            sources.push(`memory (${memories.length})`);
          }
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 4: Recent run outcomes (what agents did recently)
  if (config.includeRuns && tokensUsed < budget) {
    try {
      const runs = (await client.sql(
        `SELECT run_id, agent_id, goal, status, current_stage FROM workflow_run ORDER BY updated_at_micros DESC LIMIT 5`,
      )) as Record<string, unknown>[];

      if (runs.length > 0) {
        const runBlock = runs.map((r) =>
          `- ${r.run_id} (${r.agent_id}): "${sanitizeContext(String(r.goal), 60)}" → ${r.status}`,
        ).join("\n");

        const runTokens = estimateTokens(runBlock);
        if (tokensUsed + runTokens <= budget) {
          blocks.push(fenceContext("recent-runs", runBlock));
          plainParts.push("Recent runs:\n" + runBlock);
          tokensUsed += runTokens;
          sources.push(`runs (${runs.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 5: Learnings from past runs
  if (config.includeLearnings && tokensUsed < budget) {
    try {
      const learnings = (await client.sql(
        `SELECT title, content FROM memory_document WHERE source_kind = 'agent-learning' ORDER BY updated_at_micros DESC LIMIT 5`,
      )) as Record<string, unknown>[];

      if (learnings.length > 0) {
        const learnBlock = learnings.map((l) =>
          `- ${sanitizeContext(String(l.content), 150)}`,
        ).join("\n");

        const learnTokens = estimateTokens(learnBlock);
        if (tokensUsed + learnTokens <= budget) {
          blocks.push(fenceContext("agent-learnings", learnBlock));
          plainParts.push("Learnings:\n" + learnBlock);
          tokensUsed += learnTokens;
          sources.push(`learnings (${learnings.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 6: Repo conventions (from first-run scan)
  if (tokensUsed < budget) {
    try {
      const repoScans = (await client.sql(
        `SELECT title, content FROM memory_document WHERE source_kind = 'repo-scan' LIMIT 10`,
      )) as Record<string, unknown>[];

      if (repoScans.length > 0) {
        const scanBlock = repoScans.map((r) =>
          `[${r.title}]\n${r.content}`,
        ).join("\n\n");

        const scanTokens = estimateTokens(scanBlock);
        if (tokensUsed + scanTokens <= budget) {
          blocks.push(fenceContext("repo-conventions", scanBlock));
          tokensUsed += scanTokens;
          sources.push(`repo-scan (${repoScans.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 7: User-specific memories
  if (config.operatorId && tokensUsed < budget) {
    try {
      const userMems = (await client.sql(
        `SELECT title, content FROM memory_document WHERE agent_id = 'user_${sqlEscape(config.operatorId)}' AND namespace = 'user-memory' ORDER BY updated_at_micros DESC LIMIT 5`,
      )) as Array<{ title: string; content: string }>;
      if (userMems.length > 0) {
        const userContext = userMems.map((m) => `- ${m.title}: ${m.content}`).join("\n");
        const userTokens = estimateTokens(userContext);
        if (tokensUsed + userTokens <= budget) {
          blocks.push(fenceContext("user-preferences", userContext));
          plainParts.push("User preferences:\n" + userContext);
          tokensUsed += userTokens;
          sources.push("user-memories");
        }
      }
    } catch { /* best-effort */ }
  }

  // Priority 8: Active sessions (what's currently running)
  if (config.includeSessions && tokensUsed < budget) {
    try {
      const sessions = (await client.sql(
        `SELECT session_id, agent_id, sandbox_id, repo_url, turn_count FROM agent_session WHERE operator_id = '${sqlEscape(config.operatorId)}' AND status = 'active'`,
      )) as Record<string, unknown>[];

      if (sessions.length > 0) {
        const sesBlock = sessions.map((s) =>
          `- ${s.agent_id} session ${s.session_id} (${s.turn_count} turns)${s.repo_url ? ` repo: ${s.repo_url}` : ""}`,
        ).join("\n");

        const sesTokens = estimateTokens(sesBlock);
        if (tokensUsed + sesTokens <= budget) {
          blocks.push(fenceContext("active-sessions", sesBlock));
          plainParts.push("Active sessions:\n" + sesBlock);
          tokensUsed += sesTokens;
          sources.push(`sessions (${sessions.length})`);
        }
      }
    } catch { /* best-effort */ }
  }

  return {
    systemBlocks: blocks,
    plainSummary: plainParts.join("\n\n"),
    tokenEstimate: tokensUsed,
    sources,
  };
}

/**
 * Build a conversation summary from SpacetimeDB for passing through handoffs.
 * This is lighter than full context assembly — just the essentials.
 */
export async function buildHandoffContext(
  operatorId: string,
  goal: string,
): Promise<string> {
  try {
    const result = await assembleContext({
      operatorId,
      goal,
      tokenBudget: 2000,
      includeChat: true,
      includeRuns: true,
      includeMemory: true,
      includeLearnings: true,
      includeSessions: false,
      chatTurns: 6,
    });
    return result.plainSummary;
  } catch {
    return "";
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
