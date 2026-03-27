import type { AgentManifest } from "./agent-manifest";
import type { NormalizedJobRequest } from "./job";

export interface EdgeExecutionResult {
  summary: string;
  actions: string[];
  memoryNote: string;
}

function classifyGoal(goal: string): string[] {
  const normalized = goal.toLowerCase();

  if (normalized.includes("incident") || normalized.includes("deploy")) {
    return [
      "Check the latest deployment metadata and blast radius.",
      "Inspect runtime health, logs, and rollback readiness.",
      "Publish a concise incident status update with next owner."
    ];
  }

  if (normalized.includes("policy") || normalized.includes("review") || normalized.includes("audit")) {
    return [
      "Extract the policy surface and affected systems.",
      "Flag risk, ambiguity, and missing approvals.",
      "Return a change-safe recommendation with follow-up owners."
    ];
  }

  return [
    "Identify the smallest safe next action.",
    "Route the task to the correct workflow and owner.",
    "Return an operator-facing summary with any blockers."
  ];
}

export function executeEdgeAgent(
  manifest: AgentManifest,
  job: NormalizedJobRequest
): EdgeExecutionResult {
  const actions = classifyGoal(job.goal);
  const summary = `${manifest.name} handled '${job.goal}' at the edge and produced ${actions.length} bounded operator actions.`;

  return {
    summary,
    actions,
    memoryNote: `${job.jobId}: ${summary}`
  };
}

