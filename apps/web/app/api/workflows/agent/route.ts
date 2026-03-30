import { requireOperatorApiSession } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { apiError, apiUnavailable } from "@/lib/api-response";

export async function POST(request: Request) {
  const { unauthorized, authToken, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  if (!getServerEnv().workflowEnabled) {
    return apiUnavailable("Workflow DevKit is not enabled");
  }

  try {
    const { start } = await import("workflow/api");
    const { agentWorkflow } = await import("@/lib/durable-agent");

    const payload = await request.json();
    const { jobId, agentId, runId, goal, model } = payload as {
      jobId: string;
      agentId: string;
      runId: string;
      goal: string;
      model?: string;
    };

    if (!jobId || !agentId || !runId || !goal) {
      return apiError("jobId, agentId, runId, and goal are required", 400);
    }

    const run = await start(agentWorkflow, [{
      jobId,
      agentId,
      runId,
      operatorId: operatorId!,
      goal,
      model,
    }]);

    return Response.json({
      ok: true,
      workflowRunId: run.runId,
      runId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    if (message.includes("Cannot find module") || message.includes("MODULE_NOT_FOUND")) {
      return apiUnavailable("Workflow DevKit is enabled but the 'workflow' package could not be loaded");
    }
    return apiError(message, 500);
  }
}
