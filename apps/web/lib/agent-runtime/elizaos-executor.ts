/**
 * ElizaOS Runtime Executor
 *
 * Dispatches agent tasks to ElizaOS Cloud (api.elizacloud.ai) and captures
 * the full response for trajectory scoring. Every ElizaOS action feeds the
 * same RLVR pipeline as native Cadet agents.
 *
 * Supports: chat completions, agent invocations, tool calls, and on-chain actions.
 * All responses are logged as trajectories with platform="elizaos".
 */

import { proxyToElizaos, getElizaosProfile } from "../elizaos-auth";
import { createControlClient } from "../server";

export interface ElizaosExecutionResult {
  output: string;
  model: string;
  toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
  tokensUsed: number;
  creditsUsed: number;
  success: boolean;
  raw: unknown;
}

/**
 * Execute a prompt via ElizaOS Cloud chat completions API.
 * Returns structured result for trajectory scoring.
 */
export async function executeElizaosPrompt(opts: {
  accessToken: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  tools?: Array<{ name: string; description: string; parameters: unknown }>;
  affiliateCode?: string;
}): Promise<ElizaosExecutionResult> {
  const { accessToken, prompt, systemPrompt, tools, affiliateCode } = opts;
  const model = opts.model ?? "google/gemini-2.5-flash";

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const result = await proxyToElizaos({
    path: "/v1/chat/completions",
    method: "POST",
    body: {
      model,
      messages,
      ...(tools && tools.length > 0 ? {
        tools: tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      } : {}),
    },
    accessToken,
    affiliateCode,
  });

  if (result.status !== 200 || !result.body) {
    return {
      output: `ElizaOS API error: ${result.status}`,
      model,
      toolCalls: [],
      tokensUsed: 0,
      creditsUsed: 0,
      success: false,
      raw: result.body,
    };
  }

  const body = result.body as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      };
    }>;
    usage?: { total_tokens?: number };
    credits_used?: number;
  };

  const choice = body.choices?.[0]?.message;
  const output = choice?.content ?? "";
  const toolCalls = (choice?.tool_calls ?? []).map((tc) => ({
    name: tc.function.name,
    input: JSON.parse(tc.function.arguments || "{}"),
    output: null as unknown,
  }));

  return {
    output,
    model,
    toolCalls,
    tokensUsed: body.usage?.total_tokens ?? 0,
    creditsUsed: body.credits_used ?? 0,
    success: true,
    raw: body,
  };
}

/**
 * Execute an ElizaOS agent task and record the trajectory.
 * This is the main entry point called from durable-agent actStep.
 */
export async function executeAndTrackElizaos(opts: {
  runId: string;
  agentId: string;
  goal: string;
  accessToken: string;
  model?: string;
  systemPrompt?: string;
  affiliateCode?: string;
}): Promise<{
  stage: string;
  model: string;
  goal: string;
  responseLength: number;
  toolCallCount: number;
  output: string;
  creditsUsed: number;
}> {
  const { runId, agentId, goal, accessToken, model, systemPrompt, affiliateCode } = opts;

  const result = await executeElizaosPrompt({
    accessToken,
    model,
    prompt: goal,
    systemPrompt,
    affiliateCode,
  });

  // Log trajectory to SpacetimeDB
  const client = createControlClient();
  const trajId = `traj_elizaos_${runId}_${Date.now().toString(36)}`;

  try {
    await client.callReducer("log_trajectory", [
      trajId,
      runId,
      `step_elizaos_${runId}`,
      agentId,
      "act",
      goal.slice(0, 500),
      "", // context_toon
      result.output.slice(0, 2000),
      JSON.stringify(result.toolCalls.map((tc) => tc.name)),
      result.success,
      0, // duration_ms (not tracked at this level)
    ]);
  } catch { /* best-effort */ }

  // Record trajectory score with ElizaOS-specific RLVR signals
  try {
    const scoreId = `rlvr_elizaos_${runId}_${Date.now().toString(36)}`;
    const rlvrSignals = {
      compile_success: null,
      tests_passed: null,
      deploy_success: null,
      user_feedback: null,
      task_completed: result.success,
      exit_code: result.success ? 0 : 1,
      platform: "elizaos",
      model: result.model,
      credits_used: result.creditsUsed,
      tool_calls: result.toolCalls.length,
    };
    const composite = result.success ? 0.8 : 0.2; // Base score, refined by judge later

    await client.callReducer("record_trajectory_score", [
      scoreId,
      trajId,
      runId,
      composite, composite, composite, composite, composite,
      1.0, // surprise (cold start)
      "rlvr",
      result.model,
      `RLVR [elizaos]: ${result.toolCalls.length} tools, ${result.tokensUsed} tokens`,
      JSON.stringify(rlvrSignals),
    ]);
  } catch { /* best-effort */ }

  // Track credit usage
  try {
    if (result.creditsUsed > 0) {
      await client.callReducer("record_user_interaction", [
        `elizaos_usage_${Date.now().toString(36)}`,
        agentId,
        agentId,
        "elizaos",
        "outbound",
        `${result.model}: ${goal.slice(0, 100)} (${result.creditsUsed} credits)`,
        "",
        runId,
        result.success ? "positive" : "negative",
      ]);
    }
  } catch { /* best-effort */ }

  return {
    stage: "act",
    model: result.model,
    goal,
    responseLength: result.output.length,
    toolCallCount: result.toolCalls.length,
    output: result.output.slice(0, 2000),
    creditsUsed: result.creditsUsed,
  };
}
