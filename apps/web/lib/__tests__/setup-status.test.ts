/**
 * Tests for apps/web/lib/setup-status.ts
 *
 * Strategy:
 *  - createControlClient (from ./server) is mocked — its sql stub drives
 *    all combinations of SpacetimeDB reachability and data presence.
 *  - hasSpacetimeConfig (from ./env) is mocked to control the early-exit
 *    path before any DB call is made.
 *  - getSetupSteps is a pure function requiring no mocks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const { mockClient, mockHasSpacetimeConfig } = vi.hoisted(() => ({
  mockClient: {
    sql: vi.fn(),
  },
  mockHasSpacetimeConfig: vi.fn(),
}));

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

vi.mock("@/lib/env", () => ({
  hasSpacetimeConfig: mockHasSpacetimeConfig,
  getServerEnv: vi.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { getSetupStatus, getSetupSteps, type SetupStatus } from "@/lib/setup-status";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStatus(overrides: Partial<SetupStatus> = {}): SetupStatus {
  return {
    spacetimeDbReachable: false,
    hasVercelToken: false,
    hasAgentConfigured: false,
    hasCompletedFirstRun: false,
    agentCount: 0,
    runCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: SpacetimeDB is configured
  mockHasSpacetimeConfig.mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// getSetupStatus — SpacetimeDB not configured
// ---------------------------------------------------------------------------

describe("getSetupStatus — SpacetimeDB not configured", () => {
  it("returns all-false status when hasSpacetimeConfig returns false", async () => {
    mockHasSpacetimeConfig.mockReturnValue(false);

    const status = await getSetupStatus("op_42");

    expect(status.spacetimeDbReachable).toBe(false);
    expect(status.hasVercelToken).toBe(false);
    expect(status.hasAgentConfigured).toBe(false);
    expect(status.hasCompletedFirstRun).toBe(false);
    expect(status.agentCount).toBe(0);
    expect(status.runCount).toBe(0);
  });

  it("does not call createControlClient when hasSpacetimeConfig is false", async () => {
    mockHasSpacetimeConfig.mockReturnValue(false);
    await getSetupStatus("op_42");
    expect(mockClient.sql).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getSetupStatus — SpacetimeDB unreachable
// ---------------------------------------------------------------------------

describe("getSetupStatus — SpacetimeDB unreachable", () => {
  it("returns spacetimeDbReachable=false and all-zero counts when SQL throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("connection refused"));

    const status = await getSetupStatus("op_42");

    expect(status.spacetimeDbReachable).toBe(false);
    expect(status.hasVercelToken).toBe(false);
    expect(status.hasAgentConfigured).toBe(false);
    expect(status.hasCompletedFirstRun).toBe(false);
  });

  it("does not throw when SpacetimeDB is unreachable", async () => {
    mockClient.sql.mockRejectedValue(new Error("timeout"));
    await expect(getSetupStatus("op_42")).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getSetupStatus — SpacetimeDB reachable, no data
// ---------------------------------------------------------------------------

describe("getSetupStatus — reachable, no data", () => {
  beforeEach(() => {
    // SELECT 1 — ping succeeds
    // token query — empty
    // agent query — empty
    // run query — empty
    mockClient.sql
      .mockResolvedValueOnce([{ "1": 1 }])   // SELECT 1
      .mockResolvedValueOnce([])              // operator_token
      .mockResolvedValueOnce([])              // agent_record
      .mockResolvedValueOnce([]);             // workflow_run
  });

  it("sets spacetimeDbReachable=true", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.spacetimeDbReachable).toBe(true);
  });

  it("sets hasVercelToken=false when token table is empty", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.hasVercelToken).toBe(false);
  });

  it("sets hasAgentConfigured=false when agent_record is empty", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.hasAgentConfigured).toBe(false);
    expect(status.agentCount).toBe(0);
  });

  it("sets hasCompletedFirstRun=false when workflow_run is empty", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.hasCompletedFirstRun).toBe(false);
    expect(status.runCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getSetupStatus — all data present
// ---------------------------------------------------------------------------

describe("getSetupStatus — reachable, all data present", () => {
  beforeEach(() => {
    mockClient.sql
      .mockResolvedValueOnce([{ "1": 1 }])                                 // SELECT 1
      .mockResolvedValueOnce([{ operator_id: "op_42" }])                   // operator_token
      .mockResolvedValueOnce([{ agent_id: "voyager" }, { agent_id: "saturn" }]) // agent_record
      .mockResolvedValueOnce([{ run_id: "run_1" }]);                       // workflow_run
  });

  it("sets hasVercelToken=true when token row exists for the operator", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.hasVercelToken).toBe(true);
  });

  it("sets hasAgentConfigured=true and correct agentCount", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.hasAgentConfigured).toBe(true);
    expect(status.agentCount).toBe(2);
  });

  it("sets hasCompletedFirstRun=true when a run row exists", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.hasCompletedFirstRun).toBe(true);
    expect(status.runCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getSetupStatus — partial data (token yes, no agents, no runs)
// ---------------------------------------------------------------------------

describe("getSetupStatus — partial data (token yes, no agents)", () => {
  beforeEach(() => {
    mockClient.sql
      .mockResolvedValueOnce([{ "1": 1 }])
      .mockResolvedValueOnce([{ operator_id: "op_42" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it("reflects the correct partial state", async () => {
    const status = await getSetupStatus("op_42");
    expect(status.spacetimeDbReachable).toBe(true);
    expect(status.hasVercelToken).toBe(true);
    expect(status.hasAgentConfigured).toBe(false);
    expect(status.hasCompletedFirstRun).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSetupSteps — step shapes
// ---------------------------------------------------------------------------

describe("getSetupSteps — step shapes", () => {
  it("returns exactly 4 steps", () => {
    const steps = getSetupSteps(makeStatus());
    expect(steps).toHaveLength(4);
  });

  it("every step has id, label, and complete fields", () => {
    const steps = getSetupSteps(makeStatus());
    for (const step of steps) {
      expect(typeof step.id).toBe("string");
      expect(typeof step.label).toBe("string");
      expect(typeof step.complete).toBe("boolean");
    }
  });

  it("signin step is always complete", () => {
    const steps = getSetupSteps(makeStatus({ hasVercelToken: false }));
    const signin = steps.find((s) => s.id === "signin")!;
    expect(signin.complete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getSetupSteps — completion flags
// ---------------------------------------------------------------------------

describe("getSetupSteps — completion flags mirror SetupStatus", () => {
  it("vercel step is complete when hasVercelToken=true", () => {
    const steps = getSetupSteps(makeStatus({ hasVercelToken: true }));
    const vercel = steps.find((s) => s.id === "vercel")!;
    expect(vercel.complete).toBe(true);
  });

  it("vercel step is incomplete when hasVercelToken=false", () => {
    const steps = getSetupSteps(makeStatus({ hasVercelToken: false }));
    const vercel = steps.find((s) => s.id === "vercel")!;
    expect(vercel.complete).toBe(false);
  });

  it("agent step is complete when hasAgentConfigured=true", () => {
    const steps = getSetupSteps(makeStatus({ hasAgentConfigured: true }));
    const agent = steps.find((s) => s.id === "agent")!;
    expect(agent.complete).toBe(true);
  });

  it("agent step is incomplete when hasAgentConfigured=false", () => {
    const steps = getSetupSteps(makeStatus({ hasAgentConfigured: false }));
    const agent = steps.find((s) => s.id === "agent")!;
    expect(agent.complete).toBe(false);
  });

  it("run step is complete when hasCompletedFirstRun=true", () => {
    const steps = getSetupSteps(makeStatus({ hasCompletedFirstRun: true }));
    const run = steps.find((s) => s.id === "run")!;
    expect(run.complete).toBe(true);
  });

  it("run step is incomplete when hasCompletedFirstRun=false", () => {
    const steps = getSetupSteps(makeStatus({ hasCompletedFirstRun: false }));
    const run = steps.find((s) => s.id === "run")!;
    expect(run.complete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSetupSteps — action URLs
// ---------------------------------------------------------------------------

describe("getSetupSteps — action URLs", () => {
  it("vercel step has an action pointing to /api/auth/vercel/authorize", () => {
    const steps = getSetupSteps(makeStatus());
    const vercel = steps.find((s) => s.id === "vercel")!;
    expect(vercel.action).toBe("/api/auth/vercel/authorize");
    expect(vercel.actionLabel).toBeDefined();
  });

  it("signin step has no action (always complete, no CTA needed)", () => {
    const steps = getSetupSteps(makeStatus());
    const signin = steps.find((s) => s.id === "signin")!;
    expect(signin.action).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getSetupSteps — all steps complete (fully set-up operator)
// ---------------------------------------------------------------------------

describe("getSetupSteps — fully set-up operator", () => {
  it("all steps are marked complete", () => {
    const steps = getSetupSteps(
      makeStatus({
        hasVercelToken: true,
        hasAgentConfigured: true,
        hasCompletedFirstRun: true,
      }),
    );
    for (const step of steps) {
      expect(step.complete).toBe(true);
    }
  });
});
