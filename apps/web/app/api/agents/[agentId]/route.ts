import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiNotFound } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT * FROM agent_record WHERE agent_id = '${sqlEscape(agentId)}'`,
    )) as Record<string, unknown>[];
    if (rows.length === 0) return apiNotFound(`Agent '${agentId}' not found`);
    return Response.json({ ok: true, agent: rows[0] });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  try {
    const client = createControlClient();
    await client.callReducer("delete_agent", [agentId]);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
