import { after } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createControlClient } from "@/lib/server";
import { cloudAgentCatalog } from "@/lib/cloud-agents";
import { sqlEscape } from "@/lib/sql";
import { shouldRetry } from "@/lib/queue-retry";
import { handleQueueCallback } from "@/lib/queue";
import type { AgentLaunchMessage } from "@/lib/queue";
import {
  normalizeJobRequest,
  seedWorkflowFromGoal,
  executeEdgeAgent,
  nextWorkflowStage,
  ownerExecutionForStage,
  createStepId,
  parseControlPlaneTarget,
  parseMessageChannel,
  parseRunnerPresenceStatus,
} from "@starbridge/core";

const cloudTarget = parseControlPlaneTarget("cloud");
const systemChannel = parseMessageChannel("system");

export const POST = handleQueueCallback(
  async (message: AgentLaunchMessage) => {
    const { jobId, agentId, runId, operatorId, attempt } = message;

    console.log(
      `[queue/agent-launch] Processing job=${jobId} agent=${agentId} run=${runId} attempt=${attempt}/${message.maxRetries}`,
    );

    // Look up agent manifest
    const manifest = cloudAgentCatalog.find((a) => a.id === agentId);
    if (!manifest) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const client = createControlClient();

    if (
      !getServerEnv().sandboxExecutionEnabled &&
      manifest.deployment.execution === "vercel-sandbox"
    ) {
      await client.markJobFailed(jobId, "Sandbox-backed agents are disabled in APP_STORE_SAFE_MODE");
      console.warn(`[queue/agent-launch] Skipping sandbox-backed agent ${agentId} in APP_STORE_SAFE_MODE`);
      return;
    }

    // Create sandbox for vercel-sandbox agents
    let sandboxId: string | undefined;
    if (manifest.deployment.execution === "vercel-sandbox") {
      const { getVercelAccessToken } = await import("@/lib/token-store");
      const { createSandbox } = await import("@/lib/sandbox");
      const vercelToken = await getVercelAccessToken(operatorId);
      if (vercelToken) {
        const sandbox = await createSandbox({
          vercelAccessToken: vercelToken,
          operatorId,
          agentId,
          runId,
          environment: manifest.deployment.sandbox,
        });
        sandboxId = sandbox.sandboxId;
        console.log(`[queue/agent-launch] Sandbox created: ${sandboxId}`);
      } else {
        console.warn(`[queue/agent-launch] No Vercel token for operator ${operatorId} — sandbox not created`);
      }
    }

    // Retrieve the job
    const jobs = (await client.sql(
      `SELECT * FROM job WHERE job_id = '${sqlEscape(jobId)}'`,
    )) as Record<string, unknown>[];

    if (jobs.length === 0) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = normalizeJobRequest({
      agentId: manifest.id,
      goal: String(jobs[0]!.goal ?? ""),
      requestedBy: operatorId,
      context: {
        controlPlane: manifest.deployment.controlPlane,
        execution: manifest.deployment.execution,
        workflow: manifest.deployment.workflow,
      },
    });

    // Seed the workflow
    const seed = seedWorkflowFromGoal(manifest, {
      channel: systemChannel,
      channelThreadId: `system_${jobId}`,
      requestedBy: operatorId,
      actor: operatorId,
      goal: job.goal,
      priority: job.priority,
      triggerSource: "queue:agent-launch",
      context: job.context,
      createId: (prefix) => `${prefix}_${jobId}`,
    });

    await client.ingestMessage({
      threadId: seed.message.threadId,
      channel: seed.message.channel,
      channelThreadId: seed.thread.channelThreadId,
      title: seed.thread.title,
      eventId: seed.message.eventId,
      runId: seed.message.runId,
      direction: seed.message.direction,
      actor: seed.message.actor,
      content: seed.message.content,
      metadata: { ...seed.message.metadata, jobId },
    });
    await client.startWorkflowRun(seed.run);
    await client.enqueueWorkflowStep(seed.routeStep);

    // Execute route triage
    const runnerId = `${agentId}-route@cloud`;
    await client.upsertPresence(agentId, runnerId, cloudTarget, parseRunnerPresenceStatus("running"));
    await client.claimWorkflowStep(seed.routeStep.stepId, manifest.deployment.execution, runnerId);

    const routeResult = executeEdgeAgent(manifest, job);
    await client.completeWorkflowStep(seed.routeStep.stepId, {
      summary: routeResult.summary,
      actions: routeResult.actions,
      browserRequired: seed.browser.required,
      browserMode: seed.browser.mode,
      nextStage: nextWorkflowStage("route"),
    });

    // Enqueue plan step
    const planStage = nextWorkflowStage("route");
    if (planStage) {
      const planStepId = createStepId(seed.run.runId, planStage);
      await client.enqueueWorkflowStep({
        stepId: planStepId,
        runId: seed.run.runId,
        agentId: manifest.id,
        stage: planStage,
        ownerExecution: ownerExecutionForStage(manifest, planStage, seed.browser.required),
        input: {
          jobId,
          runId: seed.run.runId,
          threadId: seed.thread.threadId,
          channel: systemChannel,
          goal: job.goal,
          context: job.context,
          browserRequired: seed.browser.required,
          browserMode: seed.browser.mode,
          routeSummary: routeResult.summary,
          routeActions: routeResult.actions,
        },
        dependsOnStepId: seed.routeStep.stepId,
      });
    }

    await client.remember(manifest.id, manifest.memory.namespace, routeResult.memoryNote);
    await client.markJobCompleted(jobId, `Workflow ${seed.run.runId} seeded via queue`);

    after(() => {
      client.upsertPresence(agentId, runnerId, cloudTarget, parseRunnerPresenceStatus("idle")).catch(() => {});
    });

    console.log(`[queue/agent-launch] Job ${jobId} completed — workflow ${seed.run.runId} seeded`);
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (error, metadata) => {
      const attempt = (metadata as unknown as { deliveryCount: number }).deliveryCount ?? 0;
      const decision = shouldRetry(attempt, error);

      if (!decision.retry) {
        console.error(`[queue/agent-launch] Giving up: ${decision.reason}`);
        return { acknowledge: true };
      }

      console.warn(`[queue/agent-launch] ${decision.reason}`);
      return { afterSeconds: Math.ceil(decision.delayMs / 1000) };
    },
  },
);
