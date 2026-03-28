import { requireOperatorApiSession } from "../../../../../lib/auth";
import { resolveApprovalFromPayload } from "../../../../../lib/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> }
) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { approvalId } = await context.params;
  const payload = await request.json().catch(() => ({}));
  const result = await resolveApprovalFromPayload(approvalId, payload, authToken);
  return Response.json({ ok: true, result });
}
