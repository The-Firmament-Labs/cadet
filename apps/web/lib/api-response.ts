/**
 * Shared API response helpers for consistent { ok, result/error } envelope format.
 */

export function apiOk(result?: unknown): Response {
  return Response.json({ ok: true, ...(result !== undefined ? { result } : {}) });
}

export function apiError(error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  return Response.json({ ok: false, error: message }, { status });
}

export function apiNotFound(message = "Not found"): Response {
  return Response.json({ ok: false, error: message }, { status: 404 });
}

export function apiUnauthorized(message = "Unauthorized"): Response {
  return Response.json({ ok: false, error: message }, { status: 401 });
}

export function apiForbidden(message = "Forbidden"): Response {
  return Response.json({ ok: false, error: message }, { status: 403 });
}

export function apiUnavailable(message = "Service unavailable"): Response {
  return Response.json({ ok: false, error: message }, { status: 503 });
}

/**
 * Extract a safe error message from an unknown thrown value.
 */
export function errorMessage(error: unknown, fallback = "Unknown error"): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
}
