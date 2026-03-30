import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { apiError, apiUnavailable } from "@/lib/api-response";
import { findOperatorByEmail, setSessionCookie } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { storeVercelTokens } from "@/lib/token-store";
import {
  safeCompare,
  exchangeCodeForTokens,
  verifyIdToken,
} from "@/lib/vercel-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    return apiError("Missing code or state parameter", 400);
  }

  const env = getServerEnv();
  const clientId = env.vercelClientId;
  const clientSecret = env.vercelClientSecret;
  if (!clientId || !clientSecret) {
    return apiUnavailable("Vercel OAuth not configured");
  }

  // Read and validate OAuth state cookie
  const cookieStore = await cookies();
  const oauthCookie = cookieStore.get("cadet_vercel_oauth");
  if (!oauthCookie?.value) {
    return apiError("OAuth state cookie missing — try signing in again", 400);
  }

  let oauthState: { state: string; codeVerifier: string; returnTo: string };
  try {
    oauthState = JSON.parse(oauthCookie.value);
  } catch {
    return apiError("Invalid OAuth state cookie", 400);
  }

  // Timing-safe state comparison
  if (!safeCompare(stateParam, oauthState.state)) {
    return apiError("OAuth state mismatch", 400);
  }

  // Clean up the OAuth state cookie
  cookieStore.delete("cadet_vercel_oauth");

  const redirectUri = `${env.controlPlaneUrl}/api/auth/vercel/callback`;

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier: oauthState.codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    });

    // Verify ID token and extract claims
    let email: string | undefined;
    let displayName: string | undefined;
    let vercelUserId: string | undefined;

    if (tokens.id_token) {
      const claims = await verifyIdToken(tokens.id_token, clientId);
      email = claims.email;
      displayName = claims.name;
      vercelUserId = claims.sub;
    }

    if (!email) {
      return apiError("No email in Vercel ID token", 400);
    }

    // Find existing operator or create a new one
    let operator = await findOperatorByEmail(email);

    if (!operator) {
      const operatorId = crypto.randomUUID();
      const client = createControlClient();
      await client.callReducer("register_operator", [
        operatorId,
        displayName || email.split("@")[0] || "Vercel User",
        email,
        `vercel_${vercelUserId ?? operatorId}`, // credential_id (Vercel OAuth marker)
        "{}", // public_key_json (no WebAuthn key for Vercel OAuth)
        "[]", // transports_json
      ]);
      operator = {
        operatorId,
        displayName: displayName || email.split("@")[0] || "Vercel User",
        email,
        role: "operator",
      };
    }

    // Build session with Vercel tokens
    await setSessionCookie({
      operatorId: operator.operatorId,
      displayName: operator.displayName,
      email: operator.email,
      role: operator.role,
      vercelAccessToken: tokens.access_token,
      vercelRefreshToken: tokens.refresh_token,
      vercelTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      vercelUserId,
    });

    // Persist encrypted tokens for server-side use (sandbox, watchdog)
    try {
      await storeVercelTokens(
        operator.operatorId,
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
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("[vercel-oauth] callback error:", error);
    return apiError(error, 500);
  }
}
