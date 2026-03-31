import { requireOperatorApiSession } from "@/lib/auth";
import { dispatchJobFromPayload } from "@/lib/server";
import { apiError } from "@/lib/api-response";

export async function POST(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  try {
    const body = await request.json();
    const { goal, context: ctx } = body as { goal: string; context?: Record<string, unknown> };
    if (!goal) return apiError("goal is required", 400);

    const result = await dispatchJobFromPayload({ agentId, goal, context: ctx }, authToken);
    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 400);
  }
}
