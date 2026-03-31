/**
 * Tests for apps/web/lib/agent-runtime/session-search.ts
 *
 * Strategy:
 *   - createControlClient is mocked; sql stub controls rows returned.
 *   - searchSessions queries all 4 tables when no type filter is provided.
 *   - searchSessions respects the type filter (only queries the correct table).
 *   - Results are sorted by relevance then recency.
 *   - Empty query (all stop words or blank) returns [] immediately.
 *   - Keywords are extracted correctly (stop words filtered, max 5).
 *   - scoreRelevance is tested indirectly via relevance field values.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { searchSessions } from "./session-search";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all tables return empty (no results)
  mockClient.sql.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// searchSessions — all tables queried
// ---------------------------------------------------------------------------

describe("searchSessions — queries all 4 tables by default", () => {
  it("calls sql 4 times when no type filter is provided", async () => {
    await searchSessions("fix authentication bug");
    // chat_message, workflow_run, memory_document, thread_record
    expect(mockClient.sql).toHaveBeenCalledTimes(4);
  });

  it("queries chat_message table", async () => {
    await searchSessions("authentication issue");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    expect(queries.some((q) => q.includes("chat_message"))).toBe(true);
  });

  it("queries workflow_run table", async () => {
    await searchSessions("authentication issue");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    expect(queries.some((q) => q.includes("workflow_run"))).toBe(true);
  });

  it("queries memory_document table", async () => {
    await searchSessions("authentication issue");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    expect(queries.some((q) => q.includes("memory_document"))).toBe(true);
  });

  it("queries thread_record table", async () => {
    await searchSessions("authentication issue");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    expect(queries.some((q) => q.includes("thread_record"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// searchSessions — type filter
// ---------------------------------------------------------------------------

describe("searchSessions — type filter: chat", () => {
  it("queries only chat_message when type='chat'", async () => {
    await searchSessions("login bug", { type: "chat" });
    expect(mockClient.sql).toHaveBeenCalledTimes(1);
    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("chat_message");
  });
});

describe("searchSessions — type filter: run", () => {
  it("queries only workflow_run when type='run'", async () => {
    await searchSessions("deploy pipeline", { type: "run" });
    expect(mockClient.sql).toHaveBeenCalledTimes(1);
    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("workflow_run");
  });
});

describe("searchSessions — type filter: memory", () => {
  it("queries only memory_document when type='memory'", async () => {
    await searchSessions("user preferences", { type: "memory" });
    expect(mockClient.sql).toHaveBeenCalledTimes(1);
    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("memory_document");
  });
});

describe("searchSessions — type filter: thread", () => {
  it("queries only thread_record when type='thread'", async () => {
    await searchSessions("project planning", { type: "thread" });
    expect(mockClient.sql).toHaveBeenCalledTimes(1);
    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("thread_record");
  });
});

// ---------------------------------------------------------------------------
// searchSessions — empty / stop-word-only queries
// ---------------------------------------------------------------------------

describe("searchSessions — empty query handling", () => {
  it("returns empty array for a blank query", async () => {
    const results = await searchSessions("");
    expect(results).toEqual([]);
    expect(mockClient.sql).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only query", async () => {
    const results = await searchSessions("   ");
    expect(results).toEqual([]);
    expect(mockClient.sql).not.toHaveBeenCalled();
  });

  it("returns empty array when all words are stop words", async () => {
    // "the a an is are" are all stop words
    const results = await searchSessions("the a an is are");
    expect(results).toEqual([]);
    expect(mockClient.sql).not.toHaveBeenCalled();
  });

  it("returns empty array for very short words (2 chars or fewer)", async () => {
    const results = await searchSessions("do it");
    expect(results).toEqual([]);
    expect(mockClient.sql).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// searchSessions — keyword extraction (tested indirectly)
// ---------------------------------------------------------------------------

describe("searchSessions — keyword extraction", () => {
  it("uses extracted keywords in LIKE conditions (stop words removed)", async () => {
    await searchSessions("the authentication bug");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    const chatQuery = queries.find((q) => q.includes("chat_message"))!;
    // 'the' is a stop word and must not appear as a standalone keyword
    // 'authentication' and 'bug' should appear
    expect(chatQuery).toContain("authentication");
    expect(chatQuery).toContain("bug");
  });

  it("limits keywords to at most 5 in the LIKE conditions", async () => {
    // 6 non-stop-word keywords: only first 5 should be used
    await searchSessions("alpha bravo charlie delta echo foxtrot");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    const anyQuery = queries[0]!;
    // Count LIKE occurrences — should be at most 5 per column
    const likeCount = (anyQuery.match(/LIKE/g) ?? []).length;
    // Up to 5 keywords, possibly applied to multiple columns — but max 5 distinct keywords
    expect(likeCount).toBeLessThanOrEqual(10); // 5 keywords * 2 columns in memory = 10
  });

  it("lowercases keywords in LIKE conditions", async () => {
    await searchSessions("TYPESCRIPT ERROR");
    const queries = mockClient.sql.mock.calls.map(([q]) => q as string);
    const chatQuery = queries.find((q) => q.includes("chat_message"))!;
    expect(chatQuery).toContain("typescript");
    expect(chatQuery).toContain("error");
  });
});

// ---------------------------------------------------------------------------
// searchSessions — result mapping
// ---------------------------------------------------------------------------

describe("searchSessions — result mapping from chat_message", () => {
  it("maps chat_message rows to SearchResult objects with type='chat'", async () => {
    mockClient.sql
      .mockResolvedValueOnce([
        {
          message_id: "msg_001",
          role: "user",
          content: "Fix the authentication bug in login flow",
          created_at_micros: 1_700_000_000_000_000,
        },
      ])
      .mockResolvedValue([]); // other tables return empty

    const results = await searchSessions("authentication bug");

    expect(results).toHaveLength(1);
    expect(results[0]!.type).toBe("chat");
    expect(results[0]!.id).toBe("msg_001");
    expect(results[0]!.title).toBe("user message");
  });

  it("truncates chat content to 200 characters", async () => {
    const longContent = "a".repeat(300);
    mockClient.sql
      .mockResolvedValueOnce([
        {
          message_id: "msg_002",
          role: "assistant",
          content: longContent,
          created_at_micros: 1_700_000_000_000_000,
        },
      ])
      .mockResolvedValue([]);

    const results = await searchSessions("aaa");
    expect(results[0]!.content.length).toBeLessThanOrEqual(200);
  });
});

describe("searchSessions — result mapping from workflow_run", () => {
  it("maps workflow_run rows to SearchResult objects with type='run'", async () => {
    mockClient.sql
      .mockResolvedValueOnce([]) // chat_message
      .mockResolvedValueOnce([
        {
          run_id: "run_abc",
          agent_id: "voyager",
          goal: "Fix the authentication module",
          status: "completed",
          updated_at_micros: 1_700_000_100_000_000,
        },
      ])
      .mockResolvedValue([]);

    const results = await searchSessions("authentication module");

    const runResult = results.find((r) => r.type === "run");
    expect(runResult).toBeDefined();
    expect(runResult!.id).toBe("run_abc");
    expect(runResult!.title).toContain("voyager");
  });
});

describe("searchSessions — result mapping from memory_document", () => {
  it("maps memory_document rows to SearchResult objects with type='memory'", async () => {
    mockClient.sql
      .mockResolvedValueOnce([]) // chat_message
      .mockResolvedValueOnce([]) // workflow_run
      .mockResolvedValueOnce([
        {
          document_id: "doc_001",
          title: "Auth System Notes",
          content: "JWT tokens are used for authentication",
          updated_at_micros: 1_700_000_200_000_000,
        },
      ])
      .mockResolvedValue([]);

    const results = await searchSessions("authentication jwt");

    const memResult = results.find((r) => r.type === "memory");
    expect(memResult).toBeDefined();
    expect(memResult!.id).toBe("doc_001");
    expect(memResult!.title).toBe("Auth System Notes");
  });
});

describe("searchSessions — result mapping from thread_record", () => {
  it("maps thread_record rows to SearchResult objects with type='thread'", async () => {
    mockClient.sql
      .mockResolvedValueOnce([]) // chat_message
      .mockResolvedValueOnce([]) // workflow_run
      .mockResolvedValueOnce([]) // memory_document
      .mockResolvedValueOnce([
        {
          thread_id: "thr_001",
          title: "Authentication discussion",
          updated_at_micros: 1_700_000_300_000_000,
        },
      ]);

    const results = await searchSessions("authentication discussion");

    const threadResult = results.find((r) => r.type === "thread");
    expect(threadResult).toBeDefined();
    expect(threadResult!.id).toBe("thr_001");
  });
});

// ---------------------------------------------------------------------------
// searchSessions — sorting (relevance then recency)
// ---------------------------------------------------------------------------

describe("searchSessions — sorting by relevance then recency", () => {
  it("sorts higher-relevance results before lower-relevance results", async () => {
    // First result: content matches both keywords ('authentication' + 'bug')
    // Second result: content matches only one keyword ('authentication')
    mockClient.sql
      .mockResolvedValueOnce([
        {
          message_id: "msg_low",
          role: "user",
          content: "authentication issue",          // 1/2 keywords match
          created_at_micros: 2_000_000_000_000_000, // newer
        },
        {
          message_id: "msg_high",
          role: "user",
          content: "authentication bug fix needed", // 2/2 keywords match
          created_at_micros: 1_000_000_000_000_000, // older
        },
      ])
      .mockResolvedValue([]);

    const results = await searchSessions("authentication bug");
    // Higher relevance (2 matches) should sort first
    expect(results[0]!.id).toBe("msg_high");
    expect(results[1]!.id).toBe("msg_low");
  });

  it("sorts by recency when relevance is equal", async () => {
    mockClient.sql
      .mockResolvedValueOnce([
        {
          message_id: "msg_older",
          role: "user",
          content: "fix the authentication",
          created_at_micros: 1_000_000_000_000_000, // older
        },
        {
          message_id: "msg_newer",
          role: "user",
          content: "authentication problem fix",
          created_at_micros: 2_000_000_000_000_000, // newer
        },
      ])
      .mockResolvedValue([]);

    const results = await searchSessions("authentication fix");
    // Equal relevance (both match 2 keywords) — newer should come first
    expect(results[0]!.id).toBe("msg_newer");
    expect(results[1]!.id).toBe("msg_older");
  });
});

// ---------------------------------------------------------------------------
// searchSessions — limit
// ---------------------------------------------------------------------------

describe("searchSessions — limit", () => {
  it("returns at most 20 results by default", async () => {
    const manyRows = Array.from({ length: 30 }, (_, i) => ({
      message_id: `msg_${i}`,
      role: "user",
      content: "authentication token refresh needed",
      created_at_micros: i * 1_000_000,
    }));

    mockClient.sql
      .mockResolvedValueOnce(manyRows)
      .mockResolvedValue([]);

    const results = await searchSessions("authentication");
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("respects a custom limit", async () => {
    const manyRows = Array.from({ length: 15 }, (_, i) => ({
      message_id: `msg_${i}`,
      role: "user",
      content: "typescript compilation error",
      created_at_micros: i * 1_000_000,
    }));

    mockClient.sql
      .mockResolvedValueOnce(manyRows)
      .mockResolvedValue([]);

    const results = await searchSessions("typescript", { limit: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("caps limit at 50 (no more than 50 even if limit=100 requested)", async () => {
    // Build 100 rows per table
    const makeRows = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        message_id: `${prefix}_${i}`,
        role: "user",
        content: "authentication token refresh needed",
        created_at_micros: i * 1_000_000,
      }));

    mockClient.sql
      .mockResolvedValueOnce(makeRows("chat", 100))
      .mockResolvedValueOnce(makeRows("run", 0).map((r, i) => ({
        run_id: `run_${i}`, agent_id: "agent", goal: "authentication flow", status: "done", updated_at_micros: 0,
      })))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const results = await searchSessions("authentication", { limit: 100 });
    expect(results.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// searchSessions — operatorId filter
// ---------------------------------------------------------------------------

describe("searchSessions — operatorId filter", () => {
  it("includes operatorId in the chat_message query when provided", async () => {
    await searchSessions("authentication bug", { operatorId: "op_001", type: "chat" });
    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("op_001");
    expect(query).toContain("operator_id");
  });

  it("omits operatorId filter from chat_message query when not provided", async () => {
    await searchSessions("authentication bug", { type: "chat" });
    const [query] = mockClient.sql.mock.calls[0]! as [string];
    // The query should NOT contain operator_id as a filter condition
    expect(query).not.toMatch(/AND operator_id/);
  });
});
