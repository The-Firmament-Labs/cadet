/**
 * Tests for apps/web/lib/agent-runtime/session.ts
 *
 * Strategy:
 *   - createControlClient is mocked; sql and callReducer stubs control
 *     all SpacetimeDB interactions.
 *   - createAgentSession: verify correct reducer call and returned object.
 *   - getActiveSession: verify SQL query construction with/without repoUrl.
 *   - loadAgentSession: verify query by session_id, null for not found.
 *   - closeAgentSession / markSessionCrashed: verify update_agent_session_status args.
 *   - requestCancel / clearCancel: verify correct reducer calls.
 *   - isCancelRequested: verify SQL query and boolean return value.
 *   - ensureSession: returns existing if found, creates new if not.
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

import {
  createAgentSession,
  getActiveSession,
  loadAgentSession,
  closeAgentSession,
  markSessionCrashed,
  requestCancel,
  isCancelRequested,
  clearCancel,
  ensureSession,
} from "./session";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.callReducer.mockResolvedValue(undefined);
  mockClient.sql.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: "ses_abc123",
    operator_id: "op_001",
    agent_id: "claude-code",
    sandbox_id: "sbx_xyz",
    repo_url: "https://github.com/org/repo",
    status: "active",
    cancel_requested: false,
    turn_count: 3,
    last_prompt: "fix the bug",
    created_at_micros: 1_700_000_000_000_000,
    updated_at_micros: 1_700_000_100_000_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createAgentSession
// ---------------------------------------------------------------------------

describe("createAgentSession", () => {
  it("calls the create_agent_session reducer", async () => {
    await createAgentSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
    });

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(reducerName).toBe("create_agent_session");
  });

  it("passes operatorId, agentId, sandboxId to the reducer", async () => {
    await createAgentSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
    });

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args).toContain("op_001");
    expect(args).toContain("claude-code");
    expect(args).toContain("sbx_xyz");
  });

  it("passes repoUrl to the reducer when provided", async () => {
    await createAgentSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
      repoUrl: "https://github.com/org/repo",
    });

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args).toContain("https://github.com/org/repo");
  });

  it("passes empty string for repoUrl when not provided", async () => {
    await createAgentSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
    });

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args).toContain("");
  });

  it("passes 'active' as the initial status", async () => {
    await createAgentSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });
    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args).toContain("active");
  });

  it("returns an AgentSession with the correct operatorId, agentId, sandboxId", async () => {
    const session = await createAgentSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
    });

    expect(session.operatorId).toBe("op_001");
    expect(session.agentId).toBe("claude-code");
    expect(session.sandboxId).toBe("sbx_xyz");
  });

  it("returns a session with status 'active'", async () => {
    const session = await createAgentSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });
    expect(session.status).toBe("active");
  });

  it("returns a session with cancelRequested=false", async () => {
    const session = await createAgentSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });
    expect(session.cancelRequested).toBe(false);
  });

  it("returns a session with turnCount=0", async () => {
    const session = await createAgentSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });
    expect(session.turnCount).toBe(0);
  });

  it("returns a sessionId that starts with 'ses_'", async () => {
    const session = await createAgentSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });
    expect(session.sessionId).toMatch(/^ses_/);
  });

  it("returns a session with repoUrl matching the provided value", async () => {
    const session = await createAgentSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
      repoUrl: "https://github.com/org/repo",
    });
    expect(session.repoUrl).toBe("https://github.com/org/repo");
  });

  it("returns a session with empty repoUrl when not provided", async () => {
    const session = await createAgentSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });
    expect(session.repoUrl).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getActiveSession
// ---------------------------------------------------------------------------

describe("getActiveSession — with operatorId and agentId", () => {
  it("queries agent_session table with operator_id, agent_id, and status='active'", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow()]);

    await getActiveSession("op_001", "claude-code");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("agent_session");
    expect(query).toContain("op_001");
    expect(query).toContain("claude-code");
    expect(query).toContain("active");
  });

  it("returns a mapped AgentSession when a row is found", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow()]);

    const session = await getActiveSession("op_001", "claude-code");

    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("ses_abc123");
    expect(session!.operatorId).toBe("op_001");
    expect(session!.agentId).toBe("claude-code");
    expect(session!.status).toBe("active");
    expect(session!.turnCount).toBe(3);
  });

  it("returns null when no rows are found", async () => {
    mockClient.sql.mockResolvedValue([]);

    const session = await getActiveSession("op_001", "claude-code");
    expect(session).toBeNull();
  });
});

describe("getActiveSession — with repoUrl", () => {
  it("includes a repo_url filter in the SQL when repoUrl is provided", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow()]);

    await getActiveSession("op_001", "claude-code", "https://github.com/org/repo");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("repo_url");
    expect(query).toContain("github.com/org/repo");
  });

  it("omits the repo_url filter when repoUrl is not provided", async () => {
    mockClient.sql.mockResolvedValue([]);

    await getActiveSession("op_001", "claude-code");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).not.toContain("repo_url");
  });

  it("escapes single quotes in repoUrl to prevent SQL injection", async () => {
    mockClient.sql.mockResolvedValue([]);

    await getActiveSession("op_001", "claude-code", "https://github.com/org/it's-a-repo");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("''");
  });
});

// ---------------------------------------------------------------------------
// loadAgentSession
// ---------------------------------------------------------------------------

describe("loadAgentSession", () => {
  it("queries agent_session by session_id", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow()]);

    await loadAgentSession("ses_abc123");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("agent_session");
    expect(query).toContain("session_id");
    expect(query).toContain("ses_abc123");
  });

  it("returns a mapped session when the row is found", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow({ cancel_requested: true })]);

    const session = await loadAgentSession("ses_abc123");

    expect(session).not.toBeNull();
    expect(session!.cancelRequested).toBe(true);
    expect(session!.lastPrompt).toBe("fix the bug");
  });

  it("converts timestamp micros to milliseconds", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow({
      created_at_micros: 1_700_000_000_000_000,
      updated_at_micros: 1_700_000_100_000_000,
    })]);

    const session = await loadAgentSession("ses_abc123");
    expect(session!.createdAt).toBe(1_700_000_000_000);
    expect(session!.updatedAt).toBe(1_700_000_100_000);
  });

  it("returns null when the session is not found", async () => {
    mockClient.sql.mockResolvedValue([]);

    const session = await loadAgentSession("ses_notfound");
    expect(session).toBeNull();
  });

  it("escapes single quotes in sessionId", async () => {
    mockClient.sql.mockResolvedValue([]);

    await loadAgentSession("ses_it's_special");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("''");
  });
});

// ---------------------------------------------------------------------------
// closeAgentSession
// ---------------------------------------------------------------------------

describe("closeAgentSession", () => {
  it("calls update_agent_session_status with 'closed'", async () => {
    await closeAgentSession("ses_abc123");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(reducerName).toBe("update_agent_session_status");
    expect(args[0]).toBe("ses_abc123");
    expect(args[1]).toBe("closed");
  });

  it("passes a numeric timestamp as the third argument", async () => {
    const before = Date.now();
    await closeAgentSession("ses_abc123");
    const after = Date.now();

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[2]).toBeGreaterThanOrEqual(before);
    expect(args[2]).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// markSessionCrashed
// ---------------------------------------------------------------------------

describe("markSessionCrashed", () => {
  it("calls update_agent_session_status with 'crashed'", async () => {
    await markSessionCrashed("ses_abc123");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(reducerName).toBe("update_agent_session_status");
    expect(args[0]).toBe("ses_abc123");
    expect(args[1]).toBe("crashed");
  });
});

// ---------------------------------------------------------------------------
// requestCancel
// ---------------------------------------------------------------------------

describe("requestCancel", () => {
  it("calls request_session_cancel with the correct sessionId", async () => {
    await requestCancel("ses_abc123");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(reducerName).toBe("request_session_cancel");
    expect(args[0]).toBe("ses_abc123");
  });

  it("passes a numeric timestamp as the second argument", async () => {
    const before = Date.now();
    await requestCancel("ses_abc123");
    const after = Date.now();

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[1]).toBeGreaterThanOrEqual(before);
    expect(args[1]).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// isCancelRequested
// ---------------------------------------------------------------------------

describe("isCancelRequested", () => {
  it("returns true when cancel_requested is truthy in the row", async () => {
    mockClient.sql.mockResolvedValue([{ cancel_requested: true }]);

    const result = await isCancelRequested("ses_abc123");
    expect(result).toBe(true);
  });

  it("returns false when cancel_requested is false in the row", async () => {
    mockClient.sql.mockResolvedValue([{ cancel_requested: false }]);

    const result = await isCancelRequested("ses_abc123");
    expect(result).toBe(false);
  });

  it("returns false when no row is found", async () => {
    mockClient.sql.mockResolvedValue([]);

    const result = await isCancelRequested("ses_notfound");
    expect(result).toBe(false);
  });

  it("queries for cancel_requested column by session_id", async () => {
    mockClient.sql.mockResolvedValue([{ cancel_requested: false }]);

    await isCancelRequested("ses_abc123");

    const [query] = mockClient.sql.mock.calls[0]! as [string];
    expect(query).toContain("cancel_requested");
    expect(query).toContain("ses_abc123");
  });
});

// ---------------------------------------------------------------------------
// clearCancel
// ---------------------------------------------------------------------------

describe("clearCancel", () => {
  it("calls clear_session_cancel with the correct sessionId", async () => {
    await clearCancel("ses_abc123");

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(reducerName).toBe("clear_session_cancel");
    expect(args[0]).toBe("ses_abc123");
  });

  it("passes a numeric timestamp as the second argument", async () => {
    const before = Date.now();
    await clearCancel("ses_abc123");
    const after = Date.now();

    const [, args] = mockClient.callReducer.mock.calls[0]! as [string, unknown[]];
    expect(args[1]).toBeGreaterThanOrEqual(before);
    expect(args[1]).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// ensureSession
// ---------------------------------------------------------------------------

describe("ensureSession — existing session", () => {
  it("returns existing session with created=false when active session found", async () => {
    // getActiveSession will find a row
    mockClient.sql.mockResolvedValue([makeSessionRow()]);

    const result = await ensureSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
    });

    expect(result.created).toBe(false);
    expect(result.session.sessionId).toBe("ses_abc123");
  });

  it("does NOT call create_agent_session reducer when session exists", async () => {
    mockClient.sql.mockResolvedValue([makeSessionRow()]);

    await ensureSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });

    const createCalls = mockClient.callReducer.mock.calls.filter(
      ([name]) => name === "create_agent_session",
    );
    expect(createCalls).toHaveLength(0);
  });
});

describe("ensureSession — no existing session", () => {
  it("creates a new session with created=true when no active session found", async () => {
    // getActiveSession finds nothing; createAgentSession proceeds
    mockClient.sql.mockResolvedValue([]);

    const result = await ensureSession({
      operatorId: "op_001",
      agentId: "claude-code",
      sandboxId: "sbx_xyz",
    });

    expect(result.created).toBe(true);
    expect(result.session.operatorId).toBe("op_001");
    expect(result.session.agentId).toBe("claude-code");
  });

  it("calls create_agent_session reducer when no session exists", async () => {
    mockClient.sql.mockResolvedValue([]);

    await ensureSession({ operatorId: "op_001", agentId: "claude-code", sandboxId: "sbx_xyz" });

    const createCalls = mockClient.callReducer.mock.calls.filter(
      ([name]) => name === "create_agent_session",
    );
    expect(createCalls).toHaveLength(1);
  });
});
