/**
 * Tests for apps/web/lib/server.ts
 *
 * Strategy: mock @starbridge/sdk at the module level so every call to
 * `createControlClient()` returns a single shared `mockClient` object.
 * @starbridge/core parse helpers are NOT mocked — we rely on their real
 * behaviour so validation paths stay meaningful.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock client — every method is a vi.fn() stub
// ---------------------------------------------------------------------------

const mockClient = {
  registerAgent: vi.fn(),
  registerSchedule: vi.fn(),
  enqueueJob: vi.fn(),
  ingestMessage: vi.fn(),
  startWorkflowRun: vi.fn(),
  enqueueWorkflowStep: vi.fn(),
  claimWorkflowStep: vi.fn(),
  completeWorkflowStep: vi.fn(),
  upsertPresence: vi.fn(),
  remember: vi.fn(),
  markJobCompleted: vi.fn(),
  listThreads: vi.fn(),
  listWorkflowRuns: vi.fn(),
  listWorkflowSteps: vi.fn(),
  listApprovalRequests: vi.fn(),
  listBrowserTasks: vi.fn(),
  listBrowserArtifacts: vi.fn(),
  listJobs: vi.fn(),
  listMessageEvents: vi.fn(),
  listToolCalls: vi.fn(),
  listRetrievalTraces: vi.fn(),
  listPresence: vi.fn(),
  listSchedules: vi.fn(),
  resolveApproval: vi.fn(),
  claimScheduledRun: vi.fn()
};

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock("@starbridge/sdk", () => ({
  StarbridgeControlClient: vi.fn(() => mockClient)
}));

vi.mock("../cloud-agents", () => ({
  cloudAgentCatalog: [
    {
      id: "saturn",
      name: "Saturn",
      description: "Cloud ops agent",
      system: "Be precise",
      model: "gpt-5.4-mini",
      runtime: "edge-function",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "ops"
      },
      tags: ["ops"],
      tools: {
        allowExec: false,
        allowBrowser: true,
        allowNetwork: true,
        allowMcp: true,
        browser: {
          enabled: true,
          allowedDomains: [],
          blockedDomains: [],
          maxConcurrentSessions: 1,
          allowDownloads: false,
          defaultMode: "extract",
          requiresApprovalFor: ["form", "download"]
        }
      },
      memory: { namespace: "operations", maxNotes: 250, summarizeAfter: 16 },
      workflowTemplates: [
        {
          id: "ops-default",
          description: "Ops workflow",
          stages: ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
        }
      ],
      toolProfiles: [],
      handoffRules: [],
      learningPolicy: {
        enabled: true,
        summarizeEveryRuns: 4,
        embedMemory: true,
        maxRetrievedChunks: 8
      },
      schedules: [
        {
          id: "incident-sweep",
          goal: "Sweep incidents",
          intervalMinutes: 10,
          priority: "high",
          enabled: true,
          requestedBy: "scheduler-cloud"
        }
      ],
      prompts: {
        system: "system/core.md",
        personality: "agents/saturn.md",
        stages: {
          route: "system/autonomy.md",
          summarize: "system/user-experience.md",
          learn: "workflows/autonomous-loop.md"
        }
      }
    }
  ]
}));

vi.mock("../env", () => ({
  requireSpacetimeServerEnv: vi.fn(() => ({
    controlPlaneUrl: "http://localhost:3001",
    spacetimeUrl: "http://127.0.0.1:3000",
    database: "starbridge-control",
    authToken: "test-token"
  }))
}));

// ---------------------------------------------------------------------------
// Helpers — minimal shape factories for client list responses
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<{
  runId: string;
  agentId: string;
  updatedAtMicros: number;
  status: string;
}> = {}) {
  return {
    runId: overrides.runId ?? "run_001",
    agentId: overrides.agentId ?? "saturn",
    status: overrides.status ?? "running",
    updatedAtMicros: overrides.updatedAtMicros ?? 1000
  };
}

function makeStep(overrides: Partial<{
  stepId: string;
  runId: string;
  stage: string;
  status: string;
  updatedAtMicros: number;
  ownerExecution: string;
  inputJson: string;
  dependsOnStepId: string | null;
}> = {}) {
  return {
    stepId: overrides.stepId ?? "step_001",
    runId: overrides.runId ?? "run_001",
    stage: overrides.stage ?? "plan",
    status: overrides.status ?? "failed",
    updatedAtMicros: overrides.updatedAtMicros ?? 2000,
    ownerExecution: overrides.ownerExecution ?? "vercel-edge",
    inputJson: overrides.inputJson ?? '{"goal":"test"}',
    dependsOnStepId: overrides.dependsOnStepId ?? null
  };
}

function makeMessage(overrides: Partial<{
  runId: string;
  metadataJson: string;
}> = {}) {
  return {
    runId: overrides.runId ?? "run_001",
    metadataJson: overrides.metadataJson ?? "{}"
  };
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default no-op resolutions for the workflow seeding calls
  mockClient.enqueueJob.mockResolvedValue(undefined);
  mockClient.ingestMessage.mockResolvedValue(undefined);
  mockClient.startWorkflowRun.mockResolvedValue(undefined);
  mockClient.enqueueWorkflowStep.mockResolvedValue(undefined);
  mockClient.claimWorkflowStep.mockResolvedValue(undefined);
  mockClient.completeWorkflowStep.mockResolvedValue(undefined);
  mockClient.upsertPresence.mockResolvedValue(undefined);
  mockClient.remember.mockResolvedValue(undefined);
  mockClient.markJobCompleted.mockResolvedValue(undefined);
  mockClient.registerAgent.mockResolvedValue(undefined);
  mockClient.registerSchedule.mockResolvedValue(undefined);
  mockClient.resolveApproval.mockResolvedValue({ ok: true });

  // Default empty-list resolutions for read methods
  mockClient.listThreads.mockResolvedValue([]);
  mockClient.listWorkflowRuns.mockResolvedValue([]);
  mockClient.listWorkflowSteps.mockResolvedValue([]);
  mockClient.listApprovalRequests.mockResolvedValue([]);
  mockClient.listBrowserTasks.mockResolvedValue([]);
  mockClient.listBrowserArtifacts.mockResolvedValue([]);
  mockClient.listJobs.mockResolvedValue([]);
  mockClient.listMessageEvents.mockResolvedValue([]);
  mockClient.listToolCalls.mockResolvedValue([]);
  mockClient.listRetrievalTraces.mockResolvedValue([]);
  mockClient.listPresence.mockResolvedValue([]);
  mockClient.listSchedules.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Lazy import — must happen AFTER vi.mock calls are hoisted
// ---------------------------------------------------------------------------

async function importServerFns() {
  const mod = await import("../server");
  return mod;
}

// ---------------------------------------------------------------------------
// 1. createControlClient
// ---------------------------------------------------------------------------

describe("createControlClient", () => {
  it("constructs a StarbridgeControlClient with env values", async () => {
    const { StarbridgeControlClient } = await import("@starbridge/sdk");
    const { createControlClient } = await importServerFns();

    createControlClient();

    expect(StarbridgeControlClient).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:3000",
      database: "starbridge-control",
      authToken: "test-token"
    });
  });

  it("uses an explicit authToken override when provided", async () => {
    const { StarbridgeControlClient } = await import("@starbridge/sdk");
    const { createControlClient } = await importServerFns();

    createControlClient("override-token");

    expect(StarbridgeControlClient).toHaveBeenCalledWith(
      expect.objectContaining({ authToken: "override-token" })
    );
  });

  it("returns the mock client instance", async () => {
    const { createControlClient } = await importServerFns();
    const client = createControlClient();
    expect(client).toBe(mockClient);
  });
});

// ---------------------------------------------------------------------------
// 2. registerAgentFromPayload
// ---------------------------------------------------------------------------

describe("registerAgentFromPayload", () => {
  const validManifestPayload = {
    id: "saturn",
    name: "Saturn",
    description: "Cloud ops agent",
    system: "Be precise",
    model: "gpt-5.4-mini",
    runtime: "edge-function",
    deployment: {
      controlPlane: "cloud",
      execution: "vercel-edge",
      workflow: "ops"
    },
    tags: ["ops"],
    tools: { allowExec: false, allowBrowser: true, allowNetwork: true, allowMcp: true },
    memory: { namespace: "operations", maxNotes: 250, summarizeAfter: 16 },
    schedules: [
      {
        id: "sweep",
        goal: "Sweep",
        intervalMinutes: 10,
        priority: "high",
        enabled: true,
        requestedBy: "scheduler"
      }
    ]
  };

  it("registers the agent and its schedules, returns agentId + schedules count", async () => {
    const { registerAgentFromPayload } = await importServerFns();

    const result = await registerAgentFromPayload(validManifestPayload) as {
      agentId: string;
      schedules: number;
    };

    expect(result.agentId).toBe("saturn");
    expect(result.schedules).toBe(1);
    expect(mockClient.registerAgent).toHaveBeenCalledTimes(1);
    expect(mockClient.registerSchedule).toHaveBeenCalledTimes(1);
  });

  it("registers with an explicit authToken", async () => {
    const { registerAgentFromPayload } = await importServerFns();
    const { StarbridgeControlClient } = await import("@starbridge/sdk");

    await registerAgentFromPayload(validManifestPayload, "my-token");

    expect(StarbridgeControlClient).toHaveBeenCalledWith(
      expect.objectContaining({ authToken: "my-token" })
    );
  });

  it("throws when controlPlane is not cloud", async () => {
    const { registerAgentFromPayload } = await importServerFns();

    await expect(
      registerAgentFromPayload({
        ...validManifestPayload,
        deployment: { controlPlane: "local", execution: "local-runner", workflow: "ops" }
      })
    ).rejects.toThrow("Cloud control plane can only register cloud-plane agents");
  });

  it("throws when payload is not a valid manifest", async () => {
    const { registerAgentFromPayload } = await importServerFns();

    await expect(
      registerAgentFromPayload({ id: "bad", name: "Bad" })
    ).rejects.toThrow();
  });

  it("registers agent with no schedules — registerSchedule is never called", async () => {
    const { registerAgentFromPayload } = await importServerFns();

    const result = await registerAgentFromPayload({
      ...validManifestPayload,
      schedules: []
    }) as { agentId: string; schedules: number };

    expect(result.schedules).toBe(0);
    expect(mockClient.registerSchedule).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. dispatchJobFromPayload
// ---------------------------------------------------------------------------

describe("dispatchJobFromPayload", () => {
  it("dispatches a job for a known cloud agent and returns job + workflow", async () => {
    const { dispatchJobFromPayload } = await importServerFns();

    const result = await dispatchJobFromPayload({
      agentId: "saturn",
      goal: "Deploy the app"
    }) as { job: { agentId: string; goal: string }; workflow: { runId: string } };

    expect(result.job.agentId).toBe("saturn");
    expect(result.job.goal).toBe("Deploy the app");
    expect(mockClient.enqueueJob).toHaveBeenCalledTimes(1);
    expect(mockClient.startWorkflowRun).toHaveBeenCalledTimes(1);
  });

  it("throws for a non-object payload", async () => {
    const { dispatchJobFromPayload } = await importServerFns();

    await expect(dispatchJobFromPayload("bad")).rejects.toThrow("dispatch payload must be an object");
    await expect(dispatchJobFromPayload(null)).rejects.toThrow("dispatch payload must be an object");
  });

  it("throws when agentId is not in the cloud catalog", async () => {
    const { dispatchJobFromPayload } = await importServerFns();

    await expect(
      dispatchJobFromPayload({ agentId: "unknown-agent", goal: "do something" })
    ).rejects.toThrow("Cloud control plane only dispatches registered cloud agents");
  });

  it("syncs the catalog before dispatching — registerAgent is called", async () => {
    const { dispatchJobFromPayload } = await importServerFns();

    await dispatchJobFromPayload({ agentId: "saturn", goal: "test" });

    expect(mockClient.registerAgent).toHaveBeenCalled();
  });

  it("uses requestedBy from payload when provided", async () => {
    const { dispatchJobFromPayload } = await importServerFns();

    const result = await dispatchJobFromPayload({
      agentId: "saturn",
      goal: "Test run",
      requestedBy: "alice"
    }) as { job: { requestedBy: string } };

    expect(result.job.requestedBy).toBe("alice");
  });

  it("defaults requestedBy to 'cloud-control' when omitted", async () => {
    const { dispatchJobFromPayload } = await importServerFns();

    const result = await dispatchJobFromPayload({
      agentId: "saturn",
      goal: "Test run"
    }) as { job: { requestedBy: string } };

    expect(result.job.requestedBy).toBe("cloud-control");
  });
});

// ---------------------------------------------------------------------------
// 4. dispatchEdgeJobFromPayload
// ---------------------------------------------------------------------------

describe("dispatchEdgeJobFromPayload", () => {
  it("throws for a non-object payload", async () => {
    const { dispatchEdgeJobFromPayload } = await importServerFns();

    await expect(dispatchEdgeJobFromPayload(null)).rejects.toThrow("dispatch payload must be an object");
  });

  it("defaults agentId to 'operator' when omitted — throws because operator is not in test catalog", async () => {
    const { dispatchEdgeJobFromPayload } = await importServerFns();

    // Our mock catalog only has 'saturn', so 'operator' lookup fails
    await expect(
      dispatchEdgeJobFromPayload({ goal: "run something" })
    ).rejects.toThrow("Unknown edge agent 'operator'");
  });

  it("throws for an unknown explicit agentId", async () => {
    const { dispatchEdgeJobFromPayload } = await importServerFns();

    await expect(
      dispatchEdgeJobFromPayload({ agentId: "voyager", goal: "explore" })
    ).rejects.toThrow("Unknown edge agent 'voyager'");
  });

  it("dispatches a known edge agent and returns plane + runtime + manifest + job + workflow", async () => {
    const { dispatchEdgeJobFromPayload } = await importServerFns();

    const result = await dispatchEdgeJobFromPayload({
      agentId: "saturn",
      goal: "Check deploys"
    }) as {
      plane: string;
      runtime: string;
      manifest: { id: string };
      job: { agentId: string };
      workflow: { runId: string };
    };

    expect(result.plane).toBe("cloud");
    expect(result.runtime).toBe("edge");
    expect(result.manifest.id).toBe("saturn");
    expect(result.job.agentId).toBe("saturn");
  });

  it("syncs the catalog before dispatching", async () => {
    const { dispatchEdgeJobFromPayload } = await importServerFns();

    await dispatchEdgeJobFromPayload({ agentId: "saturn", goal: "Check deploys" });

    expect(mockClient.registerAgent).toHaveBeenCalled();
  });

  it("enqueues the job on the control client", async () => {
    const { dispatchEdgeJobFromPayload } = await importServerFns();

    await dispatchEdgeJobFromPayload({ agentId: "saturn", goal: "Check deploys" });

    expect(mockClient.enqueueJob).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 5. ingestSlackEvent
// ---------------------------------------------------------------------------

describe("ingestSlackEvent", () => {
  it("throws for a non-object payload", async () => {
    const { ingestSlackEvent } = await importServerFns();

    await expect(ingestSlackEvent("bad")).rejects.toThrow("slack payload must be an object");
    await expect(ingestSlackEvent(null)).rejects.toThrow("slack payload must be an object");
  });

  it("throws when no matching cloud agent is found", async () => {
    const { ingestSlackEvent } = await importServerFns();

    await expect(
      ingestSlackEvent({ agentId: "noexist", text: "hello" })
    ).rejects.toThrow("No matching cloud agent");
  });

  it("routes to 'operator' by default when agentId is omitted — throws in test catalog", async () => {
    const { ingestSlackEvent } = await importServerFns();

    await expect(
      ingestSlackEvent({ text: "hello" })
    ).rejects.toThrow("No matching cloud agent");
  });

  it("ingests a full Slack event and returns ok + workflow", async () => {
    const { ingestSlackEvent } = await importServerFns();

    const result = await ingestSlackEvent({
      agentId: "saturn",
      text: "Deploy main to production",
      user: "alice",
      channel: "C123",
      thread_ts: "1234567890.000"
    }) as { ok: boolean; workflow: { runId: string } };

    expect(result.ok).toBe(true);
    expect(mockClient.enqueueJob).toHaveBeenCalledTimes(1);
  });

  it("extracts goal from text field", async () => {
    const { ingestSlackEvent } = await importServerFns();

    await ingestSlackEvent({
      agentId: "saturn",
      text: "Run a health check",
      user: "bob"
    });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { goal: string };
    expect(jobArg?.goal).toBe("Run a health check");
  });

  it("throws when text is missing because normalizeJobRequest requires a non-empty goal", async () => {
    const { ingestSlackEvent } = await importServerFns();

    // normalizeJobRequest enforces that goal is non-empty; an absent text field
    // resolves to "" which triggers the validation error before enqueueJob is called.
    await expect(ingestSlackEvent({ agentId: "saturn" })).rejects.toThrow("goal is required");
    expect(mockClient.enqueueJob).not.toHaveBeenCalled();
  });

  it("defaults requestedBy to 'slack-user' when user field is absent", async () => {
    const { ingestSlackEvent } = await importServerFns();

    await ingestSlackEvent({ agentId: "saturn", text: "hello" });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { requestedBy: string };
    expect(jobArg?.requestedBy).toBe("slack-user");
  });
});

// ---------------------------------------------------------------------------
// 6. ingestGitHubEvent
// ---------------------------------------------------------------------------

describe("ingestGitHubEvent", () => {
  it("throws for a non-object payload", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await expect(ingestGitHubEvent(null)).rejects.toThrow("github payload must be an object");
  });

  it("throws when no matching cloud agent is found", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await expect(
      ingestGitHubEvent({ agentId: "noexist", action: "opened" })
    ).rejects.toThrow("No matching cloud agent");
  });

  it("ingests a comment event — prefers comment.body as goal", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    const result = await ingestGitHubEvent({
      agentId: "saturn",
      action: "created",
      repository: { full_name: "owner/repo" },
      issue: { number: 42, title: "Fix thing", body: "issue body", user: { login: "dev" } },
      comment: { body: "Please fix this now", user: { login: "alice" } }
    }) as { ok: boolean };

    expect(result.ok).toBe(true);
    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { goal: string; requestedBy: string };
    expect(jobArg?.goal).toBe("Please fix this now");
    expect(jobArg?.requestedBy).toBe("alice");
  });

  it("falls back to issue.body when comment is absent", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await ingestGitHubEvent({
      agentId: "saturn",
      action: "opened",
      issue: { number: 1, title: "Bug title", body: "Bug description", user: { login: "reporter" } }
    });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { goal: string };
    expect(jobArg?.goal).toBe("Bug description");
  });

  it("falls back to issue.title when body is absent", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await ingestGitHubEvent({
      agentId: "saturn",
      action: "opened",
      issue: { number: 1, title: "Important bug", user: { login: "reporter" } }
    });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { goal: string };
    expect(jobArg?.goal).toBe("Important bug");
  });

  it("constructs fallback goal from action + repo when no issue or comment present", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await ingestGitHubEvent({
      agentId: "saturn",
      action: "pushed",
      repository: { full_name: "owner/repo" }
    });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { goal: string };
    expect(jobArg?.goal).toBe("pushed in owner/repo");
  });

  it("defaults actor to 'github-user' when no login is present", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await ingestGitHubEvent({ agentId: "saturn", action: "ping" });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as { requestedBy: string };
    expect(jobArg?.requestedBy).toBe("github-user");
  });

  it("sets issueNumber to 0 when issue is absent", async () => {
    const { ingestGitHubEvent } = await importServerFns();

    await ingestGitHubEvent({ agentId: "saturn", action: "ping" });

    const jobArg = mockClient.enqueueJob.mock.calls[0]?.[0] as {
      context: { issueNumber: number }
    };
    expect(jobArg?.context?.issueNumber).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. loadInbox
// ---------------------------------------------------------------------------

describe("loadInbox", () => {
  it("calls all four list methods and returns their results", async () => {
    const { loadInbox } = await importServerFns();

    const thread1 = { threadId: "t1", updatedAtMicros: 100 };
    const thread2 = { threadId: "t2", updatedAtMicros: 200 };
    mockClient.listThreads.mockResolvedValue([thread1, thread2]);
    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_1", updatedAtMicros: 50 })]);
    mockClient.listApprovalRequests.mockResolvedValue([]);
    mockClient.listBrowserTasks.mockResolvedValue([]);

    const inbox = await loadInbox();

    expect(mockClient.listThreads).toHaveBeenCalledTimes(1);
    expect(mockClient.listWorkflowRuns).toHaveBeenCalledTimes(1);
    expect(mockClient.listApprovalRequests).toHaveBeenCalledTimes(1);
    expect(mockClient.listBrowserTasks).toHaveBeenCalledTimes(1);
    expect(inbox.threads).toHaveLength(2);
    expect(inbox.runs).toHaveLength(1);
  });

  it("sorts threads by updatedAtMicros descending", async () => {
    const { loadInbox } = await importServerFns();

    mockClient.listThreads.mockResolvedValue([
      { threadId: "t1", updatedAtMicros: 100 },
      { threadId: "t2", updatedAtMicros: 300 },
      { threadId: "t3", updatedAtMicros: 200 }
    ]);

    const inbox = await loadInbox();

    expect(inbox.threads.map((t: { threadId: string }) => t.threadId)).toEqual(["t2", "t3", "t1"]);
  });

  it("sorts runs by updatedAtMicros descending", async () => {
    const { loadInbox } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([
      makeRun({ runId: "run_a", updatedAtMicros: 10 }),
      makeRun({ runId: "run_b", updatedAtMicros: 50 }),
      makeRun({ runId: "run_c", updatedAtMicros: 30 })
    ]);

    const inbox = await loadInbox();

    expect(inbox.runs.map((r: { runId: string }) => r.runId)).toEqual(["run_b", "run_c", "run_a"]);
  });

  it("accepts an explicit authToken", async () => {
    const { loadInbox } = await importServerFns();
    const { StarbridgeControlClient } = await import("@starbridge/sdk");

    await loadInbox("inbox-token");

    expect(StarbridgeControlClient).toHaveBeenCalledWith(
      expect.objectContaining({ authToken: "inbox-token" })
    );
  });

  it("returns empty arrays when all list methods return empty", async () => {
    const { loadInbox } = await importServerFns();

    const inbox = await loadInbox();

    expect(inbox.threads).toEqual([]);
    expect(inbox.runs).toEqual([]);
    expect(inbox.approvals).toEqual([]);
    expect(inbox.browserTasks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. loadRunDetails
// ---------------------------------------------------------------------------

describe("loadRunDetails", () => {
  it("throws when the runId is not found", async () => {
    const { loadRunDetails } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_other" })]);

    await expect(loadRunDetails("run_missing")).rejects.toThrow("Unknown workflow run 'run_missing'");
  });

  it("returns run, filtered steps/messages/toolCalls/approvals/browserTasks, and null job when no jobId", async () => {
    const { loadRunDetails } = await importServerFns();
    const targetRun = makeRun({ runId: "run_001" });

    mockClient.listWorkflowRuns.mockResolvedValue([targetRun, makeRun({ runId: "run_002" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({ runId: "run_001", stepId: "step_a" }),
      makeStep({ runId: "run_002", stepId: "step_b" })
    ]);
    mockClient.listMessageEvents.mockResolvedValue([
      makeMessage({ runId: "run_001", metadataJson: "{}" }),
      makeMessage({ runId: "run_002" })
    ]);
    mockClient.listToolCalls.mockResolvedValue([{ runId: "run_001", toolCallId: "tc_1" }]);
    mockClient.listApprovalRequests.mockResolvedValue([{ runId: "run_001", approvalId: "ap_1" }]);
    mockClient.listBrowserTasks.mockResolvedValue([{ runId: "run_002", taskId: "bt_1" }]);
    mockClient.listBrowserArtifacts.mockResolvedValue([{ runId: "run_001", artifactId: "ba_1" }]);

    const details = await loadRunDetails("run_001");

    expect(details.run).toEqual(targetRun);
    expect(details.steps).toHaveLength(1);
    expect(details.steps[0]!.stepId).toBe("step_a");
    expect(details.messages).toHaveLength(1);
    expect(details.toolCalls).toHaveLength(1);
    expect(details.approvals).toHaveLength(1);
    expect(details.browserTasks).toHaveLength(0); // belongs to run_002
    expect(details.job).toBeNull();
  });

  it("extracts jobId from message metadata and resolves the matching job", async () => {
    const { loadRunDetails } = await importServerFns();
    const targetRun = makeRun({ runId: "run_001" });

    mockClient.listWorkflowRuns.mockResolvedValue([targetRun]);
    mockClient.listMessageEvents.mockResolvedValue([
      makeMessage({ runId: "run_001", metadataJson: '{"jobId":"job_abc"}' })
    ]);
    mockClient.listJobs.mockResolvedValue([
      { jobId: "job_abc", agentId: "saturn" },
      { jobId: "job_xyz", agentId: "other" }
    ]);

    const details = await loadRunDetails("run_001");

    expect(details.job).toEqual({ jobId: "job_abc", agentId: "saturn" });
  });

  it("extracts jobId from run_job_ prefix when no metadata present", async () => {
    const { loadRunDetails } = await importServerFns();
    // extractJobIdFromRun does: runId.slice("run_".length) → "job_prefixed"
    // so the runId must be "run_job_prefixed" (prefix "run_" + jobId "job_prefixed")
    const targetRun = makeRun({ runId: "run_job_prefixed" });

    mockClient.listWorkflowRuns.mockResolvedValue([targetRun]);
    mockClient.listJobs.mockResolvedValue([
      { jobId: "job_prefixed", agentId: "saturn" }
    ]);

    const details = await loadRunDetails("run_job_prefixed");

    expect(details.job).toEqual({ jobId: "job_prefixed", agentId: "saturn" });
  });

  it("returns null job when metadata has non-string jobId", async () => {
    const { loadRunDetails } = await importServerFns();
    const targetRun = makeRun({ runId: "run_001" });

    mockClient.listWorkflowRuns.mockResolvedValue([targetRun]);
    mockClient.listMessageEvents.mockResolvedValue([
      makeMessage({ runId: "run_001", metadataJson: '{"jobId":42}' })
    ]);
    mockClient.listJobs.mockResolvedValue([]);

    const details = await loadRunDetails("run_001");

    // jobId 42 is not a string, so it should not match and job falls back to null
    expect(details.job).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. resolveApprovalFromPayload
// ---------------------------------------------------------------------------

describe("resolveApprovalFromPayload", () => {
  it("throws for a non-object payload", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();

    await expect(
      resolveApprovalFromPayload("approval_1", "bad")
    ).rejects.toThrow("approval payload must be an object");

    await expect(
      resolveApprovalFromPayload("approval_1", null)
    ).rejects.toThrow("approval payload must be an object");
  });

  it("throws when status is missing from payload", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();

    await expect(
      resolveApprovalFromPayload("approval_1", { resolvedBy: "operator" })
    ).rejects.toThrow("approval status is required");
  });

  it("delegates to client.resolveApproval with approved status", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();

    await resolveApprovalFromPayload("approval_1", {
      status: "approved",
      resolvedBy: "alice",
      note: "Looks good"
    });

    expect(mockClient.resolveApproval).toHaveBeenCalledWith(
      "approval_1",
      "approved",
      { resolvedBy: "alice", note: "Looks good" }
    );
  });

  it("delegates to client.resolveApproval with rejected status", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();

    await resolveApprovalFromPayload("approval_1", {
      status: "rejected",
      resolvedBy: "bob"
    });

    expect(mockClient.resolveApproval).toHaveBeenCalledWith(
      "approval_1",
      "rejected",
      { resolvedBy: "bob", note: "" }
    );
  });

  it("defaults resolvedBy to 'operator' and note to empty string", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();

    await resolveApprovalFromPayload("approval_1", { status: "approved" });

    expect(mockClient.resolveApproval).toHaveBeenCalledWith(
      "approval_1",
      "approved",
      { resolvedBy: "operator", note: "" }
    );
  });

  it("accepts an explicit authToken", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();
    const { StarbridgeControlClient } = await import("@starbridge/sdk");

    await resolveApprovalFromPayload("approval_1", { status: "approved" }, "mytoken");

    expect(StarbridgeControlClient).toHaveBeenCalledWith(
      expect.objectContaining({ authToken: "mytoken" })
    );
  });

  it("returns whatever client.resolveApproval returns", async () => {
    const { resolveApprovalFromPayload } = await importServerFns();

    mockClient.resolveApproval.mockResolvedValue({ resolved: true, approvalId: "approval_1" });

    const result = await resolveApprovalFromPayload("approval_1", { status: "approved" });

    expect(result).toEqual({ resolved: true, approvalId: "approval_1" });
  });
});

// ---------------------------------------------------------------------------
// 10. retryWorkflowRun
// ---------------------------------------------------------------------------

describe("retryWorkflowRun", () => {
  it("throws when the runId is not found", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_other" })]);

    await expect(retryWorkflowRun("run_missing")).rejects.toThrow(
      "Unknown workflow run 'run_missing'"
    );
  });

  it("throws when the run has no steps", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([]);

    await expect(retryWorkflowRun("run_001")).rejects.toThrow("has no steps to retry");
  });

  it("prefers the most recent failed step over others", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({ runId: "run_001", stepId: "step_old", status: "failed", updatedAtMicros: 100 }),
      makeStep({ runId: "run_001", stepId: "step_new", status: "failed", updatedAtMicros: 500 }),
      makeStep({ runId: "run_001", stepId: "step_completed", status: "completed", updatedAtMicros: 800 })
    ]);

    const result = await retryWorkflowRun("run_001") as {
      ok: boolean;
      retryStepId: string;
      stage: string;
    };

    expect(result.ok).toBe(true);
    // The new retry step ID should incorporate the failed step's ID
    expect(result.retryStepId).toMatch(/^step_new_retry_/);
  });

  it("retries a blocked step as well as a failed step", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({ runId: "run_001", stepId: "step_blocked", status: "blocked", updatedAtMicros: 200 })
    ]);

    const result = await retryWorkflowRun("run_001") as { retryStepId: string };

    expect(result.retryStepId).toMatch(/^step_blocked_retry_/);
  });

  it("falls back to the most recent step when no failed/blocked steps exist", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({ runId: "run_001", stepId: "step_a", status: "completed", updatedAtMicros: 100 }),
      makeStep({ runId: "run_001", stepId: "step_b", status: "completed", updatedAtMicros: 500 })
    ]);

    const result = await retryWorkflowRun("run_001") as { retryStepId: string };

    // Most recent completed step is step_b
    expect(result.retryStepId).toMatch(/^step_b_retry_/);
  });

  it("enqueues a new workflow step with the retry ID", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001", agentId: "saturn" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({
        runId: "run_001",
        stepId: "step_x",
        status: "failed",
        stage: "plan",
        inputJson: '{"goal":"repair"}'
      })
    ]);

    await retryWorkflowRun("run_001");

    expect(mockClient.enqueueWorkflowStep).toHaveBeenCalledTimes(1);
    const stepArg = mockClient.enqueueWorkflowStep.mock.calls[0]?.[0] as {
      runId: string;
      agentId: string;
      stage: string;
      input: { goal: string };
    };
    expect(stepArg.runId).toBe("run_001");
    expect(stepArg.agentId).toBe("saturn");
    expect(stepArg.stage).toBe("plan");
    expect(stepArg.input).toEqual({ goal: "repair" });
  });

  it("ignores steps that belong to other runs", async () => {
    const { retryWorkflowRun } = await importServerFns();

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({ runId: "run_002", stepId: "step_other", status: "failed" }),
      makeStep({ runId: "run_001", stepId: "step_mine", status: "failed", updatedAtMicros: 300 })
    ]);

    const result = await retryWorkflowRun("run_001") as { retryStepId: string };

    expect(result.retryStepId).toMatch(/^step_mine_retry_/);
  });

  it("accepts an explicit authToken", async () => {
    const { retryWorkflowRun } = await importServerFns();
    const { StarbridgeControlClient } = await import("@starbridge/sdk");

    mockClient.listWorkflowRuns.mockResolvedValue([makeRun({ runId: "run_001" })]);
    mockClient.listWorkflowSteps.mockResolvedValue([
      makeStep({ runId: "run_001", stepId: "s1", status: "failed" })
    ]);

    await retryWorkflowRun("run_001", "retry-token");

    expect(StarbridgeControlClient).toHaveBeenCalledWith(
      expect.objectContaining({ authToken: "retry-token" })
    );
  });
});
