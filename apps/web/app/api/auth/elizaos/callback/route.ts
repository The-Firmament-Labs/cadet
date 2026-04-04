import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { apiError, apiUnavailable } from "@/lib/api-response";
import { findOperatorByEmail, setSessionCookie } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { safeCompare, exchangeCodeForTokens, getElizaosProfile } from "@/lib/elizaos-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  if (!code || !stateParam) return apiError("Missing code or state", 400);

  const clientId = process.env.ELIZAOS_CLIENT_ID;
  const clientSecret = process.env.ELIZAOS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return apiUnavailable("ElizaOS OAuth not configured");

  const cookieStore = await cookies();
  const oauthCookie = cookieStore.get("cadet_elizaos_oauth");
  if (!oauthCookie?.value) return apiError("OAuth state cookie missing", 400);

  let oauthState: { state: string; codeVerifier: string; returnTo: string };
  try {
    oauthState = JSON.parse(oauthCookie.value);
  } catch {
    return apiError("Invalid state cookie", 400);
  }

  if (!safeCompare(stateParam, oauthState.state)) return apiError("State mismatch", 400);
  cookieStore.delete("cadet_elizaos_oauth");

  const env = getServerEnv();
  const redirectUri = `${env.controlPlaneUrl}/api/auth/elizaos/callback`;

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: oauthState.codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    // Get user profile from ElizaOS
    const profile = await getElizaosProfile(tokens.access_token);
    const email = profile?.email;
    if (!email) return apiError("No email from ElizaOS profile", 400);

    let operator = await findOperatorByEmail(email);
    if (!operator) {
      const operatorId = crypto.randomUUID();
      const client = createControlClient();
      await client.callReducer("register_operator", [
        operatorId,
        profile.name || email.split("@")[0] || "ElizaOS User",
        email,
        `elizaos_${profile.id ?? operatorId}`,
        "{}", "[]",
      ]);
      operator = {
        operatorId,
        displayName: profile.name || email.split("@")[0] || "ElizaOS User",
        email,
        role: "operator",
      };
    }

    await setSessionCookie({
      operatorId: operator.operatorId,
      displayName: operator.displayName,
      email: operator.email,
      role: operator.role,
      elizaosToken: tokens.access_token,
      elizaosRefreshToken: tokens.refresh_token,
      elizaosTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      elizaosUserId: profile.id,
    });

    // Store encrypted tokens for server-side use (best-effort)
    try {
      const { storeProviderTokens } = await import("@/lib/token-store");
      await storeProviderTokens(
        operator.operatorId,
        "elizaos",
        tokens.access_token,
        tokens.refresh_token ?? "",
        Date.now() + tokens.expires_in * 1000,
      );
    } catch {
      // Non-fatal — token store may not be available yet
    }

    redirect(oauthState.returnTo || "/dashboard");
  } catch (error) {
    // Re-throw Next.js redirect errors — they use throw for control flow
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[elizaos-oauth] callback error:", error);
    return apiError(error, 500);
  }
}
