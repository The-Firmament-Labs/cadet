import { parseSessionFromRequest } from "@/lib/auth";
import { apiError, apiUnauthorized } from "@/lib/api-response";
import { proxyToElizaos } from "@/lib/elizaos-auth";
import { createControlClient } from "@/lib/server";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  const elizaosToken = session.elizaosToken;
  if (!elizaosToken) return apiError("ElizaOS not connected — sign in with ElizaOS first", 403);

  try {
    const body = await request.json();
    const { path, method, payload } = body as { path: string; method?: string; payload?: unknown };
    if (!path) return apiError("path required", 400);

    const result = await proxyToElizaos({
      path,
      method: method ?? "POST",
      body: payload,
      accessToken: elizaosToken,
      affiliateCode: process.env.ELIZAOS_AFFILIATE_CODE,
    });

    // Track usage in SpacetimeDB (best-effort)
    try {
      const client = createControlClient();
      await client.callReducer("record_user_interaction", [
        `elizaos_${Date.now().toString(36)}`,
        session.operatorId,
        session.operatorId,
        "elizaos",
        "outbound",
        `API: ${path}`.slice(0, 200),
        "",
        "",
        "",
      ]);
    } catch {
      // Non-fatal
    }

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return apiError(error, 500);
  }
}
