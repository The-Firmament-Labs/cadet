import { retryWorkflowRun } from "../../../../../lib/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  const result = await retryWorkflowRun(runId);
  return Response.json({ ok: true, result });
}
