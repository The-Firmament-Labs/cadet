import { requireVercelAccessToken } from "@/lib/auth";
import { getAgentConfig } from "@/lib/agent-runtime/registry";
import { ensureSession, getActiveSession } from "@/lib/agent-runtime/session";
import { executeAgentPrompt } from "@/lib/agent-runtime/executor";
import { createSandbox } from "@/lib/sandbox";
import { getVercelAccessToken } from "@/lib/token-store";
import { apiError, apiNotFound } from "@/lib/api-response";

export async function POST(
  request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const { unauthorized, vercelAccessToken, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  const { agentId } = await context.params;
  const config = getAgentConfig(agentId);
  if (!config) return apiNotFound(`Agent '${agentId}' not in registry`);

  try {
    const body = await request.json();
    const { prompt, repoUrl, branch, apiKey, sessionId } = body as {
      prompt: string;
      repoUrl?: string;
      branch?: string;
      apiKey?: string;
      sessionId?: string;
    };

    if (!prompt) return apiError("prompt is required", 400);

    // Find or create a session
    let session = sessionId
      ? await (await import("@/lib/agent-runtime/session")).loadAgentSession(sessionId)
      : await getActiveSession(operatorId!, agentId, repoUrl);

    if (!session) {
      // Create sandbox + session
      const sandbox = await createSandbox({
        vercelAccessToken: vercelAccessToken!,
        operatorId: operatorId!,
        agentId,
      });
      const result = await ensureSession({
        operatorId: operatorId!,
        agentId,
        sandboxId: sandbox.sandboxId,
        repoUrl,
      });
      session = result.session;
    }

    // Execute the prompt
    const result = await executeAgentPrompt({
      sandboxId: session.sandboxId,
      vercelAccessToken: vercelAccessToken!,
      agentId,
      prompt,
      sessionId: session.sessionId,
      repoUrl,
      branch,
      apiKey,
    });

    return Response.json({
      ok: true,
      sessionId: session.sessionId,
      exitCode: result.exitCode,
      events: result.events,
      output: result.output.slice(0, 10_000), // cap response size
    });
  } catch (error) {
    return apiError(error, 500);
  }
}
