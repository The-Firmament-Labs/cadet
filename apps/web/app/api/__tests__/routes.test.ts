import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — hoisted before all route imports
// ---------------------------------------------------------------------------

vi.mock("../../../lib/auth", () => ({
  requireOperatorApiSession: vi.fn(),
}));

vi.mock("../../../lib/server", () => ({
  createControlClient: vi.fn(),
  loadInbox: vi.fn(),
  dispatchJobFromPayload: vi.fn(),
  dispatchEdgeJobFromPayload: vi.fn(),
  registerAgentFromPayload: vi.fn(),
  reconcileCloudControlPlane: vi.fn(),
}));

vi.mock("../../../lib/env", () => ({
  getSafeServerEnv: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("../../../lib/cloud-agents", () => ({
  cloudAgentCatalog: [
    {
      id: "saturn",
      name: "Saturn",
      description: "Test agent",
      model: "gpt-5.4-mini",
      runtime: "edge-function",
      deployment: { controlPlane: "cloud", execution: "vercel-edge", workflow: "ops" },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Deferred imports (after vi.mock calls)
// ---------------------------------------------------------------------------

import { requireOperatorApiSession } from "../../../lib/auth";
import {
  createControlClient,
  loadInbox,
  dispatchJobFromPayload,
  dispatchEdgeJobFromPayload,
  registerAgentFromPayload,
  reconcileCloudControlPlane,
} from "../../../lib/server";
import { getSafeServerEnv, getServerEnv } from "../../../lib/env";

import { GET as healthGET } from "../health/route";
import { GET as catalogGET } from "../catalog/route";
import { GET as inboxGET } from "../inbox/route";
import { POST as jobsDispatchPOST } from "../jobs/dispatch/route";
import { POST as edgeDispatchPOST } from "../agents/edge/dispatch/route";
import { POST as registerPOST } from "../agents/register/route";
import { GET as cronReconcileGET } from "../cron/reconcile/route";
import { GET as streamGET } from "../stream/route";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Fresh 401 unauthorized return value — re-created each call to avoid body re-use. */
function mockUnauth() {
  return {
    unauthorized: Response.json(
      { ok: false, error: "Authentication required" },
      { status: 401 }
    ),
    authToken: undefined as string | undefined,
  };
}

function mockSession(authToken = "test-token") {
  return { unauthorized: null as Response | null, authToken };
}

const DEFAULT_SAFE_ENV = {
  controlPlaneUrl: "http://localhost:3001",
  spacetimeUrl: "http://localhost:3000",
  database: "test-db",
  hasAuthToken: false,
  hasCronSecret: false,
  hasSpacetimeConfig: false,
  hasOperatorAuth: false,
};

const DEFAULT_SERVER_ENV = {
  controlPlaneUrl: "http://localhost:3001",
  spacetimeUrl: "http://localhost:3000",
  database: "test-db",
  authToken: undefined as string | undefined,
  cronSecret: "super-secret-cron",
};

// Reset all mock state between every test
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSafeServerEnv).mockReturnValue(DEFAULT_SAFE_ENV);
  vi.mocked(getServerEnv).mockReturnValue(DEFAULT_SERVER_ENV);
});

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  it("returns ok:true with plane and environment on success", async () => {
    const mockSchema = { tables: [] };
    const mockClient = { schema: vi.fn().mockResolvedValue(mockSchema) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await healthGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plane).toBe("cloud");
    expect(body.environment).toBeDefined();
    expect(body.schema).toEqual(mockSchema);
  });

  it("includes edgeAgents array in the response", async () => {
    const mockClient = { schema: vi.fn().mockResolvedValue({}) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await healthGET();
    const body = await res.json();
    expect(Array.isArray(body.edgeAgents)).toBe(true);
    expect(body.edgeAgents[0].id).toBe("saturn");
  });

  it("returns 500 with ok:false when schema() throws an Error", async () => {
    const mockClient = {
      schema: vi.fn().mockRejectedValue(new Error("SpacetimeDB unreachable")),
    };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await healthGET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("SpacetimeDB unreachable");
  });

  it("returns 500 with generic error message for non-Error throws", async () => {
    const mockClient = { schema: vi.fn().mockRejectedValue("boom") };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await healthGET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Unknown error");
  });

  it("includes environment in the 500 error response", async () => {
    const mockClient = {
      schema: vi.fn().mockRejectedValue(new Error("fail")),
    };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await healthGET();
    const body = await res.json();
    expect(body.environment).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/catalog
// ---------------------------------------------------------------------------

describe("GET /api/catalog", () => {
  it("returns ok:true with plane and agents array", async () => {
    const res = await catalogGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.plane).toBe("cloud");
    expect(Array.isArray(body.agents)).toBe(true);
  });

  it("does not require authentication", async () => {
    const res = await catalogGET();
    expect(res.status).toBe(200);
  });

  it("returns the mocked catalog entries", async () => {
    const res = await catalogGET();
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].id).toBe("saturn");
  });
});

// ---------------------------------------------------------------------------
// GET /api/inbox
// ---------------------------------------------------------------------------

describe("GET /api/inbox", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockUnauth());

    const res = await inboxGET(new Request("http://test/api/inbox"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with ok:true and result on success", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(loadInbox).mockResolvedValue({
      threads: [],
      runs: [],
      approvals: [],
      browserTasks: [],
    } as never);

    const res = await inboxGET(new Request("http://test/api/inbox"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toBeDefined();
  });

  it("passes authToken to loadInbox", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession("stdb-tok"));
    vi.mocked(loadInbox).mockResolvedValue({
      threads: [],
      runs: [],
      approvals: [],
      browserTasks: [],
    } as never);

    await inboxGET(new Request("http://test/api/inbox"));
    expect(loadInbox).toHaveBeenCalledWith("stdb-tok");
  });

  it("returns the inbox result in the response body", async () => {
    const inboxData = {
      threads: [{ threadId: "t1" }],
      runs: [],
      approvals: [],
      browserTasks: [],
    };
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(loadInbox).mockResolvedValue(inboxData as never);

    const res = await inboxGET(new Request("http://test/api/inbox"));
    const body = await res.json();
    expect(body.result.threads).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/jobs/dispatch
// ---------------------------------------------------------------------------

describe("POST /api/jobs/dispatch", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockUnauth());

    const res = await jobsDispatchPOST(
      new Request("http://test/api/jobs/dispatch", {
        method: "POST",
        body: JSON.stringify({ agentId: "saturn", goal: "deploy" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with ok:true on successful dispatch", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchJobFromPayload).mockResolvedValue({ jobId: "job-1" });

    const res = await jobsDispatchPOST(
      new Request("http://test/api/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "saturn", goal: "deploy" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual({ jobId: "job-1" });
  });

  it("passes payload and authToken to dispatchJobFromPayload", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchJobFromPayload).mockResolvedValue({});

    const payload = { agentId: "saturn", goal: "test goal" };
    await jobsDispatchPOST(
      new Request("http://test/api/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    expect(dispatchJobFromPayload).toHaveBeenCalledWith(payload, "test-token");
  });

  it("returns 400 when dispatchJobFromPayload throws an Error", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchJobFromPayload).mockRejectedValue(
      new Error("Cloud control plane only dispatches registered cloud agents")
    );

    const res = await jobsDispatchPOST(
      new Request("http://test/api/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "unknown" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("cloud agents");
  });

  it("returns 400 with generic message for non-Error throws", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchJobFromPayload).mockRejectedValue("string error");

    const res = await jobsDispatchPOST(
      new Request("http://test/api/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown dispatch error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/agents/edge/dispatch
// ---------------------------------------------------------------------------

describe("POST /api/agents/edge/dispatch", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockUnauth());

    const res = await edgeDispatchPOST(
      new Request("http://test/api/agents/edge/dispatch", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with ok:true on success", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchEdgeJobFromPayload).mockResolvedValue({ plane: "cloud", runtime: "edge" });

    const res = await edgeDispatchPOST(
      new Request("http://test/api/agents/edge/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "saturn", goal: "edge test" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual({ plane: "cloud", runtime: "edge" });
  });

  it("passes payload and authToken to dispatchEdgeJobFromPayload", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchEdgeJobFromPayload).mockResolvedValue({});

    const payload = { agentId: "saturn", goal: "edge goal" };
    await edgeDispatchPOST(
      new Request("http://test/api/agents/edge/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    expect(dispatchEdgeJobFromPayload).toHaveBeenCalledWith(payload, "test-token");
  });

  it("returns 400 when dispatchEdgeJobFromPayload throws an Error", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchEdgeJobFromPayload).mockRejectedValue(
      new Error("Unknown edge agent 'x'")
    );

    const res = await edgeDispatchPOST(
      new Request("http://test/api/agents/edge/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "x" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Unknown edge agent");
  });

  it("returns 400 with generic message for non-Error throws", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(dispatchEdgeJobFromPayload).mockRejectedValue(42);

    const res = await edgeDispatchPOST(
      new Request("http://test/api/agents/edge/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown edge dispatch error");
  });
});

// ---------------------------------------------------------------------------
// POST /api/agents/register
// ---------------------------------------------------------------------------

describe("POST /api/agents/register", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockUnauth());

    const res = await registerPOST(
      new Request("http://test/api/agents/register", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with ok:true on successful registration", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(registerAgentFromPayload).mockResolvedValue({ agentId: "saturn", schedules: 1 });

    const manifest = { id: "saturn", deployment: { controlPlane: "cloud" } };
    const res = await registerPOST(
      new Request("http://test/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual({ agentId: "saturn", schedules: 1 });
  });

  it("passes payload and authToken to registerAgentFromPayload", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(registerAgentFromPayload).mockResolvedValue({});

    const manifest = { id: "saturn" };
    await registerPOST(
      new Request("http://test/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      })
    );
    expect(registerAgentFromPayload).toHaveBeenCalledWith(manifest, "test-token");
  });

  it("returns 400 when registerAgentFromPayload throws an Error", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(registerAgentFromPayload).mockRejectedValue(
      new Error("Cloud control plane can only register cloud-plane agents")
    );

    const res = await registerPOST(
      new Request("http://test/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "bad-agent", deployment: { controlPlane: "local" } }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("cloud-plane");
  });

  it("returns 400 with generic message for non-Error throws", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(registerAgentFromPayload).mockRejectedValue(null);

    const res = await registerPOST(
      new Request("http://test/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Unknown register error");
  });
});

// ---------------------------------------------------------------------------
// GET /api/cron/reconcile
// ---------------------------------------------------------------------------

describe("GET /api/cron/reconcile", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await cronReconcileGET(new Request("http://test/api/cron/reconcile"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header has wrong token", async () => {
    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when authorization is malformed (no Bearer prefix)", async () => {
    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "super-secret-cron" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when cronSecret is not configured", async () => {
    vi.mocked(getServerEnv).mockReturnValue({
      ...DEFAULT_SERVER_ENV,
      cronSecret: undefined,
    });

    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer super-secret-cron" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 with ok:true on valid Bearer token", async () => {
    vi.mocked(reconcileCloudControlPlane).mockResolvedValue({
      catalog: { agents: 1, schedules: 1 },
      staleRunners: [],
      runs: [],
    });

    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer super-secret-cron" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.action).toBe("reconcile");
  });

  it("includes database in successful response", async () => {
    vi.mocked(reconcileCloudControlPlane).mockResolvedValue({
      catalog: { agents: 1, schedules: 0 },
      staleRunners: [],
      runs: [],
    });

    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer super-secret-cron" },
      })
    );
    const body = await res.json();
    expect(body.database).toBe("test-db");
  });

  it("returns 500 when reconcileCloudControlPlane throws an Error", async () => {
    vi.mocked(reconcileCloudControlPlane).mockRejectedValue(new Error("SpacetimeDB down"));

    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer super-secret-cron" },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("SpacetimeDB down");
  });

  it("returns 500 with generic message for non-Error throws", async () => {
    vi.mocked(reconcileCloudControlPlane).mockRejectedValue("unexpected failure");

    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer super-secret-cron" },
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Unknown reconcile error");
  });
});

// ---------------------------------------------------------------------------
// GET /api/stream
// ---------------------------------------------------------------------------

describe("GET /api/stream", () => {
  it("returns 401 when no cadet_session cookie is present", async () => {
    const res = await streamGET(new Request("http://test/api/stream"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when cookie header exists but lacks cadet_session", async () => {
    const res = await streamGET(
      new Request("http://test/api/stream", {
        headers: { cookie: "other_cookie=abc" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 200 SSE response when cadet_session cookie is present", async () => {
    const mockClient = { sql: vi.fn().mockRejectedValue(new Error("not connected")) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await streamGET(
      new Request("http://test/api/stream", {
        headers: { cookie: "cadet_session=dGVzdA" },
      })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("sets Cache-Control: no-cache, no-transform header", async () => {
    const mockClient = { sql: vi.fn().mockRejectedValue(new Error("not connected")) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await streamGET(
      new Request("http://test/api/stream", {
        headers: { cookie: "cadet_session=dGVzdA" },
      })
    );
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
  });

  it("sets Connection: keep-alive header", async () => {
    const mockClient = { sql: vi.fn().mockRejectedValue(new Error("not connected")) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await streamGET(
      new Request("http://test/api/stream", {
        headers: { cookie: "cadet_session=dGVzdA" },
      })
    );
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("returns a ReadableStream body", async () => {
    const mockClient = { sql: vi.fn().mockRejectedValue(new Error("not connected")) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await streamGET(
      new Request("http://test/api/stream", {
        headers: { cookie: "cadet_session=dGVzdA" },
      })
    );
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it("accepts cadet_session as one of multiple cookies", async () => {
    const mockClient = { sql: vi.fn().mockRejectedValue(new Error("not connected")) };
    vi.mocked(createControlClient).mockReturnValue(mockClient as never);

    const res = await streamGET(
      new Request("http://test/api/stream", {
        headers: { cookie: "foo=bar; cadet_session=dGVzdA; baz=qux" },
      })
    );
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Golden Paths
// ---------------------------------------------------------------------------

describe("Golden path — full auth-guarded request lifecycle", () => {
  it("inbox: valid session → loadInbox → sorted result returned", async () => {
    const inboxData = {
      threads: [
        { threadId: "t1", updatedAtMicros: 2000 },
        { threadId: "t2", updatedAtMicros: 1000 },
      ],
      runs: [],
      approvals: [],
      browserTasks: [],
    };
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession("stdb-tok"));
    vi.mocked(loadInbox).mockResolvedValue(inboxData as never);

    const res = await inboxGET(new Request("http://test/api/inbox"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(loadInbox).toHaveBeenCalledWith("stdb-tok");
    expect(body.result.threads).toHaveLength(2);
  });

  it("jobs/dispatch: session → payload → job dispatched → result returned", async () => {
    const jobResult = { job: { jobId: "job-abc" }, workflow: { runId: "run-1" } };
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession("stdb-tok"));
    vi.mocked(dispatchJobFromPayload).mockResolvedValue(jobResult);

    const res = await jobsDispatchPOST(
      new Request("http://test/api/jobs/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "saturn", goal: "run deployment" }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.job.jobId).toBe("job-abc");
  });

  it("cron/reconcile: valid bearer → reconcile → catalog + stale runners returned", async () => {
    vi.mocked(getServerEnv).mockReturnValue({
      ...DEFAULT_SERVER_ENV,
      cronSecret: "cron-tok",
    });
    vi.mocked(reconcileCloudControlPlane).mockResolvedValue({
      catalog: { agents: 1, schedules: 2 },
      staleRunners: ["runner-old"],
      runs: [],
    });

    const res = await cronReconcileGET(
      new Request("http://test/api/cron/reconcile", {
        headers: { authorization: "Bearer cron-tok" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.catalog.agents).toBe(1);
    expect(body.staleRunners).toEqual(["runner-old"]);
  });

  it("agents/register: session → manifest → agent registered → agentId returned", async () => {
    vi.mocked(requireOperatorApiSession).mockResolvedValue(mockSession());
    vi.mocked(registerAgentFromPayload).mockResolvedValue({
      agentId: "saturn",
      schedules: 1,
    });

    const res = await registerPOST(
      new Request("http://test/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "saturn", deployment: { controlPlane: "cloud" } }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.result.agentId).toBe("saturn");
  });
});
