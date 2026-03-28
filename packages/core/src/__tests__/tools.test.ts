import { describe, expect, it } from "vitest";

import {
  AGENT_TOOLS,
  formatToolsForPrompt,
  getAgentTools,
  type ToolDefinition,
} from "../tools";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeManifest(overrides: {
  allowExec?: boolean;
  allowBrowser?: boolean;
  allowNetwork?: boolean;
  allowMcp?: boolean;
} = {}) {
  return {
    tools: {
      allowExec: overrides.allowExec ?? false,
      allowBrowser: overrides.allowBrowser ?? false,
      allowNetwork: overrides.allowNetwork ?? false,
      allowMcp: overrides.allowMcp ?? false,
    },
    tags: [] as string[],
  };
}

// ── Registry Integrity ────────────────────────────────────────────────────────

describe("AGENT_TOOLS registry integrity", () => {
  it("has exactly 30 entries", () => {
    expect(AGENT_TOOLS).toHaveLength(30);
  });

  it("has no duplicate tool names", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("marks vercel_deploy as requiresApproval", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "vercel_deploy");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("marks github_issue as requiresApproval", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "github_issue");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("marks send_email as requiresApproval", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "send_email");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("marks post_message as requiresApproval", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "post_message");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("marks run_code as requiresApproval", () => {
    const tool = AGENT_TOOLS.find((t) => t.name === "run_code");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("has exactly 5 approval-gated tools", () => {
    const approvalTools = AGENT_TOOLS.filter((t) => t.requiresApproval).map((t) => t.name);
    expect(approvalTools.sort()).toEqual(
      ["github_issue", "post_message", "run_code", "send_email", "vercel_deploy"].sort()
    );
  });
});

// ── getAgentTools permission filtering ───────────────────────────────────────

describe("getAgentTools", () => {
  it("returns only context (5) + state (3) = 8 tools when all flags are false", () => {
    const tools = getAgentTools(makeManifest());
    expect(tools).toHaveLength(8);
  });

  it("always includes the 5 context tools", () => {
    const tools = getAgentTools(makeManifest());
    const names = tools.map((t) => t.name);
    expect(names).toContain("query_memory");
    expect(names).toContain("store_memory");
    expect(names).toContain("load_context");
    expect(names).toContain("get_trajectory");
    expect(names).toContain("log_step");
  });

  it("always includes the 3 state tools", () => {
    const tools = getAgentTools(makeManifest());
    const names = tools.map((t) => t.name);
    expect(names).toContain("query_state");
    expect(names).toContain("create_approval");
    expect(names).toContain("handoff");
  });

  it("allowBrowser true alone: adds browse + screenshot = 10 total", () => {
    const tools = getAgentTools(makeManifest({ allowBrowser: true }));
    expect(tools).toHaveLength(10);
    const names = tools.map((t) => t.name);
    expect(names).toContain("browse");
    expect(names).toContain("screenshot");
  });

  it("allowNetwork true alone: adds crypto (8) + platform (4) + communication (4) = 24 total", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    expect(tools).toHaveLength(24);
  });

  it("allowNetwork includes all 8 crypto tools", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const cryptoTools = tools.filter((t) => t.category === "crypto");
    expect(cryptoTools).toHaveLength(8);
  });

  it("allowNetwork includes all 4 platform tools", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const platformTools = tools.filter((t) => t.category === "platform");
    expect(platformTools).toHaveLength(4);
  });

  it("allowNetwork includes all 4 communication tools", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const commTools = tools.filter((t) => t.category === "communication");
    expect(commTools).toHaveLength(4);
  });

  it("allowExec true alone: adds execution (4) = 12 total", () => {
    const tools = getAgentTools(makeManifest({ allowExec: true }));
    expect(tools).toHaveLength(12);
    const execTools = tools.filter((t) => t.category === "execution");
    expect(execTools).toHaveLength(4);
  });

  it("all flags true: returns all 30 tools", () => {
    const tools = getAgentTools(
      makeManifest({ allowExec: true, allowBrowser: true, allowNetwork: true, allowMcp: true })
    );
    expect(tools).toHaveLength(30);
  });

  it("does not include browser tools when allowBrowser is false", () => {
    const tools = getAgentTools(makeManifest());
    const browserTools = tools.filter((t) => t.category === "browser");
    expect(browserTools).toHaveLength(0);
  });

  it("does not include execution tools when allowExec is false", () => {
    const tools = getAgentTools(makeManifest({ allowBrowser: true, allowNetwork: true }));
    const execTools = tools.filter((t) => t.category === "execution");
    expect(execTools).toHaveLength(0);
  });

  it("requiresApproval flag is preserved on vercel_deploy when returned", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const tool = tools.find((t) => t.name === "vercel_deploy");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("requiresApproval flag is preserved on github_issue when returned", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const tool = tools.find((t) => t.name === "github_issue");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("requiresApproval flag is preserved on send_email when returned", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const tool = tools.find((t) => t.name === "send_email");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("requiresApproval flag is preserved on post_message when returned", () => {
    const tools = getAgentTools(makeManifest({ allowNetwork: true }));
    const tool = tools.find((t) => t.name === "post_message");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("requiresApproval flag is preserved on run_code when returned", () => {
    const tools = getAgentTools(makeManifest({ allowExec: true }));
    const tool = tools.find((t) => t.name === "run_code");
    expect(tool?.requiresApproval).toBe(true);
  });

  it("allowMcp flag alone does not add extra tools beyond context + state", () => {
    const tools = getAgentTools(makeManifest({ allowMcp: true }));
    expect(tools).toHaveLength(8);
  });
});

// ── formatToolsForPrompt output ───────────────────────────────────────────────

describe("formatToolsForPrompt", () => {
  it("returns empty string for empty array", () => {
    expect(formatToolsForPrompt([])).toBe("");
  });

  it("renders category header in uppercase", () => {
    const tool: ToolDefinition = {
      name: "query_memory",
      description: "Search memory",
      category: "context",
      params: [],
      requiresApproval: false,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).toContain("## CONTEXT");
  });

  it("renders tool name in bold", () => {
    const tool: ToolDefinition = {
      name: "query_memory",
      description: "Search memory",
      category: "context",
      params: [],
      requiresApproval: false,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).toContain("**query_memory**");
  });

  it("marks optional param with ? suffix", () => {
    const tool: ToolDefinition = {
      name: "query_memory",
      description: "Search memory",
      category: "context",
      params: [
        { name: "max_chunks", type: "number", required: false, description: "Max chunks" },
      ],
      requiresApproval: false,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).toContain("max_chunks?");
  });

  it("does not mark required param with ?", () => {
    const tool: ToolDefinition = {
      name: "query_memory",
      description: "Search memory",
      category: "context",
      params: [
        { name: "query", type: "string", required: true, description: "Search query" },
      ],
      requiresApproval: false,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).toContain("query: string");
    expect(output).not.toContain("query?");
  });

  it("appends [APPROVAL] for tools that requiresApproval", () => {
    const tool: ToolDefinition = {
      name: "vercel_deploy",
      description: "Deploy to Vercel",
      category: "platform",
      params: [],
      requiresApproval: true,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).toContain("[APPROVAL]");
  });

  it("does not append [APPROVAL] for tools that do not require approval", () => {
    const tool: ToolDefinition = {
      name: "query_memory",
      description: "Search memory",
      category: "context",
      params: [],
      requiresApproval: false,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).not.toContain("[APPROVAL]");
  });

  it("renders multiple category headers for tools from different categories", () => {
    const tools: ToolDefinition[] = [
      {
        name: "query_memory",
        description: "Search memory",
        category: "context",
        params: [],
        requiresApproval: false,
      },
      {
        name: "browse",
        description: "Browse a URL",
        category: "browser",
        params: [],
        requiresApproval: false,
      },
    ];
    const output = formatToolsForPrompt(tools);
    expect(output).toContain("## CONTEXT");
    expect(output).toContain("## BROWSER");
  });

  it("includes the tool description in output", () => {
    const tool: ToolDefinition = {
      name: "query_memory",
      description: "Search vector memory for relevant prior knowledge",
      category: "context",
      params: [],
      requiresApproval: false,
    };
    const output = formatToolsForPrompt([tool]);
    expect(output).toContain("Search vector memory for relevant prior knowledge");
  });

  it("formats full AGENT_TOOLS list without throwing", () => {
    expect(() => formatToolsForPrompt(AGENT_TOOLS)).not.toThrow();
  });

  it("full registry output contains all 7 category headers", () => {
    const output = formatToolsForPrompt(AGENT_TOOLS);
    expect(output).toContain("## CONTEXT");
    expect(output).toContain("## STATE");
    expect(output).toContain("## BROWSER");
    expect(output).toContain("## CRYPTO");
    expect(output).toContain("## PLATFORM");
    expect(output).toContain("## COMMUNICATION");
    expect(output).toContain("## EXECUTION");
  });
});
