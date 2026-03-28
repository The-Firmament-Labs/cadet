import { describe, expect, it } from "vitest";

import { parseAgentManifest } from "../agent-manifest";
import { executeEdgeAgent } from "../edge-agent";

// Minimal manifest fixture for edge-agent tests
function makeManifest(name = "Operator", id = "operator") {
  return parseAgentManifest({
    id,
    name,
    description: "Edge test agent",
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
}

function makeJob(goal: string, jobId = "job_test") {
  return {
    jobId,
    agentId: "operator",
    goal,
    priority: "normal" as const,
    requestedBy: "operator",
    createdAt: "2026-03-28T00:00:00.000Z",
    context: {}
  };
}

describe("executeEdgeAgent", () => {
  describe("incident routing", () => {
    it("goal with 'incident' → incident-specific actions", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Triage the incident in prod"));
      expect(result.actions).toEqual([
        "Check the latest deployment metadata and blast radius.",
        "Inspect runtime health, logs, and rollback readiness.",
        "Publish a concise incident status update with next owner."
      ]);
    });

    it("goal with 'deploy' → incident actions", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Review the deploy rollout status"));
      expect(result.actions).toEqual([
        "Check the latest deployment metadata and blast radius.",
        "Inspect runtime health, logs, and rollback readiness.",
        "Publish a concise incident status update with next owner."
      ]);
    });
  });

  describe("policy routing", () => {
    it("goal with 'policy' → policy-review actions", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Check the access policy document"));
      expect(result.actions).toEqual([
        "Extract the policy surface and affected systems.",
        "Flag risk, ambiguity, and missing approvals.",
        "Return a change-safe recommendation with follow-up owners."
      ]);
    });

    it("goal with 'review' → policy actions", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Review the PR for compliance"));
      expect(result.actions).toEqual([
        "Extract the policy surface and affected systems.",
        "Flag risk, ambiguity, and missing approvals.",
        "Return a change-safe recommendation with follow-up owners."
      ]);
    });

    it("goal with 'audit' → policy actions", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Run a full audit of permissions"));
      expect(result.actions).toEqual([
        "Extract the policy surface and affected systems.",
        "Flag risk, ambiguity, and missing approvals.",
        "Return a change-safe recommendation with follow-up owners."
      ]);
    });
  });

  describe("generic routing", () => {
    it("goal with none of the above → generic routing actions", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Summarize weekly metrics"));
      expect(result.actions).toEqual([
        "Identify the smallest safe next action.",
        "Route the task to the correct workflow and owner.",
        "Return an operator-facing summary with any blockers."
      ]);
    });
  });

  describe("case-insensitive matching", () => {
    it("INCIDENT in uppercase matches incident routing", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Handle INCIDENT-42 immediately"));
      expect(result.actions[0]).toBe("Check the latest deployment metadata and blast radius.");
    });

    it("POLICY in uppercase matches policy routing", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Enforce POLICY changes"));
      expect(result.actions[0]).toBe("Extract the policy surface and affected systems.");
    });

    it("Deploy with mixed case matches incident routing", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Watch the Deploy pipeline"));
      expect(result.actions[0]).toBe("Check the latest deployment metadata and blast radius.");
    });
  });

  describe("result shape", () => {
    it("summary contains manifest.name and job.goal", () => {
      const manifest = makeManifest("Titan");
      const result = executeEdgeAgent(manifest, makeJob("Check the access policy"));
      expect(result.summary).toContain("Titan");
      expect(result.summary).toContain("Check the access policy");
    });

    it("actions length is always 3", () => {
      const goals = [
        "respond to incident",
        "deploy new release",
        "policy check required",
        "review changes",
        "audit the system",
        "summarize metrics"
      ];
      for (const goal of goals) {
        const result = executeEdgeAgent(makeManifest(), makeJob(goal));
        expect(result.actions).toHaveLength(3);
      }
    });

    it("memoryNote starts with jobId and contains the summary", () => {
      const result = executeEdgeAgent(makeManifest(), makeJob("Audit log access", "job_abc"));
      expect(result.memoryNote).toMatch(/^job_abc:/);
      expect(result.memoryNote).toContain(result.summary);
    });
  });
});
