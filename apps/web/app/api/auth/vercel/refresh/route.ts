import { requireOperatorApiSession, parseSessionFromRequest, setSessionCookie } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { refreshAccessToken } from "@/lib/vercel-auth";
import { apiError, apiUnavailable } from "@/lib/api-response";

export async function POST(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const session = parseSessionFromRequest(request);
  if (!session?.vercelRefreshToken) {
    return apiError("No Vercel refresh token in session", 400);
  }

  const { vercelClientId: clientId, vercelClientSecret: clientSecret } = getServerEnv();
  if (!clientId || !clientSecret) {
    return apiUnavailable("Vercel OAuth not configured");
  }

  try {
    const tokens = await refreshAccessToken({
      refreshToken: session.vercelRefreshToken,
      clientId,
      clientSecret,
    });

    await setSessionCookie({
      ...session,
      vercelAccessToken: tokens.access_token,
      vercelRefreshToken: tokens.refresh_token ?? session.vercelRefreshToken,
      vercelTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}
