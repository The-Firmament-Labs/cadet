import { describe, expect, it } from "vitest";

import type { AgentManifest, BrowserToolPolicy } from "../agent-manifest";
import {
  browserModeRequiresApproval,
  defaultWorkflowStages,
  inferBrowserMode,
  inferBrowserNeed,
  ownerExecutionForStage,
  seedWorkflowFromGoal,
  titleForGoal
} from "../orchestration";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeManifest(overrides?: Partial<AgentManifest["tools"]["browser"]> & {
  execution?: AgentManifest["deployment"]["execution"];
  browserEnabled?: boolean;
}): AgentManifest {
  const enabled = overrides?.browserEnabled ?? true;
  const browser: BrowserToolPolicy = {
    enabled,
    allowedDomains: [],
    blockedDomains: [],
    maxConcurrentSessions: 2,
    allowDownloads: overrides?.allowDownloads ?? false,
    defaultMode: overrides?.defaultMode ?? "read",
    requiresApprovalFor: overrides?.requiresApprovalFor ?? ["form", "download"]
  };

  return {
    id: "test-agent",
    name: "Test Agent",
    description: "Agent for tests",
    system: "Be precise",
    model: "gpt-5.4",
    runtime: "rust-core",
    deployment: {
      controlPlane: "local",
      execution: overrides?.execution ?? "local-runner",
      workflow: "default"
    },
    tags: ["test"],
    tools: {
      allowExec: false,
      allowBrowser: enabled,
      allowNetwork: true,
      allowMcp: true,
      browser
    },
    memory: { namespace: "test", maxNotes: 100, summarizeAfter: 10 },
    schedules: [],
    workflowTemplates: [{ id: "default", description: "Default", stages: [...defaultWorkflowStages] }],
    toolProfiles: [],
    handoffRules: [],
    learningPolicy: {
      enabled: true,
      summarizeEveryRuns: 5,
      embedMemory: true,
      maxRetrievedChunks: 8
    }
  };
}

const createId = () => "test_id";

const baseOptions = {
  channel: "web" as const,
  requestedBy: "user_1",
  actor: "user_1",
  goal: "Do a simple task",
  triggerSource: "api",
  createId
};

// ---------------------------------------------------------------------------
// inferBrowserNeed
// ---------------------------------------------------------------------------

describe("inferBrowserNeed", () => {
  it("returns false when browser.enabled is false even if goal contains 'browser'", () => {
    const manifest = makeManifest({ browserEnabled: false });
    expect(inferBrowserNeed("open a browser page", manifest)).toBe(false);
  });

  it("returns false when browser.enabled is false and goal contains 'website'", () => {
    const manifest = makeManifest({ browserEnabled: false });
    expect(inferBrowserNeed("visit this website for me", manifest)).toBe(false);
  });

  it("returns true when enabled and goal contains 'browser'", () => {
    const manifest = makeManifest({ browserEnabled: true });
    expect(inferBrowserNeed("open a browser page", manifest)).toBe(true);
  });

  it("returns true when enabled and goal contains 'screenshot'", () => {
    const manifest = makeManifest({ browserEnabled: true });
    expect(inferBrowserNeed("take a screenshot of the dashboard", manifest)).toBe(true);
  });

  it("returns true when enabled and goal contains 'github'", () => {
    const manifest = makeManifest({ browserEnabled: true });
    expect(inferBrowserNeed("check the github repo for issues", manifest)).toBe(true);
  });

  it("returns true when enabled and goal contains 'triage'", () => {
    const manifest = makeManifest({ browserEnabled: true });
    expect(inferBrowserNeed("triage the open issues", manifest)).toBe(true);
  });

  it("returns false when enabled but goal has no browser keywords", () => {
    const manifest = makeManifest({ browserEnabled: true });
    expect(inferBrowserNeed("summarize the latest quarterly report", manifest)).toBe(false);
  });

  it("matches keywords case-insensitively", () => {
    const manifest = makeManifest({ browserEnabled: true });
    expect(inferBrowserNeed("RESEARCH the topic", manifest)).toBe(true);
    expect(inferBrowserNeed("Take a SCREENSHOT", manifest)).toBe(true);
    expect(inferBrowserNeed("Verify via SLACK", manifest)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// inferBrowserMode
// ---------------------------------------------------------------------------

describe("inferBrowserMode", () => {
  const policy: BrowserToolPolicy = {
    enabled: true,
    allowedDomains: [],
    blockedDomains: [],
    maxConcurrentSessions: 2,
    allowDownloads: true,
    defaultMode: "read",
    requiresApprovalFor: ["form", "download"]
  };

  const policyNoDownload: BrowserToolPolicy = { ...policy, allowDownloads: false };

  it("returns 'download' when goal contains 'download' and allowDownloads is true", () => {
    expect(inferBrowserMode("please download the file", policy)).toBe("download");
  });

  it("falls through to defaultMode when goal contains 'download' but allowDownloads is false", () => {
    expect(inferBrowserMode("please download the file", policyNoDownload)).toBe("read");
  });

  it("returns 'form' when goal contains 'submit'", () => {
    expect(inferBrowserMode("submit the pull request form", policy)).toBe("form");
  });

  it("returns 'form' when goal contains 'form'", () => {
    expect(inferBrowserMode("fill out the onboarding form", policy)).toBe("form");
  });

  it("returns 'form' when goal contains 'login'", () => {
    expect(inferBrowserMode("login to the admin dashboard", policy)).toBe("form");
  });

  it("returns 'extract' when goal contains 'extract'", () => {
    expect(inferBrowserMode("extract all pricing data from the page", policy)).toBe("extract");
  });

  it("returns 'extract' when goal contains 'research'", () => {
    expect(inferBrowserMode("research the competitor landscape", policy)).toBe("extract");
  });

  it("returns 'extract' when goal contains 'triage'", () => {
    expect(inferBrowserMode("triage the bug queue on github", policy)).toBe("extract");
  });

  it("returns 'monitor' when goal contains 'monitor'", () => {
    expect(inferBrowserMode("monitor the deployment status page", policy)).toBe("monitor");
  });

  it("returns 'monitor' when goal contains 'watch'", () => {
    expect(inferBrowserMode("watch for changes on the status page", policy)).toBe("monitor");
  });

  it("returns 'navigate' when goal contains 'navigate'", () => {
    expect(inferBrowserMode("navigate to the settings page", policy)).toBe("navigate");
  });

  it("returns 'navigate' when goal contains 'browse'", () => {
    expect(inferBrowserMode("browse through the documentation", policy)).toBe("navigate");
  });

  it("returns policy.defaultMode when goal has no mode keywords", () => {
    expect(inferBrowserMode("help me think through this problem", policy)).toBe("read");
  });

  it("returns custom defaultMode when configured differently", () => {
    const customPolicy: BrowserToolPolicy = { ...policy, defaultMode: "extract" };
    expect(inferBrowserMode("look into this for me", customPolicy)).toBe("extract");
  });
});

// ---------------------------------------------------------------------------
// browserModeRequiresApproval
// ---------------------------------------------------------------------------

describe("browserModeRequiresApproval", () => {
  const policy: BrowserToolPolicy = {
    enabled: true,
    allowedDomains: [],
    blockedDomains: [],
    maxConcurrentSessions: 2,
    allowDownloads: true,
    defaultMode: "read",
    requiresApprovalFor: ["form", "download"]
  };

  it("returns true when mode is in requiresApprovalFor", () => {
    expect(browserModeRequiresApproval("form", policy)).toBe(true);
    expect(browserModeRequiresApproval("download", policy)).toBe(true);
  });

  it("returns false when mode is not in requiresApprovalFor", () => {
    expect(browserModeRequiresApproval("read", policy)).toBe(false);
    expect(browserModeRequiresApproval("extract", policy)).toBe(false);
    expect(browserModeRequiresApproval("navigate", policy)).toBe(false);
    expect(browserModeRequiresApproval("monitor", policy)).toBe(false);
  });

  it("returns false when requiresApprovalFor is empty", () => {
    const openPolicy: BrowserToolPolicy = { ...policy, requiresApprovalFor: [] };
    expect(browserModeRequiresApproval("form", openPolicy)).toBe(false);
    expect(browserModeRequiresApproval("download", openPolicy)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// titleForGoal
// ---------------------------------------------------------------------------

describe("titleForGoal", () => {
  it("returns 'Cadet workflow' for an empty string", () => {
    expect(titleForGoal("")).toBe("Cadet workflow");
  });

  it("returns 'Cadet workflow' for a whitespace-only string", () => {
    expect(titleForGoal("   ")).toBe("Cadet workflow");
  });

  it("returns the trimmed goal when <= 96 chars", () => {
    expect(titleForGoal("  Do something useful  ")).toBe("Do something useful");
  });

  it("returns a goal that is exactly 96 chars unchanged", () => {
    const goal = "a".repeat(96);
    expect(titleForGoal(goal)).toBe(goal);
    expect(titleForGoal(goal)).toHaveLength(96);
  });

  it("truncates goals longer than 96 chars to exactly 96 chars", () => {
    const goal = "a".repeat(97);
    const result = titleForGoal(goal);
    expect(result).toHaveLength(96);
    expect(result).toBe("a".repeat(96));
  });

  it("truncates very long goals", () => {
    const goal = "Summarize the quarterly performance results for all regional offices across Europe and Asia Pacific".repeat(3);
    const result = titleForGoal(goal);
    expect(result.length).toBeLessThanOrEqual(96);
  });
});

// ---------------------------------------------------------------------------
// ownerExecutionForStage
// ---------------------------------------------------------------------------

describe("ownerExecutionForStage", () => {
  it("returns 'learning-worker' for the learn stage regardless of browser", () => {
    const manifest = makeManifest({ execution: "local-runner" });
    expect(ownerExecutionForStage(manifest, "learn", false)).toBe("learning-worker");
    expect(ownerExecutionForStage(manifest, "learn", true)).toBe("learning-worker");
  });

  it("returns 'browser-worker' for gather stage when browser is required", () => {
    const manifest = makeManifest({ execution: "local-runner" });
    expect(ownerExecutionForStage(manifest, "gather", true)).toBe("browser-worker");
  });

  it("returns 'browser-worker' for verify stage when browser is required", () => {
    const manifest = makeManifest({ execution: "local-runner" });
    expect(ownerExecutionForStage(manifest, "verify", true)).toBe("browser-worker");
  });

  it("returns manifest execution for gather stage when browser is not required", () => {
    const manifest = makeManifest({ execution: "local-runner" });
    expect(ownerExecutionForStage(manifest, "gather", false)).toBe("local-runner");
  });

  it("returns manifest execution for route stage from manifest deployment", () => {
    const manifest = makeManifest({ execution: "container-runner" });
    expect(ownerExecutionForStage(manifest, "route", false)).toBe("container-runner");
  });

  it("returns manifest execution for route stage even when browser is required", () => {
    const manifest = makeManifest({ execution: "maincloud-runner" });
    expect(ownerExecutionForStage(manifest, "route", true)).toBe("maincloud-runner");
  });

  it("returns 'container-runner' for plan stage when execution is vercel-edge", () => {
    const manifest = makeManifest({ execution: "vercel-edge" });
    expect(ownerExecutionForStage(manifest, "plan", false)).toBe("container-runner");
  });

  it("returns 'container-runner' for act stage when execution is vercel-edge", () => {
    const manifest = makeManifest({ execution: "vercel-edge" });
    expect(ownerExecutionForStage(manifest, "act", false)).toBe("container-runner");
  });

  it("returns manifest execution for plan stage when execution is not vercel-edge", () => {
    const manifest = makeManifest({ execution: "container-runner" });
    expect(ownerExecutionForStage(manifest, "plan", false)).toBe("container-runner");
  });
});

// ---------------------------------------------------------------------------
// seedWorkflowFromGoal
// ---------------------------------------------------------------------------

describe("seedWorkflowFromGoal", () => {
  it("produces a full seed with deterministic IDs via injected createId", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions,
      goal: "Summarize the deployment report"
    });

    expect(seed.thread.threadId).toBe("test_id");
    expect(seed.message.eventId).toBe("test_id");
    expect(seed.run.runId).toBe("test_id");
    expect(seed.routeStep.stepId).toBe("test_id");
  });

  it("uses channelThreadId from options when provided", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions,
      channelThreadId: "chan_thread_42"
    });
    expect(seed.thread.channelThreadId).toBe("chan_thread_42");
  });

  it("defaults channelThreadId to threadId when not provided", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions
    });
    expect(seed.thread.channelThreadId).toBe(seed.thread.threadId);
  });

  it("sets message.direction to 'inbound'", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions });
    expect(seed.message.direction).toBe("inbound");
  });

  it("defaults run.priority to 'normal' when not specified", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions });
    expect(seed.run.priority).toBe("normal");
  });

  it("uses provided priority when specified", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions, priority: "high" });
    expect(seed.run.priority).toBe("high");
  });

  it("sets routeStep.stage to 'route'", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions });
    expect(seed.routeStep.stage).toBe("route");
  });

  it("sets remainingStages to the 6 stages after route", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions });
    expect(seed.remainingStages).toHaveLength(6);
    expect(seed.remainingStages).toEqual(["plan", "gather", "act", "verify", "summarize", "learn"]);
  });

  it("includes all expected top-level keys on the seed", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions });
    expect(seed).toHaveProperty("thread");
    expect(seed).toHaveProperty("message");
    expect(seed).toHaveProperty("run");
    expect(seed).toHaveProperty("routeStep");
    expect(seed).toHaveProperty("remainingStages");
    expect(seed).toHaveProperty("browser");
  });

  it("encodes browser requirement in the seed when goal triggers browser keywords", () => {
    const manifest = makeManifest({ browserEnabled: true });
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions,
      goal: "research the competitor pricing page"
    });
    expect(seed.browser.required).toBe(true);
    expect(seed.browser.mode).toBe("extract");
  });

  it("encodes browser not required when goal has no keywords", () => {
    const manifest = makeManifest({ browserEnabled: true });
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions,
      goal: "summarize the last sprint"
    });
    expect(seed.browser.required).toBe(false);
  });

  it("sets browser.requiresApproval correctly for a form mode", () => {
    const manifest = makeManifest({ browserEnabled: true });
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions,
      goal: "login to the dashboard and submit the form"
    });
    expect(seed.browser.mode).toBe("form");
    expect(seed.browser.requiresApproval).toBe(true);
  });

  it("sets run.agentId from manifest.id", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions });
    expect(seed.run.agentId).toBe("test-agent");
  });

  it("propagates context into run.context alongside deployment fields", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, {
      ...baseOptions,
      context: { extra: "metadata" }
    });
    expect(seed.run.context).toMatchObject({
      extra: "metadata",
      controlPlane: "local",
      execution: "local-runner"
    });
  });

  it("sets thread.title via titleForGoal", () => {
    const manifest = makeManifest();
    const goal = "Deploy the next release";
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions, goal });
    expect(seed.thread.title).toBe("Deploy the next release");
  });

  it("sets message.content to the original goal", () => {
    const manifest = makeManifest();
    const goal = "Audit the dependency tree";
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions, goal });
    expect(seed.message.content).toBe(goal);
  });

  it("sets message.channel and thread.channel from options", () => {
    const manifest = makeManifest();
    const seed = seedWorkflowFromGoal(manifest, { ...baseOptions, channel: "slack" });
    expect(seed.thread.channel).toBe("slack");
    expect(seed.message.channel).toBe("slack");
  });
});
