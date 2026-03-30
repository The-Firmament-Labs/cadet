import { createControlClient } from "./server";
import { getServerEnv, hasSpacetimeConfig } from "./env";
import { sqlEscape } from "./sql";

export interface SetupStatus {
  spacetimeDbReachable: boolean;
  hasVercelToken: boolean;
  hasAgentConfigured: boolean;
  hasCompletedFirstRun: boolean;
  agentCount: number;
  runCount: number;
}

export async function getSetupStatus(operatorId: string): Promise<SetupStatus> {
  const status: SetupStatus = {
    spacetimeDbReachable: false,
    hasVercelToken: false,
    hasAgentConfigured: false,
    hasCompletedFirstRun: false,
    agentCount: 0,
    runCount: 0,
  };

  if (!hasSpacetimeConfig()) {
    return status;
  }

  try {
    const client = createControlClient();

    // Check SpacetimeDB is reachable
    await client.sql("SELECT 1");
    status.spacetimeDbReachable = true;

    // Check for Vercel token
    const tokenRows = (await client.sql(
      `SELECT operator_id FROM operator_token WHERE operator_id = '${sqlEscape(operatorId)}'`,
    )) as unknown[];
    status.hasVercelToken = tokenRows.length > 0;

    // Check for registered agents
    const agentRows = (await client.sql("SELECT agent_id FROM agent_record")) as unknown[];
    status.agentCount = agentRows.length;
    status.hasAgentConfigured = agentRows.length > 0;

    // Check for completed runs
    const runRows = (await client.sql(
      "SELECT run_id FROM workflow_run LIMIT 1",
    )) as unknown[];
    status.runCount = runRows.length;
    status.hasCompletedFirstRun = runRows.length > 0;
  } catch {
    // SpacetimeDB may not be reachable
  }

  return status;
}

export function getSetupSteps(status: SetupStatus): Array<{
  id: string;
  label: string;
  complete: boolean;
  action?: string;
  actionLabel?: string;
}> {
  return [
    {
      id: "signin",
      label: "Signed in",
      complete: true, // Always true if they can see this
    },
    {
      id: "vercel",
      label: "Connect Vercel account",
      complete: status.hasVercelToken,
      action: "/api/auth/vercel/authorize",
      actionLabel: "Connect Vercel",
    },
    {
      id: "agent",
      label: "Configure an agent",
      complete: status.hasAgentConfigured,
      actionLabel: "Launch Mission",
    },
    {
      id: "run",
      label: "Complete your first mission",
      complete: status.hasCompletedFirstRun,
    },
  ];
}
