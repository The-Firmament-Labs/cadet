/**
 * Tests for apps/web/lib/agent-runtime/context-refs.ts
 *
 * Strategy:
 *   - parseRefs: extract all known @ reference types.
 *   - parseRefs: no refs → empty array, multiple refs in one message.
 *   - resolveRefs: @run, @agent, @memory resolved from SQL.
 *   - resolveRefs: cleanMessage has refs stripped.
 *   - resolveRefs: maxTokens budget honoured.
 *   - resolveRefs: @url resolved via fetch mock.
 *   - stripRefs: removes all @ references from plain text.
 *
 *   createControlClient and fetch are both mocked.
 *   The dynamic import of "./skills" inside resolveRef for @skill is also mocked.
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
// Mock: fetch (global)
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Mock: ./skills (dynamic import used for @skill refs)
// ---------------------------------------------------------------------------

vi.mock("./skills", () => ({
  viewSkill: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { parseRefs, resolveRefs, stripRefs } from "./context-refs";
import { viewSkill } from "./skills";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.sql.mockResolvedValue([]);
  mockClient.callReducer.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// parseRefs
// ---------------------------------------------------------------------------

describe("parseRefs — basic extraction", () => {
  it("returns empty array when message has no @ references", () => {
    const refs = parseRefs("Just a plain message with no refs.");
    expect(refs).toEqual([]);
  });

  it("extracts a @run:id reference", () => {
    const refs = parseRefs("Check @run:run_abc123 for details.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "run", value: "run_abc123" });
  });

  it("extracts a @agent:id reference", () => {
    const refs = parseRefs("Ask @agent:voyager to fix it.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "agent", value: "voyager" });
  });

  it("extracts a @memory:terms reference", () => {
    const refs = parseRefs("Use @memory:auth+jwt context.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "memory", value: "auth+jwt" });
  });

  it("extracts a @url:... reference", () => {
    const refs = parseRefs("Refer to @url:https://example.com/docs for info.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "url", value: "https://example.com/docs" });
  });

  it("extracts a @diff reference (no value)", () => {
    const refs = parseRefs("Show me @diff to review changes.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "diff", value: "" });
  });

  it("extracts a @diff:branch reference", () => {
    const refs = parseRefs("Compare @diff:main changes.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "diff", value: "main" });
  });

  it("extracts a @skill:name reference", () => {
    const refs = parseRefs("Apply the @skill:react patterns.");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ type: "skill", value: "react" });
  });
});

describe("parseRefs — multiple refs in one message", () => {
  it("extracts multiple refs from a single message", () => {
    const refs = parseRefs("Check @run:run_001 and @agent:voyager then @memory:jwt");
    expect(refs).toHaveLength(3);
    expect(refs[0]).toEqual({ type: "run", value: "run_001" });
    expect(refs[1]).toEqual({ type: "agent", value: "voyager" });
    expect(refs[2]).toEqual({ type: "memory", value: "jwt" });
  });

  it("handles refs at the start and end of message", () => {
    const refs = parseRefs("@run:run_start do the thing @agent:saturn");
    expect(refs).toHaveLength(2);
    expect(refs[0]!.type).toBe("run");
    expect(refs[1]!.type).toBe("agent");
  });

  it("does not extract unknown ref types", () => {
    const refs = parseRefs("This @unknown:thing should not be extracted.");
    expect(refs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — cleanMessage
// ---------------------------------------------------------------------------

describe("resolveRefs — clean message", () => {
  it("returns the original message as cleanMessage when no refs are present", async () => {
    const { cleanMessage } = await resolveRefs("No refs here.");
    expect(cleanMessage).toBe("No refs here.");
  });

  it("strips @run:id from the clean message", async () => {
    mockClient.sql.mockResolvedValueOnce([
      { run_id: "run_abc", agent_id: "voyager", goal: "Fix bug", status: "completed", current_stage: "done" },
    ]);

    const { cleanMessage } = await resolveRefs("Please check @run:run_abc for context.");
    expect(cleanMessage).not.toContain("@run:run_abc");
    expect(cleanMessage.trim()).toBeTruthy();
  });

  it("strips multiple refs from the clean message", async () => {
    mockClient.sql
      .mockResolvedValueOnce([
        { run_id: "run_001", agent_id: "a", goal: "g", status: "done", current_stage: "s" },
      ])
      .mockResolvedValueOnce([
        { agent_id: "voyager", display_name: "Voyager", model_id: "claude", execution_target: "sandbox" },
      ]);

    const { cleanMessage } = await resolveRefs("Check @run:run_001 and @agent:voyager please.");
    expect(cleanMessage).not.toContain("@run:run_001");
    expect(cleanMessage).not.toContain("@agent:voyager");
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — @run resolution
// ---------------------------------------------------------------------------

describe("resolveRefs — @run", () => {
  it("returns context with run details when run is found", async () => {
    mockClient.sql.mockResolvedValueOnce([
      {
        run_id: "run_abc",
        agent_id: "voyager",
        goal: "Refactor the auth module",
        status: "completed",
        current_stage: "done",
      },
    ]);

    const { context } = await resolveRefs("Check @run:run_abc");
    expect(context).toHaveLength(1);
    expect(context[0]!.type).toBe("run");
    expect(context[0]!.content).toContain("run_abc");
    expect(context[0]!.content).toContain("voyager");
    expect(context[0]!.content).toContain("Refactor the auth module");
  });

  it("returns empty context when run is not found", async () => {
    mockClient.sql.mockResolvedValueOnce([]);

    const { context } = await resolveRefs("Check @run:run_notfound");
    expect(context).toHaveLength(0);
  });

  it("queries workflow_run table for @run refs", async () => {
    mockClient.sql.mockResolvedValueOnce([]);

    await resolveRefs("@run:run_abc");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("workflow_run");
    expect(query).toContain("run_abc");
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — @agent resolution
// ---------------------------------------------------------------------------

describe("resolveRefs — @agent", () => {
  it("returns context with agent details when agent is found", async () => {
    mockClient.sql.mockResolvedValueOnce([
      {
        agent_id: "voyager",
        display_name: "Voyager",
        model_id: "anthropic/claude-sonnet-4.5",
        execution_target: "vercel-sandbox",
      },
    ]);

    const { context } = await resolveRefs("@agent:voyager can help");
    expect(context).toHaveLength(1);
    expect(context[0]!.type).toBe("agent");
    expect(context[0]!.content).toContain("Voyager");
    expect(context[0]!.content).toContain("claude-sonnet-4.5");
  });

  it("returns empty context when agent is not found", async () => {
    mockClient.sql.mockResolvedValueOnce([]);

    const { context } = await resolveRefs("@agent:unknownbot do something");
    expect(context).toHaveLength(0);
  });

  it("queries agent_record table for @agent refs", async () => {
    mockClient.sql.mockResolvedValueOnce([]);

    await resolveRefs("@agent:voyager");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("agent_record");
    expect(query).toContain("voyager");
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — @memory resolution
// ---------------------------------------------------------------------------

describe("resolveRefs — @memory", () => {
  it("returns context with memory document content when found", async () => {
    mockClient.sql.mockResolvedValueOnce([
      { title: "Auth Notes", content: "JWT tokens are used for authentication in this system." },
    ]);

    const { context } = await resolveRefs("@memory:jwt+auth");
    expect(context).toHaveLength(1);
    expect(context[0]!.type).toBe("memory");
    expect(context[0]!.content).toContain("Auth Notes");
  });

  it("splits memory search terms on + and comma", async () => {
    mockClient.sql.mockResolvedValueOnce([
      { title: "DB Notes", content: "PostgreSQL schema details" },
    ]);

    await resolveRefs("@memory:postgres,schema");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("postgres");
    expect(query).toContain("schema");
  });

  it("returns empty context when no memory documents match", async () => {
    mockClient.sql.mockResolvedValueOnce([]);

    const { context } = await resolveRefs("@memory:nonexistent");
    expect(context).toHaveLength(0);
  });

  it("queries memory_document table for @memory refs", async () => {
    mockClient.sql.mockResolvedValueOnce([]);

    await resolveRefs("@memory:jwt");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("memory_document");
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — @skill resolution
// ---------------------------------------------------------------------------

describe("resolveRefs — @skill", () => {
  it("returns skill content when skill is found", async () => {
    vi.mocked(viewSkill).mockResolvedValue({
      name: "React Patterns",
      content: "Use hooks and functional components...",
      tokenEstimate: 50,
    } as never);

    const { context } = await resolveRefs("Apply @skill:react patterns");
    expect(context).toHaveLength(1);
    expect(context[0]!.type).toBe("skill");
    expect(context[0]!.content).toContain("React Patterns");
  });

  it("returns empty context when skill is not found", async () => {
    vi.mocked(viewSkill).mockResolvedValue(null as never);

    const { context } = await resolveRefs("@skill:nonexistent");
    expect(context).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — @url resolution
// ---------------------------------------------------------------------------

describe("resolveRefs — @url", () => {
  it("returns fetched URL content stripped of HTML tags", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue("<html><body><h1>Hello World</h1><p>Some content here.</p></body></html>"),
    });

    const { context } = await resolveRefs("@url:https://example.com/page");
    expect(context).toHaveLength(1);
    expect(context[0]!.type).toBe("url");
    expect(context[0]!.content).toContain("Hello World");
    expect(context[0]!.content).not.toContain("<h1>");
  });

  it("returns empty context when fetch response is not ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    const { context } = await resolveRefs("@url:https://example.com/missing");
    expect(context).toHaveLength(0);
  });

  it("returns an error placeholder when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { context } = await resolveRefs("@url:https://example.com/broken");
    // resolveRefs wraps errors in a placeholder
    expect(context).toHaveLength(1);
    expect(context[0]!.content).toContain("Failed to resolve");
  });
});

// ---------------------------------------------------------------------------
// resolveRefs — maxTokens budget
// ---------------------------------------------------------------------------

describe("resolveRefs — maxTokens budget", () => {
  it("stops resolving refs after maxTokens is exceeded", async () => {
    // First ref produces a large result (>= maxTokens)
    mockClient.sql
      .mockResolvedValueOnce([
        {
          run_id: "run_001",
          agent_id: "voyager",
          goal: "a".repeat(100),
          status: "completed",
          current_stage: "done",
        },
      ])
      .mockResolvedValueOnce([
        {
          agent_id: "voyager",
          display_name: "Voyager",
          model_id: "claude",
          execution_target: "sandbox",
        },
      ]);

    // maxTokens=10 — first ref should consume budget and second should be skipped
    const { context } = await resolveRefs("@run:run_001 @agent:voyager", { maxTokens: 10 });
    // Only the first context item (or none) should be resolved; second is over budget
    expect(context.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// stripRefs
// ---------------------------------------------------------------------------

describe("stripRefs", () => {
  it("removes a single @run:id reference", () => {
    const result = stripRefs("Check @run:run_abc for details.");
    expect(result).not.toContain("@run:run_abc");
  });

  it("removes multiple @ references", () => {
    const result = stripRefs("Use @agent:voyager and @memory:jwt to fix @run:run_001.");
    expect(result).not.toContain("@agent:voyager");
    expect(result).not.toContain("@memory:jwt");
    expect(result).not.toContain("@run:run_001");
  });

  it("removes @diff with no value", () => {
    const result = stripRefs("Review @diff changes.");
    expect(result).not.toContain("@diff");
  });

  it("removes @url references", () => {
    const result = stripRefs("See @url:https://example.com for more.");
    expect(result).not.toContain("@url:");
  });

  it("leaves plain text intact when there are no refs", () => {
    const text = "Just a normal message with no refs.";
    expect(stripRefs(text)).toBe(text);
  });

  it("returns a trimmed string", () => {
    const result = stripRefs("  @run:run_abc  ");
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });
});
