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

    // Resolve @ references in the latest user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    let refContext = "";
    if (lastUserMsg) {
      const textParts = lastUserMsg.parts.filter((p) => p.type === "text");
      const rawText = textParts.map((p) => (p as { text: string }).text).join("\n");
      if (rawText.includes("@")) {
        try {
          const { resolveRefs } = await import("@/lib/agent-runtime/context-refs");
          const resolved = await resolveRefs(rawText);
          if (resolved.context.length > 0) {
            refContext = "\n\n---\n## Referenced Context\n" +
              resolved.context.map((r) => r.content).join("\n\n");
          }
        } catch { /* ref resolution is best-effort */ }
      }
    }
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

    // Load Mission Journal for operator personality
    let journalPrompt = "";
    try {
      const { loadMissionJournal, renderJournalForPrompt } = await import("@/lib/agent-runtime/mission-journal");
      const journal = await loadMissionJournal(session.operatorId);
      journalPrompt = renderJournalForPrompt(journal);
    } catch { /* journal unavailable */ }

    // Fire session hooks
    try {
      const { executeHooks } = await import("@/lib/agent-runtime/hooks");
      await executeHooks("prompt:before", {
        event: "prompt:before",
        operatorId: session.operatorId,
        prompt: lastUserMsg?.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n"),
      });
    } catch { /* hooks are best-effort */ }

    const result = streamText({
      model: cadetAgent.model,
      system: [cadetAgent.system, journalPrompt, refContext].filter(Boolean).join("\n\n"),
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

        // Fire post-prompt hooks
        try {
          const { executeHooks } = await import("@/lib/agent-runtime/hooks");
          await executeHooks("prompt:after", {
            event: "prompt:after",
            operatorId: session.operatorId,
            prompt: text.slice(0, 200),
          });
        } catch { /* hooks are best-effort */ }

        // Auto-learn: add notable facts to Ship's Log
        if (text.length > 100) {
          try {
            const { addLogEntry } = await import("@/lib/agent-runtime/mission-journal");
            // Only log if the response contains a tool call result or significant action
            if (text.includes("created") || text.includes("deployed") || text.includes("fixed") || text.includes("PR")) {
              const summary = text.slice(0, 120).replace(/\n/g, " ");
              await addLogEntry(session.operatorId, summary);
            }
          } catch { /* best-effort */ }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return apiError(error, 500);
  }
}
