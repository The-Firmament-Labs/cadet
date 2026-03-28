import { describe, expect, it } from "vitest";

import { parseAgentManifest } from "../agent-manifest";
import { filterAgentsByControlPlane, filterAgentsByExecution } from "../catalog";

function makeLocalManifest(id: string) {
  return parseAgentManifest({
    id,
    name: id,
    description: "Local test agent",
    system: "Stay factual",
    model: "gpt-5.4",
    runtime: "rust-core",
    deployment: {
      controlPlane: "local",
      execution: "local-runner",
      workflow: "research"
    },
    tags: [],
    tools: {
      allowExec: false,
      allowBrowser: false,
      allowNetwork: false,
      allowMcp: false
    },
    memory: { namespace: "test", maxNotes: 10, summarizeAfter: 5 }
  });
}

function makeCloudManifest(id: string) {
  return parseAgentManifest({
    id,
    name: id,
    description: "Cloud test agent",
    system: "Stay crisp",
    model: "gpt-5.4-mini",
    runtime: "edge-function",
    deployment: {
      controlPlane: "cloud",
      execution: "vercel-edge",
      workflow: "ops"
    },
    tags: [],
    tools: {
      allowExec: false,
      allowBrowser: false,
      allowNetwork: true,
      allowMcp: true
    },
    memory: { namespace: "ops", maxNotes: 10, summarizeAfter: 5 }
  });
}

function makeContainerManifest(id: string) {
  return parseAgentManifest({
    id,
    name: id,
    description: "Container test agent",
    system: "Run containers",
    model: "gpt-5.4",
    runtime: "bun-sidecar",
    deployment: {
      controlPlane: "cloud",
      execution: "container-runner",
      workflow: "ops"
    },
    tags: [],
    tools: {
      allowExec: true,
      allowBrowser: false,
      allowNetwork: true,
      allowMcp: false
    },
    memory: { namespace: "container", maxNotes: 10, summarizeAfter: 5 }
  });
}

describe("filterAgentsByControlPlane", () => {
  it("empty list → []", () => {
    expect(filterAgentsByControlPlane([], "local")).toEqual([]);
    expect(filterAgentsByControlPlane([], "cloud")).toEqual([]);
  });

  it("all local → all returned for 'local', none for 'cloud'", () => {
    const manifests = [makeLocalManifest("a"), makeLocalManifest("b"), makeLocalManifest("c")];
    expect(filterAgentsByControlPlane(manifests, "local").map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(filterAgentsByControlPlane(manifests, "cloud")).toHaveLength(0);
  });

  it("all cloud → all returned for 'cloud', none for 'local'", () => {
    const manifests = [makeCloudManifest("x"), makeCloudManifest("y")];
    expect(filterAgentsByControlPlane(manifests, "cloud").map((m) => m.id)).toEqual(["x", "y"]);
    expect(filterAgentsByControlPlane(manifests, "local")).toHaveLength(0);
  });

  it("mixed list filters correctly", () => {
    const manifests = [
      makeLocalManifest("researcher"),
      makeCloudManifest("operator"),
      makeLocalManifest("atlas"),
      makeCloudManifest("titan")
    ];
    expect(filterAgentsByControlPlane(manifests, "local").map((m) => m.id)).toEqual([
      "researcher",
      "atlas"
    ]);
    expect(filterAgentsByControlPlane(manifests, "cloud").map((m) => m.id)).toEqual([
      "operator",
      "titan"
    ]);
  });
});

describe("filterAgentsByExecution", () => {
  it("filters by 'local-runner' execution target", () => {
    const manifests = [
      makeLocalManifest("researcher"),
      makeCloudManifest("operator"),
      makeContainerManifest("worker")
    ];
    const result = filterAgentsByExecution(manifests, "local-runner");
    expect(result.map((m) => m.id)).toEqual(["researcher"]);
  });

  it("filters by 'vercel-edge' execution target", () => {
    const manifests = [
      makeLocalManifest("researcher"),
      makeCloudManifest("operator"),
      makeContainerManifest("worker")
    ];
    const result = filterAgentsByExecution(manifests, "vercel-edge");
    expect(result.map((m) => m.id)).toEqual(["operator"]);
  });

  it("filters by 'container-runner' execution target", () => {
    const manifests = [
      makeLocalManifest("researcher"),
      makeCloudManifest("operator"),
      makeContainerManifest("worker")
    ];
    const result = filterAgentsByExecution(manifests, "container-runner");
    expect(result.map((m) => m.id)).toEqual(["worker"]);
  });

  it("empty list returns [] for any execution target", () => {
    expect(filterAgentsByExecution([], "local-runner")).toEqual([]);
    expect(filterAgentsByExecution([], "vercel-edge")).toEqual([]);
  });
});
