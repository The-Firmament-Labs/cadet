import { requireOperatorApiSession } from "@/lib/auth";
import { getAvailableAgents, saveAgentConfig } from "@/lib/agent-catalog";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const agents = await getAvailableAgents(operatorId!);
    return Response.json({ ok: true, agents });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const payload = await request.json();
    const { agentId, displayName, modelOverride, repoUrl, repoBranch, extraEnv } = payload as {
      agentId: string;
      displayName: string;
      modelOverride?: string;
      repoUrl?: string;
      repoBranch?: string;
      extraEnv?: Record<string, string>;
    };

    if (!agentId || !displayName) {
      return apiError("agentId and displayName are required", 400);
    }

    const configId = await saveAgentConfig({
      operatorId: operatorId!,
      agentId,
      displayName,
      modelOverride,
      repoUrl,
      repoBranch,
      extraEnv,
    });

    return Response.json({ ok: true, configId });
  } catch (error) {
    return apiError(error, 400);
  }
}
