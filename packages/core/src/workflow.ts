import type { BrowserMode, BrowserRisk, ExecutionTarget } from "./agent-manifest";
import type { JobPriority } from "./job";

export type WorkflowStage =
  | "route"
  | "plan"
  | "gather"
  | "act"
  | "verify"
  | "summarize"
  | "learn";

export type WorkflowExecutionTarget =
  | ExecutionTarget
  | "browser-worker"
  | "learning-worker";

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "blocked"
  | "awaiting-approval"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowStepStatus =
  | "ready"
  | "claimed"
  | "running"
  | "blocked"
  | "awaiting-approval"
  | "completed"
  | "failed"
  | "cancelled";

export type MessageDirection = "inbound" | "outbound" | "system";
export type MessageChannel = "web" | "slack" | "github" | "system";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type BrowserTaskStatus =
  | "queued"
  | "claimed"
  | "running"
  | "blocked"
  | "completed"
  | "failed";
export type DeliveryStatus = "queued" | "sent" | "failed" | "retrying";
export type BrowserToolResultStatus = "completed" | "failed";
export type ToolCallStatus = "pending" | "running" | "completed" | "failed";

export const approvalStatuses: readonly ApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
  "expired"
] as const;

export const browserTaskStatuses: readonly BrowserTaskStatus[] = [
  "queued",
  "claimed",
  "running",
  "blocked",
  "completed",
  "failed"
] as const;

export const toolCallStatuses: readonly ToolCallStatus[] = [
  "pending",
  "running",
  "completed",
  "failed"
] as const;

export const deliveryStatuses: readonly DeliveryStatus[] = [
  "queued",
  "sent",
  "failed",
  "retrying"
] as const;

export const messageDirections: readonly MessageDirection[] = [
  "inbound",
  "outbound",
  "system"
] as const;

export const messageChannels: readonly MessageChannel[] = [
  "web",
  "slack",
  "github",
  "system"
] as const;

export const browserArtifactKinds: readonly BrowserArtifactRef["kind"][] = [
  "screenshot",
  "text",
  "pdf",
  "html",
  "trace"
] as const;

export function isApprovalStatus(value: string): value is ApprovalStatus {
  return (approvalStatuses as readonly string[]).includes(value);
}

export function isBrowserTaskStatus(value: string): value is BrowserTaskStatus {
  return (browserTaskStatuses as readonly string[]).includes(value);
}

export function isToolCallStatus(value: string): value is ToolCallStatus {
  return (toolCallStatuses as readonly string[]).includes(value);
}

export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (deliveryStatuses as readonly string[]).includes(value);
}

export function isMessageDirection(value: string): value is MessageDirection {
  return (messageDirections as readonly string[]).includes(value);
}

export function isMessageChannel(value: string): value is MessageChannel {
  return (messageChannels as readonly string[]).includes(value);
}

export function isBrowserArtifactKind(value: string): value is BrowserArtifactRef["kind"] {
  return (browserArtifactKinds as readonly string[]).includes(value);
}

export interface ThreadRecord {
  threadId: string;
  channel: MessageChannel;
  channelThreadId: string;
  title: string;
  latestMessageAtMicros: number;
  createdAtMicros: number;
  updatedAtMicros: number;
}

export interface MessageEventRecord {
  eventId: string;
  threadId: string;
  runId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  actor: string;
  content: string;
  metadataJson: string;
  createdAtMicros: number;
}

export interface WorkflowRunRecord {
  runId: string;
  threadId: string;
  agentId: string;
  goal: string;
  priority: JobPriority;
  triggerSource: string;
  requestedBy: string;
  currentStage: WorkflowStage;
  status: WorkflowRunStatus;
  summary: string | null;
  contextJson: string;
  createdAtMicros: number;
  updatedAtMicros: number;
  completedAtMicros: number | null;
}

export interface WorkflowStepRecord {
  stepId: string;
  runId: string;
  agentId: string;
  stage: WorkflowStage;
  ownerExecution: WorkflowExecutionTarget;
  status: WorkflowStepStatus;
  inputJson: string;
  outputJson: string | null;
  retryCount: number;
  dependsOnStepId: string | null;
  approvalRequestId: string | null;
  runnerId: string | null;
  createdAtMicros: number;
  updatedAtMicros: number;
  claimedAtMicros: number | null;
  completedAtMicros: number | null;
}

export interface ApprovalRequestRecord {
  approvalId: string;
  runId: string;
  stepId: string;
  agentId: string;
  title: string;
  detail: string;
  status: ApprovalStatus;
  risk: BrowserRisk;
  requestedBy: string;
  resolutionJson: string | null;
  createdAtMicros: number;
  updatedAtMicros: number;
}

export interface BrowserArtifactRef {
  artifactId: string;
  kind: "screenshot" | "text" | "pdf" | "html" | "trace";
  url: string;
  title: string;
}

export interface BrowserToolRequest {
  taskId: string;
  runId: string;
  stepId: string;
  agentId: string;
  mode: BrowserMode;
  risk: BrowserRisk;
  url: string;
  allowedDomains: string[];
  blockedDomains: string[];
  allowDownloads: boolean;
  requestedBy: string;
  instructions: string;
  metadata: Record<string, unknown>;
}

export interface BrowserToolResult {
  taskId: string;
  status: BrowserToolResultStatus;
  summary: string;
  content: string;
  artifacts: BrowserArtifactRef[];
  metadata: Record<string, unknown>;
}

export interface BrowserTaskRecord {
  taskId: string;
  runId: string;
  stepId: string;
  agentId: string;
  mode: BrowserMode;
  risk: BrowserRisk;
  status: BrowserTaskStatus;
  ownerExecution: "browser-worker";
  url: string;
  requestJson: string;
  resultJson: string | null;
  runnerId: string | null;
  createdAtMicros: number;
  updatedAtMicros: number;
}

export interface BrowserArtifactRecord {
  artifactId: string;
  taskId: string;
  runId: string;
  stepId: string;
  kind: BrowserArtifactRef["kind"];
  title: string;
  url: string;
  metadataJson: string;
  createdAtMicros: number;
}

export interface DeliveryAttemptRecord {
  attemptId: string;
  threadId: string;
  runId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  status: DeliveryStatus;
  target: string;
  payloadJson: string;
  responseJson: string | null;
  createdAtMicros: number;
  updatedAtMicros: number;
}

export interface WorkflowTemplateSeed {
  stage: WorkflowStage;
  ownerExecution: WorkflowExecutionTarget;
  input: Record<string, unknown>;
  dependsOnStepId?: string | null;
}

export const workflowStages: readonly WorkflowStage[] = [
  "route",
  "plan",
  "gather",
  "act",
  "verify",
  "summarize",
  "learn"
] as const;

export const workflowRunStates: readonly WorkflowRunStatus[] = [
  "queued",
  "running",
  "blocked",
  "awaiting-approval",
  "completed",
  "failed",
  "cancelled"
] as const;

export const workflowStepStates: readonly WorkflowStepStatus[] = [
  "ready",
  "claimed",
  "running",
  "blocked",
  "awaiting-approval",
  "completed",
  "failed",
  "cancelled"
] as const;

export const workflowExecutionOwners: readonly WorkflowExecutionTarget[] = [
  "local-runner",
  "vercel-edge",
  "container-runner",
  "maincloud-runner",
  "browser-worker",
  "learning-worker"
] as const;

export function isWorkflowStage(value: string): value is WorkflowStage {
  return (workflowStages as readonly string[]).includes(value);
}

export function isWorkflowExecutionTarget(value: string): value is WorkflowExecutionTarget {
  return (workflowExecutionOwners as readonly string[]).includes(value);
}

export function isWorkflowRunStatus(value: string): value is WorkflowRunStatus {
  return (workflowRunStates as readonly string[]).includes(value);
}

export function isWorkflowStepStatus(value: string): value is WorkflowStepStatus {
  return (workflowStepStates as readonly string[]).includes(value);
}

export function nextWorkflowStage(stage: WorkflowStage): WorkflowStage | null {
  const currentIndex = workflowStages.indexOf(stage);
  if (currentIndex === -1 || currentIndex === workflowStages.length - 1) {
    return null;
  }
  return workflowStages[currentIndex + 1] ?? null;
}

export function parseWorkflowStage(value: string, field = "workflow stage"): WorkflowStage {
  if (!isWorkflowStage(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseWorkflowExecutionTarget(
  value: string,
  field = "workflow execution target"
): WorkflowExecutionTarget {
  if (!isWorkflowExecutionTarget(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseWorkflowRunStatus(
  value: string,
  field = "workflow run status"
): WorkflowRunStatus {
  if (!isWorkflowRunStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseWorkflowStepStatus(
  value: string,
  field = "workflow step status"
): WorkflowStepStatus {
  if (!isWorkflowStepStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseApprovalStatus(value: string, field = "approval status"): ApprovalStatus {
  if (!isApprovalStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseBrowserTaskStatus(
  value: string,
  field = "browser task status"
): BrowserTaskStatus {
  if (!isBrowserTaskStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseToolCallStatus(value: string, field = "tool call status"): ToolCallStatus {
  if (!isToolCallStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseDeliveryStatus(value: string, field = "delivery status"): DeliveryStatus {
  if (!isDeliveryStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseMessageDirection(
  value: string,
  field = "message direction"
): MessageDirection {
  if (!isMessageDirection(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseMessageChannel(value: string, field = "message channel"): MessageChannel {
  if (!isMessageChannel(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function parseBrowserArtifactKind(
  value: string,
  field = "browser artifact kind"
): BrowserArtifactRef["kind"] {
  if (!isBrowserArtifactKind(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}

export function workflowOwnerForStage(
  stage: WorkflowStage,
  execution: ExecutionTarget,
  browserEnabled: boolean
): WorkflowExecutionTarget {
  switch (stage) {
    case "route":
      return execution === "vercel-edge" ? "vercel-edge" : execution;
    case "verify":
      return browserEnabled ? "browser-worker" : execution;
    case "learn":
      return "learning-worker";
    default:
      return execution;
  }
}

export function browserRiskForMode(mode: BrowserMode): BrowserRisk {
  switch (mode) {
    case "form":
    case "download":
      return "high";
    case "navigate":
    case "monitor":
      return "medium";
    default:
      return "low";
  }
}

export function createWorkflowTemplateSeeds(
  execution: ExecutionTarget,
  browserEnabled: boolean,
  baseInput: Record<string, unknown>
): WorkflowTemplateSeed[] {
  let previousStepId: string | null = null;
  return workflowStages.map((stage) => {
    const seed: WorkflowTemplateSeed = {
      stage,
      ownerExecution: workflowOwnerForStage(stage, execution, browserEnabled),
      input: { ...baseInput, stage },
      dependsOnStepId: previousStepId
    };
    previousStepId = null;
    return seed;
  });
}
