import { requireOperatorApiSession } from "@/lib/auth";
import { resolveApprovalRecord } from "@/lib/durable-approval";
import { getServerEnv } from "@/lib/env";
import { apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const { approvalId, approved, comment } = (await request.json()) as {
      approvalId: string;
      approved: boolean;
      comment?: string;
    };

    if (!approvalId || typeof approved !== "boolean") {
      return apiError("approvalId and approved (boolean) are required", 400);
    }

    // Update SpacetimeDB record
    await resolveApprovalRecord(approvalId, {
      approved,
      comment,
      operatorId: operatorId!,
    });

    // Resume the paused workflow hook if Workflow DevKit is enabled
    if (getServerEnv().workflowEnabled) {
      try {
        const { resumeHook } = await import("workflow/api");
        await resumeHook(approvalId, { approved, comment, operatorId: operatorId! });
      } catch {
        // Hook may not exist if this approval wasn't from a durable workflow
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
