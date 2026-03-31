/**
 * Cadet Agent Session Manager
 *
 * Manages persistent agent sessions in SpacetimeDB.
 * Sessions are scoped by operator + agent + repo URL.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export interface AgentSession {
  sessionId: string;
  operatorId: string;
  agentId: string;
  sandboxId: string;
  repoUrl: string;
  status: "active" | "closed" | "crashed";
  cancelRequested: boolean;
  turnCount: number;
  lastPrompt: string;
  createdAt: number;
  updatedAt: number;
}

/** Create a new agent session. */
export async function createAgentSession(opts: {
  operatorId: string;
  agentId: string;
  sandboxId: string;
  repoUrl?: string;
}): Promise<AgentSession> {
  const client = createControlClient();
  const sessionId = `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await client.callReducer("create_agent_session", [
    sessionId,
    opts.operatorId,
    opts.agentId,
    opts.sandboxId,
    opts.repoUrl ?? "",
    "active",
    Date.now(),
  ]);

  return {
    sessionId,
    operatorId: opts.operatorId,
    agentId: opts.agentId,
    sandboxId: opts.sandboxId,
    repoUrl: opts.repoUrl ?? "",
    status: "active",
    cancelRequested: false,
    turnCount: 0,
    lastPrompt: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Find an active session for this operator + agent + repo. */
export async function getActiveSession(
  operatorId: string,
  agentId: string,
  repoUrl?: string,
): Promise<AgentSession | null> {
  const client = createControlClient();
  const repoFilter = repoUrl
    ? `AND repo_url = '${sqlEscape(repoUrl)}'`
    : "";

  const rows = (await client.sql(
    `SELECT * FROM agent_session WHERE operator_id = '${sqlEscape(operatorId)}' AND agent_id = '${sqlEscape(agentId)}' AND status = 'active' ${repoFilter} ORDER BY updated_at_micros DESC LIMIT 1`,
  )) as Record<string, unknown>[];

  if (rows.length === 0) return null;
  return rowToSession(rows[0]!);
}

/** Load a session by ID. */
export async function loadAgentSession(sessionId: string): Promise<AgentSession | null> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT * FROM agent_session WHERE session_id = '${sqlEscape(sessionId)}'`,
  )) as Record<string, unknown>[];

  if (rows.length === 0) return null;
  return rowToSession(rows[0]!);
}

/** Close a session (soft-close — keeps history). */
export async function closeAgentSession(sessionId: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("update_agent_session_status", [sessionId, "closed", Date.now()]);
}

/** Mark a session as crashed. */
export async function markSessionCrashed(sessionId: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("update_agent_session_status", [sessionId, "crashed", Date.now()]);
}

/** Record a prompt turn on the session. */
export async function recordSessionTurn(sessionId: string, prompt: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("record_session_turn", [sessionId, prompt, Date.now()]);
}

/** Request cooperative cancellation. */
export async function requestCancel(sessionId: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("request_session_cancel", [sessionId, Date.now()]);
}

/** Check if cancel was requested. */
export async function isCancelRequested(sessionId: string): Promise<boolean> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT cancel_requested FROM agent_session WHERE session_id = '${sqlEscape(sessionId)}'`,
  )) as Record<string, unknown>[];

  return rows.length > 0 && Boolean(rows[0]!.cancel_requested);
}

/** Clear the cancel flag after handling. */
export async function clearCancel(sessionId: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("clear_session_cancel", [sessionId, Date.now()]);
}

/** Ensure a session exists — create if needed, return existing if found. */
export async function ensureSession(opts: {
  operatorId: string;
  agentId: string;
  sandboxId: string;
  repoUrl?: string;
}): Promise<{ session: AgentSession; created: boolean }> {
  const existing = await getActiveSession(opts.operatorId, opts.agentId, opts.repoUrl);
  if (existing) return { session: existing, created: false };

  const session = await createAgentSession(opts);
  return { session, created: true };
}

function rowToSession(row: Record<string, unknown>): AgentSession {
  return {
    sessionId: String(row.session_id ?? ""),
    operatorId: String(row.operator_id ?? ""),
    agentId: String(row.agent_id ?? ""),
    sandboxId: String(row.sandbox_id ?? ""),
    repoUrl: String(row.repo_url ?? ""),
    status: String(row.status ?? "active") as AgentSession["status"],
    cancelRequested: Boolean(row.cancel_requested),
    turnCount: Number(row.turn_count ?? 0),
    lastPrompt: String(row.last_prompt ?? ""),
    createdAt: Number(row.created_at_micros ?? 0) / 1000,
    updatedAt: Number(row.updated_at_micros ?? 0) / 1000,
  };
}
