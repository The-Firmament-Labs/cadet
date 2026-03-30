import { handleCallback } from "@vercel/queue";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { sleepSandbox, wakeSandbox, stopSandbox, snapshotSandbox } from "@/lib/sandbox";
import type { AgentLifecycleMessage } from "@/lib/queue";

export const POST = handleCallback(
  async (message: AgentLifecycleMessage) => {
    const { sandboxId, action, operatorId, agentId, snapshotId, runId } = message;
    let { vercelAccessToken } = message;

    console.log(`[queue/agent-lifecycle] ${action} sandbox=${sandboxId}`);

    // Look up token from store if not provided in message
    if (!vercelAccessToken) {
      const { getVercelAccessToken } = await import("@/lib/token-store");
      vercelAccessToken = (await getVercelAccessToken(operatorId)) ?? "";
      if (!vercelAccessToken) {
        throw new Error(`No Vercel access token available for operator ${operatorId}`);
      }
    }

    // Idempotency: check current state before acting
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT status FROM sandbox_instance WHERE sandbox_id = '${sqlEscape(sandboxId)}'`,
    )) as Record<string, unknown>[];

    const currentStatus = rows[0]?.status as string | undefined;

    switch (action) {
      case "sleep": {
        if (currentStatus === "sleeping" || currentStatus === "stopped") {
          console.log(`[queue/agent-lifecycle] Sandbox ${sandboxId} already ${currentStatus}, skipping sleep`);
          return;
        }
        await sleepSandbox({ sandboxId, vercelAccessToken, operatorId });
        break;
      }
      case "wake": {
        if (currentStatus === "running") {
          console.log(`[queue/agent-lifecycle] Sandbox ${sandboxId} already running, skipping wake`);
          return;
        }
        if (!snapshotId) throw new Error("snapshotId required for wake");
        await wakeSandbox({ snapshotId, vercelAccessToken, operatorId, agentId, runId });
        break;
      }
      case "snapshot": {
        if (currentStatus !== "running") {
          console.log(`[queue/agent-lifecycle] Sandbox ${sandboxId} not running (${currentStatus}), skipping snapshot`);
          return;
        }
        await snapshotSandbox({ sandboxId, vercelAccessToken, operatorId });
        break;
      }
      case "stop": {
        if (currentStatus === "stopped") {
          console.log(`[queue/agent-lifecycle] Sandbox ${sandboxId} already stopped`);
          return;
        }
        await stopSandbox({ sandboxId, vercelAccessToken });
        break;
      }
      default:
        throw new Error(`Unknown lifecycle action: ${action}`);
    }
  },
  {
    visibilityTimeoutSeconds: 120,
    retry: (error, metadata) => {
      const count = (metadata as unknown as { deliveryCount: number }).deliveryCount ?? 0;
      if (count > 3) return { acknowledge: true };
      return { afterSeconds: Math.min(60, 5 * 2 ** count) };
    },
  },
);
