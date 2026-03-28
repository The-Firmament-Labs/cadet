import type { AgentManifest } from "./agent-manifest";
import type { NormalizedJobRequest } from "./job";

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

  // Context tools — how to get what you need
  sections.push(
    "# Context Tools",
    "You have these tools to pull context on demand:",
    "- query_memory(namespace, query, max_chunks) — search your memory for relevant prior knowledge",
    "- load_context(path) — load a prompt or knowledge file from .cadet/prompts/",
    "- get_trajectory(run_id, last_n_steps) — review your recent execution history",
    "- log_step(entry) — log this step for trajectory training",
    ""
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
