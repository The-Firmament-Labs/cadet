import { QueueClient } from "@vercel/queue";

const queueRegion = process.env.VERCEL_REGION ?? "iad1";
const queueClient = new QueueClient({ region: queueRegion });

export const handleQueueCallback = queueClient.handleCallback;

// ---------------------------------------------------------------------------
// Message Types
// ---------------------------------------------------------------------------

export interface AgentLaunchMessage {
  jobId: string;
  agentId: string;
  runId: string;
  operatorId: string;
  vercelAccessToken?: string;
  attempt: number;
  maxRetries: number;
}

export interface AgentLifecycleMessage {
  sandboxId: string;
  action: "wake" | "sleep" | "snapshot" | "stop";
  operatorId: string;
  agentId: string;
  vercelAccessToken: string;
  snapshotId?: string;
  runId?: string;
}

// ---------------------------------------------------------------------------
// Producers
// ---------------------------------------------------------------------------

export async function sendToAgentLaunch(
  payload: AgentLaunchMessage,
): Promise<{ messageId: string | null }> {
  const { messageId } = await queueClient.send("agent-launch", payload, {
    idempotencyKey: `launch-${payload.jobId}-${payload.attempt}`,
  });
  return { messageId };
}

export async function sendToAgentLifecycle(
  payload: AgentLifecycleMessage,
): Promise<{ messageId: string | null }> {
  const { messageId } = await queueClient.send("agent-lifecycle", payload, {
    idempotencyKey: `lifecycle-${payload.sandboxId}-${payload.action}`,
  });
  return { messageId };
}
