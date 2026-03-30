import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

const sendToAgentLifecycle = vi.fn();
const getServerEnv = vi.fn(() => ({
  sandboxIdleTimeoutMs: 300_000,
  sandboxMaxPerOperator: 5,
  sandboxDefaultTemplate: undefined,
  sandboxExecutionEnabled: true,
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv,
}));

vi.mock("@/lib/queue", () => ({
  sendToAgentLifecycle,
}));

describe("runSandboxWatchdog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T12:00:00.000Z"));
    getServerEnv.mockReturnValue({
      sandboxIdleTimeoutMs: 300_000,
      sandboxMaxPerOperator: 5,
      sandboxDefaultTemplate: undefined,
      sandboxExecutionEnabled: true,
    });
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues sandboxes whose microsecond heartbeat exceeds the idle timeout", async () => {
    const nowMs = Date.now();
    mockClient.sql.mockResolvedValue([
      {
        sandbox_id: "sbx_1",
        operator_id: "op_1",
        agent_id: "agent_1",
        updated_at_micros: (nowMs - 301_000) * 1_000,
        metadata_json: "{}",
      },
    ]);

    const { runSandboxWatchdog } = await import("./sandbox");
    const report = await runSandboxWatchdog();

    expect(sendToAgentLifecycle).toHaveBeenCalledWith({
      sandboxId: "sbx_1",
      action: "sleep",
      operatorId: "op_1",
      agentId: "agent_1",
      vercelAccessToken: "",
    });
    expect(report).toEqual({ checked: 1, queued: 1, errored: 0 });
  });

  it("keeps recently updated sandboxes running", async () => {
    const nowMs = Date.now();
    mockClient.sql.mockResolvedValue([
      {
        sandbox_id: "sbx_2",
        operator_id: "op_2",
        agent_id: "agent_2",
        updated_at_micros: (nowMs - 30_000) * 1_000,
        metadata_json: "{}",
      },
    ]);

    const { runSandboxWatchdog } = await import("./sandbox");
    const report = await runSandboxWatchdog();

    expect(sendToAgentLifecycle).not.toHaveBeenCalled();
    expect(report).toEqual({ checked: 1, queued: 0, errored: 0 });
  });

  it("returns a no-op report when sandbox execution is disabled", async () => {
    getServerEnv.mockReturnValue({
      sandboxIdleTimeoutMs: 300_000,
      sandboxMaxPerOperator: 5,
      sandboxDefaultTemplate: undefined,
      sandboxExecutionEnabled: false,
    });

    const { runSandboxWatchdog } = await import("./sandbox");
    const report = await runSandboxWatchdog();

    expect(mockClient.sql).not.toHaveBeenCalled();
    expect(sendToAgentLifecycle).not.toHaveBeenCalled();
    expect(report).toEqual({ checked: 0, queued: 0, errored: 0 });
  });
});
