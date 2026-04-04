import { parseSessionFromRequest, setSessionCookie } from "@/lib/auth";
import { apiError, apiUnauthorized } from "@/lib/api-response";
import { refreshAccessToken } from "@/lib/elizaos-auth";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  const clientId = process.env.ELIZAOS_CLIENT_ID;
  const clientSecret = process.env.ELIZAOS_CLIENT_SECRET;
  const refreshToken = session.elizaosRefreshToken;
  if (!clientId || !clientSecret || !refreshToken) return apiError("No ElizaOS refresh token", 400);

  try {
    const tokens = await refreshAccessToken({ refreshToken, clientId, clientSecret });
    await setSessionCookie({
      ...session,
      elizaosToken: tokens.access_token,
      elizaosRefreshToken: tokens.refresh_token ?? refreshToken,
      elizaosTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
