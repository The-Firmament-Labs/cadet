import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────

// @vercel/sandbox
const mockSandboxRunCommand = vi.hoisted(() => vi.fn());
const mockSandboxGet = vi.hoisted(() => vi.fn());

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: mockSandboxGet,
  },
}));

// agent registry
const mockGetAgentConfig = vi.hoisted(() => vi.fn());

vi.mock("./registry", () => ({
  getAgentConfig: mockGetAgentConfig,
}));

// output parsers
const mockParseAcpLine = vi.hoisted(() => vi.fn());
const mockParseRawOutput = vi.hoisted(() => vi.fn());

vi.mock("./output", () => ({
  parseAcpLine: mockParseAcpLine,
  parseRawOutput: mockParseRawOutput,
}));

// session
const mockRecordSessionTurn = vi.hoisted(() => vi.fn());
const mockIsCancelRequested = vi.hoisted(() => vi.fn());
const mockClearCancel = vi.hoisted(() => vi.fn());

vi.mock("./session", () => ({
  recordSessionTurn: mockRecordSessionTurn,
  isCancelRequested: mockIsCancelRequested,
  clearCancel: mockClearCancel,
}));

// mission-brief
const mockGenerateMissionBrief = vi.hoisted(() => vi.fn());
const mockWriteMissionBrief = vi.hoisted(() => vi.fn());
const mockRunVerification = vi.hoisted(() => vi.fn());

vi.mock("./mission-brief", () => ({
  generateMissionBrief: mockGenerateMissionBrief,
  writeMissionBrief: mockWriteMissionBrief,
  runVerification: mockRunVerification,
}));

import { installAgent, executeAgentPrompt } from "./executor";
import type { AgentConfig } from "./registry";

// ── Helpers ───────────────────────────────────────────────────────────

const mockAgentConfig: AgentConfig = {
  id: "claude-code",
  name: "Claude Code",
  command: "claude --yes --print",
  installCommand: "npm install -g @anthropic-ai/claude-code",
  checkCommand: "which claude",
  capabilities: ["code"],
  defaultModel: "anthropic/claude-sonnet-4.5",
  supportsAcp: false,
  apiKeyEnvVar: "ANTHROPIC_API_KEY",
  description: "Test agent",
};

const mockAcpAgentConfig: AgentConfig = {
  ...mockAgentConfig,
  id: "codex",
  name: "Codex CLI",
  command: "codex --quiet",
  supportsAcp: true,
};

function makeSandbox(options: {
  checkExitCode?: number;
  installExitCode?: number;
  runExitCode?: number;
  stdout?: string;
  stderr?: string;
} = {}) {
  const {
    checkExitCode = 0,
    installExitCode = 0,
    runExitCode = 0,
    stdout = "done",
    stderr = "",
  } = options;

  let callCount = 0;

  mockSandboxRunCommand.mockImplementation(async () => {
    callCount++;
    const isFirst = callCount === 1;
    return {
      exitCode: isFirst ? checkExitCode : (callCount === 2 && checkExitCode !== 0 ? installExitCode : runExitCode),
      stdout: vi.fn().mockResolvedValue(stdout),
      stderr: vi.fn().mockResolvedValue(stderr),
    };
  });

  const sandbox = { runCommand: mockSandboxRunCommand };
  mockSandboxGet.mockResolvedValue(sandbox);
  return sandbox;
}

const defaultBrief = {
  claudeMd: "# Brief",
  cloneDepth: 0,
  setupCommands: [],
  verifyCommands: [],
  autoPr: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAgentConfig.mockReturnValue(mockAgentConfig);
  mockGenerateMissionBrief.mockResolvedValue(defaultBrief);
  mockWriteMissionBrief.mockResolvedValue(undefined);
  mockRecordSessionTurn.mockResolvedValue(undefined);
  mockIsCancelRequested.mockResolvedValue(false);
  mockClearCancel.mockResolvedValue(undefined);
  mockParseRawOutput.mockReturnValue([
    { type: "text", content: "done", timestamp: Date.now() },
    { type: "complete", stopReason: "end_turn", timestamp: Date.now() },
  ]);
});

// ── installAgent ──────────────────────────────────────────────────────

describe("installAgent", () => {
  it("skips install when checkCommand succeeds (exit code 0)", async () => {
    const sandbox = {
      runCommand: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: vi.fn().mockResolvedValue("/usr/bin/claude"),
        stderr: vi.fn().mockResolvedValue(""),
      }),
    };

    const installed = await installAgent(sandbox as never, mockAgentConfig);

    expect(installed).toBe(false);
    // Only the check command was called, not the install
    expect(sandbox.runCommand).toHaveBeenCalledOnce();
    expect(sandbox.runCommand.mock.calls[0]![1]).toContain(mockAgentConfig.checkCommand);
  });

  it("installs when checkCommand fails (exit code non-zero)", async () => {
    const sandbox = {
      runCommand: vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 1, // check fails
          stdout: vi.fn().mockResolvedValue(""),
          stderr: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          exitCode: 0, // install succeeds
          stdout: vi.fn().mockResolvedValue(""),
          stderr: vi.fn().mockResolvedValue(""),
        }),
    };

    const installed = await installAgent(sandbox as never, mockAgentConfig);

    expect(installed).toBe(true);
    expect(sandbox.runCommand).toHaveBeenCalledTimes(2);
    // Second call should use installCommand
    expect(sandbox.runCommand.mock.calls[1]![1]).toContain(mockAgentConfig.installCommand);
  });

  it("throws on install failure with stderr message", async () => {
    const sandbox = {
      runCommand: vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 1, // check fails
          stdout: vi.fn().mockResolvedValue(""),
          stderr: vi.fn().mockResolvedValue(""),
        })
        .mockResolvedValueOnce({
          exitCode: 1, // install fails
          stdout: vi.fn().mockResolvedValue(""),
          stderr: vi.fn().mockResolvedValue("npm ERR! not found"),
        }),
    };

    await expect(
      installAgent(sandbox as never, mockAgentConfig)
    ).rejects.toThrow("Failed to install Claude Code: npm ERR! not found");
  });
});

// ── executeAgentPrompt ────────────────────────────────────────────────

describe("executeAgentPrompt", () => {
  const baseOpts = {
    sandboxId: "sb_exec",
    vercelAccessToken: "tok_exec",
    agentId: "claude-code",
    prompt: "Add a unit test",
    sessionId: "ses_exec",
    operatorId: "op_exec",
  };

  it("throws for unknown agent ID", async () => {
    mockGetAgentConfig.mockReturnValueOnce(undefined);

    await expect(
      executeAgentPrompt({ ...baseOpts, agentId: "phantom-agent" })
    ).rejects.toThrow("Unknown agent: phantom-agent");
  });

  it("calls generateMissionBrief with goal and config", async () => {
    makeSandbox({ stdout: "output" });

    await executeAgentPrompt(baseOpts);

    expect(mockGenerateMissionBrief).toHaveBeenCalledOnce();
    const briefOpts = mockGenerateMissionBrief.mock.calls[0]![0] as Record<string, unknown>;
    expect(briefOpts.goal).toBe("Add a unit test");
    expect(briefOpts.operatorId).toBe("op_exec");
  });

  it("calls writeMissionBrief with sandbox and brief", async () => {
    makeSandbox({ stdout: "output" });

    await executeAgentPrompt(baseOpts);

    expect(mockWriteMissionBrief).toHaveBeenCalledOnce();
    const [sandboxArg, briefArg] = mockWriteMissionBrief.mock.calls[0]!;
    expect(briefArg).toBe(defaultBrief);
    expect(sandboxArg).toBeDefined();
  });

  it("records session turn with sessionId and prompt", async () => {
    makeSandbox({ stdout: "output" });

    await executeAgentPrompt(baseOpts);

    expect(mockRecordSessionTurn).toHaveBeenCalledWith("ses_exec", "Add a unit test");
  });

  it("parses raw output for non-ACP agents", async () => {
    mockGetAgentConfig.mockReturnValue({ ...mockAgentConfig, supportsAcp: false });
    makeSandbox({ stdout: "plain text output\nmore output" });

    const rawEvents = [
      { type: "text" as const, content: "plain text output", timestamp: 1 },
      { type: "complete" as const, stopReason: "end_turn", timestamp: 2 },
    ];
    mockParseRawOutput.mockReturnValueOnce(rawEvents);

    const result = await executeAgentPrompt(baseOpts);

    expect(mockParseRawOutput).toHaveBeenCalledWith("plain text output\nmore output");
    expect(mockParseAcpLine).not.toHaveBeenCalled();
    expect(result.events).toEqual(rawEvents);
  });

  it("parses ACP output for ACP agents", async () => {
    mockGetAgentConfig.mockReturnValue(mockAcpAgentConfig);

    const acpLine1 = '{"jsonrpc":"2.0","method":"session/update","params":{"content":{"type":"text","text":"working"}}}';
    const acpLine2 = '{"jsonrpc":"2.0","id":1,"result":{"stopReason":"end_turn"}}';
    makeSandbox({ stdout: `${acpLine1}\n${acpLine2}` });

    const acpEvent1 = { type: "text" as const, content: "working", timestamp: 1 };
    const acpEvent2 = { type: "complete" as const, stopReason: "end_turn", timestamp: 2 };

    mockParseAcpLine
      .mockReturnValueOnce(acpEvent1)
      .mockReturnValueOnce(acpEvent2);

    const result = await executeAgentPrompt({ ...baseOpts, agentId: "codex" });

    expect(mockParseAcpLine).toHaveBeenCalledTimes(2);
    expect(mockParseRawOutput).not.toHaveBeenCalled();
    expect(result.events).toContainEqual(acpEvent1);
  });

  it("appends complete event for ACP agents when no complete event found", async () => {
    mockGetAgentConfig.mockReturnValue(mockAcpAgentConfig);
    makeSandbox({ stdout: "" }); // empty stdout

    // No lines parse to events
    mockParseAcpLine.mockReturnValue(null);

    const result = await executeAgentPrompt({ ...baseOpts, agentId: "codex" });

    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent!.type).toBe("complete");
  });

  it("runs verification after successful execution when verifyCommands present", async () => {
    const briefWithVerify = {
      ...defaultBrief,
      verifyCommands: ["npm test"],
    };
    mockGenerateMissionBrief.mockResolvedValueOnce(briefWithVerify);
    mockRunVerification.mockResolvedValueOnce({
      passed: true,
      results: ["PASS: npm test\n"],
    });

    makeSandbox({ stdout: "output", runExitCode: 0 });

    const result = await executeAgentPrompt(baseOpts);

    expect(mockRunVerification).toHaveBeenCalledOnce();
    expect(result.verification).toBeDefined();
    expect(result.verification!.passed).toBe(true);
  });

  it("does not run verification when verifyCommands is empty", async () => {
    mockGenerateMissionBrief.mockResolvedValueOnce({ ...defaultBrief, verifyCommands: [] });
    makeSandbox({ stdout: "output" });

    const result = await executeAgentPrompt(baseOpts);

    expect(mockRunVerification).not.toHaveBeenCalled();
    expect(result.verification).toBeUndefined();
  });

  it("returns exitCode and raw output string", async () => {
    makeSandbox({ stdout: "agent output here", runExitCode: 0 });

    const result = await executeAgentPrompt(baseOpts);

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("agent output here");
  });

  it("adds stderr as error event when exitCode non-zero", async () => {
    // First call is check (installed), subsequent calls
    mockSandboxRunCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: vi.fn().mockResolvedValue(""), stderr: vi.fn().mockResolvedValue("") }) // checkCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: vi.fn().mockResolvedValue(""), stderr: vi.fn().mockResolvedValue("") }) // ls /workspace
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: vi.fn().mockResolvedValue(""),
        stderr: vi.fn().mockResolvedValue("command not found: claude"),
      }); // main command
    mockSandboxGet.mockResolvedValue({ runCommand: mockSandboxRunCommand });

    const result = await executeAgentPrompt(baseOpts);

    expect(result.exitCode).toBe(1);
    const errorEvent = result.events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === "error") {
      expect(errorEvent.message).toContain("command not found");
    }
  });

  it("clears cancel flag when cancel was requested", async () => {
    mockIsCancelRequested.mockResolvedValueOnce(true);
    makeSandbox({ stdout: "output" });

    await executeAgentPrompt(baseOpts);

    expect(mockClearCancel).toHaveBeenCalledWith("ses_exec");
  });

  it("does not clear cancel flag when no cancel was requested", async () => {
    mockIsCancelRequested.mockResolvedValueOnce(false);
    makeSandbox({ stdout: "output" });

    await executeAgentPrompt(baseOpts);

    expect(mockClearCancel).not.toHaveBeenCalled();
  });

  it("appends error event when verification fails", async () => {
    const briefWithVerify = { ...defaultBrief, verifyCommands: ["npm test"] };
    mockGenerateMissionBrief.mockResolvedValueOnce(briefWithVerify);
    mockRunVerification.mockResolvedValueOnce({
      passed: false,
      results: ["FAIL: npm test\nTest suite failed"],
    });

    makeSandbox({ stdout: "agent output", runExitCode: 0 });

    const result = await executeAgentPrompt(baseOpts);

    const verifyError = result.events.find(
      (e) => e.type === "error" && e.type === "error" && (e as { message: string }).message.includes("Verification failed")
    );
    expect(verifyError).toBeDefined();
  });
});
