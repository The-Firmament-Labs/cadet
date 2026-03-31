/**
 * Cadet Checkpoint & Rollback System
 *
 * Automatic snapshots of sandbox state before agent modifications.
 * Hermes uses local directory snapshots. We use Vercel Sandbox snapshots —
 * instant, full-VM checkpoints that can restore the entire filesystem.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export interface Checkpoint {
  checkpointId: string;
  sessionId: string;
  sandboxId: string;
  snapshotId: string;
  label: string;
  turnNumber: number;
  createdAt: number;
}

/** Create a checkpoint before agent runs. */
export async function createCheckpoint(opts: {
  sessionId: string;
  sandboxId: string;
  vercelAccessToken: string;
  label: string;
  turnNumber: number;
}): Promise<Checkpoint> {
  const { Sandbox } = await import("@vercel/sandbox");

  const credentials = {
    token: opts.vercelAccessToken,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };

  // Take a sandbox snapshot
  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });
  const snapshot = await sandbox.snapshot();

  const checkpointId = `ckpt_${Date.now().toString(36)}`;
  const client = createControlClient();
  await client.callReducer("create_checkpoint", [
    checkpointId,
    opts.sessionId,
    opts.sandboxId,
    snapshot.snapshotId,
    opts.label,
    opts.turnNumber,
    Date.now(),
  ]);

  return {
    checkpointId,
    sessionId: opts.sessionId,
    sandboxId: opts.sandboxId,
    snapshotId: snapshot.snapshotId,
    label: opts.label,
    turnNumber: opts.turnNumber,
    createdAt: Date.now(),
  };
}

/** List checkpoints for a session. */
export async function listCheckpoints(sessionId: string): Promise<Checkpoint[]> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT * FROM agent_checkpoint WHERE session_id = '${sqlEscape(sessionId)}' ORDER BY created_at_micros DESC LIMIT 20`,
  )) as Record<string, unknown>[];

  return rows.map((r) => ({
    checkpointId: String(r.checkpoint_id),
    sessionId: String(r.session_id),
    sandboxId: String(r.sandbox_id),
    snapshotId: String(r.snapshot_id),
    label: String(r.label),
    turnNumber: Number(r.turn_number ?? 0),
    createdAt: Number(r.created_at_micros ?? 0) / 1000,
  }));
}

/** Rollback a sandbox to a specific checkpoint. */
export async function rollbackToCheckpoint(
  checkpointId: string,
  vercelAccessToken: string,
): Promise<{ newSandboxId: string }> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT * FROM agent_checkpoint WHERE checkpoint_id = '${sqlEscape(checkpointId)}'`,
  )) as Record<string, unknown>[];

  if (rows.length === 0) throw new Error(`Checkpoint ${checkpointId} not found`);
  const ckpt = rows[0]!;

  const { Sandbox } = await import("@vercel/sandbox");
  const credentials = {
    token: vercelAccessToken,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };

  // Restore from snapshot — creates a new sandbox from the snapshot
  const restored = await Sandbox.create({
    snapshot: String(ckpt.snapshot_id),
    ...credentials,
  } as never);

  // Update session to point to the new sandbox
  await client.callReducer("update_agent_session_sandbox", [
    String(ckpt.session_id),
    restored.sandboxId,
    Date.now(),
  ]);

  return { newSandboxId: restored.sandboxId };
}
