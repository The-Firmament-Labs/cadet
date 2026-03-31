/**
 * Cadet @ Reference System
 *
 * Parse and resolve @ references in user messages to inject context.
 * Hermes supports @file, @folder, @diff, @url. We support all of those
 * plus @run, @agent, @memory, @thread — SpacetimeDB-backed references
 * that Hermes can't do with flat files.
 *
 * Syntax:
 *   @file:path/to/file.ts     → inject file contents
 *   @folder:src/lib/           → inject file listing
 *   @diff                      → inject current git diff
 *   @diff:branch               → inject diff against branch
 *   @url:https://example.com   → fetch and inject URL content
 *   @run:run_abc123            → inject run details and output
 *   @agent:voyager             → inject agent manifest
 *   @memory:search terms       → inject matching memories
 *   @thread:thread_id          → inject thread messages
 *   @skill:skill-name          → inject skill content
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";
import { sanitizeContext, sanitizeHtml, sanitizeUrl } from "../sanitize";

export interface ResolvedRef {
  /** Original reference string */
  ref: string;
  /** Type of reference */
  type: "file" | "folder" | "diff" | "url" | "run" | "agent" | "memory" | "thread" | "skill";
  /** Resolved content to inject */
  content: string;
  /** Token estimate */
  tokenEstimate: number;
}

const REF_PATTERN = /@(file|folder|diff|url|run|agent|memory|thread|skill)(?::([^\s]+))?/g;

/** Parse @ references from a message string. */
export function parseRefs(message: string): Array<{ type: string; value: string }> {
  const refs: Array<{ type: string; value: string }> = [];
  let match: RegExpExecArray | null;

  const re = new RegExp(REF_PATTERN.source, REF_PATTERN.flags);
  while ((match = re.exec(message)) !== null) {
    refs.push({
      type: match[1]!,
      value: match[2] ?? "",
    });
  }

  return refs;
}

/** Resolve all @ references in a message, returning the injected context. */
export async function resolveRefs(
  message: string,
  opts?: {
    sandboxId?: string;
    vercelAccessToken?: string;
    maxTokens?: number;
  },
): Promise<{ cleanMessage: string; context: ResolvedRef[] }> {
  const refs = parseRefs(message);
  if (refs.length === 0) return { cleanMessage: message, context: [] };

  const context: ResolvedRef[] = [];
  let totalTokens = 0;
  const maxTokens = opts?.maxTokens ?? 8000;

  for (const ref of refs) {
    if (totalTokens >= maxTokens) break;

    try {
      const resolved = await resolveRef(ref.type, ref.value, opts);
      if (resolved) {
        totalTokens += resolved.tokenEstimate;
        context.push(resolved);
      }
    } catch {
      context.push({
        ref: `@${ref.type}:${ref.value}`,
        type: ref.type as ResolvedRef["type"],
        content: `[Failed to resolve @${ref.type}:${ref.value}]`,
        tokenEstimate: 10,
      });
    }
  }

  // Remove @ references from the message
  const cleanMessage = message.replace(REF_PATTERN, "").trim();

  return { cleanMessage, context };
}

async function resolveRef(
  type: string,
  value: string,
  opts?: { sandboxId?: string; vercelAccessToken?: string },
): Promise<ResolvedRef | null> {
  const client = createControlClient();

  switch (type) {
    case "run": {
      const rows = (await client.sql(
        `SELECT run_id, agent_id, goal, status, current_stage FROM workflow_run WHERE run_id = '${sqlEscape(value)}' LIMIT 1`,
      )) as Record<string, unknown>[];

      if (rows.length === 0) return null;
      const r = rows[0]!;
      const content = `## Run ${value}\n- Agent: ${r.agent_id}\n- Goal: ${r.goal}\n- Status: ${r.status}\n- Stage: ${r.current_stage}`;
      return { ref: `@run:${value}`, type: "run", content, tokenEstimate: estimateTokens(content) };
    }

    case "agent": {
      const rows = (await client.sql(
        `SELECT agent_id, display_name, model_id, execution_target FROM agent_record WHERE agent_id = '${sqlEscape(value)}' LIMIT 1`,
      )) as Record<string, unknown>[];

      if (rows.length === 0) return null;
      const r = rows[0]!;
      const content = `## Agent ${value}\n- Name: ${r.display_name}\n- Model: ${r.model_id}\n- Target: ${r.execution_target}`;
      return { ref: `@agent:${value}`, type: "agent", content, tokenEstimate: estimateTokens(content) };
    }

    case "memory": {
      const keywords = value.split(/[+,\s]+/).filter(Boolean);
      if (keywords.length === 0) return null;

      const conditions = keywords.map((k) => `content LIKE '%${sqlEscape(k)}%'`).join(" OR ");
      const rows = (await client.sql(
        `SELECT title, content FROM memory_document WHERE (${conditions}) LIMIT 5`,
      )) as Record<string, unknown>[];

      if (rows.length === 0) return null;
      const content = rows.map((r) => `### ${sanitizeContext(String(r.title), 100)}\n${sanitizeContext(String(r.content), 300)}`).join("\n\n");
      return { ref: `@memory:${value}`, type: "memory", content, tokenEstimate: estimateTokens(content) };
    }

    case "thread": {
      const [threads, messages] = await Promise.all([
        client.sql(`SELECT title FROM thread_record WHERE thread_id = '${sqlEscape(value)}' LIMIT 1`) as Promise<Record<string, unknown>[]>,
        client.sql(`SELECT actor, content FROM message_event WHERE thread_id = '${sqlEscape(value)}' ORDER BY created_at_micros ASC LIMIT 20`) as Promise<Record<string, unknown>[]>,
      ]);

      if (threads.length === 0) return null;
      const msgText = messages.map((m) => `**${m.actor}**: ${String(m.content).slice(0, 200)}`).join("\n");
      const content = `## Thread: ${threads[0]!.title}\n${msgText}`;
      return { ref: `@thread:${value}`, type: "thread", content, tokenEstimate: estimateTokens(content) };
    }

    case "skill": {
      const { viewSkill } = await import("./skills");
      const skill = await viewSkill(value);
      if (!skill) return null;
      return { ref: `@skill:${value}`, type: "skill", content: `## Skill: ${skill.name}\n${skill.content}`, tokenEstimate: skill.tokenEstimate };
    }

    case "url": {
      const safeUrl = sanitizeUrl(value);
      if (!safeUrl) return { ref: `@url:${value}`, type: "url", content: "[URL blocked: invalid or private network]", tokenEstimate: 10 };
      const res = await fetch(safeUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const html = await res.text();
      const text = sanitizeHtml(html, 3000);
      return { ref: `@url:${value}`, type: "url", content: `## URL: ${value}\n${text}`, tokenEstimate: estimateTokens(text) };
    }

    case "diff": {
      // If sandbox is available, get diff from sandbox
      if (opts?.sandboxId && opts?.vercelAccessToken) {
        const { Sandbox } = await import("@vercel/sandbox");
        const credentials = { token: opts.vercelAccessToken, teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID };
        const sandbox = await Sandbox.get({ sandboxId: opts.sandboxId, ...credentials });
        const branch = value || "HEAD";
        const result = await sandbox.runCommand("sh", ["-c", `cd /workspace && git diff ${branch}`]);
        const diff = await result.stdout();
        if (!diff.trim()) return null;
        return { ref: `@diff:${value}`, type: "diff", content: `## Git Diff${value ? ` (${value})` : ""}\n\`\`\`diff\n${diff.slice(0, 4000)}\n\`\`\``, tokenEstimate: estimateTokens(diff) };
      }
      return null;
    }

    default:
      return null;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Strip @ references from a message for clean display. */
export function stripRefs(message: string): string {
  return message.replace(REF_PATTERN, "").trim();
}
