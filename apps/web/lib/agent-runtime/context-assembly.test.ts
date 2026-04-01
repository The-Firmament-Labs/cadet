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
    // Default: all queries return empty
    mockSql.mockResolvedValue([]);
  });

  it("returns empty context when no data exists", async () => {
    const result = await assembleContext({ operatorId: "op1" });
    expect(result.systemBlocks).toHaveLength(0);
    expect(result.sources).toHaveLength(0);
  });

  it("loads user prompts and agent responses separately", async () => {
    // The assembly queries by kind, but falls back to raw chat if no taxonomy messages
    // With empty taxonomy queries, it hits the fallback
    mockSql
      .mockResolvedValueOnce([]) // user_prompt query
      .mockResolvedValueOnce([]) // agent_response query
      .mockResolvedValueOnce([]) // a2a_result query
      .mockResolvedValueOnce([ // fallback raw chat
        { role: "user", content: "fix the bug" },
        { role: "assistant", content: "I'll help" },
      ]);

    const result = await assembleContext({ operatorId: "op1", includeChat: true });
    expect(result.sources.some((s) => s.includes("chat"))).toBe(true);
    expect(result.systemBlocks[0]).toContain("fix the bug");
  });

  it("loads taxonomy-typed user prompts when available", async () => {
    mockSql
      .mockResolvedValueOnce([ // user_prompt query
        { content: "fix the login bug", metadata_json: '{"kind":"user_prompt"}' },
      ])
      .mockResolvedValue([]); // rest empty

    const result = await assembleContext({ operatorId: "op1" });
    expect(result.sources.some((s) => s.includes("user-prompts"))).toBe(true);
    expect(result.systemBlocks[0]).toContain("user-requests");
    expect(result.systemBlocks[0]).toContain("fix the login bug");
  });

  it("loads taxonomy-typed agent responses", async () => {
    mockSql
      .mockResolvedValueOnce([]) // user_prompt
      .mockResolvedValueOnce([ // agent_response
        { content: "I fixed the bug", metadata_json: '{"kind":"agent_response","toolsUsed":["handoff_to_agent"]}' },
      ])
      .mockResolvedValue([]);

    const result = await assembleContext({ operatorId: "op1" });
    expect(result.sources.some((s) => s.includes("agent-responses"))).toBe(true);
    expect(result.systemBlocks.some((b) => b.includes("handoff_to_agent"))).toBe(true);
  });

  it("loads A2A results with run and PR metadata", async () => {
    mockSql
      .mockResolvedValueOnce([]) // user_prompt
      .mockResolvedValueOnce([]) // agent_response
      .mockResolvedValueOnce([ // a2a_result
        { content: "Fixed auth.ts", metadata_json: '{"kind":"a2a_result","runId":"run_1","prUrl":"https://github.com/pr/1","agentId":"voyager"}' },
      ])
      .mockResolvedValue([]);

    const result = await assembleContext({ operatorId: "op1" });
    expect(result.sources.some((s) => s.includes("a2a-results"))).toBe(true);
    expect(result.plainSummary).toContain("voyager");
    expect(result.plainSummary).toContain("run_1");
  });

  it("loads relevant memories filtered by goal keywords", async () => {
    mockSql
      .mockResolvedValueOnce([]) // user_prompt
      .mockResolvedValueOnce([]) // agent_response
      .mockResolvedValueOnce([]) // a2a_result
      .mockResolvedValueOnce([]) // fallback chat (skipped since we have no sources but keyword query comes next)
      .mockResolvedValueOnce([ // memories
        { title: "Auth patterns", content: "Uses WebAuthn for authentication" },
      ])
      .mockResolvedValue([]);

    const result = await assembleContext({ operatorId: "op1", goal: "fix the authentication bug" });
    expect(result.sources.some((s) => s.includes("memory"))).toBe(true);
  });

  it("loads recent runs", async () => {
    // All taxonomy + memory queries empty, then runs
    mockSql.mockImplementation(async (query: string) => {
      if (query.includes("workflow_run")) {
        return [{ run_id: "run_1", agent_id: "voyager", goal: "Fix login", status: "completed", current_stage: "learn" }];
      }
      return [];
    });

    const result = await assembleContext({ operatorId: "op1" });
    expect(result.sources.some((s) => s.includes("runs"))).toBe(true);
  });

  it("loads learnings from past runs", async () => {
    mockSql.mockImplementation(async (query: string) => {
      if (query.includes("agent-learning")) {
        return [{ title: "Learning", content: "Auth uses HMAC sessions" }];
      }
      return [];
    });

    const result = await assembleContext({ operatorId: "op1" });
    expect(result.sources.some((s) => s.includes("learnings"))).toBe(true);
  });

  it("loads active sessions", async () => {
    mockSql.mockImplementation(async (query: string) => {
      if (query.includes("agent_session")) {
        return [{ session_id: "ses_1", agent_id: "claude-code", sandbox_id: "sbx_1", repo_url: "https://github.com/org/repo", turn_count: 3 }];
      }
      return [];
    });

    const result = await assembleContext({ operatorId: "op1" });
    expect(result.sources.some((s) => s.includes("sessions"))).toBe(true);
  });

  it("respects token budget", async () => {
    mockSql.mockResolvedValueOnce(
      Array.from({ length: 20 }, () => ({ content: "x".repeat(500), metadata_json: '{"kind":"user_prompt"}' })),
    );

    const result = await assembleContext({ operatorId: "op1", tokenBudget: 500 });
    expect(result.tokenEstimate).toBeLessThanOrEqual(600);
  });

  it("handles SpacetimeDB errors gracefully", async () => {
    mockSql.mockRejectedValue(new Error("DB down"));
    const result = await assembleContext({ operatorId: "op1" });
    expect(result.systemBlocks).toHaveLength(0);
  });

  it("can disable individual sources", async () => {
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

  it("returns a plain text summary", async () => {
    const result = await buildHandoffContext("op1", "fix the bug");
    expect(typeof result).toBe("string");
  });

  it("returns empty string on error", async () => {
    mockSql.mockRejectedValue(new Error("fail"));
    const result = await buildHandoffContext("op1", "goal");
    expect(result).toBe("");
  });
});
