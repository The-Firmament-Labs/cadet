import type { AgentManifest } from "./agent-manifest";
import type { NormalizedJobRequest } from "./job";
import { getAgentTools, formatToolsForPrompt } from "./tools";

// ── TOON Prompt Builder Types ──────────────────────────────────────
// Mirror the Rust PromptData struct in starbridge-core/src/context_engine.rs.
// The caller fetches data from SpacetimeDB and passes it here.

export interface ThreadMessage {
  sender: string;
  text: string;
  timestamp_micros: number;
}

export interface PromptMemoryChunk {
  title: string;
  content: string;
  similarity: number;
}

export interface ActiveRoute {
  channel: string;
  filter: string;
}

export interface ToolSummary {
  name: string;
  category: string;
  requires_approval: boolean;
}

export interface PromptData {
  agent_id: string;
  agent_name: string;
  agent_runtime: string;
  namespace: string;
  system_prompt: string;

  run_id: string;
  goal: string;
  priority: string;
  current_stage: string;
  requested_by: string;

  sender_name?: string | undefined;
  sender_channel?: string | undefined;
  sender_entity_id?: string | undefined;

  thread_history: ThreadMessage[];
  memory_chunks: PromptMemoryChunk[];
  previous_step_output?: string | undefined;
  recent_trajectories: TrajectoryRef[];
  active_routes: ActiveRoute[];
  tools: ToolSummary[];
  loadable_prompts: string[];
  token_budget: number;
}

export interface TrajectoryRef {
  stage: string;
  success: boolean;
  duration_ms: number;
}

/** Default Rust context engine endpoint (local sidecar) */
const RUST_BUILDER_URL = process.env.STARBRIDGE_URL ?? "http://localhost:3020";

/**
 * Build a TOON-encoded prompt via the Rust context engine.
 * Falls back to the TS composeRuntimePrompt() if Rust is unavailable.
 */
export async function buildToonPrompt(
  data: PromptData,
  manifest: AgentManifest,
  job: NormalizedJobRequest
): Promise<string> {
  try {
    const response = await fetch(`${RUST_BUILDER_URL}/api/prompt/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      return await response.text();
    }
  } catch {
    // Rust sidecar unavailable — fall back to TS builder
  }

  return composeRuntimePrompt(manifest, job);
}

/**
 * Build PromptData from a manifest + job + optional enrichment.
 * This is the bridge between the existing TS types and the Rust struct.
 */
export function toPromptData(
  manifest: AgentManifest,
  job: NormalizedJobRequest,
  enrichment?: {
    senderName?: string;
    senderChannel?: string;
    senderEntityId?: string;
    threadHistory?: ThreadMessage[];
    memoryChunks?: PromptMemoryChunk[];
    previousStepOutput?: string;
    recentTrajectories?: TrajectoryRef[];
    activeRoutes?: ActiveRoute[];
    currentStage?: string;
  },
  tokenBudget = 4000
): PromptData {
  const tools = getAgentTools(manifest);

  return {
    agent_id: manifest.id,
    agent_name: manifest.name,
    agent_runtime: manifest.runtime,
    namespace: manifest.memory.namespace,
    system_prompt: manifest.system,

    run_id: job.jobId,
    goal: job.goal,
    priority: job.priority,
    current_stage: enrichment?.currentStage ?? "route",
    requested_by: job.requestedBy,

    sender_name: enrichment?.senderName,
    sender_channel: enrichment?.senderChannel,
    sender_entity_id: enrichment?.senderEntityId,

    thread_history: enrichment?.threadHistory ?? [],
    memory_chunks: enrichment?.memoryChunks ?? [],
    previous_step_output: enrichment?.previousStepOutput,
    recent_trajectories: enrichment?.recentTrajectories ?? [],
    active_routes: enrichment?.activeRoutes ?? [],

    tools: tools.map((t) => ({
      name: t.name,
      category: t.category,
      requires_approval: t.requiresApproval,
    })),

    loadable_prompts: manifest.prompts
      ? [
          manifest.prompts.system,
          ...(manifest.prompts.personality ? [manifest.prompts.personality] : []),
          ...Object.values(manifest.prompts.stages ?? {}),
        ]
      : [],

    token_budget: tokenBudget,
  };
}

/**
 * Compose the runtime prompt for an agent step.
 *
 * This is a thin identity + tools prompt. The agent decides what additional
 * context to pull via tools (query_memory, load_context, get_trajectory).
 * We do NOT pre-inject prompts or pre-compute relevance — the LLM is better
 * at deciding what it needs.
 */
export function composeRuntimePrompt(
  manifest: AgentManifest,
  job: NormalizedJobRequest
): string {
  const sections: string[] = [];

  // Identity — who you are
  sections.push(
    `# ${manifest.name} (${manifest.id})`,
    manifest.system,
    ""
  );

  // Mission — what to do
  sections.push(
    "# Mission",
    `Goal: ${job.goal}`,
    `Priority: ${job.priority}`,
    `Requested by: ${job.requestedBy}`,
    ""
  );

  // Capabilities — what you can do
  const caps = [
    manifest.tools.allowExec && "exec",
    manifest.tools.allowBrowser && `browser(${manifest.tools.browser.defaultMode})`,
    manifest.tools.allowNetwork && "network",
    manifest.tools.allowMcp && "mcp",
  ].filter(Boolean).join(", ");

  sections.push(
    "# Capabilities",
    `Runtime: ${manifest.runtime} on ${manifest.deployment.controlPlane}`,
    `Execution: ${manifest.deployment.execution}`,
    `Tools: ${caps}`,
    `Memory namespace: ${manifest.memory.namespace}`,
    ""
  );

  // Tools — what you can call
  const tools = getAgentTools(manifest);
  sections.push(
    "# Available Tools",
    formatToolsForPrompt(tools),
  );

  // Available prompts — what you can load
  if (manifest.prompts) {
    sections.push("# Available Context Files");
    sections.push(`- System: ${manifest.prompts.system}`);
    if (manifest.prompts.personality) {
      sections.push(`- Personality: ${manifest.prompts.personality}`);
    }
    if (manifest.prompts.stages) {
      for (const [stage, path] of Object.entries(manifest.prompts.stages)) {
        sections.push(`- ${stage}: ${path}`);
      }
    }
    sections.push(
      "",
      "Load these with load_context() when you need domain guidance.",
      ""
    );
  }

  // Workflow — how to execute
  const template = manifest.workflowTemplates[0];
  if (template) {
    sections.push(
      "# Workflow",
      `Template: ${template.id}`,
      `Stages: ${template.stages.join(" → ")}`,
      ""
    );
  }

  // Job context
  if (Object.keys(job.context).length > 0) {
    sections.push(
      "# Job Context",
      JSON.stringify(job.context, null, 2),
      ""
    );
  }

  return sections.join("\n");
}
