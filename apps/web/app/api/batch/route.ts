import { requireOperatorApiSession } from "@/lib/auth";
import { submitBatch, getBatchStatus } from "@/lib/agent-runtime/batch";
import { apiError, apiUnauthorized, apiNotFound } from "@/lib/api-response";

/** GET /api/batch?batchId=xyz — get batch status */
export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");
  if (!batchId) return apiError("batchId query param required", 400);

  const status = await getBatchStatus(batchId);
  if (!status) return apiNotFound("Batch not found");
  return Response.json({ ok: true, batch: status });
}

/** POST /api/batch — submit a batch of prompts */
export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { prompts, agentId, concurrency } = body as {
      prompts: Array<{ promptId: string; prompt: string; agentId?: string; repoUrl?: string }>;
      agentId?: string;
      concurrency?: number;
    };

    if (!prompts?.length) return apiError("prompts array is required", 400);

    const batch = await submitBatch({
      operatorId: operatorId!,
      prompts,
      agentId,
      concurrency,
    });

    return Response.json({ ok: true, batch });
  } catch (error) {
    return apiError(error, 400);
  }
}
