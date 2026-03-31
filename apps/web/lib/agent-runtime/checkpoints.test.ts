import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────
const mockSql = vi.hoisted(() => vi.fn());
const mockCallReducer = vi.hoisted(() => vi.fn());
const mockCreateControlClient = vi.hoisted(() =>
  vi.fn(() => ({ sql: mockSql, callReducer: mockCallReducer }))
);

const mockSnapshot = vi.hoisted(() => vi.fn());
const mockSandboxGet = vi.hoisted(() => vi.fn());
const mockSandboxCreate = vi.hoisted(() => vi.fn());

vi.mock("../server", () => ({
  createControlClient: mockCreateControlClient,
}));

vi.mock("../sql", () => ({
  sqlEscape: (v: string) => v.replace(/'/g, "''"),
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    get: mockSandboxGet,
    create: mockSandboxCreate,
  },
}));

import { createCheckpoint, listCheckpoints, rollbackToCheckpoint } from "./checkpoints";

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: sandbox.get returns an object with a snapshot method
  mockSnapshot.mockResolvedValue({ snapshotId: "snap_abc123" });
  mockSandboxGet.mockResolvedValue({ snapshot: mockSnapshot });
  mockSandboxCreate.mockResolvedValue({ sandboxId: "sandbox_new_456" });
  mockCallReducer.mockResolvedValue(undefined);
  mockSql.mockResolvedValue([]);
});

// ── createCheckpoint ──────────────────────────────────────────────────

describe("createCheckpoint", () => {
  const baseOpts = {
    sessionId: "ses_test_1",
    sandboxId: "sandbox_original",
    vercelAccessToken: "tok_vercel",
    label: "Before refactor",
    turnNumber: 3,
  };

  it("calls Sandbox.get with correct sandboxId and credentials", async () => {
    await createCheckpoint(baseOpts);

    expect(mockSandboxGet).toHaveBeenCalledOnce();
    const arg = mockSandboxGet.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.sandboxId).toBe("sandbox_original");
    expect(arg.token).toBe("tok_vercel");
  });

  it("calls sandbox.snapshot() to capture state", async () => {
    await createCheckpoint(baseOpts);

    expect(mockSnapshot).toHaveBeenCalledOnce();
  });

  it("calls SpacetimeDB create_checkpoint reducer with correct args", async () => {
    const result = await createCheckpoint(baseOpts);

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("create_checkpoint");
    expect(args[0]).toBe(result.checkpointId); // generated ID
    expect(args[1]).toBe("ses_test_1");
    expect(args[2]).toBe("sandbox_original");
    expect(args[3]).toBe("snap_abc123");
    expect(args[4]).toBe("Before refactor");
    expect(args[5]).toBe(3);
  });

  it("returns a Checkpoint with all expected fields", async () => {
    const result = await createCheckpoint(baseOpts);

    expect(result.checkpointId).toMatch(/^ckpt_/);
    expect(result.sessionId).toBe("ses_test_1");
    expect(result.sandboxId).toBe("sandbox_original");
    expect(result.snapshotId).toBe("snap_abc123");
    expect(result.label).toBe("Before refactor");
    expect(result.turnNumber).toBe(3);
    expect(result.createdAt).toBeTypeOf("number");
  });

  it("uses VERCEL_TEAM_ID and VERCEL_PROJECT_ID from env", async () => {
    process.env.VERCEL_TEAM_ID = "team_xyz";
    process.env.VERCEL_PROJECT_ID = "proj_abc";

    await createCheckpoint(baseOpts);

    const arg = mockSandboxGet.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.teamId).toBe("team_xyz");
    expect(arg.projectId).toBe("proj_abc");

    delete process.env.VERCEL_TEAM_ID;
    delete process.env.VERCEL_PROJECT_ID;
  });
});

// ── listCheckpoints ───────────────────────────────────────────────────

describe("listCheckpoints", () => {
  it("queries by session_id and returns ordered list", async () => {
    mockSql.mockResolvedValueOnce([
      {
        checkpoint_id: "ckpt_1",
        session_id: "ses_1",
        sandbox_id: "sb_1",
        snapshot_id: "snap_1",
        label: "First checkpoint",
        turn_number: 1,
        created_at_micros: 1000000,
      },
      {
        checkpoint_id: "ckpt_2",
        session_id: "ses_1",
        sandbox_id: "sb_1",
        snapshot_id: "snap_2",
        label: "Second checkpoint",
        turn_number: 2,
        created_at_micros: 2000000,
      },
    ]);

    const checkpoints = await listCheckpoints("ses_1");

    expect(mockSql).toHaveBeenCalledOnce();
    expect(mockSql.mock.calls[0]![0]).toContain("ses_1");
    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]!.checkpointId).toBe("ckpt_1");
    expect(checkpoints[1]!.checkpointId).toBe("ckpt_2");
  });

  it("maps row fields to camelCase Checkpoint shape", async () => {
    mockSql.mockResolvedValueOnce([
      {
        checkpoint_id: "ckpt_abc",
        session_id: "ses_abc",
        sandbox_id: "sb_abc",
        snapshot_id: "snap_abc",
        label: "My label",
        turn_number: 5,
        created_at_micros: 5000000,
      },
    ]);

    const [checkpoint] = await listCheckpoints("ses_abc");

    expect(checkpoint!.checkpointId).toBe("ckpt_abc");
    expect(checkpoint!.sessionId).toBe("ses_abc");
    expect(checkpoint!.sandboxId).toBe("sb_abc");
    expect(checkpoint!.snapshotId).toBe("snap_abc");
    expect(checkpoint!.label).toBe("My label");
    expect(checkpoint!.turnNumber).toBe(5);
    expect(checkpoint!.createdAt).toBe(5000); // 5000000 µs / 1000
  });

  it("returns empty array when no checkpoints exist", async () => {
    mockSql.mockResolvedValueOnce([]);

    const checkpoints = await listCheckpoints("ses_empty");
    expect(checkpoints).toHaveLength(0);
  });

  it("defaults turn_number to 0 when missing", async () => {
    mockSql.mockResolvedValueOnce([
      {
        checkpoint_id: "ckpt_x",
        session_id: "ses_x",
        sandbox_id: "sb_x",
        snapshot_id: "snap_x",
        label: "no-turn",
        turn_number: null,
        created_at_micros: null,
      },
    ]);

    const [checkpoint] = await listCheckpoints("ses_x");
    expect(checkpoint!.turnNumber).toBe(0);
    expect(checkpoint!.createdAt).toBe(0);
  });
});

// ── rollbackToCheckpoint ──────────────────────────────────────────────

describe("rollbackToCheckpoint", () => {
  it("looks up checkpoint by ID and creates sandbox from snapshot", async () => {
    mockSql.mockResolvedValueOnce([
      {
        checkpoint_id: "ckpt_rollback",
        session_id: "ses_rollback",
        sandbox_id: "sb_old",
        snapshot_id: "snap_old_999",
        label: "rollback point",
        turn_number: 2,
        created_at_micros: 1000000,
      },
    ]);

    const result = await rollbackToCheckpoint("ckpt_rollback", "tok_access");

    expect(mockSandboxCreate).toHaveBeenCalledOnce();
    const createArg = mockSandboxCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg.snapshot).toBe("snap_old_999");
    expect(createArg.token).toBe("tok_access");

    expect(result.newSandboxId).toBe("sandbox_new_456");
  });

  it("calls update_agent_session_sandbox reducer with new sandbox ID", async () => {
    mockSql.mockResolvedValueOnce([
      {
        checkpoint_id: "ckpt_r",
        session_id: "ses_r",
        sandbox_id: "sb_r",
        snapshot_id: "snap_r",
        label: "r",
        turn_number: 1,
        created_at_micros: 1000,
      },
    ]);

    await rollbackToCheckpoint("ckpt_r", "tok");

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("update_agent_session_sandbox");
    expect(args[0]).toBe("ses_r");
    expect(args[1]).toBe("sandbox_new_456");
  });

  it("throws for not-found checkpoint", async () => {
    mockSql.mockResolvedValueOnce([]);

    await expect(
      rollbackToCheckpoint("ckpt_missing", "tok")
    ).rejects.toThrow("Checkpoint ckpt_missing not found");
  });

  it("does not call Sandbox.create when checkpoint is not found", async () => {
    mockSql.mockResolvedValueOnce([]);

    try {
      await rollbackToCheckpoint("ckpt_missing", "tok");
    } catch {
      // expected
    }

    expect(mockSandboxCreate).not.toHaveBeenCalled();
  });
});
