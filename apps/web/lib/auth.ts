import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createControlClient } from "./server";
import { sqlEscape } from "./sql";

export interface OperatorSession {
  operatorId: string;
  displayName: string;
  email: string;
  role: string;
  spacetimeToken?: string;
  vercelAccessToken?: string;
  vercelRefreshToken?: string;
  vercelTokenExpiresAt?: number;
  vercelUserId?: string;
}

const SESSION_COOKIE = "cadet_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSessionSecret(): string | undefined {
  const secret = process.env.AUTH_SECRET?.trim() || undefined;
  if (!secret && process.env.NODE_ENV === "production") {
    console.error("[auth] CRITICAL: AUTH_SECRET is not set in production — sessions are unsigned and forgeable");
  }
  return secret;
}

export function encodeSession(session: OperatorSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const secret = getSessionSecret();
  if (secret) {
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    return `${payload}.${sig}`;
  }
  return payload;
}

export function decodeSession(value: string): OperatorSession | null {
  try {
    const secret = getSessionSecret();
    let payload: string;

    if (secret) {
      const dotIndex = value.lastIndexOf(".");
      if (dotIndex === -1) {
        // No signature present — reject when AUTH_SECRET is set
        // (old unsigned cookies will be cleared on next sign-in)
        return null;
      }
      payload = value.slice(0, dotIndex);
      const sig = value.slice(dotIndex + 1);
      const expected = createHmac("sha256", secret).update(payload).digest("base64url");
      const sigBuf = Buffer.from(sig);
      const expectedBuf = Buffer.from(expected);
      if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
        return null;
      }
    } else {
      payload = value;
    }

    const json = Buffer.from(payload, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (
      typeof parsed.operatorId !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string"
    ) {
      return null;
    }
    // Validate optional Vercel fields are correct types if present
    const session: OperatorSession = {
      operatorId: parsed.operatorId,
      displayName: parsed.displayName,
      email: parsed.email,
      role: parsed.role,
      spacetimeToken: typeof parsed.spacetimeToken === "string" ? parsed.spacetimeToken : undefined,
      vercelAccessToken: typeof parsed.vercelAccessToken === "string" ? parsed.vercelAccessToken : undefined,
      vercelRefreshToken: typeof parsed.vercelRefreshToken === "string" ? parsed.vercelRefreshToken : undefined,
      vercelTokenExpiresAt: typeof parsed.vercelTokenExpiresAt === "number" ? parsed.vercelTokenExpiresAt : undefined,
      vercelUserId: typeof parsed.vercelUserId === "string" ? parsed.vercelUserId : undefined,
    };
    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: OperatorSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getOperatorSession(): Promise<OperatorSession | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie?.value) return null;
  return decodeSession(cookie.value);
}

export async function requireDashboardSession(): Promise<OperatorSession> {
  const session = await getOperatorSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function findOperatorByEmail(email: string): Promise<{
  operatorId: string;
  displayName: string;
  email: string;
  role: string;
} | null> {
  try {
    const client = createControlClient();
    const result = await client.sql(
      `SELECT operator_id, display_name, email, role FROM operator_account WHERE email = '${sqlEscape(email)}'`
    );
    console.log("[findOperatorByEmail] raw result:", JSON.stringify(result));
    const rows = result as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    if (!row) return null;
    return {
      operatorId: String(row.operator_id ?? ""),
      displayName: String(row.display_name ?? ""),
      email: String(row.email ?? ""),
      role: String(row.role ?? "operator"),
    };
  } catch {
    return null;
  }
}

export async function findCredentialsByOperator(operatorId: string): Promise<
  Array<{
    credentialId: string;
    publicKeyJson: string;
    counter: number;
    transportsJson: string;
  }>
> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT credential_id, public_key_json, counter, transports_json FROM webauthn_credential WHERE operator_id = '${sqlEscape(operatorId)}'`
    )) as Record<string, unknown>[];
    return rows.map((row) => ({
      credentialId: String(row.credential_id ?? ""),
      publicKeyJson: String(row.public_key_json ?? ""),
      counter: Number(row.counter ?? 0),
      transportsJson: String(row.transports_json ?? "[]"),
    }));
  } catch {
    return [];
  }
}

export async function findCredentialById(credentialId: string): Promise<{
  credentialId: string;
  operatorId: string;
  publicKeyJson: string;
  counter: number;
  transportsJson: string;
} | null> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT credential_id, operator_id, public_key_json, counter, transports_json FROM webauthn_credential WHERE credential_id = '${sqlEscape(credentialId)}'`
    )) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return null;
    return {
      credentialId: String(row.credential_id ?? ""),
      operatorId: String(row.operator_id ?? ""),
      publicKeyJson: String(row.public_key_json ?? ""),
      counter: Number(row.counter ?? 0),
      transportsJson: String(row.transports_json ?? "[]"),
    };
  } catch {
    return null;
  }
}

/**
 * Parse the cadet_session cookie from a raw Request and decode it.
 * Shared by all API route auth guards to avoid duplicating the regex.
 */
export function parseSessionFromRequest(request: Request): OperatorSession | null {
  // Dev bypass: skip auth in development when no cookie present
  if (process.env.NODE_ENV === "development") {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(/cadet_session=([^;]+)/);
    if (match) return decodeSession(match[1] ?? "");
    // No cookie in dev — return default operator session
    return { operatorId: "operator", displayName: "Operator", email: "dev@cadet.local", role: "admin" };
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/cadet_session=([^;]+)/);
  if (!match) return null;
  return decodeSession(match[1] ?? "");
}

// ── Backward compatibility with existing API routes ─────────────────

export function isOperatorAuthEnabled(): boolean {
  return true;
}

export function getOperatorProviders(): Array<{ id: string; name: string }> {
  return [{ id: "webauthn", name: "Passkey" }];
}

export function getOperatorSpacetimeToken(
  session: OperatorSession | null | undefined,
): string | undefined {
  return session?.spacetimeToken;
}

export async function requireOperatorPageSession(nextPath: string): Promise<OperatorSession> {
  const session = await getOperatorSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function requireOperatorApiSession(request: Request): Promise<{
  unauthorized: Response | null;
  authToken: string | undefined;
  operatorId: string | undefined;
}> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/cadet_session=([^;]+)/);
  if (!match) {
    return {
      unauthorized: Response.json({ ok: false, error: "Authentication required" }, { status: 401 }),
      authToken: undefined,
      operatorId: undefined,
    };
  }

  const session = decodeSession(match[1] ?? "");
  if (!session) {
    return {
      unauthorized: Response.json({ ok: false, error: "Invalid session" }, { status: 401 }),
      authToken: undefined,
      operatorId: undefined,
    };
  }

  return {
    unauthorized: null,
    authToken: session.spacetimeToken,
    operatorId: session.operatorId,
  };
}

export async function requireVercelAccessToken(request: Request): Promise<{
  unauthorized: Response | null;
  vercelAccessToken: string | undefined;
  operatorId: string | undefined;
}> {
  const session = parseSessionFromRequest(request);
  if (!session) {
    return {
      unauthorized: Response.json({ ok: false, error: "Authentication required" }, { status: 401 }),
      vercelAccessToken: undefined,
      operatorId: undefined,
    };
  }

  if (!session.vercelAccessToken) {
    return {
      unauthorized: Response.json({ ok: false, error: "Vercel account not linked — sign in with Vercel first" }, { status: 403 }),
      vercelAccessToken: undefined,
      operatorId: session.operatorId,
    };
  }

  // Check if token is expired (with 30s buffer)
  if (session.vercelTokenExpiresAt && Date.now() > session.vercelTokenExpiresAt - 30_000) {
    return {
      unauthorized: Response.json({ ok: false, error: "Vercel token expired — refresh required" }, { status: 401 }),
      vercelAccessToken: undefined,
      operatorId: session.operatorId,
    };
  }

  return {
    unauthorized: null,
    vercelAccessToken: session.vercelAccessToken,
    operatorId: session.operatorId,
  };
}
