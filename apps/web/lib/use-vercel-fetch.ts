"use client";

let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempt to refresh the Vercel access token.
 * Deduplicates concurrent calls — only one refresh in-flight at a time.
 */
async function refreshVercelToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch("/api/auth/vercel/refresh", { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Fetch wrapper that auto-refreshes Vercel tokens on 401.
 * If the first request returns 401 with a Vercel-token-expired error,
 * it refreshes the token and retries the request once.
 */
export async function vercelFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    const body = await res.clone().json().catch(() => null);
    if (body?.error?.includes("expired") || body?.error?.includes("refresh required")) {
      const refreshed = await refreshVercelToken();
      if (refreshed) {
        return fetch(input, init);
      }
    }
  }

  return res;
}
