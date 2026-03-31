/**
 * Tests for apps/web/lib/use-vercel-fetch.ts
 *
 * Strategy: replace the global `fetch` with vi.fn() stubs so that every
 * fetch call (the main request AND the refresh POST) is observable.
 * Because `refreshPromise` is module-level state, we call vi.resetModules()
 * between tests that need a clean slate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(
  status: number,
  body: unknown,
  ok?: boolean,
): Response {
  const json = JSON.stringify(body);
  return {
    status,
    ok: ok ?? (status >= 200 && status < 300),
    clone() {
      return this;
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(json),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("vercelFetch – happy path", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through a successful 200 response without touching refresh", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(200, { data: "ok" }));
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/test");

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/test", undefined);
  });

  it("passes through a 200 response with init options intact", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(200, {}));
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const init: RequestInit = { method: "POST", headers: { "X-Custom": "1" } };
    await vercelFetch("/api/test", init);

    expect(mockFetch).toHaveBeenCalledWith("/api/test", init);
  });

  it("passes through non-401 error responses without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(500, { error: "server error" }));
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/test");

    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("passes through 404 without touching refresh", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(404, { error: "not found" }));
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/missing");

    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("vercelFetch – 401 with expired error triggers refresh", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects 401 with 'expired' body, refreshes token, retries, returns retry response", async () => {
    const expiredResponse = makeResponse(401, { error: "token expired" });
    const retryResponse = makeResponse(200, { data: "retried" });
    const refreshResponse = makeResponse(200, {});

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(expiredResponse)   // initial request → 401
      .mockResolvedValueOnce(refreshResponse)   // POST /api/auth/vercel/refresh → 200
      .mockResolvedValueOnce(retryResponse);    // retry request → 200

    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data", { method: "GET" });

    expect(res.status).toBe(200);
    // 3 calls: original, refresh, retry
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/auth/vercel/refresh", { method: "POST" });
    expect(mockFetch).toHaveBeenNthCalledWith(3, "/api/data", { method: "GET" });
  });

  it("detects 401 with 'refresh required' body and retries", async () => {
    const expiredResponse = makeResponse(401, { error: "refresh required" });
    const refreshResponse = makeResponse(200, {});
    const retryResponse = makeResponse(200, { data: "ok" });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(expiredResponse)
      .mockResolvedValueOnce(refreshResponse)
      .mockResolvedValueOnce(retryResponse);

    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data");

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry when refresh POST itself fails (returns ok=false)", async () => {
    const expiredResponse = makeResponse(401, { error: "token expired" });
    const failedRefresh = makeResponse(500, {}, false);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(expiredResponse)
      .mockResolvedValueOnce(failedRefresh);

    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data");

    // Returns original 401 — no retry
    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry when refresh POST throws (network failure)", async () => {
    const expiredResponse = makeResponse(401, { error: "token expired" });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(expiredResponse)
      .mockRejectedValueOnce(new Error("network error"));

    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data");

    // Returns original 401 — no retry
    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("vercelFetch – 401 without expired error does not retry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the 401 directly when body has no expired-related message", async () => {
    const unauthorizedResponse = makeResponse(401, { error: "unauthorized" });
    const mockFetch = vi.fn().mockResolvedValue(unauthorizedResponse);
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data");

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns the 401 directly when body is null (non-JSON response)", async () => {
    const badJson: Response = {
      status: 401,
      ok: false,
      clone() { return this; },
      json: () => Promise.reject(new SyntaxError("not json")),
    } as unknown as Response;

    const mockFetch = vi.fn().mockResolvedValue(badJson);
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data");

    expect(res.status).toBe(401);
    // No refresh call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns the 401 directly when body has no error field", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeResponse(401, { code: 1001 }));
    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");
    const res = await vercelFetch("/api/data");

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("vercelFetch – deduplicates concurrent refresh calls", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("issues only one refresh POST even when two requests concurrently hit 401", async () => {
    const expiredResponse = makeResponse(401, { error: "token expired" });
    const refreshResponse = makeResponse(200, {});
    const retryResponse = makeResponse(200, { data: "ok" });

    // We need a refresh that resolves after a small tick so both requests
    // can enter the refresh path before the first one resolves.
    let resolveRefresh!: () => void;
    const refreshPending = new Promise<Response>((resolve) => {
      resolveRefresh = () => resolve(refreshResponse);
    });

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(expiredResponse)   // request A → 401
      .mockResolvedValueOnce(expiredResponse)   // request B → 401
      .mockImplementationOnce(() => refreshPending) // single refresh
      .mockResolvedValue(retryResponse);         // retries

    vi.stubGlobal("fetch", mockFetch);

    const { vercelFetch } = await import("./use-vercel-fetch");

    // Fire both requests without awaiting
    const promiseA = vercelFetch("/api/a", { method: "GET" });
    const promiseB = vercelFetch("/api/b", { method: "GET" });

    // Let the 401s resolve and the refresh call begin
    await Promise.resolve();
    await Promise.resolve();

    // Now resolve the refresh
    resolveRefresh();

    const [resA, resB] = await Promise.all([promiseA, promiseB]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const refreshCalls = mockFetch.mock.calls.filter(
      ([url]) => url === "/api/auth/vercel/refresh"
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
