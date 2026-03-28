import { requireOperatorApiSession } from "../../../../../lib/auth";
import { retryWorkflowRun } from "../../../../../lib/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { runId } = await context.params;
  const result = await retryWorkflowRun(runId, authToken);
  return Response.json({ ok: true, result });
}
