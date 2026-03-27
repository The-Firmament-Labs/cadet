import type { AgentManifest } from "./agent-manifest";
import type { NormalizedJobRequest } from "./job";

export function composeRuntimePrompt(
  manifest: AgentManifest,
  job: NormalizedJobRequest
): string {
  const policy = [
    `exec=${manifest.tools.allowExec}`,
    `browser=${manifest.tools.browser.enabled}`,
    `browserMode=${manifest.tools.browser.defaultMode}`,
    `network=${manifest.tools.allowNetwork}`,
    `mcp=${manifest.tools.allowMcp}`
  ].join(", ");

  const contextBlock =
    Object.keys(job.context).length === 0
      ? "No additional context."
      : JSON.stringify(job.context, null, 2);

  return [
    `# Agent`,
    `${manifest.name} (${manifest.id})`,
    ``,
    `# Mission`,
    manifest.system,
    ``,
    `# Job`,
    `Goal: ${job.goal}`,
    `Priority: ${job.priority}`,
    `Requested by: ${job.requestedBy}`,
    `Control plane: ${manifest.deployment.controlPlane}`,
    `Execution: ${manifest.deployment.execution}`,
    `Memory namespace: ${manifest.memory.namespace}`,
    `Workflow template: ${manifest.workflowTemplates[0]?.id ?? "default"}`,
    `Tool policy: ${policy}`,
    ``,
    `# Context`,
    contextBlock
  ].join("\n");
}
