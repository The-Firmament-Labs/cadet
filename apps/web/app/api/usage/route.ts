import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const client = createControlClient();
    const [runs, sandboxes, toolCalls, memory] = await Promise.all([
      client.sql("SELECT COUNT(*) as count FROM workflow_run").then((r) => Number((r as Record<string, unknown>[])[0]?.count ?? 0)).catch(() => 0),
      client.sql("SELECT COUNT(*) as count FROM sandbox_instance").then((r) => Number((r as Record<string, unknown>[])[0]?.count ?? 0)).catch(() => 0),
      client.sql("SELECT COUNT(*) as count FROM tool_call_record").then((r) => Number((r as Record<string, unknown>[])[0]?.count ?? 0)).catch(() => 0),
      client.sql("SELECT COUNT(*) as count FROM memory_document").then((r) => Number((r as Record<string, unknown>[])[0]?.count ?? 0)).catch(() => 0),
    ]);

    return Response.json({
      ok: true,
      usage: { runs, sandboxes, toolCalls, memoryDocs: memory },
    });
  } catch (error) {
    return apiError(error, 500);
  }
}
