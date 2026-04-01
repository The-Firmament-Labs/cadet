/**
 * Mission Brief Generator
 *
 * Assembles a CLAUDE.md (or equivalent context file) before spawning
 * a coding agent in a sandbox. This is the single highest-leverage
 * feature for agent effectiveness.
 *
 * A good mission brief turns a generic "fix the bug" into a fully
 * contextualized task with project knowledge, conventions, previous
 * learnings, and clear success criteria.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";
import { sanitizeContext } from "../sanitize";
import type { AgentConfig } from "./registry";

export interface MissionBrief {
  /** The CLAUDE.md content to write into the workspace */
  claudeMd: string;
  /** Git clone depth (0 = full history) */
  cloneDepth: number;
  /** Commands to run after clone (e.g., install deps, run setup) */
  setupCommands: string[];
  /** Commands to run after agent finishes (verification) */
  verifyCommands: string[];
  /** Whether to auto-create a PR on success */
  autoPr: boolean;
}

interface MissionContext {
  goal: string;
  agentConfig: AgentConfig;
  operatorId: string;
  repoUrl?: string;
  branch?: string;
  /** Extra context from the user */
  context?: string;
  /** Previous run learnings */
  previousRunId?: string;
}

/**
 * Generate a mission brief for a coding agent.
 */
export async function generateMissionBrief(opts: MissionContext): Promise<MissionBrief> {
  const sections: string[] = [];

  // Load Mission Journal for operator personality and preferences
  let journalSection = "";
  try {
    const { loadMissionJournal, renderJournalForPrompt } = await import("./mission-journal");
    const journal = await loadMissionJournal(opts.operatorId);
    journalSection = renderJournalForPrompt(journal);
  } catch { /* journal unavailable */ }

  // Header
  sections.push(`# Mission Brief`);
  sections.push(`Agent: ${opts.agentConfig.name} (${opts.agentConfig.id})`);
  sections.push(`Model: ${opts.agentConfig.defaultModel}`);
  sections.push("");

  // Inject Mission Journal
  if (journalSection) {
    sections.push(journalSection);
  }

  // Goal
  sections.push(`## Goal`);
  sections.push(opts.goal);
  sections.push("");

  // Context from user
  if (opts.context) {
    sections.push(`## Additional Context`);
    sections.push(opts.context);
    sections.push("");
  }

  // Previous learnings from memory
  const memories = await loadRelevantMemories(opts.goal, opts.operatorId);
  if (memories.length > 0) {
    sections.push(`## Previous Learnings`);
    sections.push("The following was learned from previous runs on this codebase:");
    sections.push("");
    for (const mem of memories) {
      sections.push(`- **${mem.title}**: ${mem.content.slice(0, 200)}`);
    }
    sections.push("");
  }

  // Previous run output (for follow-up tasks)
  if (opts.previousRunId) {
    try {
      const prevResult = (await client.sql(
        `SELECT content, metadata_json FROM chat_message WHERE conversation_id = '${sqlEscape(opts.previousRunId)}' AND metadata_json LIKE '%a2a_result%' ORDER BY created_at_micros DESC LIMIT 1`,
      )) as Record<string, unknown>[];
      if (prevResult.length > 0) {
        const content = sanitizeContext(String(prevResult[0]!.content), 500);
        let meta = "";
        try {
          const parsed = JSON.parse(String(prevResult[0]!.metadata_json ?? "{}")) as Record<string, unknown>;
          if (parsed.prUrl) meta += `\nPR: ${parsed.prUrl}`;
          if (parsed.branch) meta += `\nBranch: ${parsed.branch}`;
        } catch { /* */ }
        sections.push(`## Previous Run Output (${opts.previousRunId})`);
        sections.push(content + meta);
        sections.push("");
      }
    } catch { /* best-effort */ }
  }

  // Standing orders from Mission Journal
  try {
    const { loadMissionJournal } = await import("./mission-journal");
    const journal = await loadMissionJournal(opts.operatorId);
    if (journal.standingOrders.length > 0) {
      sections.push("## Standing Orders");
      for (const order of journal.standingOrders) {
        sections.push(`- ${sanitizeContext(order, 100)}`);
      }
      sections.push("");
    }
  } catch { /* best-effort */ }

  // Operator preferences
  const prefs = await loadOperatorPreferences(opts.operatorId);
  if (prefs.length > 0) {
    sections.push(`## Operator Preferences`);
    for (const pref of prefs) {
      sections.push(`- ${pref}`);
    }
    sections.push("");
  }

  // Success criteria
  sections.push(`## Success Criteria`);
  sections.push("1. The goal above is achieved");
  sections.push("2. All existing tests continue to pass");
  sections.push("3. No new linting errors introduced");
  sections.push("4. Changes are minimal and focused — don't refactor unrelated code");
  sections.push("5. Commit messages are clear and descriptive");
  sections.push("");

  // Rules
  sections.push(`## Rules`);
  sections.push("- Do NOT create new files unless strictly necessary");
  sections.push("- Do NOT add comments to code you didn't change");
  sections.push("- Do NOT add error handling for scenarios that can't happen");
  sections.push("- Prefer editing existing files over creating new ones");
  sections.push("- Match the existing code style exactly");
  sections.push("- If you're unsure about something, err on the side of doing less");
  sections.push("");

  // Determine setup and verify commands based on repo detection
  const setupCommands = detectSetupCommands(opts.repoUrl);
  const verifyCommands = detectVerifyCommands(opts.repoUrl);

  return {
    claudeMd: sections.join("\n"),
    cloneDepth: 0, // full history — agents need git log and blame
    setupCommands,
    verifyCommands,
    autoPr: Boolean(opts.repoUrl),
  };
}

async function loadRelevantMemories(
  goal: string,
  operatorId: string,
): Promise<Array<{ title: string; content: string }>> {
  try {
    const client = createControlClient();
    // Search for memories related to the goal keywords
    const keywords = goal.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
    if (keywords.length === 0) return [];

    const conditions = keywords.map((k) => `content LIKE '%${sqlEscape(k)}%'`).join(" OR ");
    const rows = (await client.sql(
      `SELECT title, content FROM memory_document WHERE (${conditions}) LIMIT 5`,
    )) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      title: sanitizeContext(String(r.title ?? ""), 100),
      content: sanitizeContext(String(r.content ?? ""), 300),
    }));
  } catch {
    return [];
  }
}

async function loadOperatorPreferences(operatorId: string): Promise<string[]> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT content FROM memory_document WHERE namespace = 'assistant' AND source_kind = 'conversation' AND agent_id = '${sqlEscape(operatorId)}' LIMIT 10`,
    )) as Array<Record<string, unknown>>;

    return rows.map((r) => sanitizeContext(String(r.content ?? ""), 200)).filter((c) => c.length > 0);
  } catch {
    return [];
  }
}

function detectSetupCommands(repoUrl?: string): string[] {
  if (!repoUrl) return [];

  // Common setup patterns — the agent will run these after clone
  return [
    "[ -f package.json ] && (command -v bun >/dev/null && bun install --frozen-lockfile || npm ci) || true",
    "[ -f requirements.txt ] && pip install -r requirements.txt || true",
    "[ -f Cargo.toml ] && cargo build || true",
  ];
}

function detectVerifyCommands(repoUrl?: string): string[] {
  if (!repoUrl) return [];

  return [
    "[ -f package.json ] && (command -v bun >/dev/null && bun run test || npm test) || true",
    "[ -f package.json ] && (command -v bun >/dev/null && bun run typecheck || npx tsc --noEmit) || true",
  ];
}

/**
 * Write the mission brief into a sandbox workspace.
 */
export async function writeMissionBrief(
  sandbox: { runCommand: (cmd: string, args: string[]) => Promise<{ exitCode: number }> },
  brief: MissionBrief,
  workdir: string = "/workspace",
): Promise<void> {
  // Write CLAUDE.md via base64 to avoid heredoc/shell injection
  const encoded = Buffer.from(brief.claudeMd, "utf-8").toString("base64");
  await sandbox.runCommand("sh", ["-c", `echo '${encoded}' | base64 -d > ${workdir}/CLAUDE.md`]);

  // Run setup commands
  for (const cmd of brief.setupCommands) {
    await sandbox.runCommand("sh", ["-c", `cd ${workdir} && ${cmd}`]);
  }
}

/**
 * Run verification commands after agent finishes.
 */
export async function runVerification(
  sandbox: { runCommand: (cmd: string, args: string[]) => Promise<{ exitCode: number; stdout: () => Promise<string> }> },
  brief: MissionBrief,
  workdir: string = "/workspace",
): Promise<{ passed: boolean; results: string[] }> {
  const results: string[] = [];
  let allPassed = true;

  for (const cmd of brief.verifyCommands) {
    const result = await sandbox.runCommand("sh", ["-c", `cd ${workdir} && ${cmd}`]);
    const output = await result.stdout();
    const passed = result.exitCode === 0;
    results.push(`${passed ? "PASS" : "FAIL"}: ${cmd}\n${output.slice(0, 500)}`);
    if (!passed) allPassed = false;
  }

  return { passed: allPassed, results };
}
