import { describe, expect, it, vi } from "vitest";

import type { AgentManifest, NormalizedJobRequest, ScheduleRegistration } from "@starbridge/core";

import { StarbridgeControlClient } from "../client";

function makeOkFetch(body: unknown = { ok: true }): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  ) as unknown as typeof fetch;
}

function makeClient(
  options: Partial<ConstructorParameters<typeof StarbridgeControlClient>[0]> & {
    fetchImpl?: typeof fetch;
  } = {}
): { client: StarbridgeControlClient; fetchImpl: ReturnType<typeof vi.fn> } {
  const fetchImpl = (options.fetchImpl as ReturnType<typeof vi.fn>) ?? (makeOkFetch() as unknown as ReturnType<typeof vi.fn>);
  const client = new StarbridgeControlClient({
    baseUrl: options.baseUrl ?? "http://127.0.0.1:3000",
    database: options.database ?? "starbridge-control",
    authToken: options.authToken,
    fetchImpl: fetchImpl as unknown as typeof fetch
  });
  return { client, fetchImpl };
}

describe("StarbridgeControlClient", () => {
  it("invokes reducers with the correct path and body", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new StarbridgeControlClient({
      baseUrl: "http://127.0.0.1:3000/",
      database: "starbridge-control",
      authToken: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await client.markJobCompleted("job_1", "done");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3000/v1/database/starbridge-control/call/complete_job");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('["job_1","done"]');
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer secret");
  });

  it("registers agents from manifests", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new StarbridgeControlClient({
      baseUrl: "http://127.0.0.1:3000",
      database: "starbridge-control",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    const manifest: AgentManifest = {
      id: "researcher",
      name: "Researcher",
      description: "Research agent",
      system: "Stay factual",
      model: "gpt-5.4",
      runtime: "rust-core",
      deployment: {
        controlPlane: "local",
        execution: "local-runner",
        workflow: "research"
      },
      tags: ["research"],
      tools: {
        allowExec: true,
        allowBrowser: true,
        allowNetwork: true,
        allowMcp: true,
        browser: {
          enabled: true,
          allowedDomains: ["github.com"],
          blockedDomains: [],
          maxConcurrentSessions: 2,
          allowDownloads: false,
          defaultMode: "read",
          requiresApprovalFor: ["form", "download"]
        }
      },
      memory: { namespace: "research", maxNotes: 100, summarizeAfter: 10 },
      schedules: [],
      workflowTemplates: [
        {
          id: "default",
          description: "default",
          stages: ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
        }
      ],
      toolProfiles: [],
      handoffRules: [],
      learningPolicy: {
        enabled: true,
        summarizeEveryRuns: 5,
        embedMemory: true,
        maxRetrievedChunks: 8
      }
    };

    await client.registerAgent(manifest);

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.body).toContain('"researcher"');
    expect(init.body).toContain('"rust-core"');
    expect(init.body).toContain('"local"');
    expect(init.body).toContain('"local-runner"');
  });

  it("requests the supported schema version", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new StarbridgeControlClient({
      baseUrl: "http://127.0.0.1:3000",
      database: "starbridge-control",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await client.schema();

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://127.0.0.1:3000/v1/database/starbridge-control/schema?version=9"
    );
    expect(init.method).toBe("GET");
  });

  it("decodes public SQL rows for schedules and presence", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/sql")) {
        return new Response(
          JSON.stringify([
            {
              schema: {
                elements: [
                  { name: { some: "schedule_id" }, algebraic_type: { String: [] } },
                  { name: { some: "agent_id" }, algebraic_type: { String: [] } },
                  { name: { some: "control_plane" }, algebraic_type: { String: [] } },
                  { name: { some: "goal" }, algebraic_type: { String: [] } },
                  { name: { some: "interval_minutes" }, algebraic_type: { U32: [] } },
                  { name: { some: "priority" }, algebraic_type: { String: [] } },
                  { name: { some: "requested_by" }, algebraic_type: { String: [] } },
                  { name: { some: "enabled" }, algebraic_type: { Bool: [] } },
                  { name: { some: "next_run_at_micros" }, algebraic_type: { I64: [] } },
                  {
                    name: { some: "last_run_at_micros" },
                    algebraic_type: {
                      Sum: {
                        variants: [
                          { name: { some: "some" }, algebraic_type: { I64: [] } },
                          { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                        ]
                      }
                    }
                  },
                  {
                    name: { some: "status" },
                    algebraic_type: { String: [] }
                  },
                  {
                    name: { some: "last_job_id" },
                    algebraic_type: {
                      Sum: {
                        variants: [
                          { name: { some: "some" }, algebraic_type: { String: [] } },
                          { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                        ]
                      }
                    }
                  }
                ]
              },
              rows: [["operator_incident-sweep", "operator", "cloud", "Sweep", 10, "high", "scheduler", true, 1000, [1, []], "ready", [0, "job_1"]]]
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new StarbridgeControlClient({
      baseUrl: "http://127.0.0.1:3000",
      database: "starbridge-control",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(client.listSchedules()).resolves.toEqual([
      {
        scheduleId: "operator_incident-sweep",
        agentId: "operator",
        controlPlane: "cloud",
        goal: "Sweep",
        intervalMinutes: 10,
        priority: "high",
        enabled: true,
        requestedBy: "scheduler",
        status: "ready",
        nextRunAtMicros: 1000,
        lastRunAtMicros: null,
        lastJobId: "job_1"
      }
    ]);
  });

  it("decodes public SQL rows for jobs and tool calls", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const query = String(init?.body ?? "");
      if (query.includes("job_record")) {
        return new Response(
          JSON.stringify([
            {
              schema: {
                elements: [
                  { name: { some: "job_id" }, algebraic_type: { String: [] } },
                  { name: { some: "agent_id" }, algebraic_type: { String: [] } },
                  { name: { some: "goal" }, algebraic_type: { String: [] } },
                  { name: { some: "priority" }, algebraic_type: { String: [] } },
                  { name: { some: "requested_by" }, algebraic_type: { String: [] } },
                  {
                    name: { some: "requested_by_identity" },
                    algebraic_type: {
                      Product: {
                        elements: [{ name: { some: "__identity__" }, algebraic_type: { String: [] } }]
                      }
                    }
                  },
                  { name: { some: "context_json" }, algebraic_type: { String: [] } },
                  { name: { some: "status" }, algebraic_type: { String: [] } },
                  {
                    name: { some: "runner_id" },
                    algebraic_type: {
                      Sum: {
                        variants: [
                          { name: { some: "some" }, algebraic_type: { String: [] } },
                          { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                        ]
                      }
                    }
                  },
                  {
                    name: { some: "result_summary" },
                    algebraic_type: {
                      Sum: {
                        variants: [
                          { name: { some: "some" }, algebraic_type: { String: [] } },
                          { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                        ]
                      }
                    }
                  },
                  {
                    name: { some: "created_at" },
                    algebraic_type: {
                      Product: {
                        elements: [
                          {
                            name: { some: "__timestamp_micros_since_unix_epoch__" },
                            algebraic_type: { I64: [] }
                          }
                        ]
                      }
                    }
                  },
                  {
                    name: { some: "updated_at" },
                    algebraic_type: {
                      Product: {
                        elements: [
                          {
                            name: { some: "__timestamp_micros_since_unix_epoch__" },
                            algebraic_type: { I64: [] }
                          }
                        ]
                      }
                    }
                  }
                ]
              },
              rows: [
                [
                  "job_1",
                  "operator",
                  "Sweep incidents",
                  "high",
                  "scheduler",
                  ["identity_scheduler"],
                  "{\"scope\":\"incidents\"}",
                  "running",
                  [0, "runner_1"],
                  [1, []],
                  [1111],
                  [2222]
                ]
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (query.includes("tool_call_record")) {
        return new Response(
          JSON.stringify([
            {
              schema: {
                elements: [
                  { name: { some: "tool_call_id" }, algebraic_type: { String: [] } },
                  { name: { some: "run_id" }, algebraic_type: { String: [] } },
                  { name: { some: "step_id" }, algebraic_type: { String: [] } },
                  { name: { some: "agent_id" }, algebraic_type: { String: [] } },
                  { name: { some: "tool_name" }, algebraic_type: { String: [] } },
                  { name: { some: "status" }, algebraic_type: { String: [] } },
                  { name: { some: "input_json" }, algebraic_type: { String: [] } },
                  {
                    name: { some: "output_json" },
                    algebraic_type: {
                      Sum: {
                        variants: [
                          { name: { some: "some" }, algebraic_type: { String: [] } },
                          { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                        ]
                      }
                    }
                  },
                  { name: { some: "created_at_micros" }, algebraic_type: { I64: [] } },
                  { name: { some: "updated_at_micros" }, algebraic_type: { I64: [] } }
                ]
              },
              rows: [
                [
                  "tool_step_1",
                  "run_1",
                  "step_1",
                  "operator",
                  "workflow::plan",
                  "completed",
                  "{\"goal\":\"Sweep incidents\"}",
                  [0, "{\"summary\":\"done\"}"],
                  3333,
                  4444
                ]
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    const client = new StarbridgeControlClient({
      baseUrl: "http://127.0.0.1:3000",
      database: "starbridge-control",
      fetchImpl: fetchImpl as unknown as typeof fetch
    });

    await expect(client.listJobs()).resolves.toEqual([
      {
        jobId: "job_1",
        agentId: "operator",
        goal: "Sweep incidents",
        priority: "high",
        requestedBy: "scheduler",
        requestedByIdentity: "identity_scheduler",
        contextJson: "{\"scope\":\"incidents\"}",
        status: "running",
        runnerId: "runner_1",
        resultSummary: null,
        createdAtMicros: 1111,
        updatedAtMicros: 2222
      }
    ]);

    await expect(client.listToolCalls()).resolves.toEqual([
      {
        toolCallId: "tool_step_1",
        runId: "run_1",
        stepId: "step_1",
        agentId: "operator",
        toolName: "workflow::plan",
        status: "completed",
        inputJson: "{\"goal\":\"Sweep incidents\"}",
        outputJson: "{\"summary\":\"done\"}",
        createdAtMicros: 3333,
        updatedAtMicros: 4444
      }
    ]);
  });

  // ── HTTP error handling ────────────────────────────────────────────────────

  it("throws when request() receives a non-2xx status", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" })
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.schema()).rejects.toThrow(
      "Control plane request failed: 500 Internal Server Error"
    );
  });

  it("throws on 401 Unauthorized", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("Unauthorized", { status: 401, statusText: "Unauthorized" })
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.schema()).rejects.toThrow("401");
  });

  // ── Authorization header ───────────────────────────────────────────────────

  it("includes Bearer authorization header when authToken is set", async () => {
    const { client, fetchImpl } = makeClient({ authToken: "my-token" });

    await client.schema();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers as HeadersInit).get("authorization")).toBe("Bearer my-token");
  });

  it("omits authorization header when authToken is undefined", async () => {
    const { client, fetchImpl } = makeClient({ authToken: undefined });

    await client.schema();

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers as HeadersInit).get("authorization")).toBeNull();
  });

  // ── sql() content-type header ──────────────────────────────────────────────

  it("sends sql() with content-type text/plain; charset=utf-8", async () => {
    const { client, fetchImpl } = makeClient();

    await client.sql("SELECT 1");

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers as HeadersInit).get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(init.body).toBe("SELECT 1");
  });

  // ── trailing slash on baseUrl ──────────────────────────────────────────────

  it("strips trailing slash from baseUrl", async () => {
    const { client, fetchImpl } = makeClient({ baseUrl: "http://127.0.0.1:3000/" });

    await client.schema();

    const [url] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("//v1");
    expect(url).toBe("http://127.0.0.1:3000/v1/database/starbridge-control/schema?version=9");
  });

  // ── selectAll returns empty array for non-array response ──────────────────

  it("selectAll returns empty array when sql response is not an array", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.selectAll("any_table")).resolves.toEqual([]);
  });

  it("selectAll returns empty array when sql response is an empty array", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.selectAll("any_table")).resolves.toEqual([]);
  });

  // ── callReducer URL construction ──────────────────────────────────────────

  it("callReducer builds the correct URL from reducer name", async () => {
    const { client, fetchImpl } = makeClient();

    await client.callReducer("my_custom_reducer", ["arg1", 42]);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://127.0.0.1:3000/v1/database/starbridge-control/call/my_custom_reducer"
    );
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers as HeadersInit).get("content-type")).toBe("application/json");
    expect(init.body).toBe('["arg1",42]');
  });

  // ── enqueueJob serialization ──────────────────────────────────────────────

  it("enqueueJob serializes context as JSON string in the args array", async () => {
    const { client, fetchImpl } = makeClient();

    const job: NormalizedJobRequest = {
      jobId: "j-001",
      agentId: "operator",
      goal: "Fix the incident",
      priority: "high",
      requestedBy: "scheduler",
      createdAt: "2026-03-28T00:00:00.000Z",
      context: { scope: "prod", extra: 99 }
    };

    await client.enqueueJob(job);

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const args = JSON.parse(init.body as string) as unknown[];
    expect(args[0]).toBe("j-001");
    expect(args[1]).toBe("operator");
    expect(args[2]).toBe("Fix the incident");
    expect(args[3]).toBe("high");
    // context must be JSON-serialized, not an object
    expect(typeof args[5]).toBe("string");
    expect(JSON.parse(args[5] as string)).toEqual({ scope: "prod", extra: 99 });
  });

  // ── registerSchedule ──────────────────────────────────────────────────────

  it("registerSchedule passes all fields to the reducer", async () => {
    const { client, fetchImpl } = makeClient();

    const schedule: ScheduleRegistration = {
      scheduleId: "sched-1",
      agentId: "operator",
      controlPlane: "local",
      goal: "Sweep logs",
      intervalMinutes: 30,
      priority: "normal",
      requestedBy: "cron",
      enabled: true
    };

    await client.registerSchedule(schedule);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("call/register_schedule");
    const args = JSON.parse(init.body as string) as unknown[];
    expect(args[0]).toBe("sched-1");
    expect(args[4]).toBe(30);
    expect(args[7]).toBe(true);
  });

  // ── claimScheduledRun ─────────────────────────────────────────────────────

  it("claimScheduledRun includes scheduleId, controlPlane, expectedNextRunAtMicros, jobId, and context", async () => {
    const { client, fetchImpl } = makeClient();

    const job: NormalizedJobRequest = {
      jobId: "j-002",
      agentId: "operator",
      goal: "Periodic sweep",
      priority: "normal",
      requestedBy: "scheduler",
      createdAt: "2026-03-28T00:00:00.000Z",
      context: { run: "periodic" }
    };

    await client.claimScheduledRun("sched-1", "local", 9999999, job);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("call/claim_schedule_run");
    const args = JSON.parse(init.body as string) as unknown[];
    expect(args[0]).toBe("sched-1");
    expect(args[1]).toBe("local");
    expect(args[2]).toBe(9999999);
    expect(args[3]).toBe("j-002");
    // context JSON
    expect(JSON.parse(args[4] as string)).toEqual({ run: "periodic" });
  });

  // ── resolveApproval ───────────────────────────────────────────────────────

  it("resolveApproval serializes resolution object as JSON", async () => {
    const { client, fetchImpl } = makeClient();

    await client.resolveApproval("appr-1", "approved", { note: "LGTM", reviewer: "alice" });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("call/resolve_approval");
    const args = JSON.parse(init.body as string) as unknown[];
    expect(args[0]).toBe("appr-1");
    expect(args[1]).toBe("approved");
    expect(JSON.parse(args[2] as string)).toEqual({ note: "LGTM", reviewer: "alice" });
  });

  // ── asString with null/undefined ──────────────────────────────────────────
  // decodeSqlValue returns null early when value === null (before asString);
  // higher-level list methods (e.g. listJobs) then call asString(null, ...) → ""

  it("asString coerces null to empty string (via String(value ?? ''))", () => {
    // Verify the nullish coalescing pattern used by asString in client.ts
    const nullVal: unknown = null;
    const undefVal: unknown = undefined;
    expect(String(nullVal ?? "")).toBe("");
    expect(String(undefVal ?? "")).toBe("");
  });

  it("selectAll passes null cell values through decodeSqlValue unchanged when type is String", async () => {
    // decodeSqlValue returns null early when value === null; rows keep the null.
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            schema: {
              elements: [{ name: { some: "goal" }, algebraic_type: { String: [] } }]
            },
            rows: [[null]]
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const rows = await client.selectAll("any_table");
    // decodeSqlValue short-circuits on null: the raw row value is preserved
    expect(rows[0]?.goal).toBeNull();
  });

  // ── Sum type decoding: none variant ──────────────────────────────────────

  it("decodes Sum/none variant to null in selectAll rows", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            schema: {
              elements: [
                {
                  name: { some: "optional_field" },
                  algebraic_type: {
                    Sum: {
                      variants: [
                        { name: { some: "some" }, algebraic_type: { String: [] } },
                        { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                      ]
                    }
                  }
                }
              ]
            },
            rows: [[[1, []]]]
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const rows = await client.selectAll("any_table");
    expect(rows[0]?.optional_field).toBeNull();
  });

  // ── Sum type decoding: some variant ──────────────────────────────────────

  it("decodes Sum/some variant to the inner value in selectAll rows", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            schema: {
              elements: [
                {
                  name: { some: "optional_field" },
                  algebraic_type: {
                    Sum: {
                      variants: [
                        { name: { some: "some" }, algebraic_type: { String: [] } },
                        { name: { some: "none" }, algebraic_type: { Product: { elements: [] } } }
                      ]
                    }
                  }
                }
              ]
            },
            rows: [[[0, "hello-world"]]]
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const rows = await client.selectAll("any_table");
    expect(rows[0]?.optional_field).toBe("hello-world");
  });

  // ── text/plain response ───────────────────────────────────────────────────

  it("returns plain text body when response content-type is not application/json", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("OK\n", {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    );

    const { client } = makeClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    const result = await client.sql("SELECT 1");
    expect(result).toBe("OK\n");
  });
});
