import { requireVercelAccessToken } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { runInSandbox, verifySandboxOwnership } from "@/lib/sandbox";
import { apiError, apiUnavailable } from "@/lib/api-response";

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
  const { command, args } = payload as { command: string; args?: unknown };

  if (!command || typeof command !== "string") {
    return apiError("command is required", 400);
  }

  if (args !== undefined && (!Array.isArray(args) || !args.every((a) => typeof a === "string"))) {
    return apiError("args must be an array of strings", 400);
  }

  try {
    const result = await runInSandbox({
      sandboxId,
      vercelAccessToken: vercelAccessToken!,
      command,
      args: args as string[] | undefined,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 500);
  }
}
