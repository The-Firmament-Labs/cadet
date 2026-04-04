import { getBot } from "./bot";
import { ThreadImpl } from "chat";

/**
 * Post an agent result back to the originating platform thread.
 * Called by the workflow summarize step when the channel is not "web".
 *
 * Reconstructs a Chat SDK Thread from the stored thread ID and posts
 * via the platform adapter. Logs to SpacetimeDB for audit trail.
 */
export async function replyToOrigin(opts: {
  channel: string;
  channelThreadId: string;
  summary: string;
  runId?: string;
  prUrl?: string;
  agentId?: string;
  channelId?: string;
}): Promise<void> {
  const { channel, channelThreadId, summary, runId, prUrl, agentId, channelId } = opts;

  if (channel === "web" || channel === "system") return;

  try {
    // Ensure bot singleton is registered (needed for lazy adapter resolution)
    await getBot();

    // Reconstruct the thread via Chat SDK's lazy resolution.
    // channelThreadId is the full thread ID from bot.ts onNewMention (thread.id).
    // channel is the adapter name (slack, discord, telegram, github).
    let delivered = false;
    try {
      // Derive channelId from the thread ID if not provided.
      // Chat SDK thread IDs are formatted as "adapter:channelId:threadTs"
      const effectiveChannelId = channelId ?? deriveChannelId(channel, channelThreadId);
      const thread = new ThreadImpl({
        adapterName: channel,
        channelId: effectiveChannelId,
        id: channelThreadId,
      });
      await thread.post({ markdown: formatReplyMarkdown(summary, prUrl, runId, agentId) });
      delivered = true;
    } catch (err) {
      console.warn(`[bot-reply] Chat SDK thread delivery failed for ${channel}:`, err);
    }

    if (!delivered) {
      console.log(`[bot-reply] ${channel}/${channelThreadId}: ${summary.slice(0, 100)}...`);
    }

    // Store the reply as a message event in SpacetimeDB for auditability
    const { createControlClient } = await import("./server");
    const { parseMessageChannel } = await import("@starbridge/core");
    const client = createControlClient();
    await client.ingestMessage({
      threadId: channelThreadId.includes("_") ? channelThreadId.split("_")[0]! : channelThreadId,
      channel: parseMessageChannel(channel),
      channelThreadId,
      title: "Agent Reply",
      eventId: `reply_${Date.now().toString(36)}`,
      runId: runId ?? undefined,
      direction: "outbound",
      actor: agentId ?? "cadet",
      content: summary,
      metadata: { replyChannel: channel, delivered },
    });
  } catch (error) {
    console.error(`[bot-reply] Failed to reply to ${channel}:`, error);
  }
}

/**
 * Post an arbitrary message to a platform channel.
 * Used by reaction handlers, approval notifications, and other non-workflow flows.
 */
export async function postToChannel(
  channelId: string,
  text: string,
): Promise<boolean> {
  try {
    const bot = await getBot();
    const ch = bot.channel(channelId);
    if (ch) {
      await ch.post({ markdown: text });
      return true;
    }
  } catch (err) {
    console.error(`[bot-reply] postToChannel failed:`, err);
  }
  return false;
}

/**
 * Derive channelId from a Chat SDK thread ID.
 * Thread IDs are typically "adapter:channelId:threadIdentifier".
 * If the format doesn't match, fall back to the full threadId.
 */
function deriveChannelId(adapterName: string, threadId: string): string {
  // Chat SDK encodes thread IDs as "adapter:channelId:threadTs" or similar
  const parts = threadId.split(":");
  if (parts.length >= 2 && parts[0] === adapterName) {
    return `${parts[0]}:${parts[1]}`;
  }
  // Fallback: use adapter:threadId as channel
  return `${adapterName}:${threadId}`;
}

function formatReplyMarkdown(
  summary: string,
  prUrl?: string,
  runId?: string,
  agentId?: string,
): string {
  const parts: string[] = [];
  if (agentId) parts.push(`**${agentId}** completed`);
  parts.push(summary);
  if (prUrl) parts.push(`[View PR](${prUrl})`);
  if (runId) parts.push(`\`${runId}\``);
  return parts.join("\n\n");
}
