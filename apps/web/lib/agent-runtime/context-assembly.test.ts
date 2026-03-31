import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSql } = vi.hoisted(() => ({
  mockSql: vi.fn(),
}));

vi.mock("../server", () => ({
  createControlClient: vi.fn(() => ({ sql: mockSql, callReducer: vi.fn() })),
}));

vi.mock("../sanitize", () => ({
  sanitizeContext: vi.fn((s: string) => s),
  fenceContext: vi.fn((label: string, content: string) => `<context source="${label}">\n${content}\n</context>`),
}));

import { assembleContext, buildHandoffContext } from "./context-assembly";

describe("assembleContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.mockResolvedValue([]);
  });

  it("returns empty context when no data exists", async () => {
    const result = await assembleContext({ operatorId: "op1" });
    expect(result.systemBlocks).toHaveLength(0);
    expect(result.plainSummary).toBe("");
    expect(result.sources).toHaveLength(0);
  });

  it("loads chat history as highest priority", async () => {
    mockSql.mockResolvedValueOnce([
      { role: "user", content: "fix the bug", metadata_json: "{}" },
      { role: "assistant", content: "I'll help with that", metadata_json: "{}" },
    ]);

    const result = await assembleContext({ operatorId: "op1", includeChat: true });

    expect(result.sources.some((s) => s.startsWith("chat"))).toBe(true);
    expect(result.systemBlocks[0]).toContain("recent-conversation");
    expect(result.systemBlocks[0]).toContain("fix the bug");
  });

  it("loads agent completion results", async () => {
    mockSql
      .mockResolvedValueOnce([]) // chat
      .mockResolvedValueOnce([
        { content: "Fixed the login bug", metadata_json: '{"runId":"run_1","source":"agent-completion"}' },
      ]);

    const result = await assembleContext({ operatorId: "op1" });

    expect(result.sources.some((s) => s.startsWith("agent-results"))).toBe(true);
    expect(result.plainSummary).toContain("Fixed the login bug");
  });

  it("loads relevant memories filtered by goal keywords", async () => {
    mockSql
      .mockResolvedValueOnce([]) // chat
      .mockResolvedValueOnce([]) // agent results
      .mockResolvedValueOnce([
        { title: "Auth patterns", content: "Uses WebAuthn for authentication" },
      ]);

    const result = await assembleContext({ operatorId: "op1", goal: "fix the authentication bug" });

    expect(result.sources.some((s) => s.startsWith("memory"))).toBe(true);
    expect(result.plainSummary).toContain("WebAuthn");
  });

  it("skips memories when goal has no keywords", async () => {
    const result = await assembleContext({ operatorId: "op1", goal: "do it" });

    // "do" and "it" are too short (< 4 chars), so no memory query
    const memCalls = mockSql.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes("memory_document") && String(c[0]).includes("LIKE"),
    );
    expect(memCalls).toHaveLength(0);
  });

  it("loads recent runs", async () => {
    // No goal → no memory query → runs is 3rd SQL call
    mockSql
      .mockResolvedValueOnce([]) // chat
      .mockResolvedValueOnce([]) // agent results
      .mockResolvedValueOnce([  // runs (no memory query since no goal)
        { run_id: "run_1", agent_id: "voyager", goal: "Fix login", status: "completed", current_stage: "learn" },
      ]);

    const result = await assembleContext({ operatorId: "op1" });

    expect(result.sources.some((s) => s.startsWith("runs"))).toBe(true);
  });

  it("loads learnings from past runs", async () => {
    mockSql
      .mockResolvedValueOnce([]) // chat
      .mockResolvedValueOnce([]) // agent results
      .mockResolvedValueOnce([]) // runs
      .mockResolvedValueOnce([
        { title: "Learning", content: "The auth module uses HMAC sessions" },
      ]);

    const result = await assembleContext({ operatorId: "op1" });

    expect(result.sources.some((s) => s.startsWith("learnings"))).toBe(true);
  });

  it("respects token budget — stops adding when full", async () => {
    // Return a lot of chat data
    const bigChat = Array.from({ length: 20 }, (_, i) => ({
      role: "user",
      content: "x".repeat(500),
      metadata_json: "{}",
    }));
    mockSql.mockResolvedValueOnce(bigChat);

    const result = await assembleContext({ operatorId: "op1", tokenBudget: 500 });

    // Should include chat but token estimate should be bounded
    expect(result.tokenEstimate).toBeLessThanOrEqual(600); // some overhead
  });

  it("includes active sessions info", async () => {
    mockSql
      .mockResolvedValueOnce([]) // chat
      .mockResolvedValueOnce([]) // agent results
      .mockResolvedValueOnce([]) // runs
      .mockResolvedValueOnce([]) // learnings
      .mockResolvedValueOnce([
        { session_id: "ses_1", agent_id: "claude-code", sandbox_id: "sbx_1", repo_url: "https://github.com/org/repo", turn_count: 3 },
      ]);

    const result = await assembleContext({ operatorId: "op1" });

    expect(result.sources.some((s) => s.startsWith("sessions"))).toBe(true);
    expect(result.plainSummary).toContain("claude-code");
  });

  it("handles SpacetimeDB errors gracefully", async () => {
    mockSql.mockRejectedValue(new Error("DB down"));

    const result = await assembleContext({ operatorId: "op1" });

    // Should return empty, not throw
    expect(result.systemBlocks).toHaveLength(0);
  });

  it("can disable individual sources", async () => {
    mockSql.mockResolvedValue([{ role: "user", content: "hello", metadata_json: "{}" }]);

    const result = await assembleContext({
      operatorId: "op1",
      includeChat: false,
      includeRuns: false,
      includeMemory: false,
      includeLearnings: false,
      includeSessions: false,
    });

    expect(result.sources).toHaveLength(0);
  });
});

describe("buildHandoffContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.mockResolvedValue([]);
  });

  it("returns a plain text summary for handoff", async () => {
    mockSql.mockResolvedValueOnce([
      { role: "user", content: "fix the bug", metadata_json: "{}" },
    ]);

    const result = await buildHandoffContext("op1", "fix the bug");

    expect(typeof result).toBe("string");
  });

  it("returns empty string on error", async () => {
    mockSql.mockRejectedValue(new Error("fail"));

    const result = await buildHandoffContext("op1", "goal");

    expect(result).toBe("");
  });
});
