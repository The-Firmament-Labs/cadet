import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as jose from "jose";

// Sign in with Vercel OAuth endpoints
// See: https://vercel.com/docs/security/sign-in-with-vercel
const VERCEL_AUTHORIZE_URL = "https://vercel.com/oauth/authorize";
const VERCEL_TOKEN_URL = "https://api.vercel.com/v2/oauth/access_token";
const VERCEL_JWKS_URL = "https://vercel.com/.well-known/jwks.json";

// Lazy-initialized JWKS keyset
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = jose.createRemoteJWKSet(new URL(VERCEL_JWKS_URL));
  }
  return jwks;
}

// ---------------------------------------------------------------------------
// PKCE
// ---------------------------------------------------------------------------

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: "openid profile email",
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${VERCEL_AUTHORIZE_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token Exchange
// ---------------------------------------------------------------------------

export interface VercelTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<VercelTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    code_verifier: opts.codeVerifier,
  });

  const res = await fetch(VERCEL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<VercelTokenResponse>;
}

export async function refreshAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<VercelTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
  });

  const res = await fetch(VERCEL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<VercelTokenResponse>;
}

// ---------------------------------------------------------------------------
// ID Token Verification
// ---------------------------------------------------------------------------

export interface VercelIdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function verifyIdToken(
  idToken: string,
  clientId: string,
): Promise<VercelIdTokenClaims> {
  const { payload } = await jose.jwtVerify(idToken, getJwks(), {
    issuer: "https://vercel.com",
    audience: clientId,
  });

  if (!payload.sub) {
    throw new Error("Vercel ID token missing 'sub' claim");
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
