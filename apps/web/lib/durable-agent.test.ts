/**
 * Tests for apps/web/lib/durable-agent.ts
 *
 * The step functions (routeStep, planStep, gatherStep, actStep, verifyStep,
 * summarizeStep, learnStep) are NOT exported individually. They are tested
 * through the public agentWorkflow() function.
 *
 * "use step" / "use workflow" directives are bare string literals and are
 * no-ops in a Node.js test environment.
 *
 * Strategy:
 *   - Mock createControlClient from @/lib/server
 *   - Mock streamText from ai
 *   - Mock runCodingAgent from @/lib/sandbox (dynamic import)
 *   - Mock bot-reply (dynamic import inside summarizeStep)
 *   - Mock @/lib/env for local-docker branch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock client
// ---------------------------------------------------------------------------

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
  stepCountIs: vi.fn((n: number) => n),
}));

// Dynamic imports inside actStep
vi.mock("@/lib/sandbox", () => ({
  runCodingAgent: vi.fn(),
}));

// Dynamic import inside summarizeStep
vi.mock("./bot-reply", () => ({
  replyToOrigin: vi.fn(),
}));

// Dynamic import inside local-docker branch
vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(() => ({ controlPlaneUrl: "http://localhost:3001" })),
}));

// Dynamic imports added for the enriched workflow stages
vi.mock("./agent-runtime/mission-journal", () => ({
  loadMissionJournal: vi.fn().mockResolvedValue({ standingOrders: [], shipsLog: [], missionPatches: [], crewManifest: {}, flightPlan: { role: "Dev", expertise: [], timezone: "UTC", communicationStyle: "direct" }, callsign: "Test" }),
}));

vi.mock("./agent-runtime/executor", () => ({
  executeAgentPrompt: vi.fn().mockResolvedValue({ output: "done", exitCode: 0, events: [], verification: { passed: true, results: [] } }),
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizeContext: vi.fn((s: string) => s),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { agentWorkflow } from "./durable-agent";
import { streamText } from "ai";
import { runCodingAgent } from "@/lib/sandbox";
import { replyToOrigin } from "./bot-reply";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStreamTextResult(text = "response text", toolCalls: unknown[] = []) {
  return {
    text: Promise.resolve(text),
    toolCalls: Promise.resolve(toolCalls),
  } as never;
}

const BASE_PARAMS = {
  jobId: "job_001",
  agentId: "agent_saturn",
  runId: "run_001",
  operatorId: "op_001",
  goal: "Write a test",
  model: "anthropic/claude-sonnet-4",
};

// ---------------------------------------------------------------------------
// routeStep — called first in agentWorkflow
// ---------------------------------------------------------------------------

describe("routeStep (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: streamText happy path (planStep + actStep + learnStep all call streamText)
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);
    // Default: SQL returns empty for everything after routeStep
    mockClient.sql.mockResolvedValue([]);
  });

  it("queries job table and calls update_run_stage with 'route'", async () => {
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }]) // routeStep SELECT
      .mockResolvedValue([]); // all other SQL calls

    mockClient.callReducer.mockResolvedValue(undefined);

    await agentWorkflow(BASE_PARAMS);

    const sqlCalls = mockClient.sql.mock.calls;
    expect(sqlCalls[0]![0]).toContain("job_001");

    const reducerCalls = mockClient.callReducer.mock.calls;
    const routeCall = reducerCalls.find((call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "route");
    expect(routeCall).toBeDefined();
  });

  it("throws when job is not found", async () => {
    mockClient.sql.mockResolvedValueOnce([]); // routeStep finds no rows
    mockClient.callReducer.mockResolvedValue(undefined);

    await expect(agentWorkflow(BASE_PARAMS)).rejects.toThrow("Job job_001 not found");
  });
});

// ---------------------------------------------------------------------------
// planStep — calls update_run_stage with 'plan'
// ---------------------------------------------------------------------------

describe("planStep (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);
  });

  it("calls update_run_stage with 'plan'", async () => {
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);

    await agentWorkflow(BASE_PARAMS);

    const planCall = mockClient.callReducer.mock.calls.find(
      (call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "plan"
    );
    expect(planCall).toBeDefined();
    expect(planCall![1][0]).toBe("run_001");
  });
});

// ---------------------------------------------------------------------------
// gatherStep — calls update_run_stage with 'gather', queries memory_document
// ---------------------------------------------------------------------------

describe("gatherStep (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);
  });

  it("calls update_run_stage with 'gather' and queries SpacetimeDB", async () => {
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }]) // route
      .mockResolvedValue([]); // all gather/plan/learn queries
    mockClient.callReducer.mockResolvedValue(undefined);

    const result = await agentWorkflow(BASE_PARAMS);

    const gatherCall = mockClient.callReducer.mock.calls.find(
      (call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "gather"
    );
    expect(gatherCall).toBeDefined();

    const gatherStage = result.stages.find((s) => s.stage === "gather") as { stage: string; contextItems: number };
    expect(typeof gatherStage?.contextItems).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// actStep — default streamText path
// ---------------------------------------------------------------------------

describe("actStep – default streamText path (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("calls streamText for actStep with correct model and goal", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("hello world") as ReturnType<typeof streamText>);

    await agentWorkflow({ ...BASE_PARAMS, model: "anthropic/claude-sonnet-4" });

    // streamText is called by planStep (haiku), actStep (user model), and learnStep (haiku)
    // Find the actStep call — it uses the user-specified model, not haiku
    const actCall = vi.mocked(streamText).mock.calls.find(
      ([opts]) => opts.model === "anthropic/claude-sonnet-4",
    );
    expect(actCall).toBeDefined();
    expect(actCall![0].prompt).toBe("Write a test");
  });

  it("uses default model when none is provided", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);

    const { model: _omit, ...paramsWithoutModel } = BASE_PARAMS;
    await agentWorkflow(paramsWithoutModel);

    // actStep uses the default model
    const actCall = vi.mocked(streamText).mock.calls.find(
      ([opts]) => opts.model === "anthropic/claude-sonnet-4.5",
    );
    expect(actCall).toBeDefined();
  });

  it("calls update_run_stage with 'act'", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);

    await agentWorkflow(BASE_PARAMS);

    const actCall = mockClient.callReducer.mock.calls.find(
      (call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "act"
    );
    expect(actCall).toBeDefined();
  });

  it("records tool calls via record_tool_call reducer", async () => {
    const toolCalls = [
      { toolName: "read_file", args: { path: "/tmp/foo" } },
    ];
    // planStep and learnStep use haiku, actStep uses the user model
    // All calls return the same mock but only actStep has tool calls
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("done", toolCalls) as ReturnType<typeof streamText>);

    await agentWorkflow(BASE_PARAMS);

    const tcCalls = mockClient.callReducer.mock.calls.filter((call) => call[0] === "record_tool_call");
    // Tool calls are recorded from actStep (and potentially planStep/learnStep mock returns them too)
    expect(tcCalls.length).toBeGreaterThanOrEqual(1);
    expect(tcCalls.some((call) => (call[1] as unknown[])?.[2] === "read_file")).toBe(true);
  });

  it("returns act stage with responseLength and toolCallCount", async () => {
    vi.mocked(streamText).mockReturnValue(
      makeStreamTextResult("a".repeat(42), [{ toolName: "x", args: {} }, { toolName: "y", args: {} }]) as ReturnType<typeof streamText>,
    );

    const result = await agentWorkflow(BASE_PARAMS);

    const actStage = result.stages.find((s) => s.stage === "act") as { stage: string; responseLength: number; toolCallCount: number };
    expect(actStage?.responseLength).toBe(42);
    expect(actStage?.toolCallCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// actStep — vercel-sandbox path
// ---------------------------------------------------------------------------

describe("actStep – vercel-sandbox path (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("calls executeAgentPrompt when execution is 'vercel-sandbox' and sandboxContext is provided", async () => {
    const { executeAgentPrompt } = await import("./agent-runtime/executor");

    await agentWorkflow({
      ...BASE_PARAMS,
      execution: "vercel-sandbox",
      sandboxContext: {
        sandboxId: "sbx_abc",
        vercelAccessToken: "tok_123",
        repoUrl: "https://github.com/org/repo",
        branch: "main",
      },
    });

    expect(executeAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxId: "sbx_abc",
        vercelAccessToken: "tok_123",
        prompt: "Write a test",
      }),
    );
  });

  it("uses executeAgentPrompt (not streamText) for sandbox execution in actStep", async () => {
    const { executeAgentPrompt } = await import("./agent-runtime/executor");

    await agentWorkflow({
      ...BASE_PARAMS,
      execution: "vercel-sandbox",
      sandboxContext: { sandboxId: "sbx_abc", vercelAccessToken: "tok_123" },
    });

    // actStep uses executeAgentPrompt for sandbox, planStep/learnStep still use streamText
    expect(executeAgentPrompt).toHaveBeenCalled();
  });

  it("returns model as 'claude-code' and correct exitCode in act stage", async () => {
    const result = await agentWorkflow({
      ...BASE_PARAMS,
      execution: "vercel-sandbox",
      sandboxContext: { sandboxId: "sbx_abc", vercelAccessToken: "tok_123" },
    });

    const actStage = result.stages.find((s) => s.stage === "act") as { stage: string; model: string; exitCode: number; responseLength: number };
    expect(actStage?.model).toBe("claude-code");
    expect(actStage?.exitCode).toBe(0);
    expect(actStage?.responseLength).toBe("done".length); // from executeAgentPrompt mock
  });

  it("falls through to streamText when sandboxContext is missing sandboxId", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);

    await agentWorkflow({
      ...BASE_PARAMS,
      execution: "vercel-sandbox",
      sandboxContext: { vercelAccessToken: "tok_123" }, // no sandboxId
    });

    expect(runCodingAgent).not.toHaveBeenCalled();
    expect(streamText).toHaveBeenCalled();
  });

  it("passes apiKey through to executeAgentPrompt when provided", async () => {
    const { executeAgentPrompt } = await import("./agent-runtime/executor");

    await agentWorkflow({
      ...BASE_PARAMS,
      execution: "vercel-sandbox",
      sandboxContext: { sandboxId: "sbx_abc", vercelAccessToken: "tok_123", apiKey: "sk-test" },
    });

    expect(executeAgentPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-test" }),
    );
  });
});

// ---------------------------------------------------------------------------
// verifyStep — calls update_run_stage with 'verify'
// ---------------------------------------------------------------------------

describe("verifyStep (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
  });

  it("calls update_run_stage with 'verify'", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("some text") as ReturnType<typeof streamText>);

    await agentWorkflow(BASE_PARAMS);

    const verifyCall = mockClient.callReducer.mock.calls.find(
      (call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "verify"
    );
    expect(verifyCall).toBeDefined();
  });

  it("returns verified=true when responseLength > 0", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("non-empty") as ReturnType<typeof streamText>);

    const result = await agentWorkflow(BASE_PARAMS);

    const verifyStage = result.stages.find((s) => s.stage === "verify") as { stage: string; verified: boolean };
    expect(verifyStage?.verified).toBe(true);
  });

  it("returns verified=false when response is empty", async () => {
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("") as ReturnType<typeof streamText>);

    const result = await agentWorkflow(BASE_PARAMS);

    const verifyStage = result.stages.find((s) => s.stage === "verify") as { stage: string; verified: boolean };
    expect(verifyStage?.verified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// summarizeStep — calls update_run_stage with 'summarize'
// ---------------------------------------------------------------------------

describe("summarizeStep (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);
  });

  it("calls update_run_stage with 'summarize'", async () => {
    await agentWorkflow(BASE_PARAMS);

    const sumCall = mockClient.callReducer.mock.calls.find(
      (call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "summarize"
    );
    expect(sumCall).toBeDefined();
  });

  it("calls replyToOrigin for non-web/non-system channels", async () => {
    vi.mocked(replyToOrigin).mockResolvedValue(undefined);

    await agentWorkflow({
      ...BASE_PARAMS,
      channel: "slack",
      channelThreadId: "C123_456",
    });

    expect(replyToOrigin).toHaveBeenCalledTimes(1);
    expect(replyToOrigin).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "slack", channelThreadId: "C123_456" }),
    );
  });

  it("does NOT call replyToOrigin for 'web' channel", async () => {
    await agentWorkflow({ ...BASE_PARAMS, channel: "web", channelThreadId: "web_thread" });

    expect(replyToOrigin).not.toHaveBeenCalled();
  });

  it("does NOT call replyToOrigin for 'system' channel", async () => {
    await agentWorkflow({ ...BASE_PARAMS, channel: "system", channelThreadId: "sys_thread" });

    expect(replyToOrigin).not.toHaveBeenCalled();
  });

  it("does NOT call replyToOrigin when channel is undefined", async () => {
    await agentWorkflow(BASE_PARAMS);

    expect(replyToOrigin).not.toHaveBeenCalled();
  });

  it("does not propagate replyToOrigin errors (non-fatal)", async () => {
    vi.mocked(replyToOrigin).mockRejectedValueOnce(new Error("reply failed"));

    await expect(
      agentWorkflow({ ...BASE_PARAMS, channel: "slack", channelThreadId: "C1_2" }),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// learnStep — calls update_run_stage with 'learn' and update_run_status with 'completed'
// ---------------------------------------------------------------------------

describe("learnStep (via agentWorkflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult() as ReturnType<typeof streamText>);
  });

  it("calls update_run_stage with 'learn'", async () => {
    await agentWorkflow(BASE_PARAMS);

    const learnStageCall = mockClient.callReducer.mock.calls.find(
      (call) => call[0] === "update_run_stage" && (call[1] as string[])?.[1] === "learn"
    );
    expect(learnStageCall).toBeDefined();
  });

  it("calls update_run_status with 'completed'", async () => {
    await agentWorkflow(BASE_PARAMS);

    const statusCall = mockClient.callReducer.mock.calls.find((call) => call[0] === "update_run_status");
    expect(statusCall).toBeDefined();
    expect((statusCall![1] as string[])[1]).toBe("completed");
  });

  it("returns completed=true", async () => {
    const result = await agentWorkflow(BASE_PARAMS);
    expect(result.completed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// agentWorkflow — full golden-path integration
// ---------------------------------------------------------------------------

describe("agentWorkflow – full golden path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns expected structure with all 7 stages", async () => {
    mockClient.sql
      .mockResolvedValueOnce([{ job_id: "job_001", run_id: "run_001" }])
      .mockResolvedValue([]);
    mockClient.callReducer.mockResolvedValue(undefined);
    vi.mocked(streamText).mockReturnValue(makeStreamTextResult("output") as ReturnType<typeof streamText>);

    const result = await agentWorkflow(BASE_PARAMS);

    expect(result.runId).toBe("run_001");
    expect(result.agentId).toBe("agent_saturn");
    expect(result.completed).toBe(true);
    expect(result.stages).toHaveLength(7);

    const stageNames = result.stages.map((s) => s.stage);
    expect(stageNames).toEqual(["route", "plan", "gather", "act", "verify", "summarize", "learn"]);
  });
});
