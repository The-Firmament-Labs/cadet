import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiNotFound } from "@/lib/api-response";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ configId: string }> },
) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { configId } = await context.params;
  try {
    const body = await request.json();
    const client = createControlClient();

    // Verify ownership
    const rows = (await client.sql(
      `SELECT operator_id FROM user_agent_config WHERE config_id = '${sqlEscape(configId)}'`,
    )) as Record<string, unknown>[];
    if (rows.length === 0) return apiNotFound("Config not found");
    if (String(rows[0]!.operator_id) !== operatorId) return apiError("Not your config", 403);

    const { displayName, modelOverride, repoUrl, repoBranch, extraEnv } = body as Record<string, unknown>;
    await client.callReducer("upsert_user_agent_config", [
      configId,
      operatorId,
      "", // agent_id unchanged
      String(displayName ?? ""),
      String(modelOverride ?? ""),
      "", // api_key unchanged
      String(repoUrl ?? ""),
      String(repoBranch ?? ""),
      "", // snapshot unchanged
      JSON.stringify(extraEnv ?? {}),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ configId: string }> },
) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { configId } = await context.params;
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT operator_id FROM user_agent_config WHERE config_id = '${sqlEscape(configId)}'`,
    )) as Record<string, unknown>[];
    if (rows.length > 0 && String(rows[0]!.operator_id) !== operatorId) {
      return apiError("Not your config", 403);
    }
    await client.callReducer("delete_user_agent_config", [configId]);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
