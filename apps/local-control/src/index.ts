import { spawn } from "node:child_process";
import path from "node:path";

import {
  filterAgentsByControlPlane,
  isScheduleDue,
  loadAgentManifestDirectory,
  normalizeJobRequest,
  schedulesForManifest,
  type AgentManifest,
  type JobRequest,
  type RegisteredScheduleRecord
} from "@starbridge/core";
import { StarbridgeControlClient } from "@starbridge/sdk";

const port = Number(process.env.PORT ?? "3010");
const heartbeatIntervalMs = Number(process.env.STARBRIDGE_HEARTBEAT_INTERVAL_MS ?? "30000");
const scheduleIntervalMs = Number(process.env.STARBRIDGE_SCHEDULE_INTERVAL_MS ?? "30000");
const presenceTtlMs = Number(process.env.STARBRIDGE_PRESENCE_TTL_MS ?? "90000");

interface LocalRunnerEnvelope {
  manifest: AgentManifest;
  job: {
    job_id: string;
    goal: string;
  };
  prompt: string;
  result: {
    summary: string;
    actions: string[];
    memory_note: string;
  };
}

interface ScheduledRunResult {
  scheduleId: string;
  agentId: string;
  jobId?: string;
  status: "dispatched" | "skipped" | "failed";
  reason?: string;
}

function defaultManifestDirectory(): string {
  return path.resolve(process.cwd(), "../../examples/agents");
}

function projectRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

function createControlClient(): StarbridgeControlClient {
  return new StarbridgeControlClient({
    baseUrl: process.env.SPACETIMEDB_URL ?? "http://127.0.0.1:3000",
    database: process.env.SPACETIMEDB_DATABASE ?? "starbridge-control",
    authToken: process.env.SPACETIMEDB_AUTH_TOKEN
  });
}

function runnerIdFor(agentId: string, role: "control" | "scheduler" | "runner"): string {
  return `${agentId}-${role}@local:${port}`;
}

async function loadLocalCatalog(): Promise<AgentManifest[]> {
  const manifests = await loadAgentManifestDirectory(
    process.env.STARBRIDGE_MANIFEST_DIR ?? defaultManifestDirectory()
  );
  return filterAgentsByControlPlane(manifests, "local");
}

async function syncLocalCatalog(catalog: AgentManifest[]): Promise<{ agents: number; schedules: number }> {
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

async function heartbeatLocalPresence(catalog: AgentManifest[]): Promise<void> {
  const client = createControlClient();

  for (const manifest of catalog) {
    await client.upsertPresence(
      manifest.id,
      runnerIdFor(manifest.id, "control"),
      "local",
      "alive"
    );
    await client.upsertPresence(
      manifest.id,
      runnerIdFor(manifest.id, "scheduler"),
      "local",
      "alive"
    );
  }
}

async function executeLocalRunner(
  manifest: AgentManifest,
  normalized: ReturnType<typeof normalizeJobRequest>
): Promise<LocalRunnerEnvelope> {
  const runnerBinary = process.env.STARBRIDGE_RUNNER_BIN;
  const manifestPath = path.resolve(
    process.env.STARBRIDGE_MANIFEST_DIR ?? defaultManifestDirectory(),
    `${manifest.id}.agent.json`
  );
  const command = runnerBinary ?? "cargo";
  const args = runnerBinary
    ? [
        "run-once",
        "--agent-file",
        manifestPath,
        "--goal",
        normalized.goal,
        "--job-id",
        normalized.jobId,
        "--priority",
        normalized.priority,
        "--requested-by",
        normalized.requestedBy,
        "--created-at",
        normalized.createdAt
      ]
    : [
        "run",
        "-p",
        "starbridge-runner",
        "--",
        "run-once",
        "--agent-file",
        manifestPath,
        "--goal",
        normalized.goal,
        "--job-id",
        normalized.jobId,
        "--priority",
        normalized.priority,
        "--requested-by",
        normalized.requestedBy,
        "--created-at",
        normalized.createdAt
      ];

  return new Promise<LocalRunnerEnvelope>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot(),
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Local runner exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as LocalRunnerEnvelope);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse local runner output: ${
              error instanceof Error ? error.message : "unknown error"
            }`
          )
        );
      }
    });
  });
}

async function executeQueuedLocalJob(
  manifest: AgentManifest,
  normalized: ReturnType<typeof normalizeJobRequest>
): Promise<LocalRunnerEnvelope> {
  const client = createControlClient();
  const runnerId = runnerIdFor(manifest.id, "runner");

  await client.upsertPresence(manifest.id, runnerId, "local", "running");
  await client.markJobStarted(normalized.jobId, runnerId);

  try {
    const execution = await executeLocalRunner(manifest, normalized);
    await client.remember(
      manifest.id,
      manifest.memory.namespace,
      execution.result.memory_note
    );
    await client.markJobCompleted(normalized.jobId, execution.result.summary);
    await client.upsertPresence(manifest.id, runnerId, "local", "idle");
    return execution;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown local execution error";
    await client.markJobFailed(normalized.jobId, message);
    await client.upsertPresence(manifest.id, runnerId, "local", "failed");
    throw error;
  }
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
  const agentId = body.agentId ?? "";
  const manifest = catalog.find((candidate) => candidate.id === agentId);

  if (!manifest) {
    throw new Error(`Local agent '${agentId}' is not registered in the local control plane`);
  }

  const request: JobRequest = {
    agentId: manifest.id,
    goal: body.goal ?? ""
  };

  if (body.priority !== undefined) {
    request.priority = body.priority;
  }

  request.requestedBy = body.requestedBy ?? "local-control";
  request.context = {
    ...(body.context ?? {}),
    controlPlane: manifest.deployment.controlPlane,
    execution: manifest.deployment.execution,
    workflow: manifest.deployment.workflow
  };

  const normalized = normalizeJobRequest(request);
  const client = createControlClient();
  await client.enqueueJob(normalized);
  const execution = await executeQueuedLocalJob(manifest, normalized);

  return {
    plane: "local",
    manifest,
    job: normalized,
    execution
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
        status: "skipped",
        reason: "Local manifest no longer exists"
      });
      continue;
    }

    const job = normalizeScheduledLocalJob(manifest, schedule);

    try {
      await client.claimScheduledRun(
        schedule.scheduleId,
        "local",
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
      const execution = await executeQueuedLocalJob(manifest, job);
      runs.push({
        scheduleId: schedule.scheduleId,
        agentId: schedule.agentId,
        jobId: job.jobId,
        status: "dispatched",
        reason: execution.result.summary
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
