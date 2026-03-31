import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const client = createControlClient();
    const where = status ? `WHERE status = '${sqlEscape(status)}'` : "";
    const rows = await client.sql(
      `SELECT approval_id, run_id, agent_id, title, detail, risk, status, updated_at_micros FROM approval_request ${where} ORDER BY updated_at_micros DESC LIMIT 50`,
    );
    return Response.json({ ok: true, approvals: rows });
  } catch (error) {
    return apiError(error, 500);
  }
}
