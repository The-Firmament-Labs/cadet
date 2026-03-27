import type { JobPriority } from "./job";

export type ControlPlaneTarget = "local" | "cloud";
export type ExecutionTarget = "local-runner" | "vercel-edge" | "container-runner" | "maincloud-runner";
export type AgentRuntime = "rust-core" | "bun-sidecar" | "edge-function";

export interface ToolPolicy {
  allowExec: boolean;
  allowBrowser: boolean;
  allowNetwork: boolean;
  allowMcp: boolean;
}

export interface MemoryPolicy {
  namespace: string;
  maxNotes: number;
  summarizeAfter: number;
}

export interface AgentScheduleDefinition {
  id: string;
  goal: string;
  intervalMinutes: number;
  priority: JobPriority;
  enabled: boolean;
  requestedBy: string;
}

export interface AgentManifest {
  id: string;
  name: string;
  description: string;
  system: string;
  model: string;
  runtime: AgentRuntime;
  deployment: {
    controlPlane: ControlPlaneTarget;
    execution: ExecutionTarget;
    workflow: string;
  };
  tags: string[];
  tools: ToolPolicy;
  memory: MemoryPolicy;
  schedules: AgentScheduleDefinition[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`);
  }

  return value;
}

function expectInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${path} must be a positive integer`);
  }

  return value as number;
}

function expectPriority(value: unknown, path: string): JobPriority {
  if (value !== "low" && value !== "normal" && value !== "high") {
    throw new Error(`${path} must be low, normal, or high`);
  }

  return value;
}

export function parseAgentManifest(value: unknown): AgentManifest {
  if (!isRecord(value)) {
    throw new Error("Agent manifest must be an object");
  }

  const deployment = value.deployment;
  const tools = value.tools;
  const memory = value.memory;
  const tags = value.tags;
  const schedules = value.schedules;

  if (!isRecord(deployment)) {
    throw new Error("deployment must be an object");
  }

  if (!isRecord(tools)) {
    throw new Error("tools must be an object");
  }

  if (!isRecord(memory)) {
    throw new Error("memory must be an object");
  }

  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    throw new Error("tags must be an array of strings");
  }

  if (
    schedules !== undefined &&
    (!Array.isArray(schedules) ||
      !schedules.every((schedule) => typeof schedule === "object" && schedule !== null))
  ) {
    throw new Error("schedules must be an array of objects when provided");
  }

  const runtime = expectString(value.runtime, "runtime");
  if (runtime !== "rust-core" && runtime !== "bun-sidecar" && runtime !== "edge-function") {
    throw new Error("runtime must be `rust-core`, `bun-sidecar`, or `edge-function`");
  }

  const controlPlane = expectString(deployment.controlPlane, "deployment.controlPlane");
  if (!["local", "cloud"].includes(controlPlane)) {
    throw new Error("deployment.controlPlane must be local or cloud");
  }

  const execution = expectString(deployment.execution, "deployment.execution");
  if (!["local-runner", "vercel-edge", "container-runner", "maincloud-runner"].includes(execution)) {
    throw new Error(
      "deployment.execution must be local-runner, vercel-edge, container-runner, or maincloud-runner"
    );
  }

  const normalizedSchedules: AgentScheduleDefinition[] = (schedules ?? []).map(
    (schedule, index) => {
      const candidate = schedule as Record<string, unknown>;
      return {
        id: expectString(candidate.id, `schedules[${index}].id`),
        goal: expectString(candidate.goal, `schedules[${index}].goal`),
        intervalMinutes: expectInteger(
          candidate.intervalMinutes,
          `schedules[${index}].intervalMinutes`
        ),
        priority: expectPriority(
          candidate.priority ?? "normal",
          `schedules[${index}].priority`
        ),
        enabled:
          candidate.enabled === undefined
            ? true
            : expectBoolean(candidate.enabled, `schedules[${index}].enabled`),
        requestedBy:
          candidate.requestedBy === undefined
            ? "scheduler"
            : expectString(candidate.requestedBy, `schedules[${index}].requestedBy`)
      };
    }
  );

  return {
    id: expectString(value.id, "id"),
    name: expectString(value.name, "name"),
    description: expectString(value.description, "description"),
    system: expectString(value.system, "system"),
    model: expectString(value.model, "model"),
    runtime,
    deployment: {
      controlPlane: controlPlane as ControlPlaneTarget,
      execution: execution as ExecutionTarget,
      workflow: expectString(deployment.workflow, "deployment.workflow")
    },
    tags,
    tools: {
      allowExec: expectBoolean(tools.allowExec, "tools.allowExec"),
      allowBrowser: expectBoolean(tools.allowBrowser, "tools.allowBrowser"),
      allowNetwork: expectBoolean(tools.allowNetwork, "tools.allowNetwork"),
      allowMcp: expectBoolean(tools.allowMcp, "tools.allowMcp")
    },
    memory: {
      namespace: expectString(memory.namespace, "memory.namespace"),
      maxNotes: expectInteger(memory.maxNotes, "memory.maxNotes"),
      summarizeAfter: expectInteger(memory.summarizeAfter, "memory.summarizeAfter")
    },
    schedules: normalizedSchedules
  };
}
