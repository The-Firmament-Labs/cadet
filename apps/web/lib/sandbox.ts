import { Sandbox } from "@vercel/sandbox";
import type { SandboxEnvironment } from "@starbridge/core";
import { createControlClient } from "./server";
import { getServerEnv } from "./env";
import { sqlEscape } from "./sql";
import type { SandboxRecord, SandboxStatus } from "./sandbox-types";

function getSandboxCredentials(vercelAccessToken: string) {
  return {
    token: vercelAccessToken,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };
}

async function updateSandboxStatus(
  sandboxId: string,
  status: SandboxStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    const client = createControlClient();
    await client.callReducer("update_sandbox_status", [
      sandboxId,
      status,
      Date.now(),
      JSON.stringify(extra ?? {}),
    ]);
  } catch (error) {
    console.error(`[sandbox] Failed to update status for ${sandboxId}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Ownership verification
// ---------------------------------------------------------------------------

export async function verifySandboxOwnership(
  sandboxId: string,
  operatorId: string,
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT operator_id FROM sandbox_instance WHERE sandbox_id = '${sqlEscape(sandboxId)}'`,
  )) as Record<string, unknown>[];

  if (rows.length === 0) {
    return { ok: false, error: "Sandbox not found", status: 404 };
  }
  if (String(rows[0]!.operator_id) !== operatorId) {
    return { ok: false, error: "Not your sandbox", status: 403 };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function createSandbox(opts: {
  vercelAccessToken: string;
  operatorId: string;
  agentId: string;
  runId?: string;
  environment?: SandboxEnvironment;
}): Promise<SandboxRecord> {
  // Check operator sandbox limit
  const client = createControlClient();
  const existing = (await client.sql(
    `SELECT sandbox_id FROM sandbox_instance WHERE operator_id = '${sqlEscape(opts.operatorId)}' AND status IN ('creating', 'running')`,
  )) as Record<string, unknown>[];

  if (existing.length >= getServerEnv().sandboxMaxPerOperator) {
    throw new Error(`Sandbox limit reached (${getServerEnv().sandboxMaxPerOperator} max per operator)`);
  }

  const credentials = getSandboxCredentials(opts.vercelAccessToken);
  const env = getServerEnv();
  const sandboxEnv = opts.environment;

  // Determine snapshot: agent-specific > global default > none
  const snapshotId = sandboxEnv?.snapshotId ?? env.sandboxDefaultTemplate;
  // Determine runtime: agent-specific > "node24"
  const runtime = sandboxEnv?.runtime ?? "node24";

  // Write a "creating" record first so failures are visible
  const tempId = `pending_${crypto.randomUUID()}`;
  const envMeta = sandboxEnv
    ? { runtime, packages: sandboxEnv.packages, vcpus: sandboxEnv.vcpus }
    : { runtime };
  await client.callReducer("create_sandbox", [
    tempId, opts.operatorId, opts.agentId, opts.runId ?? "", "creating", Date.now(), JSON.stringify(envMeta),
  ]);

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>>;
  try {
    sandbox = snapshotId
      ? await Sandbox.create({
          ...credentials,
          source: { type: "snapshot", snapshotId },
          timeout: 120_000,
        })
      : await Sandbox.create({
          ...credentials,
          runtime: runtime === "bun" ? "node24" : runtime === "python3" ? "node24" : runtime === "custom" ? "node24" : runtime,
          timeout: 120_000,
          ...(sandboxEnv?.env ? { env: sandboxEnv.env } : {}),
        });

    // If no snapshot, install packages for the agent's environment
    if (!snapshotId && sandboxEnv) {
      // System packages
      if (sandboxEnv.systemPackages?.length) {
        await sandbox.runCommand("sh", ["-c", `sudo dnf install -y --skip-broken ${sandboxEnv.systemPackages.join(" ")} 2>&1`]);
      }
      // Runtime-specific package manager
      if (sandboxEnv.packages?.length) {
        if (runtime === "bun") {
          await sandbox.runCommand("sh", ["-c", "curl -fsSL https://bun.sh/install | bash 2>&1"]);
          await sandbox.runCommand("sh", ["-c", `~/.bun/bin/bun add ${sandboxEnv.packages.join(" ")} 2>&1`]);
        } else if (runtime === "python3") {
          await sandbox.runCommand("pip3", ["install", ...sandboxEnv.packages]);
        } else {
          await sandbox.runCommand("npm", ["install", "-g", ...sandboxEnv.packages]);
        }
      }
      // Custom setup commands
      if (sandboxEnv.setupCommands?.length) {
        for (const cmd of sandboxEnv.setupCommands) {
          await sandbox.runCommand("sh", ["-c", cmd]);
        }
      }
    }
  } catch (error) {
    await updateSandboxStatus(tempId, "error", {
      reason: error instanceof Error ? error.message : "Sandbox creation failed",
    });
    throw error;
  }

  // Clean up the temp record — we'll create the real one with the actual sandboxId
  try { await client.callReducer("delete_sandbox", [tempId]); } catch { /* best-effort */ }

  const record: SandboxRecord = {
    sandboxId: sandbox.sandboxId,
    operatorId: opts.operatorId,
    agentId: opts.agentId,
    runId: opts.runId,
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {},
  };

  await client.callReducer("create_sandbox", [
    record.sandboxId,
    record.operatorId,
    record.agentId,
    record.runId ?? "",
    "running",
    Date.now(),
    "{}",
  ]);

  return record;
}

export async function runInSandbox(opts: {
  sandboxId: string;
  vercelAccessToken: string;
  command: string;
  args?: string[];
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const credentials = getSandboxCredentials(opts.vercelAccessToken);
  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });

  const result = await sandbox.runCommand(opts.command, opts.args ?? []);
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  const exitCode = result.exitCode;

  await updateSandboxStatus(opts.sandboxId, "running", { lastCommand: opts.command });

  return { stdout, stderr, exitCode };
}

export async function snapshotSandbox(opts: {
  sandboxId: string;
  vercelAccessToken: string;
  operatorId: string;
}): Promise<string> {
  const credentials = getSandboxCredentials(opts.vercelAccessToken);
  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });

  const snapshot = await sandbox.snapshot();
  const snapshotId = snapshot.snapshotId;

  // Store snapshot record
  const client = createControlClient();
  await client.callReducer("create_sandbox_snapshot", [
    snapshotId,
    opts.sandboxId,
    opts.operatorId,
    Date.now(),
  ]);

  await updateSandboxStatus(opts.sandboxId, "running", { snapshotId });

  return snapshotId;
}

export async function sleepSandbox(opts: {
  sandboxId: string;
  vercelAccessToken: string;
  operatorId: string;
}): Promise<string> {
  // Snapshot then stop
  const snapshotId = await snapshotSandbox(opts);

  const credentials = getSandboxCredentials(opts.vercelAccessToken);
  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });
  await sandbox.stop();

  await updateSandboxStatus(opts.sandboxId, "sleeping", { snapshotId });

  return snapshotId;
}

export async function wakeSandbox(opts: {
  snapshotId: string;
  vercelAccessToken: string;
  operatorId: string;
  agentId: string;
  runId?: string;
}): Promise<SandboxRecord> {
  const credentials = getSandboxCredentials(opts.vercelAccessToken);

  const sandbox = await Sandbox.create({
    ...credentials,
    source: { type: "snapshot", snapshotId: opts.snapshotId },
    timeout: 120_000,
  });

  const record: SandboxRecord = {
    sandboxId: sandbox.sandboxId,
    operatorId: opts.operatorId,
    agentId: opts.agentId,
    runId: opts.runId,
    snapshotId: opts.snapshotId,
    status: "running",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: { restoredFrom: opts.snapshotId },
  };

  const client = createControlClient();
  await client.callReducer("create_sandbox", [
    record.sandboxId,
    record.operatorId,
    record.agentId,
    record.runId ?? "",
    "running",
    Date.now(),
    JSON.stringify(record.metadata),
  ]);

  return record;
}

export async function stopSandbox(opts: {
  sandboxId: string;
  vercelAccessToken: string;
}): Promise<void> {
  try {
    const credentials = getSandboxCredentials(opts.vercelAccessToken);
    const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });
    await sandbox.stop();
  } catch {
    // Sandbox may already be stopped
  }

  await updateSandboxStatus(opts.sandboxId, "stopped");
}

// ---------------------------------------------------------------------------
// Watchdog
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Claude Code runner
// ---------------------------------------------------------------------------

export async function runCodingAgent(opts: {
  sandboxId: string;
  vercelAccessToken: string;
  goal: string;
  repoUrl?: string;
  branch?: string;
  apiKey?: string;
}): Promise<{ output: string; exitCode: number }> {
  const credentials = getSandboxCredentials(opts.vercelAccessToken);
  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });

  // Clone repo if specified
  if (opts.repoUrl) {
    const cloneResult = await sandbox.runCommand("git", [
      "clone", "--branch", opts.branch ?? "main", "--depth", "1",
      opts.repoUrl, "/workspace",
    ]);
    if (cloneResult.exitCode !== 0) {
      const stderr = await cloneResult.stderr();
      throw new Error(`Git clone failed: ${stderr}`);
    }
  } else {
    await sandbox.runCommand("mkdir", ["-p", "/workspace"]);
  }

  // Install Claude Code CLI (skip if already installed via snapshot)
  const whichResult = await sandbox.runCommand("which", ["claude"]);
  if (whichResult.exitCode !== 0) {
    await sandbox.runCommand("npm", ["install", "-g", "@anthropic-ai/claude-code"]);
  }

  // Build the environment with API key
  const envPrefix = opts.apiKey
    ? `ANTHROPIC_API_KEY='${opts.apiKey.replace(/'/g, "'\\''")}'`
    : "";

  // Run Claude Code in non-interactive mode
  const escapedGoal = opts.goal.replace(/'/g, "'\\''");
  const result = await sandbox.runCommand("sh", ["-c",
    `cd /workspace && ${envPrefix} claude --yes --print '${escapedGoal}'`,
  ]);

  const output = await result.stdout();
  const exitCode = result.exitCode;

  // Update sandbox status with last run info
  await updateSandboxStatus(opts.sandboxId, "running", {
    lastRun: { goal: opts.goal, exitCode, outputLength: output.length, timestamp: Date.now() },
  });

  return { output, exitCode };
}

// ---------------------------------------------------------------------------
// Watchdog
// ---------------------------------------------------------------------------

export async function runSandboxWatchdog(): Promise<{
  checked: number;
  queued: number;
  errored: number;
}> {
  const client = createControlClient();
  const rows = (await client.sql(
    `SELECT sandbox_id, operator_id, agent_id, updated_at_micros, metadata_json FROM sandbox_instance WHERE status = 'running'`,
  )) as Record<string, unknown>[];

  const idleTimeout = getServerEnv().sandboxIdleTimeoutMs;
  const now = Date.now();
  let queued = 0;
  let errored = 0;

  for (const row of rows) {
    const sandboxId = String(row.sandbox_id);
    const operatorId = String(row.operator_id);
    const agentId = String(row.agent_id);
    const updatedAt = Number(row.updated_at_micros ?? 0);
    const isIdle = now - updatedAt > idleTimeout;

    if (isIdle) {
      try {
        // Queue a lifecycle message to sleep the sandbox
        // The queue consumer has access to the operator's token context
        const { sendToAgentLifecycle } = await import("./queue");
        const { getVercelAccessToken } = await import("./token-store");
        const token = await getVercelAccessToken(operatorId) ?? "";
        await sendToAgentLifecycle({
          sandboxId,
          action: "sleep",
          operatorId,
          agentId,
          vercelAccessToken: token,
        });
        await updateSandboxStatus(sandboxId, "sleeping", { reason: "idle-timeout", queuedAt: now });
        queued++;
      } catch {
        await updateSandboxStatus(sandboxId, "error", { reason: "watchdog-queue-failed" });
        errored++;
      }
    }
  }

  return { checked: rows.length, queued, errored };
}
