import { requireOperatorApiSession } from "../../../../../lib/auth";
import { resolveApprovalFromPayload } from "../../../../../lib/server";
import { getServerEnv } from "../../../../../lib/env";
import { apiError } from "../../../../../lib/api-response";

export async function POST(
  request: Request,
  context: { params: Promise<{ approvalId: string }> }
) {
  const { unauthorized, authToken, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { approvalId } = await context.params;

  try {
    const payload = await request.json().catch(() => ({}));
    const result = await resolveApprovalFromPayload(approvalId, payload, authToken);

    // If Workflow DevKit is enabled, also resume any suspended workflow hook
    if (getServerEnv().workflowEnabled) {
      try {
        const { resumeHook } = await import("workflow/api");
        const body = payload as { status?: string; note?: string };
        const approved = body.status === "approved";
        await resumeHook(approvalId, {
          approved,
          comment: body.note ?? "",
          operatorId: operatorId ?? "operator",
        });
      } catch {
        // Hook may not exist if this approval wasn't from a durable workflow
      }
    }

    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 400);
  }
}
