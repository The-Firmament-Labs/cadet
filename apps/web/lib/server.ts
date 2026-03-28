import {
  parseControlPlaneTarget,
  createStepId,
  executeEdgeAgent,
  nextWorkflowStage,
  normalizeJobRequest,
  ownerExecutionForStage,
  parseApprovalStatus,
  parseAgentManifest,
  parseMessageChannel,
  parseRunnerPresenceStatus,
  parseScheduleDispatchStatus,
  parseWorkflowStepStatus,
  seedWorkflowFromGoal,
  type AgentManifest,
  type BrowserMode,
  type ControlPlaneTarget,
  type JobRequest,
  type MessageChannel,
  type RegisteredScheduleRecord,
  type ScheduleDispatchStatus
} from "@starbridge/core";
import { isScheduleDue, schedulesForManifest } from "@starbridge/core/schedule";
import { StarbridgeControlClient } from "@starbridge/sdk";

import { cloudAgentCatalog } from "./cloud-agents";
import { requireSpacetimeServerEnv } from "./env";

const presenceTtlMs = Number(process.env.STARBRIDGE_PRESENCE_TTL_MS ?? "90000");
const staleRunnerPresenceStatus = parseRunnerPresenceStatus("stale");
const approvedApprovalStatus = parseApprovalStatus("approved");
const rejectedApprovalStatus = parseApprovalStatus("rejected");
const expiredApprovalStatus = parseApprovalStatus("expired");
const cloudControlPlaneTarget = parseControlPlaneTarget("cloud");
const webMessageChannel = parseMessageChannel("web");
const systemMessageChannel = parseMessageChannel("system");
const slackMessageChannel = parseMessageChannel("slack");
const githubMessageChannel = parseMessageChannel("github");
const retryableWorkflowStepStatuses = new Set([
  parseWorkflowStepStatus("failed"),
  parseWorkflowStepStatus("blocked")
]);
type CloudWorkflowChannel = MessageChannel;
interface SeededWorkflowRoute<TChannel extends MessageChannel = MessageChannel> {
  runId: string;
  threadId: string;
  routeStepId: string;
  channel: TChannel;
  browserRequired: boolean;
  browserMode: BrowserMode;
}

interface CloudScheduledRunResult {
  scheduleId: string;
  agentId: string;
  runId?: string;
  jobId?: string;
  status: ScheduleDispatchStatus;
  reason?: string;
}

export function createControlClient(): StarbridgeControlClient {
  const env = requireSpacetimeServerEnv();

  return new StarbridgeControlClient({
    baseUrl: env.spacetimeUrl,
    database: env.database,
    authToken: env.authToken
  });
}

function runnerIdFor(agentId: string, role: "edge" | "scheduler" | "route"): string {
  return `${agentId}-${role}@cloud`;
}

async function syncCloudCatalog(): Promise<{ agents: number; schedules: number }> {
  const client = createControlClient();
  let scheduleCount = 0;

  for (const manifest of cloudAgentCatalog) {
    await client.registerAgent(manifest);
    for (const schedule of schedulesForManifest(manifest)) {
      await client.registerSchedule(schedule);
      scheduleCount += 1;
    }
  }

  return {
    agents: cloudAgentCatalog.length,
    schedules: scheduleCount
  };
}

async function reconcilePresenceStaleness(controlPlane: ControlPlaneTarget): Promise<string[]> {
  const client = createControlClient();
  const nowMicros = Date.now() * 1_000;
  const staleRunners: string[] = [];

  for (const presence of await client.listPresence()) {
    if (presence.controlPlane !== controlPlane || presence.status === staleRunnerPresenceStatus) {
      continue;
    }

    if (nowMicros - presence.lastSeenAtMicros <= presenceTtlMs * 1_000) {
      continue;
    }

    await client.upsertPresence(
      presence.agentId,
      presence.runnerId,
      controlPlane,
      parseRunnerPresenceStatus("stale")
    );
    staleRunners.push(presence.runnerId);
  }

  return staleRunners;
}

async function heartbeatCloudPresence(): Promise<void> {
  const client = createControlClient();

  for (const manifest of cloudAgentCatalog) {
    await client.upsertPresence(
      manifest.id,
      runnerIdFor(manifest.id, "scheduler"),
      cloudControlPlaneTarget,
      parseRunnerPresenceStatus("alive")
    );
  }
}

function buildCloudJobRequest(
  manifest: AgentManifest,
  candidate: Partial<JobRequest>,
  defaultRequestedBy: string
): JobRequest {
  const request: JobRequest = {
    agentId: manifest.id,
    goal: candidate.goal ?? ""
  };

  if (candidate.priority !== undefined) {
    request.priority = candidate.priority;
  }

  request.requestedBy = candidate.requestedBy ?? defaultRequestedBy;
  request.context = {
    ...(candidate.context ?? {}),
    controlPlane: manifest.deployment.controlPlane,
    execution: manifest.deployment.execution,
    workflow: manifest.deployment.workflow
  };

  return request;
}

async function seedWorkflowFromJob(
  manifest: AgentManifest,
  job: ReturnType<typeof normalizeJobRequest>,
  triggerSource: string,
  channel: CloudWorkflowChannel,
  actor: string
): Promise<SeededWorkflowRoute<CloudWorkflowChannel>> {
  const client = createControlClient();
  const seed = seedWorkflowFromGoal(manifest, {
    channel,
    channelThreadId: `${channel}_${job.jobId}`,
    requestedBy: job.requestedBy,
    actor,
    goal: job.goal,
    priority: job.priority,
    triggerSource,
    context: job.context,
    createId: (prefix) => `${prefix}_${job.jobId}`
  });

  await client.ingestMessage({
    threadId: seed.message.threadId,
    channel: seed.message.channel,
    channelThreadId: seed.thread.channelThreadId,
    title: seed.thread.title,
    eventId: seed.message.eventId,
    runId: seed.message.runId,
    direction: seed.message.direction,
    actor: seed.message.actor,
    content: seed.message.content,
    metadata: {
      ...seed.message.metadata,
      jobId: job.jobId
    }
  });
  await client.startWorkflowRun(seed.run);
  await client.enqueueWorkflowStep(seed.routeStep);

  return {
    runId: seed.run.runId,
    threadId: seed.thread.threadId,
    routeStepId: seed.routeStep.stepId,
    channel,
    browserRequired: seed.browser.required,
    browserMode: seed.browser.mode
  };
}

async function completeRouteTriage(
  manifest: AgentManifest,
  job: ReturnType<typeof normalizeJobRequest>,
  workflow: SeededWorkflowRoute<CloudWorkflowChannel>
): Promise<void> {
  const client = createControlClient();
  const runnerId = runnerIdFor(manifest.id, "route");

  await client.upsertPresence(
    manifest.id,
    runnerId,
    cloudControlPlaneTarget,
    parseRunnerPresenceStatus("running")
  );
  await client.claimWorkflowStep(workflow.routeStepId, manifest.deployment.execution, runnerId);

  const routeResult = executeEdgeAgent(manifest, job);
  await client.completeWorkflowStep(workflow.routeStepId, {
    summary: routeResult.summary,
    actions: routeResult.actions,
    browserRequired: workflow.browserRequired,
    browserMode: workflow.browserMode,
    nextStage: nextWorkflowStage("route")
  });

  const planStage = nextWorkflowStage("route");
  if (!planStage) {
    throw new Error("Cadet canonical workflow must advance from route to plan");
  }
  const planStepId = createStepId(workflow.runId, planStage);
  await client.enqueueWorkflowStep({
    stepId: planStepId,
    runId: workflow.runId,
    agentId: manifest.id,
    stage: planStage,
    ownerExecution: ownerExecutionForStage(manifest, planStage, workflow.browserRequired),
    input: {
      jobId: job.jobId,
      runId: workflow.runId,
      threadId: workflow.threadId,
      channel: workflow.channel,
      goal: job.goal,
      context: job.context,
      browserRequired: workflow.browserRequired,
      browserMode: workflow.browserMode,
      routeSummary: routeResult.summary,
      routeActions: routeResult.actions
    },
    dependsOnStepId: workflow.routeStepId
  });

  await client.remember(manifest.id, manifest.memory.namespace, routeResult.memoryNote);
  await client.markJobCompleted(job.jobId, `Workflow ${workflow.runId} seeded`);
  await client.upsertPresence(
    manifest.id,
    runnerId,
    cloudControlPlaneTarget,
    parseRunnerPresenceStatus("idle")
  );
}

function normalizeScheduledCloudJob(
  manifest: AgentManifest,
  schedule: RegisteredScheduleRecord
): ReturnType<typeof normalizeJobRequest> {
  return normalizeJobRequest({
    agentId: manifest.id,
    goal: schedule.goal,
    priority: schedule.priority,
    requestedBy: schedule.requestedBy,
    context: {
      controlPlane: manifest.deployment.controlPlane,
      execution: manifest.deployment.execution,
      workflow: manifest.deployment.workflow,
      scheduleId: schedule.scheduleId,
      scheduled: true
    }
  });
}

export async function registerAgentFromPayload(payload: unknown): Promise<unknown> {
  const manifest: AgentManifest = parseAgentManifest(payload);
  if (manifest.deployment.controlPlane !== cloudControlPlaneTarget) {
    throw new Error("Cloud control plane can only register cloud-plane agents");
  }

  const client = createControlClient();
  await client.registerAgent(manifest);
  for (const schedule of schedulesForManifest(manifest)) {
    await client.registerSchedule(schedule);
  }

  return {
    agentId: manifest.id,
    schedules: manifest.schedules.length
  };
}

export async function dispatchJobFromPayload(payload: unknown): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("dispatch payload must be an object");
  }

  await syncCloudCatalog();

  const candidate = payload as Partial<JobRequest>;
  const manifest = cloudAgentCatalog.find((agent) => agent.id === (candidate.agentId ?? ""));

  if (!manifest) {
    throw new Error("Cloud control plane only dispatches registered cloud agents");
  }

  const normalized = normalizeJobRequest(
    buildCloudJobRequest(manifest, candidate, "cloud-control")
  );
  const client = createControlClient();
  await client.enqueueJob(normalized);
  const workflow = await seedWorkflowFromJob(
    manifest,
    normalized,
    "api:jobs.dispatch",
    webMessageChannel,
    normalized.requestedBy
  );
  await completeRouteTriage(manifest, normalized, workflow);

  return {
    job: normalized,
    workflow
  };
}

export async function dispatchEdgeJobFromPayload(payload: unknown): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("dispatch payload must be an object");
  }

  await syncCloudCatalog();

  const candidate = payload as Partial<JobRequest> & { agentId?: string };
  const agentId = candidate.agentId ?? "operator";
  const manifest = cloudAgentCatalog.find((entry) => entry.id === agentId);

  if (!manifest) {
    throw new Error(`Unknown edge agent '${agentId}'`);
  }

  const job = normalizeJobRequest(buildCloudJobRequest(manifest, candidate, "cloud-control"));
  await createControlClient().enqueueJob(job);
  const workflow = await seedWorkflowFromJob(
    manifest,
    job,
    "api:agents.edge.dispatch",
    webMessageChannel,
    job.requestedBy
  );
  await completeRouteTriage(manifest, job, workflow);

  return {
    plane: cloudControlPlaneTarget,
    runtime: "edge",
    manifest,
    job,
    workflow
  };
}

export async function ingestSlackEvent(payload: unknown): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("slack payload must be an object");
  }

  await syncCloudCatalog();

  const body = payload as {
    text?: string;
    user?: string;
    thread_ts?: string;
    channel?: string;
    agentId?: string;
  };
  const manifest = cloudAgentCatalog.find((entry) => entry.id === (body.agentId ?? "operator"));
  if (!manifest) {
    throw new Error("No matching cloud agent");
  }

  const job = normalizeJobRequest({
    agentId: manifest.id,
    goal: body.text ?? "",
    requestedBy: body.user ?? "slack-user",
    context: {
      slackChannel: body.channel ?? "unknown",
      slackThreadTs: body.thread_ts ?? "root"
    }
  });

  await createControlClient().enqueueJob(job);
  const workflow = await seedWorkflowFromJob(
    manifest,
    job,
    "slack:webhook",
    slackMessageChannel,
    body.user ?? "slack-user"
  );
  await completeRouteTriage(manifest, job, workflow);

  return {
    ok: true,
    workflow
  };
}

export async function ingestGitHubEvent(payload: unknown): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("github payload must be an object");
  }

  await syncCloudCatalog();

  const body = payload as {
    action?: string;
    repository?: { full_name?: string };
    issue?: { number?: number; title?: string; body?: string; user?: { login?: string } };
    comment?: { body?: string; user?: { login?: string } };
    agentId?: string;
  };
  const manifest = cloudAgentCatalog.find((entry) => entry.id === (body.agentId ?? "operator"));
  if (!manifest) {
    throw new Error("No matching cloud agent");
  }

  const goal =
    body.comment?.body ??
    body.issue?.body ??
    body.issue?.title ??
    `${body.action ?? "event"} in ${body.repository?.full_name ?? "github"}`;
  const actor = body.comment?.user?.login ?? body.issue?.user?.login ?? "github-user";

  const job = normalizeJobRequest({
    agentId: manifest.id,
    goal,
    requestedBy: actor,
    context: {
      githubAction: body.action ?? "unknown",
      repository: body.repository?.full_name ?? "unknown",
      issueNumber: body.issue?.number ?? 0
    }
  });

  await createControlClient().enqueueJob(job);
  const workflow = await seedWorkflowFromJob(
    manifest,
    job,
    "github:webhook",
    githubMessageChannel,
    actor
  );
  await completeRouteTriage(manifest, job, workflow);

  return {
    ok: true,
    workflow
  };
}

export async function loadInbox(): Promise<{
  threads: Awaited<ReturnType<StarbridgeControlClient["listThreads"]>>;
  runs: Awaited<ReturnType<StarbridgeControlClient["listWorkflowRuns"]>>;
  approvals: Awaited<ReturnType<StarbridgeControlClient["listApprovalRequests"]>>;
  browserTasks: Awaited<ReturnType<StarbridgeControlClient["listBrowserTasks"]>>;
}> {
  const client = createControlClient();
  const [threads, runs, approvals, browserTasks] = await Promise.all([
    client.listThreads(),
    client.listWorkflowRuns(),
    client.listApprovalRequests(),
    client.listBrowserTasks()
  ]);

  return {
    threads: [...threads].sort((left, right) => right.updatedAtMicros - left.updatedAtMicros),
    runs: [...runs].sort((left, right) => right.updatedAtMicros - left.updatedAtMicros),
    approvals: [...approvals].sort(
      (left, right) => right.updatedAtMicros - left.updatedAtMicros
    ),
    browserTasks: [...browserTasks].sort(
      (left, right) => right.updatedAtMicros - left.updatedAtMicros
    )
  };
}

export async function loadRunDetails(runId: string): Promise<{
  run: Awaited<ReturnType<StarbridgeControlClient["listWorkflowRuns"]>>[number];
  job: Awaited<ReturnType<StarbridgeControlClient["listJobs"]>>[number] | null;
  steps: Awaited<ReturnType<StarbridgeControlClient["listWorkflowSteps"]>>;
  messages: Awaited<ReturnType<StarbridgeControlClient["listMessageEvents"]>>;
  toolCalls: Awaited<ReturnType<StarbridgeControlClient["listToolCalls"]>>;
  approvals: Awaited<ReturnType<StarbridgeControlClient["listApprovalRequests"]>>;
  browserTasks: Awaited<ReturnType<StarbridgeControlClient["listBrowserTasks"]>>;
  browserArtifacts: Awaited<ReturnType<StarbridgeControlClient["listBrowserArtifacts"]>>;
  retrievalTraces: Awaited<ReturnType<StarbridgeControlClient["listRetrievalTraces"]>>;
}> {
  const client = createControlClient();
  const [runs, jobs, steps, messages, toolCalls, approvals, browserTasks, browserArtifacts, retrievalTraces] =
    await Promise.all([
      client.listWorkflowRuns(),
      client.listJobs(),
      client.listWorkflowSteps(),
      client.listMessageEvents(),
      client.listToolCalls(),
      client.listApprovalRequests(),
      client.listBrowserTasks(),
      client.listBrowserArtifacts(),
      client.listRetrievalTraces()
    ]);

  const run = runs.find((candidate) => candidate.runId === runId);
  if (!run) {
    throw new Error(`Unknown workflow run '${runId}'`);
  }

  const runMessages = messages.filter((candidate) => candidate.runId === runId);
  const jobId = extractJobIdFromRun(run.runId, runMessages);

  return {
    run,
    job: jobId ? jobs.find((candidate) => candidate.jobId === jobId) ?? null : null,
    steps: steps.filter((candidate) => candidate.runId === runId),
    messages: runMessages,
    toolCalls: toolCalls.filter((candidate) => candidate.runId === runId),
    approvals: approvals.filter((candidate) => candidate.runId === runId),
    browserTasks: browserTasks.filter((candidate) => candidate.runId === runId),
    browserArtifacts: browserArtifacts.filter((candidate) => candidate.runId === runId),
    retrievalTraces: retrievalTraces.filter((candidate) => candidate.runId === runId)
  };
}

function extractJobIdFromRun(
  runId: string,
  messages: Awaited<ReturnType<StarbridgeControlClient["listMessageEvents"]>>
): string | null {
  for (const message of messages) {
    try {
      const metadata = JSON.parse(message.metadataJson) as { jobId?: unknown };
      if (typeof metadata.jobId === "string" && metadata.jobId.length > 0) {
        return metadata.jobId;
      }
    } catch {
      continue;
    }
  }

  return runId.startsWith("run_job_") ? runId.slice("run_".length) : null;
}

export async function resolveApprovalFromPayload(
  approvalId: string,
  payload: unknown
): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("approval payload must be an object");
  }

  const body = payload as {
    status?: typeof approvedApprovalStatus | typeof rejectedApprovalStatus | typeof expiredApprovalStatus;
    resolvedBy?: string;
    note?: string;
  };

  if (!body.status) {
    throw new Error("approval status is required");
  }

  const client = createControlClient();
  return client.resolveApproval(approvalId, body.status, {
    resolvedBy: body.resolvedBy ?? "operator",
    note: body.note ?? ""
  });
}

export async function loadBrowserTask(taskId: string): Promise<{
  task: Awaited<ReturnType<StarbridgeControlClient["listBrowserTasks"]>>[number];
  artifacts: Awaited<ReturnType<StarbridgeControlClient["listBrowserArtifacts"]>>;
}> {
  const client = createControlClient();
  const [tasks, artifacts] = await Promise.all([
    client.listBrowserTasks(),
    client.listBrowserArtifacts()
  ]);
  const task = tasks.find((candidate) => candidate.taskId === taskId);

  if (!task) {
    throw new Error(`Unknown browser task '${taskId}'`);
  }

  return {
    task,
    artifacts: artifacts.filter((candidate) => candidate.taskId === taskId)
  };
}

export async function retryWorkflowRun(runId: string): Promise<unknown> {
  const client = createControlClient();
  const [runs, steps] = await Promise.all([
    client.listWorkflowRuns(),
    client.listWorkflowSteps()
  ]);
  const run = runs.find((candidate) => candidate.runId === runId);

  if (!run) {
    throw new Error(`Unknown workflow run '${runId}'`);
  }

  const failedStep =
    [...steps]
      .filter((candidate) => candidate.runId === runId)
      .sort((left, right) => right.updatedAtMicros - left.updatedAtMicros)
      .find((candidate) => retryableWorkflowStepStatuses.has(candidate.status)) ??
    [...steps]
      .filter((candidate) => candidate.runId === runId)
      .sort((left, right) => right.updatedAtMicros - left.updatedAtMicros)[0];

  if (!failedStep) {
    throw new Error(`Run '${runId}' has no steps to retry`);
  }

  const retryStepId = `${failedStep.stepId}_retry_${Date.now().toString(36)}`;
  await client.enqueueWorkflowStep({
    stepId: retryStepId,
    runId,
    agentId: run.agentId,
    stage: failedStep.stage,
    ownerExecution: failedStep.ownerExecution,
    input: JSON.parse(failedStep.inputJson) as Record<string, unknown>,
    dependsOnStepId: failedStep.dependsOnStepId
  });

  return {
    ok: true,
    retryStepId,
    stage: failedStep.stage
  };
}

export async function reconcileCloudControlPlane(): Promise<{
  catalog: { agents: number; schedules: number };
  staleRunners: string[];
  runs: CloudScheduledRunResult[];
}> {
  const catalog = await syncCloudCatalog();
  const client = createControlClient();
  const staleRunners = await reconcilePresenceStaleness(cloudControlPlaneTarget);
  await heartbeatCloudPresence();

  const schedules = (await client.listSchedules()).filter(
    (schedule) => schedule.controlPlane === cloudControlPlaneTarget && isScheduleDue(schedule)
  );

  const runs: CloudScheduledRunResult[] = [];

  for (const schedule of schedules) {
    const manifest = cloudAgentCatalog.find((entry) => entry.id === schedule.agentId);

    if (!manifest) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        status: parseScheduleDispatchStatus("skipped"),
        reason: "Cloud manifest no longer exists"
      });
      continue;
    }

    const job = normalizeScheduledCloudJob(manifest, schedule);

    try {
      await client.claimScheduledRun(
        schedule.scheduleId,
        cloudControlPlaneTarget,
        schedule.nextRunAtMicros,
        job
      );
    } catch (error) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        status: parseScheduleDispatchStatus("skipped"),
        reason: error instanceof Error ? error.message : "Unknown schedule claim error"
      });
      continue;
    }

    try {
      const workflow = await seedWorkflowFromJob(
        manifest,
        job,
        "cron:reconcile",
        systemMessageChannel,
        schedule.requestedBy
      );
      await completeRouteTriage(manifest, job, workflow);
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        runId: workflow.runId,
        status: parseScheduleDispatchStatus("dispatched"),
        reason: "Workflow seeded"
      });
    } catch (error) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        status: parseScheduleDispatchStatus("failed"),
        reason: error instanceof Error ? error.message : "Unknown scheduled execution error"
      });
    }
  }

  return {
    catalog,
    staleRunners,
    runs
  };
}
