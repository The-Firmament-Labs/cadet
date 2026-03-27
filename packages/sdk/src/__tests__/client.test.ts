import { describe, expect, it, vi } from "vitest";

import type { AgentManifest } from "@starbridge/core";

import { StarbridgeControlClient } from "../client";

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
        allowMcp: true
      },
      memory: { namespace: "research", maxNotes: 100, summarizeAfter: 10 },
      schedules: []
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
              rows: [["operator_incident-sweep", "operator", "cloud", "Sweep", 10, "high", "scheduler", true, 1000, [1, []], [0, "job_1"]]]
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
        nextRunAtMicros: 1000,
        lastRunAtMicros: null,
        lastJobId: "job_1"
      }
    ]);
  });
});
