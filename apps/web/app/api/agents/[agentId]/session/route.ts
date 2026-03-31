import { requireVercelAccessToken, requireOperatorApiSession } from "@/lib/auth";
import { ensureSession, getActiveSession, closeAgentSession } from "@/lib/agent-runtime/session";
import { getAgentConfig } from "@/lib/agent-runtime/registry";
import { createSandbox } from "@/lib/sandbox";
import { apiError, apiNotFound } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  try {
    const session = await getActiveSession(operatorId!, agentId);
    if (!session) return apiNotFound("No active session for this agent");
    return Response.json({ ok: true, session });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized, vercelAccessToken, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  const config = getAgentConfig(agentId);
  if (!config) return apiNotFound(`Agent '${agentId}' not found in registry`);

  try {
    const body = await request.json().catch(() => ({})) as { repoUrl?: string };

    // Check for existing session
    const existing = await getActiveSession(operatorId!, agentId, body.repoUrl);
    if (existing) {
      return Response.json({ ok: true, session: existing, created: false });
    }

    // Create a sandbox for the agent
    const sandbox = await createSandbox({
      vercelAccessToken: vercelAccessToken!,
      operatorId: operatorId!,
      agentId,
    });

    // Create the session
    const { session } = await ensureSession({
      operatorId: operatorId!,
      agentId,
      sandboxId: sandbox.sandboxId,
      repoUrl: body.repoUrl,
    });

    return Response.json({ ok: true, session, created: true });
  } catch (error) {
    return apiError(error, 400);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  try {
    const session = await getActiveSession(operatorId!, agentId);
    if (!session) return apiNotFound("No active session to close");

    await closeAgentSession(session.sessionId);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
