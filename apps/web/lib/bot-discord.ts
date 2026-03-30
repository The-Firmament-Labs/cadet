import type { Adapter } from "chat";
import { createDiscordAdapter } from "@chat-adapter/discord";

export async function createConfiguredDiscordAdapter(): Promise<Adapter | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!botToken || !publicKey) {
    return null;
  }

  return createDiscordAdapter({
    botToken,
    publicKey,
    applicationId: process.env.DISCORD_APPLICATION_ID,
  });
}
