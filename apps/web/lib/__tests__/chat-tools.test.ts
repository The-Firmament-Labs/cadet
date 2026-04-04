/**
 * Tests for apps/web/lib/chat-tools.ts
 *
 * Strategy:
 *  - createControlClient (from ./server) is mocked to return a shared
 *    mockClient with controllable sql / callReducer stubs.
 *  - dispatchJobFromPayload (from ./server) is mocked at the module level.
 *  - Each tool's execute() function is called directly — no AI SDK wiring
 *    required because tool() from "ai" is also mocked to pass through.
 *  - fetch is stubbed where check_deployment is exercised.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Helper: execute a tool and cast the result (AI SDK v6 returns AsyncIterable union)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exec(tool: { execute?: (...args: any[]) => any }, input: Record<string, unknown>): Promise<any> {
  return tool.execute!(input, {} as never);
}

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const { mockClient, mockDispatchJobFromPayload } = vi.hoisted(() => ({
  mockClient: {
    sql: vi.fn(),
    callReducer: vi.fn(),
  },
  mockDispatchJobFromPayload: vi.fn(),
}));

vi.mock("../server", () => ({
  createControlClient: vi.fn(() => mockClient),
  dispatchJobFromPayload: mockDispatchJobFromPayload,
}));

// Pass "ai" tool() through transparently — we only care about execute()
vi.mock("ai", () => ({
  tool: (def: { execute: unknown; [key: string]: unknown }) => def,
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { chatTools } from "../chat-tools";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.callReducer.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// handoff_to_agent
// ---------------------------------------------------------------------------

describe("chatTools.handoff_to_agent — success", () => {
  it("calls dispatchJobFromPayload with the correct agentId and goal", async () => {
    mockDispatchJobFromPayload.mockResolvedValue({
      workflow: { runId: "run_abc123" },
    });

    await exec(chatTools.handoff_to_agent, { agentId: "voyager", goal: "Fix the bug" });

    expect(mockDispatchJobFromPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "voyager",
        goal: "Fix the bug",
      }),
    );
  });

  it("returns success=true and the runId from workflow.runId", async () => {
    mockDispatchJobFromPayload.mockResolvedValue({
      workflow: { runId: "run_abc123" },
    });

    const result = await exec(chatTools.handoff_to_agent, {
      agentId: "voyager",
      goal: "Fix the bug",
    });

    expect(result.success).toBe(true);
    expect(result.agentId).toBe("voyager");
    expect(result.runId).toBe("run_abc123");
  });

  it("falls back to workflowRunId when workflow.runId is absent", async () => {
    mockDispatchJobFromPayload.mockResolvedValue({ workflowRunId: "run_fallback" });

    const result = await exec(chatTools.handoff_to_agent, {
      agentId: "saturn",
      goal: "Deploy prod",
    });

    expect(result.success).toBe(true);
    expect(result.runId).toBe("run_fallback");
  });

  it("returns 'unknown' runId when no run id fields are present", async () => {
    mockDispatchJobFromPayload.mockResolvedValue({});

    const result = await exec(chatTools.handoff_to_agent, {
      agentId: "voyager",
      goal: "Do something",
    });

    expect(result.runId).toBe("unknown");
  });
});

describe("chatTools.handoff_to_agent — failure", () => {
  it("returns success=false with the error message when dispatch throws", async () => {
    mockDispatchJobFromPayload.mockRejectedValue(new Error("Agent offline"));

    const result = await exec(chatTools.handoff_to_agent, {
      agentId: "voyager",
      goal: "Fix the bug",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Agent offline");
  });

  it("returns a generic message for non-Error thrown values", async () => {
    mockDispatchJobFromPayload.mockRejectedValue("unexpected string");

    const result = await exec(chatTools.handoff_to_agent, {
      agentId: "saturn",
      goal: "Monitor infra",
    });

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// search_memory
// ---------------------------------------------------------------------------

describe("chatTools.search_memory — found", () => {
  it("returns found=true with shaped memory objects when rows exist", async () => {
    mockClient.sql.mockResolvedValue([
      {
        title: "Project spec",
        content: "Build a dashboard",
        agent_id: "cadet",
        namespace: "assistant",
      },
    ]);

    const result = await exec(chatTools.search_memory, { query: "dashboard" });

    expect(result.found).toBe(true);
    expect(result.count).toBe(1);
    expect(Array.isArray(result.memories)).toBe(true);
    expect(result.memories![0]).toMatchObject({
      title: "Project spec",
      agent: "cadet",
      namespace: "assistant",
    });
  });

  it("truncates memory content to 500 characters", async () => {
    const longContent = "x".repeat(1000);
    mockClient.sql.mockResolvedValue([
      { title: "Big memory", content: longContent, agent_id: "cadet", namespace: "n" },
    ]);

    const result = await exec(chatTools.search_memory, { query: "x" });
    expect(result.memories![0].content.length).toBe(500);
  });
});

describe("chatTools.search_memory — not found", () => {
  it("returns found=false when SQL returns no rows", async () => {
    mockClient.sql.mockResolvedValue([]);

    const result = await exec(chatTools.search_memory, { query: "nothing here" });

    expect(result.found).toBe(false);
    expect(result.message).toBeDefined();
  });

  it("returns found=false and an unavailable message when SQL throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("DB connection lost"));

    const result = await exec(chatTools.search_memory, { query: "anything" });

    expect(result.found).toBe(false);
    expect(typeof result.message).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// get_run_status
// ---------------------------------------------------------------------------

describe("chatTools.get_run_status — found", () => {
  it("returns found=true with run details when a row exists", async () => {
    mockClient.sql.mockResolvedValue([
      {
        run_id: "run_42",
        agent_id: "voyager",
        goal: "Write tests",
        status: "running",
        current_stage: "act",
      },
    ]);

    const result = await exec(chatTools.get_run_status, { runId: "run_42" });

    expect(result.found).toBe(true);
    expect(result.runId).toBe("run_42");
    expect(result.agent).toBe("voyager");
    expect(result.goal).toBe("Write tests");
    expect(result.status).toBe("running");
    expect(result.stage).toBe("act");
  });
});

describe("chatTools.get_run_status — not found", () => {
  it("returns found=false with a descriptive message when no rows match", async () => {
    mockClient.sql.mockResolvedValue([]);

    const result = await exec(chatTools.get_run_status, { runId: "run_unknown" });

    expect(result.found).toBe(false);
    expect(result.message).toContain("run_unknown");
  });

  it("returns found=false when SQL throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("timeout"));

    const result = await exec(chatTools.get_run_status, { runId: "run_xyz" });

    expect(result.found).toBe(false);
    expect(typeof result.message).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// remember
// ---------------------------------------------------------------------------

describe("chatTools.remember — success", () => {
  it("calls upsert_memory_document reducer with title and content", async () => {
    const result = await chatTools.remember.execute!({
      title: "User prefers dark mode",
      content: "Always use dark theme in UI",
    }, {} as never) as { stored: boolean; message: string };

    expect(result.stored).toBe(true);
    expect(result.message).toContain("User prefers dark mode");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(reducerName).toBe("upsert_memory_document");
    // args: [docId, agentId, namespace, source_kind, title, content, metadata]
    expect(args[3]).toBe("conversation");  // source_kind
    expect(args[4]).toBe("User prefers dark mode");  // title
    expect(args[5]).toBe("Always use dark theme in UI");  // content
  });
});

describe("chatTools.remember — failure", () => {
  it("returns stored=false when callReducer throws", async () => {
    mockClient.callReducer.mockRejectedValue(new Error("SpacetimeDB write failed"));

    const result = await chatTools.remember.execute!({
      title: "Note",
      content: "Something important",
    }, {} as never) as { stored: boolean; message: string };

    expect(result.stored).toBe(false);
    expect(typeof result.message).toBe("string");
  });
});
