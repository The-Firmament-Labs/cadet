import { resolveApprovalFromPayload } from "../../../../../lib/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await context.params;
  const payload = await request.json().catch(() => ({}));
  const result = await resolveApprovalFromPayload(approvalId, payload);
  return Response.json({ ok: true, result });
}
