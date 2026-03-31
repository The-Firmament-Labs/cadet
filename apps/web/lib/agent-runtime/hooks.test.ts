import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────
const mockSql = vi.hoisted(() => vi.fn());
const mockCallReducer = vi.hoisted(() => vi.fn());
const mockCreateControlClient = vi.hoisted(() =>
  vi.fn(() => ({ sql: mockSql, callReducer: mockCallReducer }))
);

vi.mock("../server", () => ({
  createControlClient: mockCreateControlClient,
}));

vi.mock("../sql", () => ({
  sqlEscape: (v: string) => v.replace(/'/g, "''"),
}));

import {
  executeHooks,
  registerHook,
  listHooks,
  toggleHook,
  deleteHook,
  type HookDefinition,
  type HookContext,
} from "./hooks";

// ── Helpers ───────────────────────────────────────────────────────────

function makeHookRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    hook_id: "hook_test_1",
    event: "prompt:before",
    name: "Test Hook",
    description: "A test hook",
    handler: "return 'hook ran';",
    enabled: true,
    priority: 10,
    operator_id: "op_1",
    ...overrides,
  };
}

const baseContext: HookContext = {
  event: "prompt:before",
  sessionId: "ses_1",
  operatorId: "op_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSql.mockResolvedValue([]);
  mockCallReducer.mockResolvedValue(undefined);
});

// ── executeHooks ──────────────────────────────────────────────────────

describe("executeHooks", () => {
  it("returns empty array when no hooks are registered for the event", async () => {
    mockSql.mockResolvedValueOnce([]);

    const results = await executeHooks("prompt:before", baseContext);
    expect(results).toHaveLength(0);
  });

  it("runs all hooks for the matching event and returns results", async () => {
    mockSql.mockResolvedValueOnce([
      makeHookRow({ hook_id: "hook_a", handler: "return 42;" }),
      makeHookRow({ hook_id: "hook_b", handler: "return 'hello';" }),
    ]);

    const results = await executeHooks("prompt:before", baseContext);

    expect(results).toHaveLength(2);
    expect(results[0]!.hookId).toBe("hook_a");
    expect(results[0]!.success).toBe(true);
    expect(results[0]!.output).toBe(42);
    expect(results[1]!.hookId).toBe("hook_b");
    expect(results[1]!.success).toBe(true);
    expect(results[1]!.output).toBe("hello");
  });

  it("catches errors in individual hooks without stopping others", async () => {
    mockSql.mockResolvedValueOnce([
      makeHookRow({ hook_id: "hook_bad", handler: "throw new Error('hook failed');" }),
      makeHookRow({ hook_id: "hook_good", handler: "return 'ok';" }),
    ]);

    const results = await executeHooks("prompt:before", baseContext);

    expect(results).toHaveLength(2);

    const bad = results.find((r) => r.hookId === "hook_bad");
    expect(bad!.success).toBe(false);
    expect(bad!.error).toContain("hook failed");

    const good = results.find((r) => r.hookId === "hook_good");
    expect(good!.success).toBe(true);
    expect(good!.output).toBe("ok");
  });

  it("respects priority ordering — higher priority runs first (order returned by DB)", async () => {
    // The DB orders by priority DESC, so we return them already sorted highest first
    mockSql.mockResolvedValueOnce([
      makeHookRow({ hook_id: "high_prio", priority: 100, handler: "return 'high';" }),
      makeHookRow({ hook_id: "low_prio", priority: 1, handler: "return 'low';" }),
    ]);

    const results = await executeHooks("prompt:before", baseContext);

    expect(results[0]!.hookId).toBe("high_prio");
    expect(results[1]!.hookId).toBe("low_prio");
  });

  it("records durationMs for each result", async () => {
    mockSql.mockResolvedValueOnce([
      makeHookRow({ handler: "return true;" }),
    ]);

    const results = await executeHooks("prompt:before", baseContext);

    expect(results[0]!.durationMs).toBeTypeOf("number");
    expect(results[0]!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("passes context to hook function", async () => {
    mockSql.mockResolvedValueOnce([
      makeHookRow({ handler: "return context.sessionId;" }),
    ]);

    const results = await executeHooks("prompt:before", {
      ...baseContext,
      sessionId: "ses_passed",
    });

    expect(results[0]!.output).toBe("ses_passed");
  });

  it("returns console logs as output when hook returns nothing", async () => {
    mockSql.mockResolvedValueOnce([
      makeHookRow({ handler: "console.log('logged message');" }),
    ]);

    const results = await executeHooks("prompt:before", baseContext);

    expect(results[0]!.success).toBe(true);
    expect(results[0]!.output).toEqual(["logged message"]);
  });

  it("queries DB with operator filter when operatorId is provided", async () => {
    mockSql.mockResolvedValueOnce([]);

    await executeHooks("session:start", { event: "session:start", operatorId: "op_xyz" });

    expect(mockSql).toHaveBeenCalledOnce();
    const query = mockSql.mock.calls[0]![0] as string;
    expect(query).toContain("op_xyz");
    expect(query).toContain("session:start");
  });

  it("uses system-only filter when no operatorId", async () => {
    mockSql.mockResolvedValueOnce([]);

    await executeHooks("run:start", { event: "run:start" });

    const query = mockSql.mock.calls[0]![0] as string;
    expect(query).toContain("system");
    expect(query).not.toContain("op_");
  });

  it("returns empty array when DB throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB down"));

    const results = await executeHooks("prompt:before", baseContext);
    expect(results).toHaveLength(0);
  });
});

// ── registerHook ──────────────────────────────────────────────────────

describe("registerHook", () => {
  it("calls create_agent_hook reducer with correct args", async () => {
    const hook: Omit<HookDefinition, "hookId"> = {
      event: "run:complete",
      name: "Notify on Complete",
      description: "Sends a notification when a run completes",
      handler: "console.log('done');",
      enabled: true,
      priority: 50,
      operatorId: "op_reg",
    };

    const hookId = await registerHook(hook);

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("create_agent_hook");
    expect(args[0]).toMatch(/^hook_/);
    expect(args[0]).toBe(hookId);
    expect(args[1]).toBe("run:complete");
    expect(args[2]).toBe("Notify on Complete");
    expect(args[3]).toBe("Sends a notification when a run completes");
    expect(args[4]).toBe("console.log('done');");
    expect(args[5]).toBe(true);
    expect(args[6]).toBe(50);
    expect(args[7]).toBe("op_reg");
  });

  it("returns a generated hookId starting with hook_", async () => {
    const hook: Omit<HookDefinition, "hookId"> = {
      event: "session:start",
      name: "Start Hook",
      description: "",
      handler: "",
      enabled: false,
      priority: 0,
      operatorId: "op_x",
    };

    const hookId = await registerHook(hook);
    expect(hookId).toMatch(/^hook_/);
  });
});

// ── listHooks ─────────────────────────────────────────────────────────

describe("listHooks", () => {
  it("queries by operator_id and returns mapped HookDefinitions", async () => {
    mockSql.mockResolvedValueOnce([
      makeHookRow({ hook_id: "h1", event: "run:start", operator_id: "op_list" }),
      makeHookRow({ hook_id: "h2", event: "run:complete", operator_id: "op_list" }),
    ]);

    const hooks = await listHooks("op_list");

    expect(mockSql).toHaveBeenCalledOnce();
    const query = mockSql.mock.calls[0]![0] as string;
    expect(query).toContain("op_list");

    expect(hooks).toHaveLength(2);
    expect(hooks[0]!.hookId).toBe("h1");
    expect(hooks[0]!.event).toBe("run:start");
    expect(hooks[1]!.hookId).toBe("h2");
  });

  it("maps row fields to camelCase HookDefinition shape", async () => {
    mockSql.mockResolvedValueOnce([makeHookRow()]);

    const [hook] = await listHooks("op_1");

    expect(hook!.hookId).toBe("hook_test_1");
    expect(hook!.event).toBe("prompt:before");
    expect(hook!.name).toBe("Test Hook");
    expect(hook!.description).toBe("A test hook");
    expect(hook!.handler).toBe("return 'hook ran';");
    expect(hook!.enabled).toBe(true);
    expect(hook!.priority).toBe(10);
    expect(hook!.operatorId).toBe("op_1");
  });

  it("returns empty array when DB throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB error"));
    const hooks = await listHooks("op_fail");
    expect(hooks).toHaveLength(0);
  });
});

// ── toggleHook ────────────────────────────────────────────────────────

describe("toggleHook", () => {
  it("calls toggle_agent_hook reducer with hookId and enabled flag", async () => {
    await toggleHook("hook_toggle_1", true);

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("toggle_agent_hook");
    expect(args[0]).toBe("hook_toggle_1");
    expect(args[1]).toBe(true);
  });

  it("passes false to disable a hook", async () => {
    await toggleHook("hook_disable", false);

    const [, args] = mockCallReducer.mock.calls[0]!;
    expect(args[1]).toBe(false);
  });
});

// ── deleteHook ────────────────────────────────────────────────────────

describe("deleteHook", () => {
  it("calls delete_agent_hook reducer with the hookId", async () => {
    await deleteHook("hook_del_1");

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("delete_agent_hook");
    expect(args[0]).toBe("hook_del_1");
  });
});
