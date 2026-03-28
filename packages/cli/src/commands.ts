import path from "node:path";

import {
  composeRuntimePrompt,
  parseControlPlaneTarget,
  parseExecutionTarget,
  normalizeJobRequest,
  type AgentManifest,
  type JobRequest
} from "@starbridge/core";
import { loadAgentManifestDirectory, loadAgentManifestFile } from "@starbridge/core/fs";

export interface CommandIO {
  info: (message: string) => void;
  error: (message: string) => void;
}

export interface CommandDependencies {
  loadAgentManifestDirectory?: typeof loadAgentManifestDirectory;
  loadAgentManifestFile?: typeof loadAgentManifestFile;
  fetchImpl?: typeof fetch;
}

const defaultIO: CommandIO = {
  info: (message) => console.log(message),
  error: (message) => console.error(message)
};

function printUsage(io: CommandIO): number {
  io.info(
    [
      "Usage:",
      "  starbridge agents list --dir <path>",
      "  starbridge prompt compose --agent-file <path> --goal <text>",
      "  starbridge job submit --agent <id> --goal <text> --api <url> --dir <path>"
    ].join("\n")
  );
  return 0;
}

export function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function loadManifestById(
  directory: string,
  agentId: string,
  deps: Required<Pick<CommandDependencies, "loadAgentManifestDirectory">>
): Promise<AgentManifest> {
  const manifests = await deps.loadAgentManifestDirectory(directory);
  const manifest = manifests.find((candidate) => candidate.id === agentId);

  if (!manifest) {
    throw new Error(`Unknown agent '${agentId}' in ${directory}`);
  }

  return manifest;
}

export async function runCli(
  argv: string[],
  io: CommandIO = defaultIO,
  deps: CommandDependencies = {}
): Promise<number> {
  const localControlPlaneTarget = parseControlPlaneTarget("local");
  const vercelEdgeExecutionTarget = parseExecutionTarget("vercel-edge");
  const loadDirectory = deps.loadAgentManifestDirectory ?? loadAgentManifestDirectory;
  const loadFile = deps.loadAgentManifestFile ?? loadAgentManifestFile;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const [command, subcommand, ...rest] = argv;

  const resolveDispatchPath = (manifest: AgentManifest): string => {
    if (manifest.deployment.controlPlane === localControlPlaneTarget) {
      return "/agents/local/dispatch";
    }

    if (manifest.deployment.execution === vercelEdgeExecutionTarget) {
      return "/api/agents/edge/dispatch";
    }

    return "/api/jobs/dispatch";
  };

  if (!command) {
    return printUsage(io);
  }

  if (command === "agents" && subcommand === "list") {
    const directory = path.resolve(readFlag(rest, "--dir") ?? "./examples/agents");
    const manifests = await loadDirectory(directory);
    io.info(JSON.stringify(manifests, null, 2));
    return 0;
  }

  if (command === "prompt" && subcommand === "compose") {
    const agentFile = readFlag(rest, "--agent-file");
    const goal = readFlag(rest, "--goal");

    if (!agentFile || !goal) {
      throw new Error("prompt compose requires --agent-file and --goal");
    }

    const manifest = await loadFile(path.resolve(agentFile));
    const job = normalizeJobRequest(
      {
        agentId: manifest.id,
        goal
      },
      {
        createId: () => "job_preview",
        now: () => new Date("2026-03-27T00:00:00.000Z")
      }
    );

    io.info(composeRuntimePrompt(manifest, job));
    return 0;
  }

  if (command === "job" && subcommand === "submit") {
    const agentId = readFlag(rest, "--agent");
    const goal = readFlag(rest, "--goal");
    const api = readFlag(rest, "--api");
    const directory = path.resolve(readFlag(rest, "--dir") ?? "./examples/agents");

    if (!agentId || !goal || !api) {
      throw new Error("job submit requires --agent, --goal, and --api");
    }

    const manifest = await loadManifestById(directory, agentId, {
      loadAgentManifestDirectory: loadDirectory
    });

    const request: JobRequest = {
      agentId: manifest.id,
      goal,
      context: {
        workflow: manifest.deployment.workflow,
        runtime: manifest.runtime
      }
    };

    const route = resolveDispatchPath(manifest);
    const response = await fetchImpl(`${api.replace(/\/$/, "")}${route}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Control plane request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    io.info(JSON.stringify(result, null, 2));
    return 0;
  }

  return printUsage(io);
}
