import { describe, expect, it } from "vitest";

import { filterAgentsByControlPlane } from "../catalog";
import { executeEdgeAgent } from "../edge-agent";
import { searchMemoryByEmbedding } from "../memory";
import { parseAgentManifest } from "../agent-manifest";
import { normalizeJobRequest } from "../job";
import { composeRuntimePrompt } from "../prompt";
import { isScheduleDue, schedulesForManifest } from "../schedule";

describe("parseAgentManifest", () => {
  it("parses a valid manifest", () => {
    const manifest = parseAgentManifest({
      id: "researcher",
      name: "Researcher",
      description: "Research agent",
      system: "Stay factual",
      model: "gpt-5.4",
      runtime: "rust-core",
      deployment: {
        controlPlane: "local",
        execution: "local-runner",
        workflow: "research"
      },
      tags: ["research"],
      tools: {
        allowExec: true,
        allowBrowser: true,
        allowNetwork: true,
        allowMcp: true
      },
      memory: { namespace: "research", maxNotes: 200, summarizeAfter: 20 }
    });

    expect(manifest.runtime).toBe("rust-core");
    expect(manifest.memory.maxNotes).toBe(200);
    expect(manifest.schedules).toEqual([]);
    expect(manifest.tools.browser.enabled).toBe(true);
    expect(manifest.workflowTemplates[0]?.stages).toEqual([
      "route",
      "plan",
      "gather",
      "act",
      "verify",
      "summarize",
      "learn"
    ]);
  });

  it("rejects invalid targets", () => {
    expect(() =>
      parseAgentManifest({
        id: "broken",
        name: "Broken",
        description: "Broken agent",
        system: "Nope",
        model: "gpt-5.4",
        runtime: "rust-core",
        deployment: {
          controlPlane: "unknown",
          execution: "local-runner",
          workflow: "research"
        },
        tags: [],
        tools: {
          allowExec: true,
          allowBrowser: true,
          allowNetwork: true,
          allowMcp: true
        },
        memory: { namespace: "research", maxNotes: 100, summarizeAfter: 10 }
      })
    ).toThrowError(/deployment.controlPlane/);
  });

  it("normalizes legacy browser flags into rich browser policy", () => {
    const manifest = parseAgentManifest({
      id: "operator",
      name: "Operator",
      description: "Ops agent",
      system: "Stay crisp",
      model: "gpt-5.4-mini",
      runtime: "edge-function",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "ops"
      },
      tags: ["ops"],
      tools: {
        allowExec: false,
        allowBrowser: true,
        allowNetwork: true,
        allowMcp: true
      },
      memory: { namespace: "ops", maxNotes: 100, summarizeAfter: 10 }
    });

    expect(manifest.tools.allowBrowser).toBe(true);
    expect(manifest.tools.browser.enabled).toBe(true);
    expect(manifest.tools.browser.defaultMode).toBe("read");
    expect(manifest.tools.browser.requiresApprovalFor).toEqual(["form", "download"]);
  });
});

describe("schedulesForManifest", () => {
  it("normalizes manifest schedules into registrations", () => {
    const manifest = parseAgentManifest({
      id: "operator",
      name: "Operator",
      description: "Edge operator",
      system: "Stay crisp",
      model: "gpt-5.4-mini",
      runtime: "edge-function",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "ops"
      },
      tags: ["ops"],
      tools: {
        allowExec: false,
        allowBrowser: false,
        allowNetwork: true,
        allowMcp: true
      },
      memory: { namespace: "ops", maxNotes: 100, summarizeAfter: 10 },
      schedules: [
        {
          id: "incident-sweep",
          goal: "Sweep for deployment regressions",
          intervalMinutes: 10,
          priority: "high",
          requestedBy: "scheduler-cloud"
        }
      ]
    });

    expect(schedulesForManifest(manifest)).toEqual([
      {
        scheduleId: "operator_incident-sweep",
        agentId: "operator",
        controlPlane: "cloud",
        goal: "Sweep for deployment regressions",
        intervalMinutes: 10,
        priority: "high",
        enabled: true,
        requestedBy: "scheduler-cloud"
      }
    ]);
  });

  it("detects due schedules using microsecond timestamps", () => {
    expect(
      isScheduleDue({
        enabled: true,
        nextRunAtMicros: 100
      }, 100)
    ).toBe(true);

    expect(
      isScheduleDue({
        enabled: false,
        nextRunAtMicros: 100
      }, 1_000)
    ).toBe(false);
  });
});

describe("filterAgentsByControlPlane", () => {
  it("separates local and cloud manifests deterministically", () => {
    const manifests = [
      parseAgentManifest({
        id: "researcher",
        name: "Researcher",
        description: "Research agent",
        system: "Stay factual",
        model: "gpt-5.4",
        runtime: "rust-core",
        deployment: {
          controlPlane: "local",
          execution: "local-runner",
          workflow: "research"
        },
        tags: ["research"],
        tools: {
          allowExec: true,
          allowBrowser: true,
          allowNetwork: true,
          allowMcp: true
        },
        memory: { namespace: "research", maxNotes: 200, summarizeAfter: 20 }
      }),
      parseAgentManifest({
        id: "operator",
        name: "Operator",
        description: "Edge operator",
        system: "Stay crisp",
        model: "gpt-5.4-mini",
        runtime: "edge-function",
        deployment: {
          controlPlane: "cloud",
          execution: "vercel-edge",
          workflow: "ops"
        },
        tags: ["ops"],
        tools: {
          allowExec: false,
          allowBrowser: false,
          allowNetwork: true,
          allowMcp: true
        },
        memory: { namespace: "ops", maxNotes: 100, summarizeAfter: 10 }
      })
    ];

    expect(filterAgentsByControlPlane(manifests, "local").map((manifest) => manifest.id)).toEqual([
      "researcher"
    ]);
    expect(filterAgentsByControlPlane(manifests, "cloud").map((manifest) => manifest.id)).toEqual([
      "operator"
    ]);
  });
});

describe("normalizeJobRequest", () => {
  it("normalizes requests deterministically when helpers are injected", () => {
    const job = normalizeJobRequest(
      {
        agentId: "researcher",
        goal: "Inspect the deployment plan",
        context: { channel: "ops" }
      },
      {
        createId: () => "job_fixed",
        now: () => new Date("2026-03-27T00:00:00.000Z")
      }
    );

    expect(job).toEqual({
      jobId: "job_fixed",
      agentId: "researcher",
      goal: "Inspect the deployment plan",
      priority: "normal",
      requestedBy: "operator",
      createdAt: "2026-03-27T00:00:00.000Z",
      context: { channel: "ops" }
    });
  });
});

describe("composeRuntimePrompt", () => {
  it("includes mission, policy, and context blocks", () => {
    const manifest = parseAgentManifest({
      id: "researcher",
      name: "Researcher",
      description: "Research agent",
      system: "Stay factual",
      model: "gpt-5.4",
      runtime: "rust-core",
      deployment: {
        controlPlane: "local",
        execution: "local-runner",
        workflow: "research"
      },
      tags: ["research"],
      tools: {
        allowExec: true,
        allowBrowser: false,
        allowNetwork: true,
        allowMcp: true
      },
      memory: { namespace: "research", maxNotes: 100, summarizeAfter: 10 }
    });

    const prompt = composeRuntimePrompt(manifest, {
      jobId: "job_fixed",
      agentId: "researcher",
      goal: "Write a deployment plan",
      priority: "high",
      requestedBy: "dex",
      createdAt: "2026-03-27T00:00:00.000Z",
      context: { stack: "solana" }
    });

    expect(prompt).toContain("Write a deployment plan");
    expect(prompt).toContain("exec=true");
    expect(prompt).toContain("browserMode=read");
    expect(prompt).toContain("Control plane: local");
    expect(prompt).toContain('"stack": "solana"');
  });
});

describe("searchMemoryByEmbedding", () => {
  it("returns the highest scoring chunks first", () => {
    const results = searchMemoryByEmbedding(
      [1, 0],
      [
        {
          chunkId: "chunk_1",
          documentId: "doc_1",
          agentId: "researcher",
          namespace: "research",
          ordinal: 0,
          content: "Primary rollout note",
          metadataJson: "{}",
          createdAtMicros: 1
        },
        {
          chunkId: "chunk_2",
          documentId: "doc_1",
          agentId: "researcher",
          namespace: "research",
          ordinal: 1,
          content: "Secondary rollout note",
          metadataJson: "{}",
          createdAtMicros: 2
        }
      ],
      [
        {
          embeddingId: "embedding_1",
          chunkId: "chunk_1",
          agentId: "researcher",
          namespace: "research",
          model: "text-embedding-3-small",
          dimensions: 2,
          vector: [0.99, 0.01],
          checksum: "one",
          createdAtMicros: 1
        },
        {
          embeddingId: "embedding_2",
          chunkId: "chunk_2",
          agentId: "researcher",
          namespace: "research",
          model: "text-embedding-3-small",
          dimensions: 2,
          vector: [0, 1],
          checksum: "two",
          createdAtMicros: 2
        }
      ],
      1
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.chunkId).toBe("chunk_1");
    expect(results[0]?.score).toBeGreaterThan(0.99);
  });
});

describe("executeEdgeAgent", () => {
  it("returns deterministic bounded actions for edge-safe execution", () => {
    const manifest = parseAgentManifest({
      id: "operator",
      name: "Operator",
      description: "Edge operator",
      system: "Stay crisp",
      model: "gpt-5.4-mini",
      runtime: "edge-function",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "ops"
      },
      tags: ["ops"],
      tools: {
        allowExec: false,
        allowBrowser: false,
        allowNetwork: true,
        allowMcp: true
      },
      memory: { namespace: "ops", maxNotes: 100, summarizeAfter: 10 }
    });

    const result = executeEdgeAgent(manifest, {
      jobId: "job_fixed",
      agentId: "operator",
      goal: "Triage the deploy incident",
      priority: "high",
      requestedBy: "cloud-control",
      createdAt: "2026-03-27T00:00:00.000Z",
      context: {}
    });

    expect(result.actions).toEqual([
      "Check the latest deployment metadata and blast radius.",
      "Inspect runtime health, logs, and rollback readiness.",
      "Publish a concise incident status update with next owner."
    ]);
    expect(result.summary).toContain("handled 'Triage the deploy incident'");
  });
});
