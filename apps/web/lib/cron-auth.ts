import { timingSafeEqual } from "node:crypto";
import { getServerEnv } from "./env";

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a cron request against CRON_SECRET.
 * Supports both `Authorization: Bearer <secret>` and `x-cron-secret: <secret>` headers.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyCronAuth(request: Request): { authorized: boolean; reason?: string } {
  const env = getServerEnv();

  if (!env.cronSecret) {
    console.warn("[cron] CRON_SECRET not set — rejecting");
    return { authorized: false, reason: "CRON_SECRET not configured" };
  }

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = request.headers.get("x-cron-secret")?.trim() ?? "";

  if ((bearer && safeEquals(bearer, env.cronSecret)) || (header && safeEquals(header, env.cronSecret))) {
    return { authorized: true };
  }

  return { authorized: false, reason: "Invalid credentials" };
}

/** Standard 401 response for unauthorized cron requests. */
export function cronUnauthorized(): Response {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
