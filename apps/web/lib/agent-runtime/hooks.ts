/**
 * Cadet Event Hooks System
 *
 * Extensibility via pre/post lifecycle hooks.
 * Hermes uses Python handlers on disk. We use SpacetimeDB-stored hooks
 * with TypeScript handlers — versionable, shareable, and auditable.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export type HookEvent =
  | "session:start"
  | "session:end"
  | "prompt:before"
  | "prompt:after"
  | "tool:before"
  | "tool:after"
  | "checkpoint:created"
  | "run:start"
  | "run:complete"
  | "run:failed"
  | "approval:requested"
  | "approval:resolved";

export interface HookDefinition {
  hookId: string;
  event: HookEvent;
  name: string;
  description: string;
  /** JavaScript function body to execute */
  handler: string;
  /** Whether this hook is enabled */
  enabled: boolean;
  /** Priority (higher = runs first) */
  priority: number;
  /** Who created this hook */
  operatorId: string;
}

export interface HookContext {
  event: HookEvent;
  sessionId?: string;
  runId?: string;
  agentId?: string;
  operatorId?: string;
  prompt?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  [key: string]: unknown;
}

export interface HookResult {
  hookId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

/** Execute all hooks for an event. Non-blocking — errors don't stop execution. */
export async function executeHooks(
  event: HookEvent,
  context: HookContext,
): Promise<HookResult[]> {
  const hooks = await getHooksForEvent(event, context.operatorId);
  const results: HookResult[] = [];

  for (const hook of hooks) {
    const start = Date.now();
    try {
      // Create a sandboxed function from the handler
      const fn = new Function("context", "console", hook.handler);
      const logs: string[] = [];
      const safeConsole = {
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
        warn: (...args: unknown[]) => logs.push(`WARN: ${args.map(String).join(" ")}`),
        error: (...args: unknown[]) => logs.push(`ERROR: ${args.map(String).join(" ")}`),
      };

      const output = await Promise.resolve(fn(context, safeConsole));
      results.push({
        hookId: hook.hookId,
        success: true,
        output: output ?? (logs.length > 0 ? logs : undefined),
        durationMs: Date.now() - start,
      });
    } catch (error) {
      results.push({
        hookId: hook.hookId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      });
    }
  }

  return results;
}

/** Get all enabled hooks for an event, sorted by priority. */
async function getHooksForEvent(event: HookEvent, operatorId?: string): Promise<HookDefinition[]> {
  try {
    const client = createControlClient();
    const operatorFilter = operatorId
      ? `AND (operator_id = '${sqlEscape(operatorId)}' OR operator_id = 'system')`
      : "AND operator_id = 'system'";

    const rows = (await client.sql(
      `SELECT * FROM agent_hook WHERE event = '${sqlEscape(event)}' AND enabled = true ${operatorFilter} ORDER BY priority DESC`,
    )) as Record<string, unknown>[];

    return rows.map(rowToHook);
  } catch {
    return [];
  }
}

/** Register a new hook. */
export async function registerHook(hook: Omit<HookDefinition, "hookId">): Promise<string> {
  const client = createControlClient();
  const hookId = `hook_${Date.now().toString(36)}`;

  await client.callReducer("create_agent_hook", [
    hookId,
    hook.event,
    hook.name,
    hook.description,
    hook.handler,
    hook.enabled,
    hook.priority,
    hook.operatorId,
    Date.now(),
  ]);

  return hookId;
}

/** List all hooks for an operator. */
export async function listHooks(operatorId: string): Promise<HookDefinition[]> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT * FROM agent_hook WHERE operator_id = '${sqlEscape(operatorId)}' OR operator_id = 'system' ORDER BY event, priority DESC`,
    )) as Record<string, unknown>[];
    return rows.map(rowToHook);
  } catch {
    return [];
  }
}

/** Toggle a hook's enabled state. */
export async function toggleHook(hookId: string, enabled: boolean): Promise<void> {
  const client = createControlClient();
  await client.callReducer("toggle_agent_hook", [hookId, enabled, Date.now()]);
}

/** Delete a hook. */
export async function deleteHook(hookId: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("delete_agent_hook", [hookId]);
}

function rowToHook(r: Record<string, unknown>): HookDefinition {
  return {
    hookId: String(r.hook_id ?? ""),
    event: String(r.event ?? "") as HookEvent,
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    handler: String(r.handler ?? ""),
    enabled: Boolean(r.enabled),
    priority: Number(r.priority ?? 0),
    operatorId: String(r.operator_id ?? ""),
  };
}
