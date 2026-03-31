/**
 * Tests for apps/web/lib/durable-approval.ts
 *
 * Strategy: mock createControlClient so that every function in the module
 * receives a predictable mockClient. crypto.randomUUID is replaced with a
 * deterministic stub.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock client
// ---------------------------------------------------------------------------

const mockClient = {
  callReducer: vi.fn(),
};

vi.mock("./server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createApprovalRequest, resolveApprovalRecord } from "./durable-approval";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function stubUUID() {
  vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_UUID as ReturnType<typeof crypto.randomUUID>);
}

// ---------------------------------------------------------------------------
// createApprovalRequest
// ---------------------------------------------------------------------------

describe("createApprovalRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubUUID();
  });

  it("returns the generated approvalId (UUID)", async () => {
    mockClient.callReducer.mockResolvedValue(undefined);

    const id = await createApprovalRequest({
      runId: "run_123",
      agentId: "agent_saturn",
      stepName: "approval-check",
      context: "Please review the plan",
    });

    expect(id).toBe(FIXED_UUID);
  });

  it("calls the 'create_approval' reducer with the correct positional args", async () => {
    mockClient.callReducer.mockResolvedValue(undefined);

    await createApprovalRequest({
      runId: "run_123",
      agentId: "agent_saturn",
      stepName: "approval-check",
      context: "Please review the plan",
    });

    expect(mockClient.callReducer).toHaveBeenCalledTimes(1);
    const [reducerName, args] = mockClient.callReducer.mock.calls[0]!;
    expect(reducerName).toBe("create_approval");

    // Positional args: approvalId, runId, agentId, stepName, context, status, priority, timestamp
    expect(args[0]).toBe(FIXED_UUID);
    expect(args[1]).toBe("run_123");
    expect(args[2]).toBe("agent_saturn");
    expect(args[3]).toBe("approval-check");
    expect(args[4]).toBe("Please review the plan");
    expect(args[5]).toBe("pending");
    expect(args[6]).toBe("medium");
    expect(typeof args[7]).toBe("number"); // timestamp
  });

  it("generates a fresh UUID on each invocation", async () => {
    mockClient.callReducer.mockResolvedValue(undefined);

    // Restore the real UUID for this test
    vi.restoreAllMocks();

    const id1 = await createApprovalRequest({ runId: "r1", agentId: "a", stepName: "s", context: "c" });
    const id2 = await createApprovalRequest({ runId: "r2", agentId: "a", stepName: "s", context: "c" });

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/i);
    expect(id2).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("propagates reducer errors to the caller", async () => {
    mockClient.callReducer.mockRejectedValue(new Error("SpacetimeDB write failed"));

    await expect(
      createApprovalRequest({ runId: "run_err", agentId: "a", stepName: "s", context: "c" }),
    ).rejects.toThrow("SpacetimeDB write failed");
  });
});

// ---------------------------------------------------------------------------
// resolveApprovalRecord
// ---------------------------------------------------------------------------

describe("resolveApprovalRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls 'resolve_approval' reducer with 'approved' status when result.approved is true", async () => {
    mockClient.callReducer.mockResolvedValue(undefined);

    await resolveApprovalRecord("approval_xyz", {
      approved: true,
      comment: "Looks good",
      operatorId: "op_001",
    });

    expect(mockClient.callReducer).toHaveBeenCalledTimes(1);
    const [reducerName, args] = mockClient.callReducer.mock.calls[0]!;
    expect(reducerName).toBe("resolve_approval");
    expect(args[0]).toBe("approval_xyz");
    expect(args[1]).toBe("approved");
    expect(args[2]).toBe("op_001");
    expect(args[3]).toBe("Looks good");
    expect(typeof args[4]).toBe("number");
  });

  it("calls 'resolve_approval' reducer with 'rejected' status when result.approved is false", async () => {
    mockClient.callReducer.mockResolvedValue(undefined);

    await resolveApprovalRecord("approval_xyz", {
      approved: false,
      comment: "Not ready",
      operatorId: "op_002",
    });

    const [, args] = mockClient.callReducer.mock.calls[0]!;
    expect(args[1]).toBe("rejected");
  });

  it("uses empty string when comment is undefined", async () => {
    mockClient.callReducer.mockResolvedValue(undefined);

    await resolveApprovalRecord("approval_abc", {
      approved: true,
      operatorId: "op_003",
    });

    const [, args] = mockClient.callReducer.mock.calls[0]!;
    expect(args[3]).toBe("");
  });

  it("propagates reducer errors to the caller", async () => {
    mockClient.callReducer.mockRejectedValue(new Error("reducer error"));

    await expect(
      resolveApprovalRecord("approval_fail", { approved: true, operatorId: "op_x" }),
    ).rejects.toThrow("reducer error");
  });
});
