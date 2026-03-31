/**
 * Tests for apps/web/lib/agent-catalog.ts
 *
 * Strategy:
 *  - createControlClient is mocked; its sql stub controls what "user configs"
 *    come back from SpacetimeDB.
 *  - cloudAgentCatalog is mocked to provide a small, stable set of built-in
 *    agents so tests are isolated from catalog changes.
 *  - getAvailableAgents is exercised for: built-ins only, user override of a
 *    built-in, user-only custom agent, and SpacetimeDB failure (graceful).
 *  - saveAgentConfig is exercised for: correct reducer name, correct configId
 *    format, correct reducer arguments, optional fields defaulting to "".
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockClient = {
  sql: vi.fn(),
  callReducer: vi.fn(),
};

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

vi.mock("@/lib/cloud-agents", () => ({
  cloudAgentCatalog: [
    {
      id: "voyager",
      name: "Voyager",
      description: "Coding agent",
      runtime: "sandbox",
      model: "anthropic/claude-sonnet-4.5",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-sandbox",
        workflow: "code",
      },
      tags: ["code"],
      tools: { allowExec: true, allowBrowser: false, allowNetwork: true, allowMcp: true },
    },
    {
      id: "saturn",
      name: "Saturn",
      description: "Ops agent",
      runtime: "edge-function",
      model: "anthropic/claude-sonnet-4.5",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "ops",
      },
      tags: ["ops"],
      tools: { allowExec: false, allowBrowser: true, allowNetwork: true, allowMcp: true },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { getAvailableAgents, saveAgentConfig } from "@/lib/agent-catalog";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.callReducer.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// getAvailableAgents — built-ins only
// ---------------------------------------------------------------------------

describe("getAvailableAgents — built-ins only (no user configs)", () => {
  it("returns built-in agents when the SQL query returns no user configs", async () => {
    mockClient.sql.mockResolvedValue([]);

    const agents = await getAvailableAgents("op_42");

    expect(agents).toHaveLength(2);
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("voyager");
    expect(ids).toContain("saturn");
  });

  it("marks every built-in agent with isBuiltIn=true", async () => {
    mockClient.sql.mockResolvedValue([]);

    const agents = await getAvailableAgents("op_42");
    for (const agent of agents) {
      expect(agent.isBuiltIn).toBe(true);
    }
  });

  it("sets hasSandbox=true for vercel-sandbox agents", async () => {
    mockClient.sql.mockResolvedValue([]);

    const agents = await getAvailableAgents("op_42");
    const voyager = agents.find((a) => a.id === "voyager")!;
    expect(voyager.hasSandbox).toBe(true);
  });

  it("sets hasSandbox=false for non-sandbox agents", async () => {
    mockClient.sql.mockResolvedValue([]);

    const agents = await getAvailableAgents("op_42");
    const saturn = agents.find((a) => a.id === "saturn")!;
    expect(saturn.hasSandbox).toBe(false);
  });

  it("populates name, description, runtime, execution, and model fields", async () => {
    mockClient.sql.mockResolvedValue([]);

    const agents = await getAvailableAgents("op_42");
    const voyager = agents.find((a) => a.id === "voyager")!;
    expect(voyager.name).toBe("Voyager");
    expect(voyager.description).toBe("Coding agent");
    expect(voyager.runtime).toBe("sandbox");
    expect(voyager.execution).toBe("vercel-sandbox");
    expect(voyager.model).toBe("anthropic/claude-sonnet-4.5");
  });
});

// ---------------------------------------------------------------------------
// getAvailableAgents — user config overrides a built-in
// ---------------------------------------------------------------------------

describe("getAvailableAgents — user config overrides a built-in", () => {
  it("merges user config fields onto the matching built-in agent", async () => {
    mockClient.sql.mockResolvedValue([
      {
        config_id: "cfg_op_42_voyager",
        agent_id: "voyager",
        operator_id: "op_42",
        display_name: "My Voyager",
        model_override: "anthropic/claude-opus-4",
        repo_url: "https://github.com/user/repo",
        repo_branch: "main",
        sandbox_snapshot_id: "snap_abc",
      },
    ]);

    const agents = await getAvailableAgents("op_42");

    // Total count is still 2 (override, not addition)
    expect(agents).toHaveLength(2);

    const voyager = agents.find((a) => a.id === "voyager")!;
    expect(voyager.configId).toBe("cfg_op_42_voyager");
    expect(voyager.modelOverride).toBe("anthropic/claude-opus-4");
    expect(voyager.repoUrl).toBe("https://github.com/user/repo");
    expect(voyager.repoBranch).toBe("main");
    expect(voyager.sandboxSnapshotId).toBe("snap_abc");
  });

  it("preserves isBuiltIn=true when a built-in is overridden by a user config", async () => {
    mockClient.sql.mockResolvedValue([
      {
        config_id: "cfg_op_42_saturn",
        agent_id: "saturn",
        operator_id: "op_42",
        display_name: "My Saturn",
        model_override: "",
        repo_url: "",
        repo_branch: "",
        sandbox_snapshot_id: "",
      },
    ]);

    const agents = await getAvailableAgents("op_42");
    const saturn = agents.find((a) => a.id === "saturn")!;
    expect(saturn.isBuiltIn).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableAgents — user-created custom agent (no matching built-in)
// ---------------------------------------------------------------------------

describe("getAvailableAgents — custom user agent", () => {
  it("adds a custom agent when the user config has no matching built-in id", async () => {
    mockClient.sql.mockResolvedValue([
      {
        config_id: "cfg_op_42_custom",
        agent_id: "my-custom-agent",
        operator_id: "op_42",
        display_name: "My Custom Agent",
        model_override: "anthropic/claude-haiku-3",
        repo_url: "https://github.com/user/custom",
        repo_branch: "dev",
        sandbox_snapshot_id: "",
      },
    ]);

    const agents = await getAvailableAgents("op_42");

    // 2 built-ins + 1 custom = 3
    expect(agents).toHaveLength(3);

    const custom = agents.find((a) => a.id === "my-custom-agent")!;
    expect(custom).toBeDefined();
    expect(custom.isBuiltIn).toBe(false);
    expect(custom.name).toBe("My Custom Agent");
    expect(custom.model).toBe("anthropic/claude-haiku-3");
    expect(custom.hasSandbox).toBe(true);
    expect(custom.execution).toBe("vercel-sandbox");
  });

  it("uses the agentId as the display name when display_name is missing", async () => {
    mockClient.sql.mockResolvedValue([
      {
        config_id: "cfg_op_42_anon",
        agent_id: "anon-agent",
        operator_id: "op_42",
        display_name: "",
        model_override: "",
        repo_url: "",
        repo_branch: "",
        sandbox_snapshot_id: "",
      },
    ]);

    const agents = await getAvailableAgents("op_42");
    const custom = agents.find((a) => a.id === "anon-agent")!;
    expect(custom.name).toBe("anon-agent");
  });
});

// ---------------------------------------------------------------------------
// getAvailableAgents — SpacetimeDB failure (graceful degradation)
// ---------------------------------------------------------------------------

describe("getAvailableAgents — SpacetimeDB failure", () => {
  it("still returns built-in agents when the SQL query throws", async () => {
    mockClient.sql.mockRejectedValue(new Error("SpacetimeDB connection refused"));

    const agents = await getAvailableAgents("op_42");

    // Should fall back to built-ins only
    expect(agents).toHaveLength(2);
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("voyager");
    expect(ids).toContain("saturn");
  });

  it("does not throw when SpacetimeDB is unavailable", async () => {
    mockClient.sql.mockRejectedValue(new Error("timeout"));
    await expect(getAvailableAgents("op_42")).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// saveAgentConfig
// ---------------------------------------------------------------------------

describe("saveAgentConfig", () => {
  it("calls the upsert_user_agent_config reducer", async () => {
    await saveAgentConfig({
      operatorId: "op_42",
      agentId: "voyager",
      displayName: "Voyager",
    });

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(reducerName).toBe("upsert_user_agent_config");
  });

  it("returns the correct configId (cfg_{operatorId}_{agentId})", async () => {
    const configId = await saveAgentConfig({
      operatorId: "op_42",
      agentId: "voyager",
      displayName: "Voyager",
    });

    expect(configId).toBe("cfg_op_42_voyager");
  });

  it("passes all required fields to the reducer in the correct positions", async () => {
    await saveAgentConfig({
      operatorId: "op_42",
      agentId: "voyager",
      displayName: "Voyager",
      modelOverride: "anthropic/claude-opus-4",
      repoUrl: "https://github.com/user/repo",
      repoBranch: "main",
      sandboxSnapshotId: "snap_xyz",
    });

    const [, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(args[0]).toBe("cfg_op_42_voyager");  // configId
    expect(args[1]).toBe("op_42");              // operatorId
    expect(args[2]).toBe("voyager");            // agentId
    expect(args[3]).toBe("Voyager");            // displayName
    expect(args[4]).toBe("anthropic/claude-opus-4"); // modelOverride
    expect(args[6]).toBe("https://github.com/user/repo"); // repoUrl
    expect(args[7]).toBe("main");              // repoBranch
    expect(args[8]).toBe("snap_xyz");          // sandboxSnapshotId
  });

  it("defaults optional string fields to empty string when not provided", async () => {
    await saveAgentConfig({
      operatorId: "op_42",
      agentId: "voyager",
      displayName: "Voyager",
    });

    const [, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(args[4]).toBe("");  // modelOverride
    expect(args[5]).toBe("");  // apiKeyEncrypted
    expect(args[6]).toBe("");  // repoUrl
    expect(args[7]).toBe("");  // repoBranch
    expect(args[8]).toBe("");  // sandboxSnapshotId
  });

  it("serialises extraEnv as a JSON string in the reducer args", async () => {
    await saveAgentConfig({
      operatorId: "op_42",
      agentId: "voyager",
      displayName: "Voyager",
      extraEnv: { MY_VAR: "value1", OTHER: "value2" },
    });

    const [, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    const extraEnvArg = args[9] as string;
    expect(JSON.parse(extraEnvArg)).toEqual({ MY_VAR: "value1", OTHER: "value2" });
  });

  it("defaults extraEnv to '{}' when not provided", async () => {
    await saveAgentConfig({
      operatorId: "op_42",
      agentId: "voyager",
      displayName: "Voyager",
    });

    const [, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(args[9]).toBe("{}");
  });
});
