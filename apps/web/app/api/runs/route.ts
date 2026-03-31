import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const status = searchParams.get("status");

  try {
    const client = createControlClient();
    const where = status ? `WHERE status = '${sqlEscape(status)}'` : "";
    const rows = await client.sql(
      `SELECT run_id, agent_id, goal, status, current_stage, priority, trigger_source, updated_at_micros FROM workflow_run ${where} ORDER BY updated_at_micros DESC LIMIT ${limit}`,
    );
    return Response.json({ ok: true, runs: rows });
  } catch (error) {
    return apiError(error, 500);
  }
}
