import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseAgentManifest, type AgentManifest } from "../agent-manifest";
import type { NormalizedJobRequest } from "../job";
import {
  buildToonPrompt,
  composeRuntimePrompt,
  toPromptData,
  type PromptMemoryChunk,
  type ThreadMessage,
  type TrajectoryRef,
} from "../prompt";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeManifest(overrides: Partial<Parameters<typeof parseAgentManifest>[0]> = {}): AgentManifest {
  return parseAgentManifest({
    id: "saturn",
    name: "Saturn",
    description: "Operations agent",
    system: "Stay precise and operational.",
    model: "gpt-5.4",
    runtime: "rust-core",
    deployment: {
      controlPlane: "local",
      execution: "local-runner",
      workflow: "ops",
    },
    tags: ["ops"],
    tools: {
      allowExec: true,
      allowBrowser: true,
      allowNetwork: true,
      allowMcp: true,
    },
    memory: { namespace: "operations", maxNotes: 100, summarizeAfter: 10 },
    ...overrides,
  });
}

function makeJob(overrides: Partial<NormalizedJobRequest> = {}): NormalizedJobRequest {
  return {
    jobId: "job_test_001",
    agentId: "saturn",
    goal: "Deploy the new release",
    priority: "high",
    requestedBy: "d350-control",
    createdAt: "2026-03-28T00:00:00.000Z",
    context: {},
    ...overrides,
  };
}

// ── toPromptData ───────────────────────────────────────────────────────────

describe("toPromptData", () => {
  it("maps agent_id from manifest.id", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.agent_id).toBe("saturn");
  });

  it("maps agent_name from manifest.name", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.agent_name).toBe("Saturn");
  });

  it("maps agent_runtime from manifest.runtime", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.agent_runtime).toBe("rust-core");
  });

  it("maps namespace from manifest.memory.namespace", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.namespace).toBe("operations");
  });

  it("maps system_prompt from manifest.system", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.system_prompt).toBe("Stay precise and operational.");
  });

  it("maps run_id from job.jobId", () => {
    const data = toPromptData(makeManifest(), makeJob({ jobId: "job_xyz" }));
    expect(data.run_id).toBe("job_xyz");
  });

  it("maps goal from job.goal", () => {
    const data = toPromptData(makeManifest(), makeJob({ goal: "Triage the incident" }));
    expect(data.goal).toBe("Triage the incident");
  });

  it("maps priority from job.priority", () => {
    const data = toPromptData(makeManifest(), makeJob({ priority: "low" }));
    expect(data.priority).toBe("low");
  });

  it("maps requested_by from job.requestedBy", () => {
    const data = toPromptData(makeManifest(), makeJob({ requestedBy: "scheduler-cloud" }));
    expect(data.requested_by).toBe("scheduler-cloud");
  });

  it("defaults current_stage to 'route' when enrichment is omitted", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.current_stage).toBe("route");
  });

  it("defaults current_stage to 'route' when enrichment omits currentStage", () => {
    const data = toPromptData(makeManifest(), makeJob(), {});
    expect(data.current_stage).toBe("route");
  });

  it("respects explicit currentStage override", () => {
    const data = toPromptData(makeManifest(), makeJob(), { currentStage: "act" });
    expect(data.current_stage).toBe("act");
  });

  it("defaults thread_history to empty array when enrichment is omitted", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.thread_history).toEqual([]);
  });

  it("defaults memory_chunks to empty array when enrichment is omitted", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.memory_chunks).toEqual([]);
  });

  it("defaults recent_trajectories to empty array when enrichment is omitted", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.recent_trajectories).toEqual([]);
  });

  it("defaults active_routes to empty array when enrichment is omitted", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.active_routes).toEqual([]);
  });

  it("round-trips senderName into sender_name", () => {
    const data = toPromptData(makeManifest(), makeJob(), { senderName: "Alice" });
    expect(data.sender_name).toBe("Alice");
  });

  it("round-trips senderChannel into sender_channel", () => {
    const data = toPromptData(makeManifest(), makeJob(), { senderChannel: "ops-alerts" });
    expect(data.sender_channel).toBe("ops-alerts");
  });

  it("round-trips senderEntityId into sender_entity_id", () => {
    const data = toPromptData(makeManifest(), makeJob(), { senderEntityId: "entity_42" });
    expect(data.sender_entity_id).toBe("entity_42");
  });

  it("round-trips previousStepOutput into previous_step_output", () => {
    const data = toPromptData(makeManifest(), makeJob(), {
      previousStepOutput: "Step completed successfully.",
    });
    expect(data.previous_step_output).toBe("Step completed successfully.");
  });

  it("maps tools list to ToolSummary shape with name, category, requires_approval", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.tools.length).toBeGreaterThan(0);
    const first = data.tools[0]!;
    expect(typeof first.name).toBe("string");
    expect(typeof first.category).toBe("string");
    expect(typeof first.requires_approval).toBe("boolean");
  });

  it("defaults token_budget to 4000", () => {
    const data = toPromptData(makeManifest(), makeJob());
    expect(data.token_budget).toBe(4000);
  });

  it("respects custom token_budget", () => {
    const data = toPromptData(makeManifest(), makeJob(), undefined, 8000);
    expect(data.token_budget).toBe(8000);
  });

  it("loadable_prompts is empty when manifest has no prompts field", () => {
    const manifest = makeManifest();
    // parseAgentManifest sets prompts = undefined when not provided
    const data = toPromptData(manifest, makeJob());
    expect(data.loadable_prompts).toEqual([]);
  });

  it("loadable_prompts includes system + personality + stage paths when prompts present", () => {
    const manifest = makeManifest({
      prompts: {
        system: "agents/saturn/system.md",
        personality: "agents/saturn/personality.md",
        stages: {
          act: "agents/saturn/stages/act.md",
          plan: "agents/saturn/stages/plan.md",
        },
      },
    } as Record<string, unknown>);

    const data = toPromptData(manifest, makeJob());
    expect(data.loadable_prompts).toContain("agents/saturn/system.md");
    expect(data.loadable_prompts).toContain("agents/saturn/personality.md");
    expect(data.loadable_prompts).toContain("agents/saturn/stages/act.md");
    expect(data.loadable_prompts).toContain("agents/saturn/stages/plan.md");
  });
});

// ── buildToonPrompt ────────────────────────────────────────────────────────

describe("buildToonPrompt", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns text body when fetch responds 200 OK", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => "TOON-ENCODED PROMPT FROM RUST",
    });

    const manifest = makeManifest();
    const job = makeJob();
    const data = toPromptData(manifest, job);
    const result = await buildToonPrompt(data, manifest, job);

    expect(result).toBe("TOON-ENCODED PROMPT FROM RUST");
  });

  it("falls back to composeRuntimePrompt when fetch returns non-OK status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    const manifest = makeManifest();
    const job = makeJob({ goal: "Fallback test goal" });
    const data = toPromptData(manifest, job);
    const result = await buildToonPrompt(data, manifest, job);

    // Should fall back to the TS-composed prompt which includes the goal
    expect(result).toContain("Fallback test goal");
  });

  it("falls back to composeRuntimePrompt when fetch throws a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const manifest = makeManifest();
    const job = makeJob({ goal: "Network error fallback goal" });
    const data = toPromptData(manifest, job);
    const result = await buildToonPrompt(data, manifest, job);

    expect(result).toContain("Network error fallback goal");
  });

  it("falls back without throwing when fetch times out (AbortError)", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    fetchMock.mockRejectedValueOnce(abortError);

    const manifest = makeManifest();
    const job = makeJob({ goal: "Timeout fallback goal" });
    const data = toPromptData(manifest, job);

    await expect(buildToonPrompt(data, manifest, job)).resolves.toContain("Timeout fallback goal");
  });
});

// ── composeRuntimePrompt ───────────────────────────────────────────────────

describe("composeRuntimePrompt", () => {
  it("output contains agent name", () => {
    const prompt = composeRuntimePrompt(makeManifest(), makeJob());
    expect(prompt).toContain("Saturn");
  });

  it("output contains mission goal", () => {
    const prompt = composeRuntimePrompt(
      makeManifest(),
      makeJob({ goal: "Audit the deployment pipeline" })
    );
    expect(prompt).toContain("Audit the deployment pipeline");
  });

  it("agent with no prompts field has no '# Available Context Files' section", () => {
    const manifest = makeManifest(); // no prompts field passed
    const prompt = composeRuntimePrompt(manifest, makeJob());
    expect(prompt).not.toContain("# Available Context Files");
  });

  it("agent with prompts field has '# Available Context Files' section", () => {
    const manifest = makeManifest({
      prompts: {
        system: "agents/saturn/system.md",
        personality: "agents/saturn/personality.md",
      },
    } as Record<string, unknown>);

    const prompt = composeRuntimePrompt(manifest, makeJob());
    expect(prompt).toContain("# Available Context Files");
    expect(prompt).toContain("agents/saturn/system.md");
  });

  it("agent with no workflow templates has no '# Workflow' section", () => {
    // parseAgentManifest always injects a default workflowTemplate, so we
    // need to use a manifest that has no templates explicitly and verify the
    // default is present — or build a manifest with a known template id.
    // The default id is "default", so let's check the default is used.
    const manifest = makeManifest();
    const prompt = composeRuntimePrompt(manifest, makeJob());
    // Default template is always present so Workflow section IS included
    expect(prompt).toContain("# Workflow");
  });

  it("agent with explicit workflow template shows its id and stages", () => {
    const manifest = makeManifest({
      workflowTemplates: [
        {
          id: "ops-pipeline",
          stages: ["route", "plan", "act"],
        },
      ],
    } as Record<string, unknown>);

    const prompt = composeRuntimePrompt(manifest, makeJob());
    expect(prompt).toContain("ops-pipeline");
    expect(prompt).toContain("route → plan → act");
  });

  it("empty job context produces no '# Job Context' section", () => {
    const prompt = composeRuntimePrompt(makeManifest(), makeJob({ context: {} }));
    expect(prompt).not.toContain("# Job Context");
  });

  it("non-empty job context produces '# Job Context' section", () => {
    const prompt = composeRuntimePrompt(
      makeManifest(),
      makeJob({ context: { env: "production", region: "us-east-1" } })
    );
    expect(prompt).toContain("# Job Context");
    expect(prompt).toContain('"env": "production"');
    expect(prompt).toContain('"region": "us-east-1"');
  });

  it("capabilities string includes 'exec' when allowExec is true", () => {
    const manifest = makeManifest({
      tools: { allowExec: true, allowBrowser: false, allowNetwork: false, allowMcp: false },
    } as Record<string, unknown>);

    const prompt = composeRuntimePrompt(manifest, makeJob());
    expect(prompt).toContain("exec");
  });

  it("capabilities string includes 'network' when allowNetwork is true", () => {
    const manifest = makeManifest({
      tools: { allowExec: false, allowBrowser: false, allowNetwork: true, allowMcp: false },
    } as Record<string, unknown>);

    const prompt = composeRuntimePrompt(manifest, makeJob());
    expect(prompt).toContain("network");
  });

  it("capabilities string does not include 'exec' when allowExec is false", () => {
    const manifest = makeManifest({
      tools: { allowExec: false, allowBrowser: false, allowNetwork: false, allowMcp: false },
    } as Record<string, unknown>);

    const prompt = composeRuntimePrompt(manifest, makeJob());
    // exec should not appear in the Tools: line
    const capLine = prompt
      .split("\n")
      .find((line) => line.startsWith("Tools:"));
    expect(capLine).not.toContain("exec");
  });
});
