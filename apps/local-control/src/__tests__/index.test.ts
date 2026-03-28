import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all imports from index.ts
// ---------------------------------------------------------------------------

vi.mock("@starbridge/sdk", () => ({
  StarbridgeControlClient: vi.fn()
}));

vi.mock("@starbridge/core/fs", () => ({
  loadAgentManifestDirectory: vi.fn()
}));

// ---------------------------------------------------------------------------
// Deferred imports (after vi.mock calls)
// ---------------------------------------------------------------------------

import { StarbridgeControlClient } from "@starbridge/sdk";
import { loadAgentManifestDirectory } from "@starbridge/core/fs";
import type { AgentManifest } from "@starbridge/core";

import {
  runnerIdFor,
  defaultManifestDirectory,
  normalizeScheduledLocalJob,
  json,
  methodNotAllowed,
  registerLocalAgents,
  dispatchLocalJob,
  reconcileLocalSchedules,
  handleRequest
} from "../index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeManifest(overrides?: Partial<AgentManifest>): AgentManifest {
  return {
    id: "test-agent",
    name: "Test Agent",
    description: "Agent for tests",
    system: "Be precise",
    model: "gpt-5.4",
    runtime: "rust-core",
    deployment: {
      controlPlane: "local",
      execution: "local-runner",
      workflow: "default"
    },
    tags: ["test"],
    tools: {
      allowExec: false,
      allowBrowser: false,
      allowNetwork: true,
      allowMcp: true,
      browser: {
        enabled: false,
        allowedDomains: [],
        blockedDomains: [],
        maxConcurrentSessions: 1,
        allowDownloads: false,
        defaultMode: "read",
        requiresApprovalFor: []
      }
    },
    memory: { namespace: "test", maxNotes: 100, summarizeAfter: 10 },
    schedules: [],
    workflowTemplates: [
      {
        id: "default",
        description: "Default workflow",
        stages: ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
      }
    ],
    toolProfiles: [],
    handoffRules: [],
    learningPolicy: {
      enabled: false,
      summarizeEveryRuns: 5,
      embedMemory: false,
      maxRetrievedChunks: 4
    },
    ...overrides
  };
}

function makeScheduleRecord(overrides?: object) {
  return {
    scheduleId: "test-agent_daily",
    agentId: "test-agent",
    controlPlane: "local" as const,
    goal: "Run daily check",
    intervalMinutes: 1440,
    priority: "normal" as const,
    enabled: true,
    requestedBy: "scheduler",
    status: "ready" as const,
    nextRunAtMicros: Date.now() * 1_000,
    lastRunAtMicros: null,
    lastJobId: null,
    ...overrides
  };
}

/** Build a mock StarbridgeControlClient with all methods as no-op spies. */
function makeMockClient() {
  return {
    registerAgent: vi.fn().mockResolvedValue(undefined),
    registerSchedule: vi.fn().mockResolvedValue(undefined),
    listPresence: vi.fn().mockResolvedValue([]),
    upsertPresence: vi.fn().mockResolvedValue(undefined),
    ingestMessage: vi.fn().mockResolvedValue(undefined),
    startWorkflowRun: vi.fn().mockResolvedValue(undefined),
    enqueueWorkflowStep: vi.fn().mockResolvedValue(undefined),
    claimWorkflowStep: vi.fn().mockResolvedValue(undefined),
    completeWorkflowStep: vi.fn().mockResolvedValue(undefined),
    enqueueJob: vi.fn().mockResolvedValue(undefined),
    claimScheduledRun: vi.fn().mockResolvedValue(undefined),
    listSchedules: vi.fn().mockResolvedValue([]),
    remember: vi.fn().mockResolvedValue(undefined),
    markJobCompleted: vi.fn().mockResolvedValue(undefined)
  };
}

// Reset all mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.PORT;
  delete process.env.SPACETIMEDB_URL;
  delete process.env.SPACETIMEDB_DATABASE;
  delete process.env.SPACETIMEDB_AUTH_TOKEN;
  delete process.env.STARBRIDGE_MANIFEST_DIR;
});

// ---------------------------------------------------------------------------
// runnerIdFor
// ---------------------------------------------------------------------------

describe("runnerIdFor", () => {
  it("returns agentId-role@local:<port> for the control role", () => {
    const id = runnerIdFor("my-agent", "control");
    expect(id).toMatch(/^my-agent-control@local:\d+$/);
  });

  it("returns agentId-role@local:<port> for the scheduler role", () => {
    const id = runnerIdFor("my-agent", "scheduler");
    expect(id).toMatch(/^my-agent-scheduler@local:\d+$/);
  });

  it("returns agentId-role@local:<port> for the route role", () => {
    const id = runnerIdFor("saturn", "route");
    expect(id).toMatch(/^saturn-route@local:\d+$/);
  });

  it("embeds the same port for all roles of the same agent", () => {
    const control = runnerIdFor("a", "control");
    const scheduler = runnerIdFor("a", "scheduler");
    const portControl = control.split(":")[1];
    const portScheduler = scheduler.split(":")[1];
    expect(portControl).toBe(portScheduler);
  });
});

// ---------------------------------------------------------------------------
// defaultManifestDirectory
// ---------------------------------------------------------------------------

describe("defaultManifestDirectory", () => {
  it("returns an absolute path ending in examples/agents", () => {
    const dir = defaultManifestDirectory();
    expect(dir).toMatch(/examples[\\/]agents$/);
  });

  it("returns a string", () => {
    expect(typeof defaultManifestDirectory()).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// json helper
// ---------------------------------------------------------------------------

describe("json", () => {
  it("returns a Response with the given status", async () => {
    const res = json(200, { ok: true });
    expect(res.status).toBe(200);
  });

  it("serialises the body as JSON", async () => {
    const res = json(200, { hello: "world" });
    const body = await res.json();
    expect(body).toEqual({ hello: "world" });
  });

  it("sets Content-Type to application/json", () => {
    const res = json(200, {});
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("preserves the status code for 4xx errors", async () => {
    const res = json(404, { ok: false, error: "Not found" });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// methodNotAllowed
// ---------------------------------------------------------------------------

describe("methodNotAllowed", () => {
  it("returns status 405", () => {
    expect(methodNotAllowed().status).toBe(405);
  });

  it("returns ok:false in body", async () => {
    const body = await methodNotAllowed().json();
    expect(body.ok).toBe(false);
  });

  it("returns an error message in body", async () => {
    const body = await methodNotAllowed().json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeScheduledLocalJob
// ---------------------------------------------------------------------------

describe("normalizeScheduledLocalJob", () => {
  it("produces a job with the manifest's agentId", () => {
    const manifest = makeManifest();
    const schedule = makeScheduleRecord();
    const job = normalizeScheduledLocalJob(manifest, schedule);
    expect(job.agentId).toBe("test-agent");
  });

  it("carries the schedule goal into the job", () => {
    const manifest = makeManifest();
    const schedule = makeScheduleRecord({ goal: "Sweep incidents" });
    const job = normalizeScheduledLocalJob(manifest, schedule);
    expect(job.goal).toBe("Sweep incidents");
  });

  it("marks the job context as scheduled", () => {
    const manifest = makeManifest();
    const schedule = makeScheduleRecord();
    const job = normalizeScheduledLocalJob(manifest, schedule);
    expect((job.context as Record<string, unknown>).scheduled).toBe(true);
  });

  it("embeds the scheduleId into context", () => {
    const manifest = makeManifest();
    const schedule = makeScheduleRecord({ scheduleId: "test-agent_daily" });
    const job = normalizeScheduledLocalJob(manifest, schedule);
    expect((job.context as Record<string, unknown>).scheduleId).toBe("test-agent_daily");
  });

  it("embeds controlPlane into job context", () => {
    const manifest = makeManifest();
    const schedule = makeScheduleRecord();
    const job = normalizeScheduledLocalJob(manifest, schedule);
    expect((job.context as Record<string, unknown>).controlPlane).toBe("local");
  });

  it("generates a jobId string", () => {
    const manifest = makeManifest();
    const schedule = makeScheduleRecord();
    const job = normalizeScheduledLocalJob(manifest, schedule);
    expect(typeof job.jobId).toBe("string");
    expect(job.jobId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// registerLocalAgents
// ---------------------------------------------------------------------------

describe("registerLocalAgents", () => {
  it("registers all agents when payload is empty", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await registerLocalAgents({}) as { agents: number; schedules: number };
    expect(result.agents).toBe(1);
  });

  it("registers all agents when all:true", async () => {
    const m1 = makeManifest({ id: "agent-a" });
    const m2 = makeManifest({ id: "agent-b" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([m1, m2]);

    const result = await registerLocalAgents({ all: true }) as { agents: number };
    expect(result.agents).toBe(2);
  });

  it("registers only matching agent when agentId is specified", async () => {
    const m1 = makeManifest({ id: "agent-a" });
    const m2 = makeManifest({ id: "agent-b" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([m1, m2]);

    const result = await registerLocalAgents({ agentId: "agent-a" }) as { agents: number };
    expect(result.agents).toBe(1);
  });

  it("throws when agentId does not match any local agent", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    await expect(registerLocalAgents({ agentId: "nonexistent" })).rejects.toThrow(
      "No matching local agents found"
    );
  });

  it("counts schedules in the result", async () => {
    const manifest = makeManifest({
      id: "agent-a",
      schedules: [
        { id: "sweep", goal: "Sweep", intervalMinutes: 60, priority: "normal", enabled: true, requestedBy: "scheduler" }
      ]
    });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await registerLocalAgents({}) as { schedules: number };
    expect(result.schedules).toBe(1);
  });

  it("calls registerAgent on the control client for each manifest", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    await registerLocalAgents({});
    expect(mockClient.registerAgent).toHaveBeenCalledWith(manifest);
  });
});

// ---------------------------------------------------------------------------
// dispatchLocalJob
// ---------------------------------------------------------------------------

describe("dispatchLocalJob", () => {
  it("throws when payload is null", async () => {
    await expect(dispatchLocalJob(null)).rejects.toThrow("dispatch payload must be an object");
  });

  it("throws when payload is a primitive string", async () => {
    await expect(dispatchLocalJob("bad")).rejects.toThrow("dispatch payload must be an object");
  });

  it("throws when agentId does not match any local agent", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    await expect(dispatchLocalJob({ agentId: "nonexistent", goal: "do thing" })).rejects.toThrow(
      "Local control plane only dispatches registered local agents"
    );
  });

  it("returns plane, manifest, job and workflow on success", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await dispatchLocalJob({ agentId: "agent-a", goal: "do thing" }) as Record<string, unknown>;
    expect(result.plane).toBe("local");
    expect(result.manifest).toEqual(manifest);
    expect(result.job).toBeDefined();
    expect(result.workflow).toBeDefined();
  });

  it("uses 'local-control' as default requestedBy", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await dispatchLocalJob({ agentId: "agent-a", goal: "task" }) as { job: { requestedBy: string } };
    expect(result.job.requestedBy).toBe("local-control");
  });

  it("passes custom requestedBy when provided", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await dispatchLocalJob({ agentId: "agent-a", goal: "task", requestedBy: "user_1" }) as { job: { requestedBy: string } };
    expect(result.job.requestedBy).toBe("user_1");
  });

  it("enqueues a job via the control client", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    await dispatchLocalJob({ agentId: "agent-a", goal: "task" });
    expect(mockClient.enqueueJob).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// reconcileLocalSchedules
// ---------------------------------------------------------------------------

describe("reconcileLocalSchedules", () => {
  it("returns staleRunners array and runs array", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await reconcileLocalSchedules();
    expect(Array.isArray(result.staleRunners)).toBe(true);
    expect(Array.isArray(result.runs)).toBe(true);
  });

  it("returns empty runs when no schedules are due", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    mockClient.listSchedules.mockResolvedValue([]);
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await reconcileLocalSchedules();
    expect(result.runs).toHaveLength(0);
  });

  it("marks a run as skipped when the manifest no longer exists for that schedule", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    mockClient.listSchedules.mockResolvedValue([
      {
        scheduleId: "ghost-agent_sweep",
        agentId: "ghost-agent",
        controlPlane: "local",
        goal: "Sweep",
        intervalMinutes: 10,
        priority: "normal",
        enabled: true,
        requestedBy: "scheduler",
        status: "ready",
        // next run is in the past to be "due"
        nextRunAtMicros: (Date.now() - 60_000) * 1_000,
        lastRunAtMicros: null,
        lastJobId: null
      }
    ]);
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await reconcileLocalSchedules();
    const skipped = result.runs.find((r) => r.scheduleId === "ghost-agent_sweep");
    expect(skipped?.status).toBe("skipped");
    expect(skipped?.reason).toContain("no longer exists");
  });

  it("marks a run as skipped when claimScheduledRun throws", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    mockClient.listSchedules.mockResolvedValue([
      {
        scheduleId: "agent-a_sweep",
        agentId: "agent-a",
        controlPlane: "local",
        goal: "Sweep",
        intervalMinutes: 10,
        priority: "normal",
        enabled: true,
        requestedBy: "scheduler",
        status: "ready",
        nextRunAtMicros: (Date.now() - 60_000) * 1_000,
        lastRunAtMicros: null,
        lastJobId: null
      }
    ]);
    mockClient.claimScheduledRun.mockRejectedValue(new Error("Already claimed"));
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await reconcileLocalSchedules();
    const run = result.runs.find((r) => r.scheduleId === "agent-a_sweep");
    expect(run?.status).toBe("skipped");
    expect(run?.reason).toBe("Already claimed");
  });

  it("marks a runner stale when presence TTL has elapsed", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    mockClient.listSchedules.mockResolvedValue([]);
    // Presence record that is older than the default 90s TTL
    mockClient.listPresence.mockResolvedValue([
      {
        agentId: "agent-a",
        runnerId: "agent-a-control@local:3010",
        controlPlane: "local",
        status: "alive",
        lastSeenAtMicros: (Date.now() - 200_000) * 1_000
      }
    ]);
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const result = await reconcileLocalSchedules();
    expect(result.staleRunners).toContain("agent-a-control@local:3010");
  });
});

// ---------------------------------------------------------------------------
// HTTP router — handleRequest
// ---------------------------------------------------------------------------

describe("GET /health", () => {
  it("returns 200 with ok:true", async () => {
    const res = await handleRequest(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns the local control plane target", async () => {
    const res = await handleRequest(new Request("http://localhost/health"));
    const body = await res.json();
    expect(body.plane).toBe("local");
  });

  it("includes spacetimeUrl, database, heartbeatIntervalMs, scheduleIntervalMs", async () => {
    const res = await handleRequest(new Request("http://localhost/health"));
    const body = await res.json();
    expect(body.spacetimeUrl).toBeDefined();
    expect(body.database).toBeDefined();
    expect(typeof body.heartbeatIntervalMs).toBe("number");
    expect(typeof body.scheduleIntervalMs).toBe("number");
  });

  it("returns the SPACETIMEDB_URL env var when set", async () => {
    process.env.SPACETIMEDB_URL = "http://custom-stdb:4000";
    const res = await handleRequest(new Request("http://localhost/health"));
    const body = await res.json();
    expect(body.spacetimeUrl).toBe("http://custom-stdb:4000");
    delete process.env.SPACETIMEDB_URL;
  });

  it("returns 404 for POST /health (route only matches GET)", async () => {
    const res = await handleRequest(
      new Request("http://localhost/health", { method: "POST" })
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /catalog", () => {
  it("returns 200 with ok:true and agents array on success", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(new Request("http://localhost/catalog"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.agents)).toBe(true);
  });

  it("returns the local plane in the response", async () => {
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([]);

    const res = await handleRequest(new Request("http://localhost/catalog"));
    const body = await res.json();
    expect(body.plane).toBe("local");
  });

  it("returns 404 for POST /catalog (route only matches GET)", async () => {
    const res = await handleRequest(
      new Request("http://localhost/catalog", { method: "POST" })
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /agents/register", () => {
  it("returns 200 with ok:true on success", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 405 for GET /agents/register", async () => {
    const res = await handleRequest(new Request("http://localhost/agents/register"));
    expect(res.status).toBe(405);
  });

  it("returns 400 with error when agentId does not match", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "nonexistent" })
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("No matching local agents found");
  });

  it("handles malformed JSON body gracefully (falls back to empty object)", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/agents/register", {
        method: "POST",
        body: "not-json"
      })
    );
    // Falls back to {} payload → registers all → should succeed
    expect(res.status).toBe(200);
  });
});

describe("POST /jobs/dispatch", () => {
  it("returns 200 with ok:true on successful dispatch", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent-a", goal: "do work" })
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 405 for GET /jobs/dispatch", async () => {
    const res = await handleRequest(new Request("http://localhost/jobs/dispatch"));
    expect(res.status).toBe(405);
  });

  it("returns 400 when agentId is unknown", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "ghost", goal: "task" })
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("registered local agents");
  });

  it("returns 400 when payload is not valid JSON", async () => {
    const res = await handleRequest(
      new Request("http://localhost/jobs/dispatch", {
        method: "POST",
        body: "not json"
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /agents/local/dispatch (alias route)", () => {
  it("returns 200 on the /agents/local/dispatch alias", async () => {
    const manifest = makeManifest({ id: "agent-a" });
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/agents/local/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "agent-a", goal: "do work" })
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 405 for GET /agents/local/dispatch", async () => {
    const res = await handleRequest(new Request("http://localhost/agents/local/dispatch"));
    expect(res.status).toBe(405);
  });
});

describe("POST /schedules/reconcile", () => {
  it("returns 200 with ok:true on success", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/schedules/reconcile", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns the local plane in the response", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/schedules/reconcile", { method: "POST" })
    );
    const body = await res.json();
    expect(body.plane).toBe("local");
  });

  it("returns result with staleRunners and runs", async () => {
    const manifest = makeManifest();
    const mockClient = makeMockClient();
    vi.mocked(StarbridgeControlClient).mockImplementation(() => mockClient as never);
    vi.mocked(loadAgentManifestDirectory).mockResolvedValue([manifest]);

    const res = await handleRequest(
      new Request("http://localhost/schedules/reconcile", { method: "POST" })
    );
    const body = await res.json();
    expect(Array.isArray(body.result.staleRunners)).toBe(true);
    expect(Array.isArray(body.result.runs)).toBe(true);
  });

  it("returns 405 for GET /schedules/reconcile", async () => {
    const res = await handleRequest(new Request("http://localhost/schedules/reconcile"));
    expect(res.status).toBe(405);
  });
});

describe("404 for unknown routes", () => {
  it("returns 404 for GET /unknown", async () => {
    const res = await handleRequest(new Request("http://localhost/unknown"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Route not found");
  });

  it("returns 404 for POST /unknown", async () => {
    const res = await handleRequest(
      new Request("http://localhost/unknown-path", {
        method: "POST",
        body: "{}"
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for /", async () => {
    const res = await handleRequest(new Request("http://localhost/"));
    expect(res.status).toBe(404);
  });
});
