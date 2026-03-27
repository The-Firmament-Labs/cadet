import { loadRunDetails } from "../../../../lib/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  const result = await loadRunDetails(runId);
  return Response.json({ ok: true, result });
}
