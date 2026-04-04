import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { apiUnavailable } from "@/lib/api-response";
import { generatePKCE, generateState, buildAuthorizeUrl } from "@/lib/elizaos-auth";

export async function GET(request: Request) {
  const clientId = process.env.ELIZAOS_CLIENT_ID;
  if (!clientId) return apiUnavailable("ElizaOS OAuth not configured");

  const { searchParams } = new URL(request.url);
  let returnTo = searchParams.get("returnTo") || "/dashboard";
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) returnTo = "/dashboard";

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();
  const env = getServerEnv();
  const redirectUri = `${env.controlPlaneUrl}/api/auth/elizaos/callback`;

  const cookieStore = await cookies();
  cookieStore.set("cadet_elizaos_oauth", JSON.stringify({ state, codeVerifier, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    affiliateCode: process.env.ELIZAOS_AFFILIATE_CODE,
  });

  redirect(authorizeUrl);
}
