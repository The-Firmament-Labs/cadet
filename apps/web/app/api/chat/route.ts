import { after } from "next/server";
import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { parseSessionFromRequest } from "@/lib/auth";
import { chatTools } from "@/lib/chat-tools";
import { cloudAgentCatalog } from "@/lib/cloud-agents";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiUnauthorized } from "@/lib/api-response";

const cadetAgent = cloudAgentCatalog.find((a) => a.id === "cadet")!;

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  // Load conversation history for this operator
  try {
    const client = createControlClient();
    const rows = await client.sql(
      `SELECT message_id, role, content, metadata_json, created_at_micros FROM chat_message WHERE operator_id = '${sqlEscape(session.operatorId)}' ORDER BY created_at_micros ASC LIMIT 50`,
    );
    return Response.json({ ok: true, messages: rows });
  } catch {
    return Response.json({ ok: true, messages: [] });
  }
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  try {
    const { messages } = (await request.json()) as { messages: UIMessage[] };

    // Persist the latest user message in the background
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      after(async () => {
        try {
          const client = createControlClient();
          await client.callReducer("save_chat_message", [
            `msg_${Date.now().toString(36)}`,
            session.operatorId,
            "default",
            "user",
            lastUserMsg.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n") || JSON.stringify(lastUserMsg.parts),
            "{}",
          ]);
        } catch { /* best-effort */ }
      });
    }

    const result = streamText({
      model: cadetAgent.model,
      system: cadetAgent.system,
      messages: await convertToModelMessages(messages),
      tools: chatTools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text }) => {
        // Persist assistant response
        try {
          const client = createControlClient();
          await client.callReducer("save_chat_message", [
            `msg_${Date.now().toString(36)}`,
            session.operatorId,
            "default",
            "assistant",
            text,
            "{}",
          ]);
        } catch { /* best-effort */ }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return apiError(error, 500);
  }
}
