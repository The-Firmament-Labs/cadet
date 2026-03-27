import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parseAgentManifest, type AgentManifest } from "./agent-manifest";

export async function loadAgentManifestFile(filePath: string): Promise<AgentManifest> {
  const source = await readFile(filePath, "utf8");
  return parseAgentManifest(JSON.parse(source));
}

export async function loadAgentManifestDirectory(directoryPath: string): Promise<AgentManifest[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const manifestFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();

  const manifests = await Promise.all(manifestFiles.map(loadAgentManifestFile));
  return manifests.sort((left, right) => left.id.localeCompare(right.id));
}

