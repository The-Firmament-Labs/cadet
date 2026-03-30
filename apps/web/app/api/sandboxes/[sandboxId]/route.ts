import { requireVercelAccessToken } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { snapshotSandbox, sleepSandbox, wakeSandbox, stopSandbox, verifySandboxOwnership } from "@/lib/sandbox";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiUnavailable } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ sandboxId: string }> },
) {
  const { unauthorized, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  const { sandboxId } = await context.params;
  const ownership = await verifySandboxOwnership(sandboxId, operatorId!);
  if (!ownership.ok) {
    return apiError(ownership.error, ownership.status);
  }

  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT * FROM sandbox_instance WHERE sandbox_id = '${sqlEscape(sandboxId)}'`,
    )) as Record<string, unknown>[];

    return Response.json({ ok: true, sandbox: rows[0] });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sandboxId: string }> },
) {
  if (!getServerEnv().sandboxExecutionEnabled) {
    return apiUnavailable("Sandbox execution is disabled in APP_STORE_SAFE_MODE");
  }

  const { unauthorized, vercelAccessToken, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  const { sandboxId } = await context.params;
  const ownership = await verifySandboxOwnership(sandboxId, operatorId!);
  if (!ownership.ok) {
    return apiError(ownership.error, ownership.status);
  }

  const payload = await request.json();
  const { action, agentId, snapshotId, runId } = payload as {
    action: "snapshot" | "sleep" | "wake" | "stop";
    agentId?: string;
    snapshotId?: string;
    runId?: string;
  };

  try {
    switch (action) {
      case "snapshot": {
        const snapId = await snapshotSandbox({
          sandboxId,
          vercelAccessToken: vercelAccessToken!,
          operatorId: operatorId!,
        });
        return Response.json({ ok: true, snapshotId: snapId });
      }
      case "sleep": {
        const snapId = await sleepSandbox({
          sandboxId,
          vercelAccessToken: vercelAccessToken!,
          operatorId: operatorId!,
        });
        return Response.json({ ok: true, snapshotId: snapId });
      }
      case "wake": {
        if (!snapshotId || !agentId) {
          return apiError("snapshotId and agentId required for wake", 400);
        }
        const record = await wakeSandbox({
          snapshotId,
          vercelAccessToken: vercelAccessToken!,
          operatorId: operatorId!,
          agentId,
          runId,
        });
        return Response.json({ ok: true, sandbox: record });
      }
      case "stop": {
        await stopSandbox({ sandboxId, vercelAccessToken: vercelAccessToken! });
        return Response.json({ ok: true });
      }
      default:
        return apiError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sandboxId: string }> },
) {
  if (!getServerEnv().sandboxExecutionEnabled) {
    return apiUnavailable("Sandbox execution is disabled in APP_STORE_SAFE_MODE");
  }

  const { unauthorized, vercelAccessToken, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  const { sandboxId } = await context.params;
  const ownership = await verifySandboxOwnership(sandboxId, operatorId!);
  if (!ownership.ok) {
    return apiError(ownership.error, ownership.status);
  }

  try {
    await stopSandbox({ sandboxId, vercelAccessToken: vercelAccessToken! });

    const client = createControlClient();
    await client.callReducer("delete_sandbox", [sandboxId]);

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
