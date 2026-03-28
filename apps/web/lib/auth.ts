import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createControlClient } from "./server";

export interface OperatorSession {
  operatorId: string;
  displayName: string;
  email: string;
  role: string;
  spacetimeToken?: string;
}

const SESSION_COOKIE = "cadet_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function encodeSession(session: OperatorSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

export function decodeSession(value: string): OperatorSession | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (
      typeof parsed.operatorId === "string" &&
      typeof parsed.displayName === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.role === "string"
    ) {
      return parsed as OperatorSession;
    }
    return null;
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
    const rows = (await client.sql(
      `SELECT operator_id, display_name, email, role FROM operator_account WHERE email = '${email.replace(/'/g, "''")}'`
    )) as Record<string, unknown>[];
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
      `SELECT credential_id, public_key_json, counter, transports_json FROM webauthn_credential WHERE operator_id = '${operatorId.replace(/'/g, "''")}'`
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
      `SELECT credential_id, operator_id, public_key_json, counter, transports_json FROM webauthn_credential WHERE credential_id = '${credentialId.replace(/'/g, "''")}'`
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

export async function requireOperatorPageSession(nextPath: string): Promise<OperatorSession | null> {
  const session = await getOperatorSession();
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function requireOperatorApiSession(request: Request): Promise<{
  unauthorized: Response | null;
  authToken: string | undefined;
}> {
  // Read session from cookie header
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/cadet_session=([^;]+)/);
  if (!match) {
    return {
      unauthorized: Response.json({ ok: false, error: "Authentication required" }, { status: 401 }),
      authToken: undefined,
    };
  }

  const session = decodeSession(match[1] ?? "");
  if (!session) {
    return {
      unauthorized: Response.json({ ok: false, error: "Invalid session" }, { status: 401 }),
      authToken: undefined,
    };
  }

  return {
    unauthorized: null,
    authToken: session.spacetimeToken,
  };
}
