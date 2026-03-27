import { describe, expect, it, vi } from "vitest";

import type { AgentManifest } from "@starbridge/core";

import { runCli } from "../commands";

function createManifest(id: string): AgentManifest {
  return {
    id,
    name: id,
    description: "desc",
    system: "sys",
    model: "gpt-5.4",
    runtime: "rust-core",
    deployment: {
      controlPlane: "local",
      execution: "local-runner",
      workflow: "research"
    },
    tags: [id],
    tools: {
      allowExec: true,
      allowBrowser: true,
      allowNetwork: true,
      allowMcp: true
    },
    memory: { namespace: "research", maxNotes: 200, summarizeAfter: 20 },
    schedules: []
  };
}

describe("runCli", () => {
  it("lists manifests", async () => {
    const info = vi.fn();

    const exitCode = await runCli(
      ["agents", "list", "--dir", "./examples/agents"],
      { info, error: vi.fn() },
      {
        loadAgentManifestDirectory: vi
          .fn()
          .mockResolvedValue([createManifest("researcher"), createManifest("operator")])
      }
    );

    expect(exitCode).toBe(0);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("researcher"));
  });

  it("submits jobs through the control client", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true, plane: "local" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const info = vi.fn();

    const exitCode = await runCli(
      [
        "job",
        "submit",
        "--agent",
        "researcher",
        "--goal",
        "Audit the rollout",
        "--api",
        "http://localhost:3010",
        "--dir",
        "./examples/agents"
      ],
      { info, error: vi.fn() },
      {
        loadAgentManifestDirectory: vi.fn().mockResolvedValue([createManifest("researcher")]),
        fetchImpl: fetchImpl as unknown as typeof fetch
      }
    );

    expect(exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://localhost:3010/agents/local/dispatch");
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"plane": "local"'));
  });
});
