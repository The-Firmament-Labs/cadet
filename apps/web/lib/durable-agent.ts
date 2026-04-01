import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { sanitizeContext } from "@/lib/sanitize";
import { streamText, stepCountIs } from "ai";

// ---------------------------------------------------------------------------
// Durable step functions — each runs as a retryable workflow step
// ---------------------------------------------------------------------------

async function routeStep(jobId: string, agentId: string) {
  "use step";
  const client = createControlClient();
  const jobs = (await client.sql(
    `SELECT * FROM job WHERE job_id = '${sqlEscape(jobId)}'`,
  )) as Record<string, unknown>[];

  if (jobs.length === 0) throw new Error(`Job ${jobId} not found`);

  await client.callReducer("update_run_stage", [jobs[0]!.run_id as string, "route"]);
  return { job: jobs[0], stage: "route" };
}

async function planStep(runId: string, agentId: string, goal: string, gatheredContext: string, operatorId: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "plan"]);

  // Generate a lightweight plan using a fast model
  try {
    const planResult = await streamText({
      model: "anthropic/claude-haiku-4.5",
      system: "You are a task planner. Given a goal and context, output a concise numbered plan (3-7 steps). Focus on what files to modify, what to check, and verification steps. Be specific. No preamble.",
      prompt: `Goal: ${goal}\n\nContext:\n${gatheredContext.slice(0, 2000)}`,
      stopWhen: stepCountIs(1),
    });
    const planText = await planResult.text;

    // Store the plan as both a workflow step and agent thinking
    await client.callReducer("record_tool_call", [
      `plan_${runId}`,
      runId,
      "plan_generation",
      JSON.stringify({ goal }),
      planText.slice(0, 2000),
      "completed",
      Date.now(),
    ]);

    // Store as agent_thinking for taxonomy-based context retrieval
    try {
      const { storeAgentThinking } = await import("./agent-runtime/message-taxonomy");
      await storeAgentThinking(operatorId, `Plan for "${goal.slice(0, 50)}":\n${planText.slice(0, 500)}`, runId, agentId);
    } catch { /* best-effort */ }

    return { stage: "plan", runId, agentId, goal, plan: planText };
  } catch {
    // Plan generation is best-effort — continue without plan
    return { stage: "plan", runId, agentId, goal, plan: "" };
  }
}

async function gatherStep(runId: string, agentId: string, goal: string, operatorId: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "gather"]);

  const goalLower = goal.toLowerCase();
  const parts: string[] = [];
  const sources: string[] = [];

  // Detect follow-up / debug intent and use specialized context builders
  const isFollowUp = /\b(what you just|that fix|that change|what was just|deploy what|test what|for that)\b/i.test(goal);
  const isDebug = /\b(debug|what went wrong|why did.*fail|what happened|error|broke)\b/i.test(goal);

  if (isFollowUp) {
    try {
      const { buildFollowUpContext } = await import("./agent-runtime/message-taxonomy");
      const followUp = await buildFollowUpContext(operatorId);
      if (followUp) { parts.push(followUp); sources.push("follow-up-context"); }
    } catch { /* best-effort */ }
  }

  if (isDebug) {
    try {
      // Find the most recent failed run to debug
      const failedRuns = (await client.sql(
        `SELECT run_id FROM workflow_run WHERE status = 'failed' ORDER BY updated_at_micros DESC LIMIT 1`,
      )) as Record<string, unknown>[];
      const debugRunId = failedRuns.length > 0 ? String(failedRuns[0]!.run_id) : undefined;

      const { buildDebugContext } = await import("./agent-runtime/message-taxonomy");
      const debug = await buildDebugContext(operatorId, debugRunId);
      if (debug) { parts.push(debug); sources.push("debug-context"); }
    } catch { /* best-effort */ }
  }

  // Always also run the general context assembly
  try {
    const { assembleContext } = await import("./agent-runtime/context-assembly");
    const assembled = await assembleContext({
      operatorId,
      goal,
      tokenBudget: isFollowUp || isDebug ? 2000 : 3000, // less budget if specialized context already loaded
      includeChat: true,
      includeRuns: true,
      includeMemory: true,
      includeLearnings: true,
      includeSessions: true,
      chatTurns: 6,
    });
    if (assembled.plainSummary) { parts.push(assembled.plainSummary); sources.push(...assembled.sources); }
  } catch { /* best-effort */ }

  return {
    stage: "gather",
    contextItems: sources.length,
    contextContent: parts.join("\n\n"),
    sources,
  };
}

async function actStep(
  runId: string,
  model: string,
  instructions: string,
  goal: string,
  execution?: string,
  sandboxContext?: { sandboxId?: string; vercelAccessToken?: string; repoUrl?: string; branch?: string; apiKey?: string },
) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "act"]);

  // Branch by execution target
  if (execution === "vercel-sandbox" && sandboxContext?.sandboxId && sandboxContext?.vercelAccessToken) {
    // Use the full agent runtime executor with mission brief
    try {
      const { executeAgentPrompt } = await import("./agent-runtime/executor");
      const result = await executeAgentPrompt({
        sandboxId: sandboxContext.sandboxId,
        vercelAccessToken: sandboxContext.vercelAccessToken,
        agentId: "claude-code",
        prompt: goal,
        sessionId: runId, // use runId as session for tracking
        operatorId: runId.replace("run_", ""),
        repoUrl: sandboxContext.repoUrl,
        branch: sandboxContext.branch,
        apiKey: sandboxContext.apiKey,
      });

      // Auto-create PR if repo was cloned and agent succeeded
      let prUrl: string | undefined;
      if (sandboxContext.repoUrl && result.exitCode === 0) {
        try {
          const { createPrFromSandbox } = await import("./github-pr");
          const pr = await createPrFromSandbox({
            sandboxId: sandboxContext.sandboxId,
            vercelAccessToken: sandboxContext.vercelAccessToken,
            operatorId: runId.replace("run_", ""),
            repoUrl: sandboxContext.repoUrl,
            baseBranch: sandboxContext.branch ?? "main",
            goal,
            runId,
          });
          prUrl = pr?.prUrl;
        } catch { /* PR creation is best-effort */ }
      }

      return {
        stage: "act",
        model: "claude-code",
        goal,
        responseLength: result.output.length,
        toolCallCount: result.events.filter((e) => e.type === "tool-call").length,
        exitCode: result.exitCode,
        prUrl,
        verification: result.verification,
        output: result.output.slice(0, 2000), // keep summary for later stages
      };
    } catch (error) {
      // Fallback to direct sandbox command
      const { runCodingAgent } = await import("@/lib/sandbox");
      const codingResult = await runCodingAgent({
        sandboxId: sandboxContext.sandboxId,
        vercelAccessToken: sandboxContext.vercelAccessToken,
        goal,
        repoUrl: sandboxContext.repoUrl,
        branch: sandboxContext.branch,
        apiKey: sandboxContext.apiKey,
      });
      return {
        stage: "act",
        model: "claude-code",
        goal,
        responseLength: codingResult.output.length,
        toolCallCount: 0,
        exitCode: codingResult.exitCode,
        output: codingResult.output.slice(0, 2000),
      };
    }
  }

  if (execution === "local-docker") {
    const env = (await import("@/lib/env")).getServerEnv();
    const res = await fetch(`${env.controlPlaneUrl.replace("localhost:3001", "localhost:3010")}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: runId.replace("run_", ""), goal, model }),
    });
    const result = await res.json();
    return { stage: "act", model, goal, responseLength: JSON.stringify(result).length, toolCallCount: 0, output: JSON.stringify(result).slice(0, 2000) };
  }

  // Default: AI SDK streamText (edge/cloud agents)
  const result = await streamText({
    model,
    system: instructions,
    prompt: goal,
    stopWhen: stepCountIs(10),
  });

  const text = await result.text;
  const toolCalls = await result.toolCalls ?? [];

  for (const tc of toolCalls) {
    await client.callReducer("record_tool_call", [
      `tc_${runId}_${Date.now().toString(36)}`,
      runId,
      (tc as Record<string, unknown>).toolName ?? "unknown",
      JSON.stringify((tc as Record<string, unknown>).args ?? {}),
      "",
      "completed",
      Date.now(),
    ]);
  }

  return { stage: "act", model, goal, responseLength: text.length, toolCallCount: toolCalls.length, output: text.slice(0, 2000) };
}

async function verifyStep(
  runId: string,
  actResult: { responseLength: number; toolCallCount: number; exitCode?: number; verification?: { passed: boolean; results: string[] } },
) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "verify"]);

  // Check agent-runtime verification results if available
  if (actResult.verification) {
    if (!actResult.verification.passed) {
      console.warn(`[workflow/verify] Run ${runId}: verification failed — ${actResult.verification.results.filter((r) => r.startsWith("FAIL")).join("; ")}`);
    }
    return {
      stage: "verify",
      verified: actResult.verification.passed,
      responseLength: actResult.responseLength,
      toolCallCount: actResult.toolCallCount,
      verificationResults: actResult.verification.results,
    };
  }

  // Fallback: check basic output quality
  const verified = actResult.responseLength > 0 && (actResult.exitCode === undefined || actResult.exitCode === 0);
  if (!verified) {
    console.warn(`[workflow/verify] Run ${runId}: agent produced empty response or non-zero exit`);
  }

  return { stage: "verify", verified, responseLength: actResult.responseLength, toolCallCount: actResult.toolCallCount };
}

async function summarizeStep(
  runId: string,
  operatorId: string,
  agentId: string,
  channel?: string,
  channelThreadId?: string,
  actSummary?: string,
  prUrl?: string,
  branch?: string,
) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "summarize"]);

  const summary = actSummary ?? `Run ${runId} completed.`;

  // Deliver result using message taxonomy — structured for context extraction
  if (channel === "system") {
    // System-triggered runs don't notify anyone
  } else if (channel === "web" || !channel) {
    try {
      const { storeAgentResult, storeSystemEvent } = await import("./agent-runtime/message-taxonomy");
      const completionMsg = prUrl ? `${summary}\n\nPR created: ${prUrl}` : summary;
      await storeAgentResult(operatorId, agentId, runId, completionMsg, prUrl, { branch });
      await storeSystemEvent(operatorId, `Run ${runId} completed`, runId, { status: "completed", prUrl, branch });
    } catch { /* best-effort */ }
  } else if (channelThreadId) {
    // Reply to the originating platform (Slack, Discord, etc.)
    try {
      const { replyToOrigin } = await import("./bot-reply");
      await replyToOrigin({ channel, channelThreadId, summary });
    } catch { /* best-effort */ }
  }

  return { stage: "summarize" };
}

async function learnStep(runId: string, agentId: string, goal: string, actOutput?: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "learn"]);

  // Extract learnings from the run and store in memory
  if (actOutput && actOutput.length > 50) {
    try {
      // Use a fast model to extract key learnings
      const learnResult = await streamText({
        model: "anthropic/claude-haiku-4.5",
        system: "Extract 1-3 key learnings from this agent run output. Each learning should be a single sentence that would be useful for future runs on the same codebase. Output only the learnings, one per line. If nothing notable, output 'none'.",
        prompt: `Goal: ${goal}\n\nOutput:\n${actOutput.slice(0, 1500)}`,
        stopWhen: stepCountIs(1),
      });
      const learnings = await learnResult.text;

      if (learnings.toLowerCase().trim() !== "none" && learnings.length > 10) {
        await client.callReducer("upsert_memory_document", [
          `learn_${runId}`,
          agentId,
          "learnings",
          `Learnings from run ${runId}: ${goal.slice(0, 50)}`,
          sanitizeContext(learnings, 500),
          "agent-learning",
          JSON.stringify({ runId, agentId }),
        ]);
      }
    } catch { /* learning extraction is best-effort */ }
  }

  await client.callReducer("update_run_status", [runId, "completed"]);
  return { stage: "learn", completed: true };
}

// ---------------------------------------------------------------------------
// Main durable workflow
// ---------------------------------------------------------------------------

export interface AgentWorkflowResult {
  runId: string;
  agentId: string;
  stages: Array<{ stage: string }>;
  completed: boolean;
}

export async function agentWorkflow(params: {
  jobId: string;
  agentId: string;
  runId: string;
  operatorId: string;
  goal: string;
  model?: string;
  execution?: string;
  channel?: string;
  channelThreadId?: string;
  conversationContext?: string;
  sandboxContext?: {
    sandboxId?: string;
    vercelAccessToken?: string;
    repoUrl?: string;
    branch?: string;
    apiKey?: string;
  };
}): Promise<AgentWorkflowResult> {
  "use workflow";

  const { jobId, agentId, runId, operatorId, goal, model, execution, channel, channelThreadId, conversationContext, sandboxContext } = params;

  // Stage 1: Route — triage the job
  const routeResult = await routeStep(jobId, agentId);

  // Stage 2: Gather — retrieve context from SpacetimeDB (memories, runs, tools, journal)
  const gatherResult = await gatherStep(runId, agentId, goal, operatorId);

  // Combine gathered context with conversation context passed from chat
  const fullContext = [conversationContext, gatherResult.contextContent].filter(Boolean).join("\n\n");

  // Stage 3: Plan — generate execution plan using gathered context
  const planResult = await planStep(runId, agentId, goal, fullContext, operatorId);

  // Build rich instructions from gathered context + plan
  const instructions = [
    `You are agent ${agentId}. Execute the following goal.`,
    planResult.plan ? `\n## Plan\n${planResult.plan}` : "",
    fullContext ? `\n## Context\n${fullContext.slice(0, 3000)}` : "",
  ].filter(Boolean).join("\n");

  // Stage 4: Act — execute agent actions with full context
  const actResult = await actStep(
    runId,
    model ?? "anthropic/claude-sonnet-4.5",
    instructions,
    goal,
    execution,
    sandboxContext,
  );

  // Stage 5: Verify — check results using real verification
  const verifyResult = await verifyStep(runId, actResult);

  // Stage 6: Summarize — deliver result back to user (web AND platforms)
  const actSummary = `Completed: ${goal}${(actResult as Record<string, unknown>).prUrl ? `\nPR: ${(actResult as Record<string, unknown>).prUrl}` : ""}`;
  const summarizeResult = await summarizeStep(
    runId, operatorId, agentId, channel ?? "web", channelThreadId,
    actSummary,
    (actResult as Record<string, unknown>).prUrl as string | undefined,
    sandboxContext?.branch,
  );

  // Stage 7: Learn — extract and store learnings
  const learnResult = await learnStep(runId, agentId, goal, (actResult as Record<string, unknown>).output as string | undefined);

  return {
    runId,
    agentId,
    stages: [routeResult, planResult, gatherResult, actResult, verifyResult, summarizeResult, learnResult],
    completed: true,
  };
}
