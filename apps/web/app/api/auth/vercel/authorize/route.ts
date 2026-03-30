import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { apiUnavailable } from "@/lib/api-response";
import { generatePKCE, generateState, buildAuthorizeUrl } from "@/lib/vercel-auth";

export async function GET(request: Request) {
  const env = getServerEnv();

  if (!env.vercelClientId) {
    return apiUnavailable("Vercel OAuth not configured");
  }

  const { searchParams } = new URL(request.url);
  let returnTo = searchParams.get("returnTo") || "/dashboard";
  // Prevent open redirect — only allow relative same-origin paths
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    returnTo = "/dashboard";
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  // Derive redirect URI from the control plane URL
  const redirectUri = `${env.controlPlaneUrl}/api/auth/vercel/callback`;

  // Store OAuth state in a short-lived httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set("cadet_vercel_oauth", JSON.stringify({ state, codeVerifier, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authorizeUrl = buildAuthorizeUrl({
    clientId: env.vercelClientId!,
    redirectUri,
    state,
    codeChallenge,
  });

  redirect(authorizeUrl);
}
