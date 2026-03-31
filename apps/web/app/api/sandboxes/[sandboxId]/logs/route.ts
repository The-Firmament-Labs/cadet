import { requireVercelAccessToken } from "@/lib/auth";
import { verifySandboxOwnership } from "@/lib/sandbox";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ sandboxId: string }> },
) {
  const { unauthorized, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  const { sandboxId } = await context.params;
  const ownership = await verifySandboxOwnership(sandboxId, operatorId!);
  if (!ownership.ok) return apiError(ownership.error, ownership.status);

  try {
    const client = createControlClient();
    const rows = await client.sql(
      `SELECT event_id, direction, actor, content, created_at_micros FROM message_event WHERE metadata_json LIKE '%${sqlEscape(sandboxId)}%' ORDER BY created_at_micros DESC LIMIT 50`,
    );
    return Response.json({ ok: true, logs: rows });
  } catch (error) {
    return apiError(error, 500);
  }
}
