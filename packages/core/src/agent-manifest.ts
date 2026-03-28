import { isJobPriority, type JobPriority } from "./job";
import {
  isWorkflowExecutionTarget,
  isWorkflowStage,
  workflowStages,
  type WorkflowExecutionTarget,
  type WorkflowStage
} from "./workflow";

export type ControlPlaneTarget = "local" | "cloud";
export type ExecutionTarget =
  | "local-runner"
  | "vercel-edge"
  | "container-runner"
  | "maincloud-runner";
export type AgentRuntime = "rust-core" | "bun-sidecar" | "edge-function";

export type BrowserMode = "read" | "extract" | "navigate" | "form" | "download" | "monitor";
export type BrowserRisk = "low" | "medium" | "high";

export const controlPlaneTargets: readonly ControlPlaneTarget[] = ["local", "cloud"] as const;
export const executionTargets: readonly ExecutionTarget[] = [
  "local-runner",
  "vercel-edge",
  "container-runner",
  "maincloud-runner"
] as const;
export const browserModes: readonly BrowserMode[] = [
  "read",
  "extract",
  "navigate",
  "form",
  "download",
  "monitor"
] as const;
export const browserRisks: readonly BrowserRisk[] = ["low", "medium", "high"] as const;

export interface BrowserToolPolicy {
  enabled: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
  maxConcurrentSessions: number;
  allowDownloads: boolean;
  defaultMode: BrowserMode;
  requiresApprovalFor: BrowserMode[];
}

export interface ToolPolicy {
  allowExec: boolean;
  allowBrowser: boolean;
  allowNetwork: boolean;
  allowMcp: boolean;
  browser: BrowserToolPolicy;
}

export interface MemoryPolicy {
  namespace: string;
  maxNotes: number;
  summarizeAfter: number;
}

export interface WorkflowTemplate {
  id: string;
  description: string;
  stages: WorkflowStage[];
}

export interface ToolProfile {
  id: string;
  description: string;
  allowExec?: boolean | undefined;
  allowNetwork?: boolean | undefined;
  allowMcp?: boolean | undefined;
  browser?: Partial<BrowserToolPolicy> | undefined;
}

export interface HandoffRule {
  id: string;
  whenGoalIncludes: string[];
  to: WorkflowExecutionTarget;
  reason: string;
}

export interface LearningPolicy {
  enabled: boolean;
  summarizeEveryRuns: number;
  embedMemory: boolean;
  maxRetrievedChunks: number;
}

/** Context trigger — maps agent events to prompt/memory/trajectory actions. */
export interface ContextTrigger {
  id: string;
  /** Event that activates this trigger */
  event: "step_started" | "goal_received" | "step_completed" | "run_completed" | "channel_message" | "approval_created";
  /** Conditions that must all pass */
  conditions: ContextTriggerCondition[];
  /** Actions to take when triggered */
  actions: ContextTriggerAction[];
  /** Higher priority triggers inject context first (default: 50) */
  priority?: number | undefined;
}

export interface ContextTriggerCondition {
  type: "goal_contains" | "stage_is" | "channel_is" | "risk_at_least" | "step_count_at_least";
  value: string | string[] | number;
}

export interface ContextTriggerAction {
  type: "inject_prompt" | "query_memory" | "inject_trajectory" | "log_trajectory" | "consolidate_memory" | "inject_channel_format";
  /** Prompt path (relative to .cadet/prompts/), memory namespace, or channel name */
  target?: string | undefined;
  /** Max chunks for memory queries */
  maxChunks?: number | undefined;
  /** Number of recent steps for trajectory injection */
  lastNSteps?: number | undefined;
}

/** Agent prompt references — paths to prompt files loaded at runtime */
export interface AgentPrompts {
  /** System prompt path (relative to .cadet/prompts/) */
  system: string;
  /** Agent personality prompt path */
  personality: string;
  /** Per-stage prompt overrides */
  stages?: Record<string, string> | undefined;
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
  workflowTemplates: WorkflowTemplate[];
  toolProfiles: ToolProfile[];
  handoffRules: HandoffRule[];
  learningPolicy: LearningPolicy;
  /** Context triggers — programmatic rules for dynamic prompt/memory assembly */
  contextTriggers?: ContextTrigger[] | undefined;
  /** Prompt file references for this agent */
  prompts?: AgentPrompts | undefined;
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
  if (typeof value !== "string" || !isJobPriority(value)) {
    throw new Error(`${path} must be low, normal, or high`);
  }

  return value;
}

function expectStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${path} must be an array of strings`);
  }

  return value;
}

function expectBrowserMode(value: unknown, path: string): BrowserMode {
  if (typeof value !== "string" || !isBrowserMode(value)) {
    throw new Error(`${path} must be read, extract, navigate, form, download, or monitor`);
  }

  return value;
}

export function isControlPlaneTarget(value: string): value is ControlPlaneTarget {
  return (controlPlaneTargets as readonly string[]).includes(value);
}

export function parseControlPlaneTarget(
  value: string,
  field = "control plane target"
): ControlPlaneTarget {
  if (!isControlPlaneTarget(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function isExecutionTarget(value: string): value is ExecutionTarget {
  return (executionTargets as readonly string[]).includes(value);
}

export function parseExecutionTarget(value: string, field = "execution target"): ExecutionTarget {
  if (!isExecutionTarget(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function isBrowserMode(value: string): value is BrowserMode {
  return (browserModes as readonly string[]).includes(value);
}

export function parseBrowserMode(value: string, field = "browser mode"): BrowserMode {
  if (!isBrowserMode(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function isBrowserRisk(value: string): value is BrowserRisk {
  return (browserRisks as readonly string[]).includes(value);
}

export function parseBrowserRisk(value: string, field = "browser risk"): BrowserRisk {
  if (!isBrowserRisk(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

function expectWorkflowStage(value: unknown, path: string): WorkflowStage {
  if (typeof value !== "string" || !isWorkflowStage(value)) {
    throw new Error(`${path} must be ${workflowStages.join(", ")}`);
  }

  return value;
}

function normalizeBrowserPolicy(tools: Record<string, unknown>): BrowserToolPolicy {
  const browserPolicy = tools.browser;
  const allowBrowser =
    tools.allowBrowser === undefined
      ? undefined
      : expectBoolean(tools.allowBrowser, "tools.allowBrowser");

  if (browserPolicy !== undefined && !isRecord(browserPolicy)) {
    throw new Error("tools.browser must be an object when provided");
  }

  return {
    enabled:
      browserPolicy?.enabled === undefined
        ? allowBrowser ?? false
        : expectBoolean(browserPolicy.enabled, "tools.browser.enabled"),
    allowedDomains:
      browserPolicy?.allowedDomains === undefined
        ? []
        : expectStringArray(browserPolicy.allowedDomains, "tools.browser.allowedDomains"),
    blockedDomains:
      browserPolicy?.blockedDomains === undefined
        ? []
        : expectStringArray(browserPolicy.blockedDomains, "tools.browser.blockedDomains"),
    maxConcurrentSessions:
      browserPolicy?.maxConcurrentSessions === undefined
        ? 2
        : expectInteger(
            browserPolicy.maxConcurrentSessions,
            "tools.browser.maxConcurrentSessions"
          ),
    allowDownloads:
      browserPolicy?.allowDownloads === undefined
        ? false
        : expectBoolean(browserPolicy.allowDownloads, "tools.browser.allowDownloads"),
    defaultMode:
      browserPolicy?.defaultMode === undefined
        ? "read"
        : expectBrowserMode(browserPolicy.defaultMode, "tools.browser.defaultMode"),
    requiresApprovalFor:
      browserPolicy?.requiresApprovalFor === undefined
        ? ["form", "download"]
        : expectStringArray(
            browserPolicy.requiresApprovalFor,
            "tools.browser.requiresApprovalFor"
          ).map((mode, index) =>
            expectBrowserMode(mode, `tools.browser.requiresApprovalFor[${index}]`)
          )
  };
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
  const workflowTemplates = value.workflowTemplates;
  const toolProfiles = value.toolProfiles;
  const handoffRules = value.handoffRules;
  const learningPolicy = value.learningPolicy;

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

  if (
    workflowTemplates !== undefined &&
    (!Array.isArray(workflowTemplates) ||
      !workflowTemplates.every((template) => typeof template === "object" && template !== null))
  ) {
    throw new Error("workflowTemplates must be an array of objects when provided");
  }

  if (
    toolProfiles !== undefined &&
    (!Array.isArray(toolProfiles) ||
      !toolProfiles.every((profile) => typeof profile === "object" && profile !== null))
  ) {
    throw new Error("toolProfiles must be an array of objects when provided");
  }

  if (
    handoffRules !== undefined &&
    (!Array.isArray(handoffRules) ||
      !handoffRules.every((rule) => typeof rule === "object" && rule !== null))
  ) {
    throw new Error("handoffRules must be an array of objects when provided");
  }

  if (learningPolicy !== undefined && !isRecord(learningPolicy)) {
    throw new Error("learningPolicy must be an object when provided");
  }

  const runtime = expectString(value.runtime, "runtime");
  if (runtime !== "rust-core" && runtime !== "bun-sidecar" && runtime !== "edge-function") {
    throw new Error("runtime must be `rust-core`, `bun-sidecar`, or `edge-function`");
  }

  const controlPlane = expectString(deployment.controlPlane, "deployment.controlPlane");
  if (!isControlPlaneTarget(controlPlane)) {
    throw new Error("deployment.controlPlane must be local or cloud");
  }

  const execution = expectString(deployment.execution, "deployment.execution");
  if (!isExecutionTarget(execution)) {
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

  const browser = normalizeBrowserPolicy(tools);

  const normalizedWorkflowTemplates: WorkflowTemplate[] = (workflowTemplates ?? []).map(
    (template, index) => {
      const candidate = template as Record<string, unknown>;
      return {
        id: expectString(candidate.id, `workflowTemplates[${index}].id`),
        description:
          candidate.description === undefined
            ? "Cadet workflow template"
            : expectString(candidate.description, `workflowTemplates[${index}].description`),
        stages:
          candidate.stages === undefined
            ? [...workflowStages]
            : expectStringArray(candidate.stages, `workflowTemplates[${index}].stages`).map(
                (stage, stageIndex) =>
                  expectWorkflowStage(
                    stage,
                    `workflowTemplates[${index}].stages[${stageIndex}]`
                  )
              )
      };
    }
  );

  const normalizedToolProfiles: ToolProfile[] = (toolProfiles ?? []).map((profile, index) => {
    const candidate = profile as Record<string, unknown>;
    return {
      id: expectString(candidate.id, `toolProfiles[${index}].id`),
      description:
        candidate.description === undefined
          ? "Reusable Cadet tool profile"
          : expectString(candidate.description, `toolProfiles[${index}].description`),
      allowExec:
        candidate.allowExec === undefined
          ? undefined
          : expectBoolean(candidate.allowExec, `toolProfiles[${index}].allowExec`),
      allowNetwork:
        candidate.allowNetwork === undefined
          ? undefined
          : expectBoolean(candidate.allowNetwork, `toolProfiles[${index}].allowNetwork`),
      allowMcp:
        candidate.allowMcp === undefined
          ? undefined
          : expectBoolean(candidate.allowMcp, `toolProfiles[${index}].allowMcp`),
      browser:
        candidate.browser === undefined
          ? undefined
          : normalizeBrowserPolicy({
              allowBrowser: true,
              browser: candidate.browser
            })
    };
  });

  const normalizedHandoffRules: HandoffRule[] = (handoffRules ?? []).map((rule, index) => {
    const candidate = rule as Record<string, unknown>;
    const destination = expectString(candidate.to, `handoffRules[${index}].to`);
    if (!isWorkflowExecutionTarget(destination)) {
      throw new Error(`handoffRules[${index}].to is not a supported execution target`);
    }

    return {
      id: expectString(candidate.id, `handoffRules[${index}].id`),
      whenGoalIncludes:
        candidate.whenGoalIncludes === undefined
          ? []
          : expectStringArray(
              candidate.whenGoalIncludes,
              `handoffRules[${index}].whenGoalIncludes`
            ),
      to: destination,
      reason:
        candidate.reason === undefined
          ? "Manifest-defined handoff"
          : expectString(candidate.reason, `handoffRules[${index}].reason`)
    };
  });

  return {
    id: expectString(value.id, "id"),
    name: expectString(value.name, "name"),
    description: expectString(value.description, "description"),
    system: expectString(value.system, "system"),
    model: expectString(value.model, "model"),
    runtime,
    deployment: {
      controlPlane: parseControlPlaneTarget(controlPlane, "deployment.controlPlane"),
      execution: parseExecutionTarget(execution, "deployment.execution"),
      workflow: expectString(deployment.workflow, "deployment.workflow")
    },
    tags,
    tools: {
      allowExec: expectBoolean(tools.allowExec, "tools.allowExec"),
      allowBrowser: browser.enabled,
      allowNetwork: expectBoolean(tools.allowNetwork, "tools.allowNetwork"),
      allowMcp: expectBoolean(tools.allowMcp, "tools.allowMcp"),
      browser
    },
    memory: {
      namespace: expectString(memory.namespace, "memory.namespace"),
      maxNotes: expectInteger(memory.maxNotes, "memory.maxNotes"),
      summarizeAfter: expectInteger(memory.summarizeAfter, "memory.summarizeAfter")
    },
    schedules: normalizedSchedules,
    workflowTemplates:
      normalizedWorkflowTemplates.length === 0
        ? [
            {
              id: "default",
              description: "Cadet default workflow",
              stages: [...workflowStages]
            }
          ]
        : normalizedWorkflowTemplates,
    toolProfiles: normalizedToolProfiles,
    handoffRules: normalizedHandoffRules,
    learningPolicy: {
      enabled:
        learningPolicy?.enabled === undefined
          ? true
          : expectBoolean(learningPolicy.enabled, "learningPolicy.enabled"),
      summarizeEveryRuns:
        learningPolicy?.summarizeEveryRuns === undefined
          ? 5
          : expectInteger(
              learningPolicy.summarizeEveryRuns,
              "learningPolicy.summarizeEveryRuns"
            ),
      embedMemory:
        learningPolicy?.embedMemory === undefined
          ? true
          : expectBoolean(learningPolicy.embedMemory, "learningPolicy.embedMemory"),
      maxRetrievedChunks:
        learningPolicy?.maxRetrievedChunks === undefined
          ? 8
          : expectInteger(
              learningPolicy.maxRetrievedChunks,
              "learningPolicy.maxRetrievedChunks"
            )
    },
    contextTriggers: parseContextTriggers(value.contextTriggers),
    prompts: parseAgentPrompts(value.prompts),
  };
}

function parseContextTriggers(value: unknown): ContextTrigger[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.map((trigger, index) => {
    const t = trigger as Record<string, unknown>;
    return {
      id: expectString(t.id, `contextTriggers[${index}].id`),
      event: expectString(t.event, `contextTriggers[${index}].event`) as ContextTrigger["event"],
      conditions: Array.isArray(t.conditions)
        ? (t.conditions as ContextTriggerCondition[])
        : [],
      actions: Array.isArray(t.actions)
        ? (t.actions as ContextTriggerAction[])
        : [],
      priority: typeof t.priority === "number" ? t.priority : 50,
    };
  });
}

function parseAgentPrompts(value: unknown): AgentPrompts | undefined {
  if (value === undefined || value === null || !isRecord(value)) return undefined;
  return {
    system: typeof value.system === "string" ? value.system : "system/core.md",
    personality: typeof value.personality === "string" ? value.personality : "",
    stages: isRecord(value.stages) ? (value.stages as Record<string, string>) : undefined,
  };
}
