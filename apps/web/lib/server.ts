import { parseAgentManifest, type AgentManifest } from "@starbridge/core/agent-manifest";
import { normalizeJobRequest, type JobRequest } from "@starbridge/core/job";
import { composeRuntimePrompt } from "@starbridge/core/prompt";
import {
  isScheduleDue,
  schedulesForManifest,
  type RegisteredScheduleRecord
} from "@starbridge/core/schedule";
import { executeEdgeAgent } from "@starbridge/core/edge-agent";
import { StarbridgeControlClient } from "@starbridge/sdk";

import { cloudAgentCatalog } from "./cloud-agents";
import { requireSpacetimeServerEnv } from "./env";

const presenceTtlMs = Number(process.env.STARBRIDGE_PRESENCE_TTL_MS ?? "90000");

interface CloudScheduledRunResult {
  scheduleId: string;
  agentId: string;
  jobId?: string;
  status: "dispatched" | "skipped" | "failed";
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

function runnerIdFor(agentId: string, role: "edge" | "scheduler"): string {
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

async function reconcilePresenceStaleness(controlPlane: "local" | "cloud"): Promise<string[]> {
  const client = createControlClient();
  const nowMicros = Date.now() * 1_000;
  const staleRunners: string[] = [];

  for (const presence of await client.listPresence()) {
    if (presence.controlPlane !== controlPlane) {
      continue;
    }

    if (presence.status === "stale") {
      continue;
    }

    if (nowMicros - presence.lastSeenAtMicros <= presenceTtlMs * 1_000) {
      continue;
    }

    await client.upsertPresence(
      presence.agentId,
      presence.runnerId,
      controlPlane,
      "stale"
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
      "cloud",
      "alive"
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

async function executeQueuedEdgeJob(
  manifest: AgentManifest,
  job: ReturnType<typeof normalizeJobRequest>
): Promise<{
  plane: "cloud";
  runtime: "edge";
  manifest: AgentManifest;
  job: ReturnType<typeof normalizeJobRequest>;
  promptPreview: string;
  execution: ReturnType<typeof executeEdgeAgent>;
}> {
  const client = createControlClient();
  const runnerId = runnerIdFor(manifest.id, "edge");

  await client.upsertPresence(manifest.id, runnerId, "cloud", "running");
  await client.markJobStarted(job.jobId, runnerId);

  try {
    const execution = executeEdgeAgent(manifest, job);
    await client.remember(manifest.id, manifest.memory.namespace, execution.memoryNote);
    await client.markJobCompleted(job.jobId, execution.summary);
    await client.upsertPresence(manifest.id, runnerId, "cloud", "idle");

    return {
      plane: "cloud",
      runtime: "edge",
      manifest,
      job,
      promptPreview: composeRuntimePrompt(manifest, job),
      execution
    };
  } catch (error) {
    await client.markJobFailed(
      job.jobId,
      error instanceof Error ? error.message : "Unknown edge dispatch error"
    );
    await client.upsertPresence(manifest.id, runnerId, "cloud", "failed");
    throw error;
  }
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
  if (manifest.deployment.controlPlane !== "cloud") {
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

  const normalized = normalizeJobRequest(buildCloudJobRequest(manifest, candidate, "cloud-control"));
  await createControlClient().enqueueJob(normalized);
  return normalized;
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
  return executeQueuedEdgeJob(manifest, job);
}

export async function reconcileCloudControlPlane(): Promise<{
  catalog: { agents: number; schedules: number };
  staleRunners: string[];
  runs: CloudScheduledRunResult[];
}> {
  const catalog = await syncCloudCatalog();
  const client = createControlClient();
  const staleRunners = await reconcilePresenceStaleness("cloud");
  await heartbeatCloudPresence();

  const schedules = (await client.listSchedules()).filter(
    (schedule) => schedule.controlPlane === "cloud" && isScheduleDue(schedule)
  );

  const runs: CloudScheduledRunResult[] = [];

  for (const schedule of schedules) {
    const manifest = cloudAgentCatalog.find((entry) => entry.id === schedule.agentId);

    if (!manifest) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        status: "skipped",
        reason: "Cloud manifest no longer exists"
      });
      continue;
    }

    const job = normalizeScheduledCloudJob(manifest, schedule);

    try {
      await client.claimScheduledRun(
        schedule.scheduleId,
        "cloud",
        schedule.nextRunAtMicros,
        job
      );
    } catch (error) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        status: "skipped",
        reason: error instanceof Error ? error.message : "Unknown schedule claim error"
      });
      continue;
    }

    try {
      const execution = await executeQueuedEdgeJob(manifest, job);
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        status: "dispatched",
        reason: execution.execution.summary
      });
    } catch (error) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        status: "failed",
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
