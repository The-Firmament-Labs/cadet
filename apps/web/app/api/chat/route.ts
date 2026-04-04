import { after } from "next/server";
import { streamText, stepCountIs, type UIMessage, convertToModelMessages } from "ai";
import { parseSessionFromRequest } from "@/lib/auth";
import { chatTools, withToolContext } from "@/lib/chat-tools";
import { cloudAgentCatalog } from "@/lib/cloud-agents";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiUnauthorized } from "@/lib/api-response";
import { fenceContext } from "@/lib/sanitize";
import { openai } from "@ai-sdk/openai";

const cadetAgent = cloudAgentCatalog.find((a) => a.id === "cadet")!;

// Dev: use OpenAI directly when AI Gateway isn't available
function getDevModel() {
  if (process.env.NODE_ENV === "development" && process.env.OPENAI_API_KEY) {
    return openai("gpt-4o-mini");
  }
  return undefined;
}

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
    const modelMessages = await convertToModelMessages(messages);
    const systemPrompt = [
      cadetAgent.system,
      journalPrompt,
      dbContext,
      refContext,
    ].filter(Boolean).join("\n\n");

    // Capture operatorId for onFinish (which runs outside withToolContext scope)
    const opId = session.operatorId;

    const result = withToolContext(toolCtx, () =>
      streamText({
        model: getDevModel() ?? modelId,
        system: systemPrompt,
        messages: modelMessages,
        tools: chatTools,
        stopWhen: stepCountIs(5),
      }),
    );

    // Post-stream processing runs in background via after()
    after(async () => {
      try {
        const text = await result.text;
        const toolCalls = await result.toolCalls;
        const toolNames = toolCalls?.map((tc: { toolName: string }) => tc.toolName) ?? [];
        const taxonomy = await import("@/lib/agent-runtime/message-taxonomy");

        await taxonomy.storeAgentResponse(opId, text, toolNames).catch(() => {});

        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const tcObj = tc as Record<string, unknown>;
            await taxonomy.storeToolCall(opId, String(tcObj.toolName ?? ""), tcObj.args, undefined).catch(() => {});
          }

          const handoff = toolCalls.find((tc: Record<string, unknown>) => tc.toolName === "handoff_to_agent");
          if (handoff) {
            const hArgs = (handoff as Record<string, unknown>).args as Record<string, string> | undefined;
            if (hArgs) {
              await taxonomy.storeHandoff(opId, "cadet", hArgs.agentId ?? "", hArgs.goal ?? "", handoffSummary.slice(0, 500), `run_${Date.now().toString(36)}`).catch(() => {});
            }
          }
        }

        const { executeHooks } = await import("@/lib/agent-runtime/hooks");
        await executeHooks("prompt:after", { event: "prompt:after", operatorId: opId, prompt: text.slice(0, 200) }).catch(() => {});

        if (toolNames.length > 0) {
          const { addLogEntry } = await import("@/lib/agent-runtime/mission-journal");
          await addLogEntry(opId, `Used tools: ${toolNames.join(", ")}`).catch(() => {});
        }

        // --- RLVR signal emission for chat-path responses ---
        try {
          const client = createControlClient();
          const hasOutput = text.length > 0;
          const rlvrSignals = {
            compile_success: null,
            tests_passed: null,
            deploy_success: null,
            user_feedback: null,
            task_completed: hasOutput,
            exit_code: hasOutput ? 0 : 1,
          };
          const signals = [rlvrSignals.task_completed].filter((s): s is boolean => s !== null);
          const composite = signals.length > 0
            ? signals.reduce((sum, s) => sum + (s ? 1.0 : 0.0), 0) / signals.length
            : 0.5;
          const scoreId = `rlvr_chat_${Date.now().toString(36)}`;
          const trajId = `traj_chat_${Date.now().toString(36)}`;

          // Log trajectory
          await client.callReducer("log_trajectory", [
            trajId, `run_chat_${Date.now().toString(36)}`, "step_chat",
            "cadet", "act", userText.slice(0, 500),
            "", // context_toon — chat path doesn't use TOON
            text.slice(0, 2000), JSON.stringify(toolNames),
            hasOutput, 0,
          ]).catch(() => {});

          // Record RLVR score
          await client.callReducer("record_trajectory_score", [
            scoreId, trajId, `run_chat_${Date.now().toString(36)}`,
            composite, composite, composite, composite, composite,
            1.0, // surprise = cold start
            "rlvr", "", `RLVR chat: task_completed=${hasOutput}`,
            JSON.stringify(rlvrSignals),
          ]).catch(() => {});
        } catch { /* RLVR is best-effort */ }
      } catch { /* all post-stream work is best-effort */ }
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return apiError(error, 500);
  }
}
