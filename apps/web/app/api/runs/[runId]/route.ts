import { requireOperatorApiSession } from "../../../../lib/auth";
import { loadRunDetails } from "../../../../lib/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { runId } = await context.params;
  const result = await loadRunDetails(runId, authToken);
  return Response.json({ ok: true, result });
}
