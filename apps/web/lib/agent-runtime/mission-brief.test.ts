import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────
const mockSql = vi.hoisted(() => vi.fn());
const mockCallReducer = vi.hoisted(() => vi.fn());
const mockCreateControlClient = vi.hoisted(() =>
  vi.fn(() => ({ sql: mockSql, callReducer: mockCallReducer }))
);

const mockLoadMissionJournal = vi.hoisted(() => vi.fn());
const mockRenderJournalForPrompt = vi.hoisted(() => vi.fn());

vi.mock("../server", () => ({
  createControlClient: mockCreateControlClient,
}));

vi.mock("../sql", () => ({
  sqlEscape: (v: string) => v.replace(/'/g, "''"),
}));

vi.mock("./mission-journal", () => ({
  loadMissionJournal: mockLoadMissionJournal,
  renderJournalForPrompt: mockRenderJournalForPrompt,
}));

import {
  generateMissionBrief,
  writeMissionBrief,
  runVerification,
  type MissionBrief,
} from "./mission-brief";
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

const defaultMissionContext = {
  goal: "Fix the authentication bug",
  agentConfig: mockAgentConfig,
  operatorId: "op_mission",
};

const mockJournal = {
  operatorId: "op_mission",
  callsign: "Alpha One",
  flightPlan: {
    role: "Senior Developer",
    expertise: ["TypeScript", "React"],
    timezone: "UTC",
    communicationStyle: "direct",
  },
  shipsLog: [],
  standingOrders: ["Run tests before committing"],
  missionPatches: [],
  crewManifest: {},
  updatedAt: Date.now(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCallReducer.mockResolvedValue(undefined);
  mockSql.mockResolvedValue([]);
  mockLoadMissionJournal.mockResolvedValue(mockJournal);
  mockRenderJournalForPrompt.mockReturnValue("## Mission Journal\n- Standing Orders: ...");
});

// ── generateMissionBrief ──────────────────────────────────────────────

describe("generateMissionBrief", () => {
  it("includes goal in claudeMd", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);

    expect(brief.claudeMd).toContain("Fix the authentication bug");
  });

  it("includes '## Goal' section header", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).toContain("## Goal");
  });

  it("includes agent name and ID in header", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).toContain("Claude Code");
    expect(brief.claudeMd).toContain("claude-code");
  });

  it("includes additional context when provided", async () => {
    const brief = await generateMissionBrief({
      ...defaultMissionContext,
      context: "The bug was introduced in commit abc123",
    });

    expect(brief.claudeMd).toContain("## Additional Context");
    expect(brief.claudeMd).toContain("The bug was introduced in commit abc123");
  });

  it("does not include Additional Context section when context is not provided", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).not.toContain("## Additional Context");
  });

  it("loads and includes relevant memories when found", async () => {
    mockSql.mockResolvedValueOnce([
      {
        title: "Auth pattern",
        content: "We use HMAC-signed cookies for authentication in this project",
      },
    ]);

    const brief = await generateMissionBrief(defaultMissionContext);

    expect(brief.claudeMd).toContain("## Previous Learnings");
    expect(brief.claudeMd).toContain("Auth pattern");
  });

  it("does not include Previous Learnings when no memories found", async () => {
    mockSql.mockResolvedValueOnce([]);

    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).not.toContain("## Previous Learnings");
  });

  it("includes operator preferences when found", async () => {
    // First SQL call for memories, second for operator preferences
    mockSql
      .mockResolvedValueOnce([]) // no memories
      .mockResolvedValueOnce([
        { content: "Always use TypeScript strict mode" },
        { content: "Prefer functional components" },
      ]);

    const brief = await generateMissionBrief(defaultMissionContext);

    expect(brief.claudeMd).toContain("## Operator Preferences");
    expect(brief.claudeMd).toContain("Always use TypeScript strict mode");
    expect(brief.claudeMd).toContain("Prefer functional components");
  });

  it("does not include Operator Preferences when none found", async () => {
    mockSql.mockResolvedValue([]);

    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).not.toContain("## Operator Preferences");
  });

  it("includes success criteria section", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);

    expect(brief.claudeMd).toContain("## Success Criteria");
    expect(brief.claudeMd).toContain("The goal above is achieved");
  });

  it("includes rules section", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);

    expect(brief.claudeMd).toContain("## Rules");
    expect(brief.claudeMd).toContain("Do NOT create new files");
  });

  it("returns full clone depth of 0", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.cloneDepth).toBe(0);
  });

  it("returns setup commands when repoUrl is provided", async () => {
    const brief = await generateMissionBrief({
      ...defaultMissionContext,
      repoUrl: "https://github.com/org/repo",
    });

    expect(brief.setupCommands).toBeDefined();
    expect(brief.setupCommands.length).toBeGreaterThan(0);
    expect(brief.setupCommands.some((cmd) => cmd.includes("package.json"))).toBe(true);
  });

  it("returns empty setupCommands when no repoUrl", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.setupCommands).toHaveLength(0);
  });

  it("returns verifyCommands when repoUrl is provided", async () => {
    const brief = await generateMissionBrief({
      ...defaultMissionContext,
      repoUrl: "https://github.com/org/repo",
    });

    expect(brief.verifyCommands.length).toBeGreaterThan(0);
    expect(brief.verifyCommands.some((cmd) => cmd.includes("test"))).toBe(true);
  });

  it("injects Mission Journal section when journal loads", async () => {
    mockRenderJournalForPrompt.mockReturnValueOnce(
      "## Mission Journal — Alpha One\n\n## Standing Orders\n- Run tests"
    );

    const brief = await generateMissionBrief(defaultMissionContext);

    expect(mockLoadMissionJournal).toHaveBeenCalledWith("op_mission");
    expect(brief.claudeMd).toContain("Mission Journal");
  });

  it("proceeds without journal section when journal loading fails", async () => {
    mockLoadMissionJournal.mockRejectedValueOnce(new Error("journal unavailable"));

    // Should not throw
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).toContain("Fix the authentication bug");
  });

  it("sets autoPr to true when repoUrl is provided", async () => {
    const brief = await generateMissionBrief({
      ...defaultMissionContext,
      repoUrl: "https://github.com/org/repo",
    });

    expect(brief.autoPr).toBe(true);
  });

  it("sets autoPr to false when no repoUrl", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.autoPr).toBe(false);
  });

  it("includes model from agentConfig in header", async () => {
    const brief = await generateMissionBrief(defaultMissionContext);
    expect(brief.claudeMd).toContain("anthropic/claude-sonnet-4.5");
  });
});

// ── writeMissionBrief ─────────────────────────────────────────────────

describe("writeMissionBrief", () => {
  it("writes CLAUDE.md via sandbox runCommand", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "# Mission Brief\n\nGoal: Fix auth",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: [],
      autoPr: false,
    };

    await writeMissionBrief(sandbox, brief, "/workspace");

    expect(mockRunCommand).toHaveBeenCalledOnce();
    const [cmd, args] = mockRunCommand.mock.calls[0]!;
    expect(cmd).toBe("sh");
    const script = args[1] as string;
    expect(script).toContain("CLAUDE.md");
    expect(script).toContain("# Mission Brief");
  });

  it("runs setup commands in the workdir", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "# Brief",
      cloneDepth: 0,
      setupCommands: ["npm ci", "npm run build"],
      verifyCommands: [],
      autoPr: false,
    };

    await writeMissionBrief(sandbox, brief, "/workspace");

    // 1 call for CLAUDE.md + 2 for setup commands = 3 total
    expect(mockRunCommand).toHaveBeenCalledTimes(3);

    const setupCalls = mockRunCommand.mock.calls.slice(1);
    expect(setupCalls[0]![1].join(" ")).toContain("npm ci");
    expect(setupCalls[1]![1].join(" ")).toContain("npm run build");
  });

  it("uses /workspace as default workdir", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "# Brief",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: [],
      autoPr: false,
    };

    await writeMissionBrief(sandbox, brief);

    const [, args] = mockRunCommand.mock.calls[0]!;
    expect((args as string[]).join(" ")).toContain("/workspace");
  });

  it("runs no setup commands when setupCommands is empty", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({ exitCode: 0 });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "# Brief",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: [],
      autoPr: false,
    };

    await writeMissionBrief(sandbox, brief, "/workspace");
    // Only the CLAUDE.md write
    expect(mockRunCommand).toHaveBeenCalledOnce();
  });
});

// ── runVerification ───────────────────────────────────────────────────

describe("runVerification", () => {
  it("runs all verify commands and returns pass for all-passing", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: vi.fn().mockResolvedValue("All tests passed"),
    });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: ["npm test", "tsc --noEmit"],
      autoPr: false,
    };

    const result = await runVerification(sandbox, brief, "/workspace");

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatch(/^PASS:/);
    expect(result.results[1]).toMatch(/^PASS:/);
  });

  it("returns fail when any verify command exits non-zero", async () => {
    let callCount = 0;
    const mockRunCommand = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        exitCode: callCount === 1 ? 0 : 1, // first passes, second fails
        stdout: vi.fn().mockResolvedValue(callCount === 1 ? "ok" : "Tests failed"),
      };
    });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: ["npm test", "tsc --noEmit"],
      autoPr: false,
    };

    const result = await runVerification(sandbox, brief, "/workspace");

    expect(result.passed).toBe(false);
    expect(result.results[0]).toMatch(/^PASS:/);
    expect(result.results[1]).toMatch(/^FAIL:/);
  });

  it("includes command in result label", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: vi.fn().mockResolvedValue(""),
    });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: ["npm test"],
      autoPr: false,
    };

    const result = await runVerification(sandbox, brief, "/workspace");

    expect(result.results[0]).toContain("npm test");
  });

  it("truncates stdout to 500 chars in result", async () => {
    const longOutput = "x".repeat(1000);
    const mockRunCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: vi.fn().mockResolvedValue(longOutput),
    });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: ["npm test"],
      autoPr: false,
    };

    const result = await runVerification(sandbox, brief, "/workspace");
    // The label + 500 chars of output
    expect(result.results[0]!.length).toBeLessThanOrEqual("PASS: npm test\n".length + 500);
  });

  it("returns passed:true and empty results for empty verifyCommands", async () => {
    const mockRunCommand = vi.fn();
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: [],
      autoPr: false,
    };

    const result = await runVerification(sandbox, brief, "/workspace");

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(0);
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it("runs commands with cd to workdir", async () => {
    const mockRunCommand = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: vi.fn().mockResolvedValue(""),
    });
    const sandbox = { runCommand: mockRunCommand };

    const brief: MissionBrief = {
      claudeMd: "",
      cloneDepth: 0,
      setupCommands: [],
      verifyCommands: ["npm test"],
      autoPr: false,
    };

    await runVerification(sandbox, brief, "/my/workdir");

    const [cmd, args] = mockRunCommand.mock.calls[0]!;
    expect(cmd).toBe("sh");
    expect((args as string[]).join(" ")).toContain("/my/workdir");
  });
});
