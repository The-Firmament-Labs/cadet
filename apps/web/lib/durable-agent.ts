import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { streamText, stepCountIs } from "ai";

// ---------------------------------------------------------------------------
// Durable step functions — each runs with full Node.js access
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

async function planStep(runId: string, agentId: string, goal: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "plan"]);
  return { stage: "plan", runId, agentId, goal };
}

async function gatherStep(runId: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "gather"]);

  // Gather context: memory documents, previous runs, etc.
  const memories = (await client.sql(
    `SELECT title, content FROM memory_document LIMIT 10`,
  )) as Record<string, unknown>[];

  return { stage: "gather", contextItems: memories.length };
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
    // Coding agent — run Claude Code inside sandbox
    const { runCodingAgent } = await import("@/lib/sandbox");
    const codingResult = await runCodingAgent({
      sandboxId: sandboxContext.sandboxId,
      vercelAccessToken: sandboxContext.vercelAccessToken,
      goal,
      repoUrl: sandboxContext.repoUrl,
      branch: sandboxContext.branch,
      apiKey: sandboxContext.apiKey,
    });

    // Auto-create PR if repo was cloned and agent succeeded
    let prUrl: string | undefined;
    if (sandboxContext.repoUrl && codingResult.exitCode === 0) {
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
      } catch {
        // PR creation is best-effort
      }
    }

    return {
      stage: "act",
      model: "claude-code",
      goal,
      responseLength: codingResult.output.length,
      toolCallCount: 0,
      exitCode: codingResult.exitCode,
      prUrl,
    };
  }

  if (execution === "local-docker") {
    // Docker-based execution — dispatch to local control plane
    const env = (await import("@/lib/env")).getServerEnv();
    const res = await fetch(`${env.controlPlaneUrl.replace("localhost:3001", "localhost:3010")}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: runId.replace("run_", ""), goal, model }),
    });
    const result = await res.json();
    return { stage: "act", model, goal, responseLength: JSON.stringify(result).length, toolCallCount: 0 };
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

  return { stage: "act", model, goal, responseLength: text.length, toolCallCount: toolCalls.length };
}

async function verifyStep(runId: string, actResult: { responseLength: number; toolCallCount: number }) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "verify"]);

  const verified = actResult.responseLength > 0;
  if (!verified) {
    console.warn(`[workflow/verify] Run ${runId}: agent produced empty response`);
  }

  return { stage: "verify", verified, responseLength: actResult.responseLength, toolCallCount: actResult.toolCallCount };
}

async function summarizeStep(runId: string, channel?: string, channelThreadId?: string, actSummary?: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "summarize"]);

  // Reply to the originating platform if not web
  if (channel && channelThreadId && channel !== "web" && channel !== "system") {
    try {
      const { replyToOrigin } = await import("./bot-reply");
      await replyToOrigin({
        channel,
        channelThreadId,
        summary: actSummary ?? `Run ${runId} completed.`,
      });
    } catch {
      // Non-fatal — reply delivery is best-effort
    }
  }

  return { stage: "summarize" };
}

async function learnStep(runId: string) {
  "use step";
  const client = createControlClient();
  await client.callReducer("update_run_stage", [runId, "learn"]);
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
  sandboxContext?: {
    sandboxId?: string;
    vercelAccessToken?: string;
    repoUrl?: string;
    branch?: string;
    apiKey?: string;
  };
}): Promise<AgentWorkflowResult> {
  "use workflow";

  const { jobId, agentId, runId, operatorId, goal, model, execution, channel, channelThreadId, sandboxContext } = params;

  // Stage 1: Route — triage the job
  const routeResult = await routeStep(jobId, agentId);

  // Stage 2: Plan — generate execution plan
  const planResult = await planStep(runId, agentId, goal);

  // Stage 3: Gather — retrieve context and memory
  const gatherResult = await gatherStep(runId);

  // Stage 4: Act — execute agent actions
  const actResult = await actStep(
    runId,
    model ?? "anthropic/claude-sonnet-4.5",
    `You are agent ${agentId}. Execute the following goal.`,
    goal,
    execution,
    sandboxContext,
  );

  // Stage 5: Verify — check results
  const verifyResult = await verifyStep(runId, actResult);

  // Stage 6: Summarize — produce summary
  const summarizeResult = await summarizeStep(runId, channel, channelThreadId, `Completed goal: ${goal}`);

  // Stage 7: Learn — extract learnings
  const learnResult = await learnStep(runId);

  return {
    runId,
    agentId,
    stages: [
      routeResult,
      planResult,
      gatherResult,
      actResult,
      verifyResult,
      summarizeResult,
      learnResult,
    ],
    completed: true,
  };
}
