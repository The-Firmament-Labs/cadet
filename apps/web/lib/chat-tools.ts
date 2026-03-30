import { tool } from "ai";
import { z } from "zod";
import { createControlClient } from "./server";
import { dispatchJobFromPayload } from "./server";
import { sqlEscape } from "./sql";

export const chatTools = {
  handoff_to_agent: tool({
    description:
      "Delegate a task to a specialist agent. Use 'voyager' for coding tasks (write code, fix bugs, debug). Use 'saturn' for operations tasks (deploy, rollback, monitoring). Returns a run ID for tracking.",
    inputSchema: z.object({
      agentId: z.enum(["voyager", "saturn"]).describe("The specialist agent to delegate to"),
      goal: z.string().describe("The task description for the specialist agent"),
    }),
    execute: async ({ agentId, goal }) => {
      try {
        const result = await dispatchJobFromPayload({ agentId, goal });
        const runId =
          (result as Record<string, unknown>).workflow &&
          typeof (result as Record<string, unknown>).workflow === "object"
            ? ((result as Record<string, unknown>).workflow as Record<string, unknown>).runId
            : (result as Record<string, unknown>).workflowRunId;

        return {
          success: true,
          agentId,
          runId: runId ?? "unknown",
          message: `Task delegated to ${agentId}. Tracking as run ${runId ?? "unknown"}.`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Delegation failed",
        };
      }
    },
  }),

  search_memory: tool({
    description:
      "Search the knowledge base for information from previous conversations and agent runs. Use this when the user references something from the past or asks about stored knowledge.",
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
      "Check the status of a mission/run by its run ID. Use this when the user asks about an ongoing or completed task.",
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
        return {
          found: true,
          runId: String(run.run_id),
          agent: String(run.agent_id),
          goal: String(run.goal),
          status: String(run.status),
          stage: String(run.current_stage),
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
};
