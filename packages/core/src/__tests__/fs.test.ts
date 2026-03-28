import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock node:fs/promises before importing the module under test
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn()
}));

import { readFile, readdir } from "node:fs/promises";
import { loadAgentManifestFile, loadAgentManifestDirectory } from "../fs";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);

// Minimal valid manifest JSON object
const validManifestPayload = {
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
    allowBrowser: false,
    allowNetwork: true,
    allowMcp: true
  },
  memory: { namespace: "research", maxNotes: 100, summarizeAfter: 10 }
};

const validManifestJson = JSON.stringify(validManifestPayload);

function makeDirent(name: string, isFile = true) {
  return {
    name,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadAgentManifestFile", () => {
  it("valid JSON → parses and returns an AgentManifest", async () => {
    mockReadFile.mockResolvedValue(validManifestJson as any);

    const manifest = await loadAgentManifestFile("/agents/researcher.json");

    expect(mockReadFile).toHaveBeenCalledWith("/agents/researcher.json", "utf8");
    expect(manifest.id).toBe("researcher");
    expect(manifest.name).toBe("Researcher");
    expect(manifest.runtime).toBe("rust-core");
    expect(manifest.deployment.controlPlane).toBe("local");
  });

  it("invalid JSON → throws a SyntaxError", async () => {
    mockReadFile.mockResolvedValue("{ not valid json" as any);

    await expect(loadAgentManifestFile("/agents/bad.json")).rejects.toThrow(SyntaxError);
  });

  it("valid JSON but invalid manifest schema → throws a validation error", async () => {
    const badPayload = JSON.stringify({ id: "bad", name: "Bad" }); // missing required fields
    mockReadFile.mockResolvedValue(badPayload as any);

    await expect(loadAgentManifestFile("/agents/bad.json")).rejects.toThrow();
  });
});

describe("loadAgentManifestDirectory", () => {
  it("empty directory → returns []", async () => {
    mockReaddir.mockResolvedValue([] as any);

    const result = await loadAgentManifestDirectory("/agents");

    expect(result).toEqual([]);
    expect(mockReaddir).toHaveBeenCalledWith("/agents", { withFileTypes: true });
  });

  it("directory with a single valid .json file → returns one manifest", async () => {
    mockReaddir.mockResolvedValue([makeDirent("researcher.json")] as any);
    mockReadFile.mockResolvedValue(validManifestJson as any);

    const result = await loadAgentManifestDirectory("/agents");

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("researcher");
  });

  it("multiple .json files → returns all manifests sorted by id", async () => {
    const operatorPayload = {
      ...validManifestPayload,
      id: "operator",
      name: "Operator",
      runtime: "edge-function",
      deployment: {
        controlPlane: "cloud",
        execution: "vercel-edge",
        workflow: "ops"
      }
    };

    mockReaddir.mockResolvedValue([
      makeDirent("operator.json"),
      makeDirent("researcher.json")
    ] as any);

    // readFile is called in sorted path order, then results sorted by id
    mockReadFile
      .mockResolvedValueOnce(JSON.stringify(operatorPayload) as any) // operator.json
      .mockResolvedValueOnce(validManifestJson as any); // researcher.json

    const result = await loadAgentManifestDirectory("/agents");

    expect(result).toHaveLength(2);
    // Results are sorted by id: "operator" < "researcher"
    expect(result[0]?.id).toBe("operator");
    expect(result[1]?.id).toBe("researcher");
  });

  it("non-.json files are filtered out", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("researcher.json"),
      makeDirent("README.md"),
      makeDirent(".gitkeep"),
      makeDirent("notes.txt")
    ] as any);
    mockReadFile.mockResolvedValue(validManifestJson as any);

    const result = await loadAgentManifestDirectory("/agents");

    expect(result).toHaveLength(1);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith("/agents/researcher.json", "utf8");
  });

  it("subdirectories are filtered out even if they end with .json somehow", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("researcher.json", true),  // file
      makeDirent("subdir.json", false)      // directory named with .json extension
    ] as any);
    mockReadFile.mockResolvedValue(validManifestJson as any);

    const result = await loadAgentManifestDirectory("/agents");

    expect(result).toHaveLength(1);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("file read failure propagates the error", async () => {
    mockReaddir.mockResolvedValue([makeDirent("broken.json")] as any);
    mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

    await expect(loadAgentManifestDirectory("/agents")).rejects.toThrow("ENOENT");
  });
});
