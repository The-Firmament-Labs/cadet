/**
 * Cadet Agent Executor
 *
 * Runs coding agents inside Vercel Sandboxes.
 * Handles: agent installation, env setup, prompt execution, output parsing.
 */

import { Sandbox } from "@vercel/sandbox";
import { getAgentConfig, type AgentConfig } from "./registry";
import { parseAcpLine, parseRawOutput, type AgentOutputEvent } from "./output";
import { recordSessionTurn, isCancelRequested, clearCancel } from "./session";

function getSandboxCredentials(vercelAccessToken: string) {
  return {
    token: vercelAccessToken,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };
}

/** Install an agent inside a sandbox if not already present. */
export async function installAgent(
  sandbox: Awaited<ReturnType<typeof Sandbox.get>>,
  config: AgentConfig,
): Promise<boolean> {
  // Check if already installed
  const check = await sandbox.runCommand("sh", ["-c", config.checkCommand]);
  if (check.exitCode === 0) return false; // already installed

  // Install
  console.log(`[executor] Installing ${config.name}: ${config.installCommand}`);
  const install = await sandbox.runCommand("sh", ["-c", config.installCommand]);
  if (install.exitCode !== 0) {
    const stderr = await install.stderr();
    throw new Error(`Failed to install ${config.name}: ${stderr}`);
  }

  return true; // newly installed
}

/** Execute a prompt against an agent in a sandbox. */
export async function executeAgentPrompt(opts: {
  sandboxId: string;
  vercelAccessToken: string;
  agentId: string;
  prompt: string;
  sessionId: string;
  repoUrl?: string;
  branch?: string;
  apiKey?: string;
  workdir?: string;
}): Promise<{ events: AgentOutputEvent[]; exitCode: number; output: string }> {
  const config = getAgentConfig(opts.agentId);
  if (!config) throw new Error(`Unknown agent: ${opts.agentId}`);

  const credentials = getSandboxCredentials(opts.vercelAccessToken);
  const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });

  // Install agent if needed
  await installAgent(sandbox, config);

  // Clone repo if specified and not already cloned
  const workdir = opts.workdir ?? "/workspace";
  if (opts.repoUrl) {
    const lsResult = await sandbox.runCommand("ls", [workdir]);
    if (lsResult.exitCode !== 0) {
      await sandbox.runCommand("git", [
        "clone", "--branch", opts.branch ?? "main", "--depth", "1",
        opts.repoUrl, workdir,
      ]);
    }
  } else {
    await sandbox.runCommand("mkdir", ["-p", workdir]);
  }

  // Build environment
  const envParts: string[] = [];
  if (opts.apiKey) {
    envParts.push(`${config.apiKeyEnvVar}='${opts.apiKey.replace(/'/g, "'\\''")}'`);
  }
  const envPrefix = envParts.length > 0 ? envParts.join(" ") + " " : "";

  // Build the command
  const escapedPrompt = opts.prompt.replace(/'/g, "'\\''");
  const fullCommand = `cd ${workdir} && ${envPrefix}${config.command} '${escapedPrompt}'`;

  // Record the turn
  await recordSessionTurn(opts.sessionId, opts.prompt);

  // Execute
  const result = await sandbox.runCommand("sh", ["-c", fullCommand]);
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  const exitCode = result.exitCode;

  // Clear any cancel flag
  if (await isCancelRequested(opts.sessionId)) {
    await clearCancel(opts.sessionId);
  }

  // Parse output
  let events: AgentOutputEvent[];
  if (config.supportsAcp) {
    // ACP agents output newline-delimited JSON
    events = stdout
      .split("\n")
      .map(parseAcpLine)
      .filter((e): e is AgentOutputEvent => e !== null);

    if (events.length === 0 || events[events.length - 1]?.type !== "complete") {
      events.push({ type: "complete", stopReason: exitCode === 0 ? "end_turn" : "error", timestamp: Date.now() });
    }
  } else {
    // Non-ACP agents output raw text
    events = parseRawOutput(stdout);
  }

  // Add stderr as errors if present
  if (stderr.trim() && exitCode !== 0) {
    events.unshift({ type: "error", message: stderr.trim().slice(0, 500), timestamp: Date.now() });
  }

  return { events, exitCode, output: stdout };
}
