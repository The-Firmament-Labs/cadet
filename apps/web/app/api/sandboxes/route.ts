import { requireVercelAccessToken, requireOperatorApiSession } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { createSandbox } from "@/lib/sandbox";
import { apiError, apiUnavailable } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const client = createControlClient();
    const rows = await client.sql(
      `SELECT sandbox_id, operator_id, agent_id, run_id, snapshot_id, status, created_at_micros, updated_at_micros, metadata_json FROM sandbox_instance WHERE operator_id = '${sqlEscape(operatorId ?? "")}'`,
    );
    return Response.json({ ok: true, sandboxes: rows });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  if (!getServerEnv().sandboxExecutionEnabled) {
    return apiUnavailable("Sandbox execution is disabled in APP_STORE_SAFE_MODE");
  }

  const { unauthorized, vercelAccessToken, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  try {
    const payload = await request.json();
    const { agentId, runId } = payload as { agentId: string; runId?: string };

    if (!agentId) {
      return apiError("agentId is required", 400);
    }

    const record = await createSandbox({
      vercelAccessToken: vercelAccessToken!,
      operatorId: operatorId!,
      agentId,
      runId,
    });

    return Response.json({ ok: true, sandbox: record });
  } catch (error) {
    return apiError(error, 400);
  }
}
