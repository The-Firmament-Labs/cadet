import { describe, expect, it, vi } from "vitest";

import type { AgentManifest } from "@starbridge/core";

import { runCli, readFlag } from "../commands";

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
    memory: { namespace: "research", maxNotes: 200, summarizeAfter: 20 },
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
    expect((fetchImpl.mock.calls as unknown[][])[0]?.[0]).toBe("http://localhost:3010/agents/local/dispatch");
    expect(info).toHaveBeenCalledWith(expect.stringContaining('"plane": "local"'));
  });

  // ── no args → printUsage ───────────────────────────────────────────────────

  it("prints usage and returns 0 when no args provided", async () => {
    const info = vi.fn();

    const exitCode = await runCli([], { info, error: vi.fn() });

    expect(exitCode).toBe(0);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  // ── unknown command → printUsage ──────────────────────────────────────────

  it("prints usage and returns 0 for an unknown command", async () => {
    const info = vi.fn();

    const exitCode = await runCli(["nonexistent", "command"], { info, error: vi.fn() });

    expect(exitCode).toBe(0);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  // ── agents list with default dir path ─────────────────────────────────────

  it("agents list uses ./examples/agents as default directory when --dir is omitted", async () => {
    const loadAgentManifestDirectory = vi.fn().mockResolvedValue([createManifest("operator")]);
    const info = vi.fn();

    const exitCode = await runCli(
      ["agents", "list"],
      { info, error: vi.fn() },
      { loadAgentManifestDirectory }
    );

    expect(exitCode).toBe(0);
    // The resolved path passed to the loader must end with the default dir
    const calledWith = loadAgentManifestDirectory.mock.calls[0]?.[0] as string;
    expect(calledWith).toMatch(/examples[/\\]agents$/);
  });

  // ── prompt compose: missing --goal ────────────────────────────────────────

  it("prompt compose throws when --goal is missing", async () => {
    await expect(
      runCli(
        ["prompt", "compose", "--agent-file", "/some/agent.json"],
        { info: vi.fn(), error: vi.fn() },
        { loadAgentManifestFile: vi.fn().mockResolvedValue(createManifest("researcher")) }
      )
    ).rejects.toThrow("prompt compose requires --agent-file and --goal");
  });

  // ── prompt compose: missing --agent-file ─────────────────────────────────

  it("prompt compose throws when --agent-file is missing", async () => {
    await expect(
      runCli(
        ["prompt", "compose", "--goal", "Do something"],
        { info: vi.fn(), error: vi.fn() },
        {}
      )
    ).rejects.toThrow("prompt compose requires --agent-file and --goal");
  });

  // ── job submit: missing required flags ────────────────────────────────────

  it("job submit throws when --agent is missing", async () => {
    await expect(
      runCli(
        ["job", "submit", "--goal", "Do something", "--api", "http://localhost:3000"],
        { info: vi.fn(), error: vi.fn() },
        { loadAgentManifestDirectory: vi.fn().mockResolvedValue([]) }
      )
    ).rejects.toThrow("job submit requires --agent, --goal, and --api");
  });

  it("job submit throws when --goal is missing", async () => {
    await expect(
      runCli(
        ["job", "submit", "--agent", "researcher", "--api", "http://localhost:3000"],
        { info: vi.fn(), error: vi.fn() },
        { loadAgentManifestDirectory: vi.fn().mockResolvedValue([]) }
      )
    ).rejects.toThrow("job submit requires --agent, --goal, and --api");
  });

  it("job submit throws when --api is missing", async () => {
    await expect(
      runCli(
        ["job", "submit", "--agent", "researcher", "--goal", "Do something"],
        { info: vi.fn(), error: vi.fn() },
        { loadAgentManifestDirectory: vi.fn().mockResolvedValue([]) }
      )
    ).rejects.toThrow("job submit requires --agent, --goal, and --api");
  });

  // ── job submit with vercel-edge execution ────────────────────────────────

  it("job submit dispatches to edge endpoint when execution target is vercel-edge", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const edgeManifest: AgentManifest = {
      ...createManifest("edge-agent"),
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "research"
      }
    };

    const exitCode = await runCli(
      [
        "job",
        "submit",
        "--agent",
        "edge-agent",
        "--goal",
        "Run edge task",
        "--api",
        "http://app.example.com",
        "--dir",
        "./examples/agents"
      ],
      { info: vi.fn(), error: vi.fn() },
      {
        loadAgentManifestDirectory: vi.fn().mockResolvedValue([edgeManifest]),
        fetchImpl: fetchImpl as unknown as typeof fetch
      }
    );

    expect(exitCode).toBe(0);
    expect((fetchImpl.mock.calls as unknown[][])[0]?.[0]).toBe(
      "http://app.example.com/api/agents/edge/dispatch"
    );
  });

  // ── resolveDispatchPath: cloud non-edge → /api/jobs/dispatch ─────────────

  it("job submit dispatches to /api/jobs/dispatch for cloud non-edge execution", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const cloudManifest: AgentManifest = {
      ...createManifest("cloud-agent"),
      deployment: {
        controlPlane: "cloud",
        execution: "local-runner",
        workflow: "research"
      }
    };

    await runCli(
      [
        "job",
        "submit",
        "--agent",
        "cloud-agent",
        "--goal",
        "Run cloud task",
        "--api",
        "https://prod.example.com/",
        "--dir",
        "./examples/agents"
      ],
      { info: vi.fn(), error: vi.fn() },
      {
        loadAgentManifestDirectory: vi.fn().mockResolvedValue([cloudManifest]),
        fetchImpl: fetchImpl as unknown as typeof fetch
      }
    );

    expect((fetchImpl.mock.calls as unknown[][])[0]?.[0]).toBe(
      "https://prod.example.com/api/jobs/dispatch"
    );
  });
});

// ── readFlag unit tests ────────────────────────────────────────────────────

describe("readFlag", () => {
  it("returns the value immediately after the flag", () => {
    expect(readFlag(["--dir", "/some/path", "--verbose"], "--dir")).toBe("/some/path");
  });

  it("returns the value when the flag appears in the middle of args", () => {
    expect(readFlag(["--verbose", "--goal", "do work", "--dir", "/path"], "--goal")).toBe(
      "do work"
    );
  });

  it("returns undefined when the flag is absent", () => {
    expect(readFlag(["--verbose", "--dir", "/some/path"], "--goal")).toBeUndefined();
  });

  it("returns undefined when the flag is the last element (no following value)", () => {
    expect(readFlag(["--dir", "/some/path", "--goal"], "--goal")).toBeUndefined();
  });
});
