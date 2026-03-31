import { requireOperatorApiSession } from "@/lib/auth";
import { loadRunDetails } from "@/lib/server";
import { apiError, apiNotFound } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { runId } = await context.params;
  try {
    const detail = await loadRunDetails(runId, authToken);
    const completedSteps = detail.steps.filter((s) => String(s.status) === "completed");
    const lastStep = completedSteps[completedSteps.length - 1];

    return Response.json({
      ok: true,
      runId,
      status: detail.run.status,
      stage: detail.run.currentStage,
      output: lastStep ? JSON.parse(lastStep.outputJson ?? "{}") : null,
      toolCalls: detail.toolCalls,
      messageCount: detail.messages.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unknown")) return apiNotFound(error.message);
    return apiError(error, 500);
  }
}
