/**
 * Tests for apps/web/lib/agent-runtime/registry.ts
 *
 * Strategy:
 *   - No external dependencies — registry.ts is pure data + pure functions.
 *   - Verify the shape and completeness of AGENT_REGISTRY.
 *   - Verify getAgentConfig lookup behaviour (found, not found).
 *   - Verify getAgentsByCapability filtering.
 *   - Verify getAllCapabilities deduplication and sort order.
 */

import { describe, expect, it } from "vitest";
import {
  AGENT_REGISTRY,
  getAgentConfig,
  getAgentsByCapability,
  getAllCapabilities,
} from "./registry";

// ---------------------------------------------------------------------------
// AGENT_REGISTRY — shape validation
// ---------------------------------------------------------------------------

describe("AGENT_REGISTRY — shape and completeness", () => {
  it("contains exactly 6 agents", () => {
    expect(AGENT_REGISTRY).toHaveLength(6);
  });

  it("every agent has a non-empty id", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.id).toBeTruthy();
    }
  });

  it("every agent has a non-empty name", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.name).toBeTruthy();
    }
  });

  it("every agent has a non-empty command", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.command).toBeTruthy();
    }
  });

  it("every agent has a non-empty installCommand", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.installCommand).toBeTruthy();
    }
  });

  it("every agent has a non-empty checkCommand", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.checkCommand).toBeTruthy();
    }
  });

  it("every agent has at least one capability", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("every agent has a non-empty defaultModel in 'provider/model' format", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.defaultModel).toMatch(/^[a-z0-9-]+\/.+/);
    }
  });

  it("every agent has a non-empty apiKeyEnvVar", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.apiKeyEnvVar).toBeTruthy();
    }
  });

  it("every agent has a non-empty description", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(agent.description).toBeTruthy();
    }
  });

  it("every agent has a boolean supportsAcp field", () => {
    for (const agent of AGENT_REGISTRY) {
      expect(typeof agent.supportsAcp).toBe("boolean");
    }
  });

  it("all agent ids are unique", () => {
    const ids = AGENT_REGISTRY.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("contains the expected set of agent ids", () => {
    const ids = AGENT_REGISTRY.map((a) => a.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("codex");
    expect(ids).toContain("gemini-cli");
    expect(ids).toContain("aider");
    expect(ids).toContain("cursor-agent");
    expect(ids).toContain("copilot");
  });
});

// ---------------------------------------------------------------------------
// getAgentConfig
// ---------------------------------------------------------------------------

describe("getAgentConfig", () => {
  it("returns the correct config for claude-code", () => {
    const config = getAgentConfig("claude-code");
    expect(config).toBeDefined();
    expect(config!.id).toBe("claude-code");
    expect(config!.name).toBe("Claude Code");
    expect(config!.apiKeyEnvVar).toBe("ANTHROPIC_API_KEY");
  });

  it("returns the correct config for codex", () => {
    const config = getAgentConfig("codex");
    expect(config).toBeDefined();
    expect(config!.id).toBe("codex");
    expect(config!.name).toBe("Codex CLI");
    expect(config!.supportsAcp).toBe(true);
  });

  it("returns the correct config for gemini-cli", () => {
    const config = getAgentConfig("gemini-cli");
    expect(config).toBeDefined();
    expect(config!.id).toBe("gemini-cli");
    expect(config!.apiKeyEnvVar).toBe("GOOGLE_API_KEY");
  });

  it("returns the correct config for aider", () => {
    const config = getAgentConfig("aider");
    expect(config).toBeDefined();
    expect(config!.id).toBe("aider");
    expect(config!.supportsAcp).toBe(false);
  });

  it("returns the correct config for cursor-agent", () => {
    const config = getAgentConfig("cursor-agent");
    expect(config).toBeDefined();
    expect(config!.id).toBe("cursor-agent");
    expect(config!.apiKeyEnvVar).toBe("CURSOR_API_KEY");
  });

  it("returns the correct config for copilot", () => {
    const config = getAgentConfig("copilot");
    expect(config).toBeDefined();
    expect(config!.id).toBe("copilot");
    expect(config!.apiKeyEnvVar).toBe("GITHUB_TOKEN");
    expect(config!.supportsAcp).toBe(true);
  });

  it("returns undefined for an unknown agent id", () => {
    expect(getAgentConfig("unknown-agent")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getAgentConfig("")).toBeUndefined();
  });

  it("is case-sensitive (upper-case id returns undefined)", () => {
    expect(getAgentConfig("Claude-Code")).toBeUndefined();
  });

  it("returns the same object reference as the registry entry", () => {
    const config = getAgentConfig("codex");
    const registryEntry = AGENT_REGISTRY.find((a) => a.id === "codex");
    expect(config).toBe(registryEntry);
  });
});

// ---------------------------------------------------------------------------
// getAgentsByCapability
// ---------------------------------------------------------------------------

describe("getAgentsByCapability", () => {
  it("returns all agents that include the 'code' capability", () => {
    const agents = getAgentsByCapability("code");
    // All 6 agents have 'code'
    expect(agents.length).toBe(6);
    for (const a of agents) {
      expect(a.capabilities).toContain("code");
    }
  });

  it("returns only agents that include the 'refactor' capability", () => {
    const agents = getAgentsByCapability("refactor");
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("aider");
    expect(ids).toContain("cursor-agent");
    // codex, gemini-cli and copilot do not have refactor
    expect(ids).not.toContain("codex");
    expect(ids).not.toContain("gemini-cli");
    expect(ids).not.toContain("copilot");
  });

  it("returns only agents that include the 'research' capability", () => {
    const agents = getAgentsByCapability("research");
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("gemini-cli");
    expect(agents.length).toBe(1);
  });

  it("returns an empty array for an unknown capability", () => {
    expect(getAgentsByCapability("teleportation")).toEqual([]);
  });

  it("returns an empty array for an empty capability string", () => {
    expect(getAgentsByCapability("")).toEqual([]);
  });

  it("returns agents for 'test' capability", () => {
    const agents = getAgentsByCapability("test");
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("codex");
    expect(ids).toContain("copilot");
  });

  it("does not mutate the original registry entries", () => {
    const agents = getAgentsByCapability("code");
    expect(agents).not.toBe(AGENT_REGISTRY);
  });
});

// ---------------------------------------------------------------------------
// getAllCapabilities
// ---------------------------------------------------------------------------

describe("getAllCapabilities", () => {
  it("returns a non-empty array", () => {
    const caps = getAllCapabilities();
    expect(caps.length).toBeGreaterThan(0);
  });

  it("returns a sorted array (ascending alphabetical)", () => {
    const caps = getAllCapabilities();
    const sorted = [...caps].sort();
    expect(caps).toEqual(sorted);
  });

  it("contains no duplicate entries", () => {
    const caps = getAllCapabilities();
    const unique = new Set(caps);
    expect(unique.size).toBe(caps.length);
  });

  it("includes all expected capabilities from the registry", () => {
    const caps = getAllCapabilities();
    expect(caps).toContain("code");
    expect(caps).toContain("debug");
    expect(caps).toContain("test");
    expect(caps).toContain("refactor");
    expect(caps).toContain("review");
    expect(caps).toContain("explain");
    expect(caps).toContain("architect");
    expect(caps).toContain("research");
    expect(caps).toContain("explain");
  });

  it("returns strings (not objects)", () => {
    const caps = getAllCapabilities();
    for (const cap of caps) {
      expect(typeof cap).toBe("string");
    }
  });
});
