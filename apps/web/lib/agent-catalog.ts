import type { ExecutionTarget } from "@starbridge/core";
import { cloudAgentCatalog } from "./cloud-agents";
import { createControlClient } from "./server";
import { sqlEscape } from "./sql";

export interface AgentOption {
  id: string;
  name: string;
  description: string;
  runtime: string;
  execution: ExecutionTarget;
  model: string;
  hasSandbox: boolean;
  isBuiltIn: boolean;
  // User overrides (from user_agent_config)
  configId?: string;
  modelOverride?: string;
  repoUrl?: string;
  repoBranch?: string;
  sandboxSnapshotId?: string;
}

/**
 * Get all available agents for an operator — built-in templates merged with user configs.
 * User configs override built-in defaults where they match by agent_id.
 */
export async function getAvailableAgents(operatorId: string): Promise<AgentOption[]> {
  // 1. Built-in templates
  const builtIn: AgentOption[] = cloudAgentCatalog.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    runtime: a.runtime,
    execution: a.deployment.execution,
    model: a.model,
    hasSandbox: a.deployment.execution === "vercel-sandbox",
    isBuiltIn: true,
  }));

  // 2. User configs from SpacetimeDB
  let userConfigs: Array<Record<string, unknown>> = [];
  try {
    const client = createControlClient();
    userConfigs = (await client.sql(
      `SELECT * FROM user_agent_config WHERE operator_id = '${sqlEscape(operatorId)}'`,
    )) as Array<Record<string, unknown>>;
  } catch {
    // SpacetimeDB may not have the table yet
  }

  // 3. Merge — user configs override built-in fields
  const merged = new Map<string, AgentOption>();

  for (const agent of builtIn) {
    merged.set(agent.id, agent);
  }

  for (const config of userConfigs) {
    const agentId = String(config.agent_id ?? "");
    const existing = merged.get(agentId);

    if (existing) {
      // Override built-in with user config
      merged.set(agentId, {
        ...existing,
        configId: String(config.config_id),
        modelOverride: String(config.model_override || ""),
        repoUrl: String(config.repo_url || ""),
        repoBranch: String(config.repo_branch || ""),
        sandboxSnapshotId: String(config.sandbox_snapshot_id || ""),
      });
    } else {
      // User-created custom agent
      merged.set(agentId, {
        id: agentId,
        name: String(config.display_name || agentId),
        description: "Custom agent",
        runtime: "sandbox",
        execution: "vercel-sandbox",
        model: String(config.model_override || "anthropic/claude-sonnet-4.5"),
        hasSandbox: true,
        isBuiltIn: false,
        configId: String(config.config_id),
        modelOverride: String(config.model_override || ""),
        repoUrl: String(config.repo_url || ""),
        repoBranch: String(config.repo_branch || ""),
        sandboxSnapshotId: String(config.sandbox_snapshot_id || ""),
      });
    }
  }

  return Array.from(merged.values());
}

/**
 * Save a user agent configuration (creates or updates).
 */
export async function saveAgentConfig(opts: {
  operatorId: string;
  agentId: string;
  displayName: string;
  modelOverride?: string;
  apiKeyEncrypted?: string;
  repoUrl?: string;
  repoBranch?: string;
  sandboxSnapshotId?: string;
  extraEnv?: Record<string, string>;
}): Promise<string> {
  const client = createControlClient();
  const configId = `cfg_${opts.operatorId}_${opts.agentId}`;

  await client.callReducer("upsert_user_agent_config", [
    configId,
    opts.operatorId,
    opts.agentId,
    opts.displayName,
    opts.modelOverride ?? "",
    opts.apiKeyEncrypted ?? "",
    opts.repoUrl ?? "",
    opts.repoBranch ?? "",
    opts.sandboxSnapshotId ?? "",
    JSON.stringify(opts.extraEnv ?? {}),
  ]);

  return configId;
}
