/**
 * Message Taxonomy
 *
 * Structures all agent interactions into typed categories so we can
 * extract exactly the right context for each situation:
 *
 * - Debugging: pull the previous agent's response + tool calls
 * - Understanding intent: pull only user prompts
 * - Tracing decisions: pull agent reasoning + A2A handoff context
 * - Building follow-up context: pull agent results + PR URLs
 *
 * All messages are stored in SpacetimeDB with a `message_kind` field
 * that enables precise queries. The flat chat_message table becomes
 * a structured knowledge stream.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";
import { sanitizeContext } from "../sanitize";

// ── Message types ────────────────────────────────────────────────────

export type MessageKind =
  | "user_prompt"        // What the user asked for
  | "agent_response"     // Agent's final answer to the user
  | "agent_thinking"     // Agent's internal reasoning (not shown to user)
  | "agent_tool_call"    // Tool invocation + result
  | "a2a_handoff"        // Agent delegating to another agent (context passed)
  | "a2a_result"         // Result coming back from a delegated agent
  | "system_event";      // Platform events (run started, completed, failed)

export interface StructuredMessage {
  messageId: string;
  operatorId: string;
  runId?: string;
  kind: MessageKind;
  /** Who produced this message */
  actor: string;
  /** The content */
  content: string;
  /** Structured metadata */
  metadata: Record<string, unknown>;
  createdAt: number;
}

// ── Write: store structured messages ─────────────────────────────────

/**
 * Store a structured message in SpacetimeDB.
 * This is the single entry point for all message persistence.
 */
export async function storeMessage(msg: Omit<StructuredMessage, "messageId" | "createdAt">): Promise<string> {
  const client = createControlClient();
  const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  await client.callReducer("save_chat_message", [
    messageId,
    msg.operatorId,
    msg.runId ?? "default",
    msg.actor,
    msg.content,
    JSON.stringify({ ...msg.metadata, kind: msg.kind }),
  ]);

  return messageId;
}

/** Store the user's prompt with intent extraction. */
export async function storeUserPrompt(operatorId: string, content: string, metadata?: Record<string, unknown>): Promise<string> {
  return storeMessage({
    operatorId,
    kind: "user_prompt",
    actor: "user",
    content,
    metadata: { ...metadata },
  });
}

/** Store the agent's response to the user. */
export async function storeAgentResponse(operatorId: string, content: string, toolsUsed: string[], runId?: string): Promise<string> {
  return storeMessage({
    operatorId,
    runId,
    kind: "agent_response",
    actor: "cadet",
    content,
    metadata: { toolsUsed },
  });
}

/** Store agent thinking/reasoning (internal, not shown to user). */
export async function storeAgentThinking(operatorId: string, reasoning: string, runId: string, agentId: string): Promise<string> {
  return storeMessage({
    operatorId,
    runId,
    kind: "agent_thinking",
    actor: agentId,
    content: reasoning,
    metadata: {},
  });
}

/** Store a tool call with its input and output. */
export async function storeToolCall(operatorId: string, toolName: string, input: unknown, output: unknown, runId?: string): Promise<string> {
  return storeMessage({
    operatorId,
    runId,
    kind: "agent_tool_call",
    actor: "cadet",
    content: `Tool: ${toolName}`,
    metadata: { toolName, input, output },
  });
}

/** Store a handoff from one agent to another with the context passed. */
export async function storeHandoff(
  operatorId: string,
  fromAgent: string,
  toAgent: string,
  goal: string,
  contextPassed: string,
  runId: string,
): Promise<string> {
  return storeMessage({
    operatorId,
    runId,
    kind: "a2a_handoff",
    actor: fromAgent,
    content: `Handoff to ${toAgent}: ${goal}`,
    metadata: { fromAgent, toAgent, goal, contextLength: contextPassed.length },
  });
}

/** Store the result coming back from a delegated agent. */
export async function storeAgentResult(
  operatorId: string,
  agentId: string,
  runId: string,
  summary: string,
  prUrl?: string,
  extra?: { branch?: string; filesChanged?: string[] },
): Promise<string> {
  return storeMessage({
    operatorId,
    runId,
    kind: "a2a_result",
    actor: agentId,
    content: summary,
    metadata: { agentId, runId, prUrl, branch: extra?.branch, filesChanged: extra?.filesChanged, source: "agent-completion" },
  });
}

/** Store a system event (run started, completed, failed). */
export async function storeSystemEvent(operatorId: string, event: string, runId?: string, metadata?: Record<string, unknown>): Promise<string> {
  return storeMessage({
    operatorId,
    runId,
    kind: "system_event",
    actor: "system",
    content: event,
    metadata: { ...metadata },
  });
}

// ── Read: query by message kind ──────────────────────────────────────

/** Get only user prompts — what the user actually asked for. */
export async function getUserPrompts(operatorId: string, limit: number = 10): Promise<StructuredMessage[]> {
  return queryByKind(operatorId, "user_prompt", limit);
}

/** Get only agent responses — the final answers. */
export async function getAgentResponses(operatorId: string, limit: number = 10): Promise<StructuredMessage[]> {
  return queryByKind(operatorId, "agent_response", limit);
}

/** Get agent thinking/reasoning for a specific run. */
export async function getAgentThinking(runId: string): Promise<StructuredMessage[]> {
  return queryByRun(runId, "agent_thinking");
}

/** Get tool calls for a specific run. */
export async function getToolCalls(runId: string): Promise<StructuredMessage[]> {
  return queryByRun(runId, "agent_tool_call");
}

/** Get all handoffs — who delegated what to whom. */
export async function getHandoffs(operatorId: string, limit: number = 10): Promise<StructuredMessage[]> {
  return queryByKind(operatorId, "a2a_handoff", limit);
}

/** Get agent results — what came back from delegated agents. */
export async function getAgentResults(operatorId: string, limit: number = 10): Promise<StructuredMessage[]> {
  return queryByKind(operatorId, "a2a_result", limit);
}

/** Get the full interaction trace for a specific run (all message kinds). */
export async function getRunTrace(runId: string): Promise<StructuredMessage[]> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT message_id, operator_id, role, content, metadata_json, created_at_micros FROM chat_message WHERE conversation_id = '${sqlEscape(runId)}' ORDER BY created_at_micros ASC LIMIT 100`,
  )) as Record<string, unknown>[];

  return rows.map(rowToMessage);
}

// ── Context builders: pull the right data for each situation ─────────

/**
 * Build debugging context: pull the previous agent's response,
 * tool calls, and any errors. Use when the user says
 * "what went wrong" or "debug that".
 */
export async function buildDebugContext(operatorId: string, runId?: string): Promise<string> {
  const parts: string[] = [];

  if (runId) {
    // Get the full trace for this run
    const trace = await getRunTrace(runId);
    const toolCalls = trace.filter((m) => m.kind === "agent_tool_call");
    const results = trace.filter((m) => m.kind === "a2a_result" || m.kind === "agent_response");
    const errors = trace.filter((m) => m.content.toLowerCase().includes("error") || m.content.toLowerCase().includes("fail"));

    if (toolCalls.length > 0) {
      parts.push("Tool calls:");
      for (const tc of toolCalls.slice(-5)) {
        const meta = tc.metadata as { toolName?: string; output?: unknown };
        parts.push(`  ${meta.toolName}: ${sanitizeContext(JSON.stringify(meta.output ?? "").slice(0, 200), 200)}`);
      }
    }

    if (errors.length > 0) {
      parts.push("Errors:");
      for (const e of errors.slice(-3)) {
        parts.push(`  ${sanitizeContext(e.content.slice(0, 200), 200)}`);
      }
    }

    if (results.length > 0) {
      parts.push("Results:");
      for (const r of results.slice(-2)) {
        parts.push(`  ${sanitizeContext(r.content.slice(0, 300), 300)}`);
      }
    }
  } else {
    // No specific run — get the most recent agent result
    const recent = await getAgentResults(operatorId, 1);
    if (recent.length > 0) {
      parts.push(`Last agent result: ${sanitizeContext(recent[0]!.content.slice(0, 300), 300)}`);
    }
  }

  return parts.join("\n");
}

/**
 * Build follow-up context: pull the user's original intent
 * and the agent's result. Use when the user says
 * "now add tests for that" or "deploy what was just fixed".
 */
export async function buildFollowUpContext(operatorId: string): Promise<string> {
  const parts: string[] = [];

  // Get the last user prompt (the original intent)
  const prompts = await getUserPrompts(operatorId, 3);
  if (prompts.length > 0) {
    parts.push("Recent user requests:");
    for (const p of prompts) {
      parts.push(`  - ${sanitizeContext(p.content.slice(0, 100), 100)}`);
    }
  }

  // Get the last agent result
  const results = await getAgentResults(operatorId, 2);
  if (results.length > 0) {
    parts.push("Recent agent results:");
    for (const r of results) {
      const meta = r.metadata as { prUrl?: string; runId?: string };
      parts.push(`  - ${sanitizeContext(r.content.slice(0, 150), 150)}${meta.prUrl ? ` (PR: ${meta.prUrl})` : ""}${meta.runId ? ` (run: ${meta.runId})` : ""}`);
    }
  }

  // Get recent handoffs (who did what)
  const handoffs = await getHandoffs(operatorId, 2);
  if (handoffs.length > 0) {
    parts.push("Recent delegations:");
    for (const h of handoffs) {
      const meta = h.metadata as { toAgent?: string; goal?: string };
      parts.push(`  - Delegated to ${meta.toAgent}: ${sanitizeContext(String(meta.goal ?? "").slice(0, 80), 80)}`);
    }
  }

  return parts.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────

async function queryByKind(operatorId: string, kind: MessageKind, limit: number): Promise<StructuredMessage[]> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT message_id, operator_id, role, content, metadata_json, created_at_micros FROM chat_message WHERE operator_id = '${sqlEscape(operatorId)}' AND metadata_json LIKE '%"kind":"${kind}"%' ORDER BY created_at_micros DESC LIMIT ${limit}`,
    )) as Record<string, unknown>[];

    return rows.reverse().map(rowToMessage);
  } catch {
    return [];
  }
}

async function queryByRun(runId: string, kind?: MessageKind): Promise<StructuredMessage[]> {
  try {
    const client = createControlClient();
    const kindFilter = kind ? `AND metadata_json LIKE '%"kind":"${kind}"%'` : "";
    const rows = (await client.sql(
      `SELECT message_id, operator_id, role, content, metadata_json, created_at_micros FROM chat_message WHERE conversation_id = '${sqlEscape(runId)}' ${kindFilter} ORDER BY created_at_micros ASC LIMIT 50`,
    )) as Record<string, unknown>[];

    return rows.map(rowToMessage);
  } catch {
    return [];
  }
}

function rowToMessage(row: Record<string, unknown>): StructuredMessage {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(String(row.metadata_json ?? "{}"));
  } catch { /* */ }

  return {
    messageId: String(row.message_id ?? ""),
    operatorId: String(row.operator_id ?? ""),
    runId: metadata.runId ? String(metadata.runId) : undefined,
    kind: (metadata.kind as MessageKind) ?? "agent_response",
    actor: String(row.role ?? "unknown"),
    content: String(row.content ?? ""),
    metadata,
    createdAt: Number(row.created_at_micros ?? 0) / 1000,
  };
}
