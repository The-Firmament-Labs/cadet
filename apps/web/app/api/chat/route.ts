import { after } from "next/server";
import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { parseSessionFromRequest } from "@/lib/auth";
import { chatTools, withToolContext } from "@/lib/chat-tools";
import { cloudAgentCatalog } from "@/lib/cloud-agents";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiUnauthorized } from "@/lib/api-response";
import { fenceContext } from "@/lib/sanitize";

const cadetAgent = cloudAgentCatalog.find((a) => a.id === "cadet")!;

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

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

    // Extract the latest user message text
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const userText = lastUserMsg?.parts?.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n") ?? "";

    // --- Phase 1: Resolve @ references ---
    let refContext = "";
    if (userText.includes("@")) {
      try {
        const { resolveRefs } = await import("@/lib/agent-runtime/context-refs");
        const resolved = await resolveRefs(userText);
        if (resolved.context.length > 0) {
          refContext = resolved.context
            .map((r) => fenceContext(`@${r.type}:${r.ref}`, r.content))
            .join("\n");
        }
      } catch { /* best-effort */ }
    }

    // --- Phase 2: Assemble SpacetimeDB context ---
    // Pull past conversations, agent results, memories, learnings, active sessions
    let dbContext = "";
    try {
      const { assembleContext } = await import("@/lib/agent-runtime/context-assembly");
      const assembled = await assembleContext({
        operatorId: session.operatorId,
        goal: userText,
        tokenBudget: 3000,
        chatTurns: 8,
      });
      if (assembled.systemBlocks.length > 0) {
        dbContext = assembled.systemBlocks.join("\n");
      }
    } catch { /* best-effort */ }

    // --- Phase 3: Load Mission Journal ---
    let journalPrompt = "";
    try {
      const { loadMissionJournal, renderJournalForPrompt } = await import("@/lib/agent-runtime/mission-journal");
      const journal = await loadMissionJournal(session.operatorId);
      journalPrompt = fenceContext("mission-journal", renderJournalForPrompt(journal));
    } catch { /* best-effort */ }

    // --- Phase 4: Fire hooks ---
    try {
      const { executeHooks } = await import("@/lib/agent-runtime/hooks");
      await executeHooks("prompt:before", {
        event: "prompt:before",
        operatorId: session.operatorId,
        prompt: userText,
      });
    } catch { /* best-effort */ }

    // --- Phase 5: Persist user message with taxonomy (background) ---
    if (lastUserMsg) {
      after(async () => {
        try {
          const { storeUserPrompt } = await import("@/lib/agent-runtime/message-taxonomy");
          await storeUserPrompt(session.operatorId, userText || JSON.stringify(lastUserMsg.parts));
        } catch { /* best-effort */ }
      });
    }

    // --- Phase 6: Set tool context for handoffs ---
    let handoffSummary = "";
    try {
      const { buildHandoffContext } = await import("@/lib/agent-runtime/context-assembly");
      handoffSummary = await buildHandoffContext(session.operatorId, userText);
    } catch { /* best-effort */ }

    const toolCtx = {
      operatorId: session.operatorId,
      conversationSummary: handoffSummary,
      refContext: refContext.slice(0, 1000),
    };

    // --- Phase 7: Select model ---
    let modelId: string = cadetAgent.model;
    try {
      const { getOperatorRouting, selectModel } = await import("@/lib/agent-runtime/provider-routing");
      const prefs = await getOperatorRouting(session.operatorId);
      modelId = selectModel(prefs);
    } catch { /* fall back to default */ }

    // --- Phase 8: Stream response (scoped tool context for concurrency safety) ---
    return withToolContext(toolCtx, () => {
    const systemPrompt = [
      cadetAgent.system,
      journalPrompt,
      dbContext,   // SpacetimeDB assembled context (chat history, runs, memories, learnings)
      refContext,  // @ reference resolved content
    ].filter(Boolean).join("\n\n");

    const result = streamText({
      model: modelId,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: chatTools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text, toolCalls }) => {

        const toolNames = toolCalls?.map((tc: { toolName: string }) => tc.toolName) ?? [];
        const taxonomy = await import("@/lib/agent-runtime/message-taxonomy");

        // Store agent response
        try {
          await taxonomy.storeAgentResponse(session.operatorId, text, toolNames);
        } catch { /* best-effort */ }

        // Store each tool call separately for granular querying
        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            try {
              const typed = tc as { toolName: string; args: unknown };
              await taxonomy.storeToolCall(session.operatorId, typed.toolName, typed.args, undefined);
            } catch { /* best-effort */ }
          }

          // Check if any tool was a handoff — store the A2A context
          const handoff = toolCalls.find((tc: { toolName: string }) => tc.toolName === "handoff_to_agent");
          if (handoff) {
            try {
              const args = (handoff as { args: { agentId: string; goal: string } }).args;
              await taxonomy.storeHandoff(
                session.operatorId, "cadet", args.agentId, args.goal,
                handoffSummary.slice(0, 500),
                `run_${Date.now().toString(36)}`,
              );
            } catch { /* best-effort */ }
          }
        }

        // Fire post-prompt hooks
        try {
          const { executeHooks } = await import("@/lib/agent-runtime/hooks");
          await executeHooks("prompt:after", { event: "prompt:after", operatorId: session.operatorId, prompt: text.slice(0, 200) });
        } catch { /* best-effort */ }

        // Log tool usage to Ship's Log
        if (toolNames.length > 0) {
          try {
            const { addLogEntry } = await import("@/lib/agent-runtime/mission-journal");
            await addLogEntry(session.operatorId, `Used tools: ${toolNames.join(", ")}`);
          } catch { /* best-effort */ }
        }
      },
    });

    return result.toUIMessageStreamResponse();
    }); // end withToolContext
  } catch (error) {
    return apiError(error, 500);
  }
}
