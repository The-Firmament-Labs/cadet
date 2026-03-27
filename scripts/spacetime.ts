import path from "node:path";

import {
  filterAgentsByControlPlane,
  loadAgentManifestDirectory,
  schedulesForManifest,
  type AgentManifest
} from "../packages/core/src/index";
import { StarbridgeControlClient } from "../packages/sdk/src/client";
import { cloudAgentCatalog } from "../apps/web/lib/cloud-agents";

type CatalogMode = "all" | "local" | "cloud";
type Command = "build" | "publish" | "seed" | "status" | "bootstrap";

const repoRoot = path.resolve(import.meta.dir, "..");
const projectPath = path.resolve(repoRoot, envValue("SPACETIME_PROJECT_PATH") ?? "spacetimedb");
const manifestDir = path.resolve(repoRoot, envValue("SPACETIME_MANIFEST_DIR") ?? "examples/agents");
const server = envValue("SPACETIME_SERVER") ?? "local";
const database = envValue("SPACETIME_DATABASE") ?? "starbridge-control";
const baseUrl =
  envValue("SPACETIME_BASE_URL") ??
  (server === "maincloud"
    ? "https://maincloud.spacetimedb.com"
    : "http://127.0.0.1:3000");
const authToken =
  envValue("SPACETIME_AUTH_TOKEN") ?? envValue("SPACETIMEDB_AUTH_TOKEN");

const command = parseCommand(Bun.argv[2]);

try {
  switch (command) {
    case "build":
      await buildModule();
      break;
    case "publish":
      await publishModule();
      break;
    case "seed":
      printJson(await seedCatalog(selectedCatalog()));
      break;
    case "status":
      printJson(await fetchStatus());
      break;
    case "bootstrap":
      await buildModule();
      await publishModule();
      printJson(await seedCatalog(selectedCatalog()));
      printJson(await fetchStatus());
      break;
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unknown SpacetimeDB bootstrap error"
  );
  process.exit(1);
}

function envValue(name: string): string | undefined {
  const trimmed = process.env[name]?.trim();
  return trimmed ? trimmed : undefined;
}

function argValue(name: string): string | undefined {
  const index = Bun.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return Bun.argv[index + 1];
}

function hasArg(name: string): boolean {
  return Bun.argv.includes(name);
}

function parseCommand(value: string | undefined): Command {
  if (
    value === "build" ||
    value === "publish" ||
    value === "seed" ||
    value === "status" ||
    value === "bootstrap"
  ) {
    return value;
  }

  return "status";
}

function selectedCatalog(): CatalogMode {
  const value = argValue("--catalog") ?? envValue("SPACETIME_CATALOG") ?? "all";
  if (value === "local" || value === "cloud" || value === "all") {
    return value;
  }

  throw new Error("--catalog must be one of: all, local, cloud");
}

function createControlClient(): StarbridgeControlClient {
  return new StarbridgeControlClient({
    baseUrl,
    database,
    authToken
  });
}

async function buildModule(): Promise<void> {
  await runCommand(["spacetime", "build"], projectPath);
}

async function publishModule(): Promise<void> {
  const args = ["spacetime", "publish", "--server", server, "--project-path", projectPath];

  if (hasArg("--delete-data") || envValue("SPACETIME_DELETE_DATA") === "1") {
    args.push("--delete-data");
  }

  args.push("-y");

  args.push(database);

  await runCommand(args, repoRoot);
}

async function seedCatalog(catalog: CatalogMode): Promise<{
  baseUrl: string;
  database: string;
  catalog: CatalogMode;
  agents: number;
  schedules: number;
}> {
  const client = createControlClient();
  const manifests = await collectCatalog(catalog);
  let scheduleCount = 0;

  for (const manifest of manifests) {
    await client.registerAgent(manifest);
    for (const schedule of schedulesForManifest(manifest)) {
      await client.registerSchedule(schedule);
      scheduleCount += 1;
    }
  }

  return {
    baseUrl,
    database,
    catalog,
    agents: manifests.length,
    schedules: scheduleCount
  };
}

async function fetchStatus(): Promise<{
  baseUrl: string;
  database: string;
  counts: Record<string, number>;
}> {
  const client = createControlClient();
  const [agents, schedules, presence, jobs, memory] = await Promise.all([
    client.selectAll("agent_record"),
    client.selectAll("schedule_record"),
    client.selectAll("runner_presence"),
    client.selectAll("job_record"),
    client.selectAll("memory_note")
  ]);

  return {
    baseUrl,
    database,
    counts: {
      agents: agents.length,
      schedules: schedules.length,
      presence: presence.length,
      jobs: jobs.length,
      memoryNotes: memory.length
    }
  };
}

async function collectCatalog(catalog: CatalogMode): Promise<AgentManifest[]> {
  const manifests: AgentManifest[] = [];

  if (catalog !== "cloud") {
    const localCatalog = filterAgentsByControlPlane(
      await loadAgentManifestDirectory(manifestDir),
      "local"
    );
    manifests.push(...localCatalog);
  }

  if (catalog !== "local") {
    manifests.push(...cloudAgentCatalog);
  }

  const seen = new Set<string>();
  return manifests.filter((manifest) => {
    if (seen.has(manifest.id)) {
      return false;
    }

    seen.add(manifest.id);
    return true;
  });
}

async function runCommand(commandArgs: string[], cwd: string): Promise<void> {
  const processHandle = Bun.spawn(commandArgs, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    env: process.env
  });
  const exitCode = await processHandle.exited;

  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${commandArgs.join(" ")}`);
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
