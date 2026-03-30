import { after } from "next/server";

import { getBot } from "@/lib/bot";

export async function POST(request: Request): Promise<Response> {
  try {
    const bot = await getBot();
    const handler = bot.webhooks["slack"];
    if (!handler) {
      return new Response("Slack adapter not configured", { status: 501 });
    }
    return await handler(request, { waitUntil: (p) => after(() => p) });
  } catch (err) {
    console.error("[bot/slack] webhook error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
