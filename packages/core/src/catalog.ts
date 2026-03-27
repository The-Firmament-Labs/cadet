import type { AgentManifest, ControlPlaneTarget, ExecutionTarget } from "./agent-manifest";

export function filterAgentsByControlPlane(
  manifests: AgentManifest[],
  controlPlane: ControlPlaneTarget
): AgentManifest[] {
  return manifests.filter((manifest) => manifest.deployment.controlPlane === controlPlane);
}

export function filterAgentsByExecution(
  manifests: AgentManifest[],
  execution: ExecutionTarget
): AgentManifest[] {
  return manifests.filter((manifest) => manifest.deployment.execution === execution);
}

