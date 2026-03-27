import path from "node:path";

import {
  createStepId,
  executeEdgeAgent,
  filterAgentsByControlPlane,
  isScheduleDue,
  nextWorkflowStage,
  normalizeJobRequest,
  ownerExecutionForStage,
  parseRunnerPresenceStatus,
  parseScheduleDispatchStatus,
  schedulesForManifest,
  seedWorkflowFromGoal,
  type AgentManifest,
  type JobRequest,
  type RegisteredScheduleRecord,
  type ScheduleDispatchStatus
} from "@starbridge/core";
import { loadAgentManifestDirectory } from "@starbridge/core/fs";
import { StarbridgeControlClient } from "@starbridge/sdk";

const port = Number(process.env.PORT ?? "3010");
const heartbeatIntervalMs = Number(process.env.STARBRIDGE_HEARTBEAT_INTERVAL_MS ?? "30000");
const scheduleIntervalMs = Number(process.env.STARBRIDGE_SCHEDULE_INTERVAL_MS ?? "30000");
const presenceTtlMs = Number(process.env.STARBRIDGE_PRESENCE_TTL_MS ?? "90000");
const staleRunnerPresenceStatus = parseRunnerPresenceStatus("stale");

interface ScheduledRunResult {
  scheduleId: string;
  agentId: string;
  runId?: string;
  jobId?: string;
  status: ScheduleDispatchStatus;
  reason?: string;
}

function defaultManifestDirectory(): string {
  return path.resolve(process.cwd(), "../../examples/agents");
}

function createControlClient(): StarbridgeControlClient {
  return new StarbridgeControlClient({
    baseUrl: process.env.SPACETIMEDB_URL ?? "http://127.0.0.1:3000",
    database: process.env.SPACETIMEDB_DATABASE ?? "starbridge-control",
    authToken: process.env.SPACETIMEDB_AUTH_TOKEN
  });
}

function runnerIdFor(agentId: string, role: "control" | "scheduler" | "route"): string {
  return `${agentId}-${role}@local:${port}`;
}

async function loadLocalCatalog(): Promise<AgentManifest[]> {
  const manifests = await loadAgentManifestDirectory(
    process.env.STARBRIDGE_MANIFEST_DIR ?? defaultManifestDirectory()
  );
  return filterAgentsByControlPlane(manifests, "local");
}

async function syncLocalCatalog(
  catalog: AgentManifest[]
): Promise<{ agents: number; schedules: number }> {
  const client = createControlClient();
  let scheduleCount = 0;

  for (const manifest of catalog) {
    await client.registerAgent(manifest);
    for (const schedule of schedulesForManifest(manifest)) {
      await client.registerSchedule(schedule);
      scheduleCount += 1;
    }
  }

  return {
    agents: catalog.length,
    schedules: scheduleCount
  };
}

async function reconcilePresenceStaleness(controlPlane: "local" | "cloud"): Promise<string[]> {
  const client = createControlClient();
  const staleRunners: string[] = [];
  const nowMicros = Date.now() * 1_000;

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

async function heartbeatLocalPresence(catalog: AgentManifest[]): Promise<void> {
  const client = createControlClient();

  for (const manifest of catalog) {
    await client.upsertPresence(
      manifest.id,
      runnerIdFor(manifest.id, "control"),
      "local",
      parseRunnerPresenceStatus("alive")
    );
    await client.upsertPresence(
      manifest.id,
      runnerIdFor(manifest.id, "scheduler"),
      "local",
      parseRunnerPresenceStatus("alive")
    );
  }
}

async function seedWorkflowFromJob(
  manifest: AgentManifest,
  job: ReturnType<typeof normalizeJobRequest>,
  triggerSource: string,
  channel: "web" | "system",
  actor: string
): Promise<{
  runId: string;
  threadId: string;
  routeStepId: string;
  channel: "web" | "system";
  browserRequired: boolean;
  browserMode: string;
}> {
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
  workflow: {
    runId: string;
    threadId: string;
    routeStepId: string;
    channel: "web" | "system";
    browserRequired: boolean;
    browserMode: string;
  }
): Promise<void> {
  const client = createControlClient();
  const runnerId = runnerIdFor(manifest.id, "route");

  await client.upsertPresence(manifest.id, runnerId, "local", parseRunnerPresenceStatus("running"));
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
  await client.upsertPresence(manifest.id, runnerId, "local", parseRunnerPresenceStatus("idle"));
}

async function registerLocalAgents(payload: unknown): Promise<unknown> {
  const catalog = await loadLocalCatalog();
  const body = (payload ?? {}) as { all?: boolean; agentId?: string };

  const manifests =
    body.all || (!body.all && !body.agentId)
      ? catalog
      : catalog.filter((manifest) => manifest.id === body.agentId);

  if (manifests.length === 0) {
    throw new Error("No matching local agents found");
  }

  return syncLocalCatalog(manifests);
}

async function dispatchLocalJob(payload: unknown): Promise<unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("dispatch payload must be an object");
  }

  const catalog = await loadLocalCatalog();
  await syncLocalCatalog(catalog);

  const body = payload as Partial<JobRequest> & { agentId?: string };
  const manifest = catalog.find((candidate) => candidate.id === (body.agentId ?? ""));

  if (!manifest) {
    throw new Error("Local control plane only dispatches registered local agents");
  }

  const request: JobRequest = {
    agentId: manifest.id,
    goal: body.goal ?? "",
    requestedBy: body.requestedBy ?? "local-control",
    context: {
      ...(body.context ?? {}),
      controlPlane: manifest.deployment.controlPlane,
      execution: manifest.deployment.execution,
      workflow: manifest.deployment.workflow
    }
  };
  if (body.priority !== undefined) {
    request.priority = body.priority;
  }

  const normalized = normalizeJobRequest(request);
  const client = createControlClient();
  await client.enqueueJob(normalized);
  const workflow = await seedWorkflowFromJob(
    manifest,
    normalized,
    "local:dispatch",
    "web",
    normalized.requestedBy
  );
  await completeRouteTriage(manifest, normalized, workflow);

  return {
    plane: "local",
    manifest,
    job: normalized,
    workflow
  };
}

function normalizeScheduledLocalJob(
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

async function reconcileLocalSchedules(): Promise<{
  staleRunners: string[];
  runs: ScheduledRunResult[];
}> {
  const catalog = await loadLocalCatalog();
  await syncLocalCatalog(catalog);
  await heartbeatLocalPresence(catalog);

  const client = createControlClient();
  const staleRunners = await reconcilePresenceStaleness("local");
  const schedules = (await client.listSchedules()).filter(
    (schedule) => schedule.controlPlane === "local" && isScheduleDue(schedule)
  );

  const runs: ScheduledRunResult[] = [];

  for (const schedule of schedules) {
    const manifest = catalog.find((candidate) => candidate.id === schedule.agentId);

    if (!manifest) {
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        status: parseScheduleDispatchStatus("skipped"),
        reason: "Local manifest no longer exists"
      });
      continue;
    }

    const job = normalizeScheduledLocalJob(manifest, schedule);

    try {
      await client.claimScheduledRun(schedule.scheduleId, "local", schedule.nextRunAtMicros, job);
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
        "local:schedule",
        "system",
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
    staleRunners,
    runs
  };
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function methodNotAllowed(): Response {
  return json(405, { ok: false, error: "Method not allowed" });
}

let heartbeatInFlight = false;
let scheduleInFlight = false;

async function runHeartbeatLoop(): Promise<void> {
  if (heartbeatInFlight) {
    return;
  }

  heartbeatInFlight = true;
  try {
    const catalog = await loadLocalCatalog();
    await syncLocalCatalog(catalog);
    await heartbeatLocalPresence(catalog);
    await reconcilePresenceStaleness("local");
  } catch (error) {
    console.error("Local heartbeat loop failed", error);
  } finally {
    heartbeatInFlight = false;
  }
}

async function runScheduleLoop(): Promise<void> {
  if (scheduleInFlight) {
    return;
  }

  scheduleInFlight = true;
  try {
    await reconcileLocalSchedules();
  } catch (error) {
    console.error("Local schedule loop failed", error);
  } finally {
    scheduleInFlight = false;
  }
}

void runHeartbeatLoop();
void runScheduleLoop();
setInterval(() => void runHeartbeatLoop(), heartbeatIntervalMs);
setInterval(() => void runScheduleLoop(), scheduleIntervalMs);

const server = Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json(200, {
          ok: true,
          plane: "local",
          manifestDir: process.env.STARBRIDGE_MANIFEST_DIR ?? defaultManifestDirectory(),
          spacetimeUrl: process.env.SPACETIMEDB_URL ?? "http://127.0.0.1:3000",
          database: process.env.SPACETIMEDB_DATABASE ?? "starbridge-control",
          heartbeatIntervalMs,
          scheduleIntervalMs
        });
      }

      if (request.method === "GET" && url.pathname === "/catalog") {
        return json(200, {
          ok: true,
          plane: "local",
          agents: await loadLocalCatalog()
        });
      }

      if (url.pathname === "/agents/register") {
        if (request.method !== "POST") {
          return methodNotAllowed();
        }

        const payload = await request.json().catch(() => ({}));
        return json(200, {
          ok: true,
          plane: "local",
          result: await registerLocalAgents(payload)
        });
      }

      if (url.pathname === "/jobs/dispatch" || url.pathname === "/agents/local/dispatch") {
        if (request.method !== "POST") {
          return methodNotAllowed();
        }

        const payload = await request.json();
        return json(200, {
          ok: true,
          result: await dispatchLocalJob(payload)
        });
      }

      if (url.pathname === "/schedules/reconcile") {
        if (request.method !== "POST") {
          return methodNotAllowed();
        }

        return json(200, {
          ok: true,
          plane: "local",
          result: await reconcileLocalSchedules()
        });
      }

      return json(404, { ok: false, error: "Route not found" });
    } catch (error) {
      return json(400, {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown local control error"
      });
    }
  }
});

console.log(`Local control plane listening on http://127.0.0.1:${server.port}`);
