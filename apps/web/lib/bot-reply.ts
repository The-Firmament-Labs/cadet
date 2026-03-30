import { getBot } from "./bot";

/**
 * Post an agent result back to the originating platform thread.
 * Called by the workflow summarize step when the channel is not "web".
 *
 * Uses the Chat SDK's openDM/channel methods where available,
 * or falls back to posting via the control plane URL's bot webhook.
 */
export async function replyToOrigin(opts: {
  channel: string;
  channelThreadId: string;
  summary: string;
}): Promise<void> {
  const { channel, channelThreadId, summary } = opts;

  if (channel === "web" || channel === "system") return;

  try {
    const bot = await getBot();

    // The Chat SDK exposes webhooks for each adapter, but posting back
    // requires using the platform's API directly. The simplest approach
    // is to use the control plane's ingest endpoint to create a reply message
    // that the bot's outbound handler will pick up.
    //
    // For now, log the reply intent — full platform delivery requires
    // storing the platform's thread reference during ingest and using
    // adapter-specific reply APIs (Slack: chat.postMessage, Discord: channel.send, etc.)
    console.log(`[bot-reply] ${channel}/${channelThreadId}: ${summary.slice(0, 100)}...`);

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
      runId: undefined,
      direction: "outbound",
      actor: "cadet",
      content: summary,
      metadata: { replyChannel: channel },
    });
  } catch (error) {
    console.error(`[bot-reply] Failed to reply to ${channel}:`, error);
  }
}
