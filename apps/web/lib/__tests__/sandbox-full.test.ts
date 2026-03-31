/**
 * Tests for apps/web/lib/sandbox.ts
 *
 * Covers: verifySandboxOwnership, createSandbox, runCodingAgent.
 *
 * Strategy:
 *   - Mock @vercel/sandbox (Sandbox.create / Sandbox.get)
 *   - Mock @/lib/server (createControlClient)
 *   - Mock @/lib/env (getServerEnv)
 *   - Mock @/lib/queue (sendToAgentLifecycle) — used by watchdog, not tested here
 *
 * The sandbox.test.ts file already covers runSandboxWatchdog; this file
 * covers the remaining surface: verifySandboxOwnership, createSandbox,
 * and runCodingAgent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock: @vercel/sandbox
// ---------------------------------------------------------------------------

const mockRunCommand = vi.fn();
const mockStop = vi.fn();
const mockSnapshot = vi.fn();

const mockSandboxInstance = {
  sandboxId: "sbx_real_123",
  runCommand: mockRunCommand,
  stop: mockStop,
  snapshot: mockSnapshot,
};

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: vi.fn(),
    get: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/server
// ---------------------------------------------------------------------------

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/env
// ---------------------------------------------------------------------------

const mockGetServerEnv = vi.fn();

vi.mock("@/lib/env", () => ({
  getServerEnv: () => mockGetServerEnv(),
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/queue
// ---------------------------------------------------------------------------

vi.mock("@/lib/queue", () => ({
  sendToAgentLifecycle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: @starbridge/core — type import only, no runtime needs
// ---------------------------------------------------------------------------

vi.mock("@starbridge/core", () => ({}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { Sandbox } from "@vercel/sandbox";
import {
  verifySandboxOwnership,
  createSandbox,
  runCodingAgent,
  APP_STORE_SANDBOX_DISABLED_MESSAGE,
} from "../sandbox";

// ---------------------------------------------------------------------------
// Default env factory
// ---------------------------------------------------------------------------

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    sandboxExecutionEnabled: true,
    sandboxMaxPerOperator: 5,
    sandboxIdleTimeoutMs: 300_000,
    sandboxDefaultTemplate: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// verifySandboxOwnership
// ---------------------------------------------------------------------------

describe("verifySandboxOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
  });

  it("returns ok:true when sandbox exists and operatorId matches", async () => {
    mockClient.sql.mockResolvedValue([{ operator_id: "op_001" }]);

    const result = await verifySandboxOwnership("sbx_abc", "op_001");

    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false with 404 when sandbox is not found", async () => {
    mockClient.sql.mockResolvedValue([]);

    const result = await verifySandboxOwnership("sbx_missing", "op_001");

    expect(result).toEqual({ ok: false, error: "Sandbox not found", status: 404 });
  });

  it("returns ok:false with 403 when operatorId does not match", async () => {
    mockClient.sql.mockResolvedValue([{ operator_id: "op_other" }]);

    const result = await verifySandboxOwnership("sbx_abc", "op_001");

    expect(result).toEqual({ ok: false, error: "Not your sandbox", status: 403 });
  });

  it("queries the sandbox_instance table with the correct sandboxId", async () => {
    mockClient.sql.mockResolvedValue([{ operator_id: "op_001" }]);

    await verifySandboxOwnership("sbx_test'injected", "op_001");

    const [query] = mockClient.sql.mock.calls[0]!;
    expect(query).toContain("sandbox_instance");
    // SQL injection char should be escaped (single quote doubled)
    expect(query).toContain("''injected");
  });
});

// ---------------------------------------------------------------------------
// createSandbox
// ---------------------------------------------------------------------------

describe("createSandbox – success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
    mockClient.sql.mockResolvedValue([]); // no existing sandboxes
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(Sandbox.create).mockResolvedValue(mockSandboxInstance as never);
  });

  it("returns a SandboxRecord with the real sandboxId from Sandbox.create", async () => {
    const record = await createSandbox({
      vercelAccessToken: "tok_123",
      operatorId: "op_001",
      agentId: "agent_saturn",
    });

    expect(record.sandboxId).toBe("sbx_real_123");
    expect(record.operatorId).toBe("op_001");
    expect(record.agentId).toBe("agent_saturn");
    expect(record.status).toBe("running");
  });

  it("calls the 'create_sandbox' reducer twice — once for the temp record, once for the real record", async () => {
    await createSandbox({
      vercelAccessToken: "tok_123",
      operatorId: "op_001",
      agentId: "agent_saturn",
    });

    const createCalls = mockClient.callReducer.mock.calls.filter(([name]) => name === "create_sandbox");
    expect(createCalls).toHaveLength(2);

    // First call uses a temp ID (starts with 'pending_')
    expect(String(createCalls[0]![1][0])).toMatch(/^pending_/);
    // Second call uses the real sandboxId
    expect(createCalls[1]![1][0]).toBe("sbx_real_123");
  });

  it("calls the 'delete_sandbox' reducer for the temp record after real create", async () => {
    await createSandbox({
      vercelAccessToken: "tok_123",
      operatorId: "op_001",
      agentId: "agent_saturn",
    });

    const deleteCalls = mockClient.callReducer.mock.calls.filter(([name]) => name === "delete_sandbox");
    expect(deleteCalls).toHaveLength(1);
    expect(String(deleteCalls[0]![1][0])).toMatch(/^pending_/);
  });

  it("passes runId to the sandbox record when provided", async () => {
    const record = await createSandbox({
      vercelAccessToken: "tok_123",
      operatorId: "op_001",
      agentId: "agent_saturn",
      runId: "run_999",
    });

    expect(record.runId).toBe("run_999");
  });
});

describe("createSandbox – over limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv({ sandboxMaxPerOperator: 2 }));
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("throws when operator has reached the sandbox limit", async () => {
    mockClient.sql.mockResolvedValue([{ sandbox_id: "sbx_1" }, { sandbox_id: "sbx_2" }]);

    await expect(
      createSandbox({ vercelAccessToken: "tok", operatorId: "op_001", agentId: "a" }),
    ).rejects.toThrow(/Sandbox limit reached/);
  });

  it("does NOT call Sandbox.create when limit is reached", async () => {
    mockClient.sql.mockResolvedValue([{ sandbox_id: "sbx_1" }, { sandbox_id: "sbx_2" }]);

    await expect(
      createSandbox({ vercelAccessToken: "tok", operatorId: "op_001", agentId: "a" }),
    ).rejects.toThrow();

    expect(Sandbox.create).not.toHaveBeenCalled();
  });
});

describe("createSandbox – Sandbox.create failure writes error record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
    mockClient.sql.mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("calls update_sandbox_status with 'error' and re-throws when Sandbox.create throws", async () => {
    vi.mocked(Sandbox.create).mockRejectedValue(new Error("API rate limit"));

    await expect(
      createSandbox({ vercelAccessToken: "tok", operatorId: "op_001", agentId: "a" }),
    ).rejects.toThrow("API rate limit");

    const errorStatusCall = mockClient.callReducer.mock.calls.find(
      ([name, args]) => name === "update_sandbox_status" && args[1] === "error"
    );
    expect(errorStatusCall).toBeDefined();
  });
});

describe("createSandbox – disabled by APP_STORE_SAFE_MODE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv({ sandboxExecutionEnabled: false }));
  });

  it("throws the app store disabled message", async () => {
    await expect(
      createSandbox({ vercelAccessToken: "tok", operatorId: "op_001", agentId: "a" }),
    ).rejects.toThrow(APP_STORE_SANDBOX_DISABLED_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// runCodingAgent
// ---------------------------------------------------------------------------

function makeCommandResult(exitCode: number, stdoutValue: string, stderrValue = "") {
  return {
    exitCode,
    stdout: vi.fn().mockResolvedValue(stdoutValue),
    stderr: vi.fn().mockResolvedValue(stderrValue),
  };
}

describe("runCodingAgent – without repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("creates /workspace via mkdir when no repoUrl is given", async () => {
    // Call order (no repoUrl):
    //   1. mkdir -p /workspace
    //   2. which claude → exit 1 (not installed)
    //   3. npm install -g @anthropic-ai/claude-code
    //   4. sh -c ... claude run

    const runCommandMock = vi.fn()
      .mockResolvedValueOnce(makeCommandResult(0, ""))           // mkdir -p /workspace
      .mockResolvedValueOnce(makeCommandResult(1, ""))           // which claude → not found
      .mockResolvedValueOnce(makeCommandResult(0, ""))           // npm install -g @anthropic-ai/claude-code
      .mockResolvedValueOnce(makeCommandResult(0, "agent output")); // claude run

    mockSandboxInstance.runCommand = runCommandMock;
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandboxInstance as never);

    const result = await runCodingAgent({
      sandboxId: "sbx_abc",
      vercelAccessToken: "tok_123",
      goal: "Fix the bug",
    });

    expect(result.output).toBe("agent output");
    expect(result.exitCode).toBe(0);

    const mkdirCall = runCommandMock.mock.calls.find(
      ([cmd, args]) => cmd === "mkdir" && (args as string[]).includes("-p")
    );
    expect(mkdirCall).toBeDefined();
  });
});

describe("runCodingAgent – with repo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandboxInstance as never);
  });

  it("clones the repo when repoUrl is provided", async () => {
    mockSandboxInstance.runCommand = vi.fn()
      .mockResolvedValueOnce(makeCommandResult(0, ""))       // git clone
      .mockResolvedValueOnce(makeCommandResult(0, "claude")) // which claude → found
      .mockResolvedValueOnce(makeCommandResult(0, "output")); // claude run

    const result = await runCodingAgent({
      sandboxId: "sbx_abc",
      vercelAccessToken: "tok_123",
      goal: "Add tests",
      repoUrl: "https://github.com/org/repo",
      branch: "feature/tests",
    });

    expect(result.exitCode).toBe(0);

    const cloneCall = (mockSandboxInstance.runCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      ([cmd, args]) => cmd === "git" && args[0] === "clone"
    );
    expect(cloneCall).toBeDefined();
    expect(cloneCall![1]).toContain("https://github.com/org/repo");
    expect(cloneCall![1]).toContain("feature/tests");
  });

  it("throws when git clone fails", async () => {
    mockSandboxInstance.runCommand = vi.fn()
      .mockResolvedValueOnce(makeCommandResult(1, "", "fatal: repository not found"));

    await expect(
      runCodingAgent({
        sandboxId: "sbx_abc",
        vercelAccessToken: "tok_123",
        goal: "Add tests",
        repoUrl: "https://github.com/org/missing",
      }),
    ).rejects.toThrow(/Git clone failed/);
  });
});

describe("runCodingAgent – with API key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandboxInstance as never);
  });

  it("prefixes ANTHROPIC_API_KEY in the shell command when apiKey is provided", async () => {
    const runCommandMock = vi.fn()
      .mockResolvedValueOnce(makeCommandResult(0, ""))         // mkdir
      .mockResolvedValueOnce(makeCommandResult(0, "claude"))   // which claude
      .mockResolvedValueOnce(makeCommandResult(0, "done"));    // sh -c claude run

    mockSandboxInstance.runCommand = runCommandMock;

    await runCodingAgent({
      sandboxId: "sbx_abc",
      vercelAccessToken: "tok_123",
      goal: "Do something",
      apiKey: "sk-ant-test",
    });

    const shCall = runCommandMock.mock.calls.find(([cmd]) => cmd === "sh");
    expect(shCall).toBeDefined();
    const shellScript = shCall![1][1] as string;
    expect(shellScript).toContain("ANTHROPIC_API_KEY='sk-ant-test'");
  });

  it("omits ANTHROPIC_API_KEY prefix when apiKey is not provided", async () => {
    const runCommandMock = vi.fn()
      .mockResolvedValueOnce(makeCommandResult(0, ""))
      .mockResolvedValueOnce(makeCommandResult(0, "claude"))
      .mockResolvedValueOnce(makeCommandResult(0, "done"));

    mockSandboxInstance.runCommand = runCommandMock;

    await runCodingAgent({
      sandboxId: "sbx_abc",
      vercelAccessToken: "tok_123",
      goal: "Do something",
    });

    const shCall = runCommandMock.mock.calls.find(([cmd]) => cmd === "sh");
    const shellScript = shCall![1][1] as string;
    expect(shellScript).not.toContain("ANTHROPIC_API_KEY");
  });
});

describe("runCodingAgent – disabled by APP_STORE_SAFE_MODE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv({ sandboxExecutionEnabled: false }));
  });

  it("throws the app store disabled message", async () => {
    await expect(
      runCodingAgent({ sandboxId: "sbx_abc", vercelAccessToken: "tok", goal: "test" }),
    ).rejects.toThrow(APP_STORE_SANDBOX_DISABLED_MESSAGE);
  });
});

describe("runCodingAgent – skips claude install when already present", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue(makeEnv());
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(Sandbox.get).mockResolvedValue(mockSandboxInstance as never);
  });

  it("does not call npm install when 'which claude' exits 0", async () => {
    const runCommandMock = vi.fn()
      .mockResolvedValueOnce(makeCommandResult(0, ""))        // mkdir
      .mockResolvedValueOnce(makeCommandResult(0, "/usr/bin/claude")) // which claude → found
      .mockResolvedValueOnce(makeCommandResult(0, "output")); // claude run

    mockSandboxInstance.runCommand = runCommandMock;

    await runCodingAgent({ sandboxId: "sbx_abc", vercelAccessToken: "tok", goal: "test" });

    const npmInstallCall = runCommandMock.mock.calls.find(
      ([cmd, args]) => cmd === "npm" && args.includes("install")
    );
    expect(npmInstallCall).toBeUndefined();
  });
});
