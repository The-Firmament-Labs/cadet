import type { AgentManifest, BrowserMode, BrowserToolPolicy } from "./agent-manifest";
import type { JobPriority } from "./job";
import type {
  MessageChannel,
  ThreadRecord,
  WorkflowExecutionTarget,
  WorkflowStage
} from "./workflow";

export interface WorkflowSeedIdentifiers {
  threadId: string;
  eventId: string;
  runId: string;
  deliveryAttemptId: string;
}

export interface WorkflowSeed {
  thread: {
    threadId: string;
    channel: MessageChannel;
    channelThreadId: string;
    title: string;
  };
  message: {
    eventId: string;
    threadId: string;
    runId: string;
    channel: MessageChannel;
    direction: "inbound";
    actor: string;
    content: string;
    metadata: Record<string, unknown>;
  };
  run: {
    runId: string;
    threadId: string;
    agentId: string;
    goal: string;
    priority: JobPriority;
    triggerSource: string;
    requestedBy: string;
    context: Record<string, unknown>;
  };
  routeStep: {
    stepId: string;
    runId: string;
    agentId: string;
    stage: "route";
    ownerExecution: WorkflowExecutionTarget;
    input: Record<string, unknown>;
  };
  remainingStages: WorkflowStage[];
  browser: {
    required: boolean;
    mode: BrowserMode;
    requiresApproval: boolean;
  };
}

export interface WorkflowSeedOptions {
  channel: MessageChannel;
  channelThreadId?: string;
  requestedBy: string;
  actor: string;
  goal: string;
  priority?: JobPriority;
  triggerSource: string;
  context?: Record<string, unknown>;
  createId?: (prefix: string) => string;
}

const browserKeywords = [
  "browser",
  "website",
  "web",
  "page",
  "screenshot",
  "login",
  "docs",
  "research",
  "github",
  "slack",
  "triage",
  "verify",
  "audit"
];

export const defaultWorkflowStages: WorkflowStage[] = [
  "route",
  "plan",
  "gather",
  "act",
  "verify",
  "summarize",
  "learn"
];

function defaultIdFactory(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function inferBrowserNeed(goal: string, manifest: AgentManifest): boolean {
  if (!manifest.tools.browser.enabled) {
    return false;
  }

  const lowerGoal = goal.toLowerCase();
  return browserKeywords.some((keyword) => lowerGoal.includes(keyword));
}

export function inferBrowserMode(goal: string, policy: BrowserToolPolicy): BrowserMode {
  const lowerGoal = goal.toLowerCase();
  if (lowerGoal.includes("download") && policy.allowDownloads) {
    return "download";
  }
  if (lowerGoal.includes("submit") || lowerGoal.includes("form") || lowerGoal.includes("login")) {
    return "form";
  }
  if (
    lowerGoal.includes("extract") ||
    lowerGoal.includes("research") ||
    lowerGoal.includes("triage")
  ) {
    return "extract";
  }
  if (lowerGoal.includes("monitor") || lowerGoal.includes("watch")) {
    return "monitor";
  }
  if (lowerGoal.includes("navigate") || lowerGoal.includes("browse")) {
    return "navigate";
  }
  return policy.defaultMode;
}

export function browserModeRequiresApproval(
  mode: BrowserMode,
  policy: BrowserToolPolicy
): boolean {
  return policy.requiresApprovalFor.includes(mode);
}

export function routeOwnerForManifest(manifest: AgentManifest): WorkflowExecutionTarget {
  return manifest.deployment.execution === "vercel-edge"
    ? "vercel-edge"
    : manifest.deployment.execution;
}

export function titleForGoal(goal: string): string {
  return goal.trim().slice(0, 96) || "Cadet workflow";
}

export function seedWorkflowFromGoal(
  manifest: AgentManifest,
  options: WorkflowSeedOptions
): WorkflowSeed {
  const createId = options.createId ?? defaultIdFactory;
  const browserRequired = inferBrowserNeed(options.goal, manifest);
  const browserMode = inferBrowserMode(options.goal, manifest.tools.browser);
  const threadId = createId("thread");
  const runId = createId("run");
  const stepId = createId("step_route");

  return {
    thread: {
      threadId,
      channel: options.channel,
      channelThreadId: options.channelThreadId ?? threadId,
      title: titleForGoal(options.goal)
    },
    message: {
      eventId: createId("evt"),
      threadId,
      runId,
      channel: options.channel,
      direction: "inbound",
      actor: options.actor,
      content: options.goal,
      metadata: {
        triggerSource: options.triggerSource
      }
    },
    run: {
      runId,
      threadId,
      agentId: manifest.id,
      goal: options.goal,
      priority: options.priority ?? "normal",
      triggerSource: options.triggerSource,
      requestedBy: options.requestedBy,
      context: {
        ...(options.context ?? {}),
        controlPlane: manifest.deployment.controlPlane,
        execution: manifest.deployment.execution,
        workflow: manifest.deployment.workflow,
        browserRequired,
        browserMode
      }
    },
    routeStep: {
      stepId,
      runId,
      agentId: manifest.id,
      stage: "route",
      ownerExecution: routeOwnerForManifest(manifest),
      input: {
        goal: options.goal,
        channel: options.channel,
        requestedBy: options.requestedBy,
        browserRequired,
        browserMode
      }
    },
    remainingStages: defaultWorkflowStages.slice(1),
    browser: {
      required: browserRequired,
      mode: browserMode,
      requiresApproval: browserModeRequiresApproval(browserMode, manifest.tools.browser)
    }
  };
}

export function createStepId(runId: string, stage: WorkflowStage): string {
  return `${runId}_${stage}`;
}

export function ownerExecutionForStage(
  manifest: AgentManifest,
  stage: WorkflowStage,
  browserRequired: boolean
): WorkflowExecutionTarget {
  if (stage === "learn") {
    return "learning-worker";
  }

  if ((stage === "gather" || stage === "verify") && browserRequired) {
    return "browser-worker";
  }

  if (stage === "route") {
    return routeOwnerForManifest(manifest);
  }

  if (manifest.deployment.execution === "vercel-edge") {
    return "container-runner";
  }

  return manifest.deployment.execution;
}

export function nextStage(stage: WorkflowStage): WorkflowStage | null {
  const currentIndex = defaultWorkflowStages.indexOf(stage);
  if (currentIndex === -1 || currentIndex === defaultWorkflowStages.length - 1) {
    return null;
  }
  return defaultWorkflowStages[currentIndex + 1] ?? null;
}
