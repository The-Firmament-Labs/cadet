export type JobPriority = "low" | "normal" | "high";

export const jobPriorities: readonly JobPriority[] = ["low", "normal", "high"] as const;

export function isJobPriority(value: string): value is JobPriority {
  return (jobPriorities as readonly string[]).includes(value);
}

export function parseJobPriority(value: string, field = "job priority"): JobPriority {
  if (!isJobPriority(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}
export type ScalarContextValue = string | number | boolean;

export interface JobRequest {
  agentId: string;
  goal: string;
  priority?: JobPriority;
  requestedBy?: string;
  context?: Record<string, ScalarContextValue>;
}

export interface NormalizedJobRequest {
  jobId: string;
  agentId: string;
  goal: string;
  priority: JobPriority;
  requestedBy: string;
  createdAt: string;
  context: Record<string, ScalarContextValue>;
}

export interface NormalizeJobRequestDependencies {
  now?: () => Date;
  createId?: () => string;
}

function assertIdentifier(value: string, path: string): string {
  if (!/^[a-z0-9-_]+$/i.test(value)) {
    throw new Error(`${path} must match /^[a-z0-9-_]+$/i`);
  }

  return value;
}

export function normalizeJobRequest(
  request: JobRequest,
  deps: NormalizeJobRequestDependencies = {}
): NormalizedJobRequest {
  const agentId = request.agentId.trim();
  const goal = request.goal.trim();

  if (agentId.length === 0) {
    throw new Error("agentId is required");
  }

  if (goal.length === 0) {
    throw new Error("goal is required");
  }

  const createId =
    deps.createId ??
    (() => `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  const now = deps.now ?? (() => new Date());

  return {
    jobId: assertIdentifier(createId(), "jobId"),
    agentId: assertIdentifier(agentId, "agentId"),
    goal,
    priority: request.priority ?? "normal",
    requestedBy: request.requestedBy?.trim() || "operator",
    createdAt: now().toISOString(),
    context: request.context ?? {}
  };
}

