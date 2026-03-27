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
  status: "completed" | "failed";
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

export const workflowStages: WorkflowStage[] = [
  "route",
  "plan",
  "gather",
  "act",
  "verify",
  "summarize",
  "learn"
];

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
