/**
 * ElizaOS Cloud OAuth + Affiliate Billing
 *
 * Handles OAuth2 PKCE flow with ElizaOS Cloud, affiliate link tracking,
 * and API proxying with X-Affiliate-Code header injection.
 */

import crypto from "crypto";

const ELIZAOS_AUTH_URL = "https://www.elizacloud.ai/oauth/authorize";
const ELIZAOS_TOKEN_URL = "https://www.elizacloud.ai/oauth/token";
const ELIZAOS_API_URL = "https://api.elizacloud.ai";

export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function generateState() {
  return crypto.randomBytes(16).toString("hex");
}

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  affiliateCode?: string;
}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    scope: "openid email profile",
  });
  if (opts.affiliateCode) {
    params.set("affiliate", opts.affiliateCode);
  }
  return `${ELIZAOS_AUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const res = await fetch(ELIZAOS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      code_verifier: opts.codeVerifier,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElizaOS token exchange failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    id_token?: string;
    token_type: string;
  }>;
}

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}) {
  const res = await fetch(ELIZAOS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: opts.refreshToken,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`ElizaOS token refresh failed (${res.status})`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}

/** Proxy a request to ElizaOS Cloud API with affiliate code injection. */
export async function proxyToElizaos(opts: {
  path: string;
  method: string;
  body?: unknown;
  accessToken: string;
  affiliateCode?: string;
}) {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${opts.accessToken}`,
    "Content-Type": "application/json",
  };
  if (opts.affiliateCode) {
    headers["X-Affiliate-Code"] = opts.affiliateCode;
  }

  const res = await fetch(`${ELIZAOS_API_URL}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: await res.json().catch(() => null),
  };
}

/** Get ElizaOS user profile from access token. */
export async function getElizaosProfile(accessToken: string) {
  const res = await fetch(`${ELIZAOS_API_URL}/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    id: string;
    email: string;
    name?: string;
    credits?: number;
    walletAddress?: string;
    affiliateCode?: string;
    affiliateEarnings?: number;
  }>;
}
