import { describe, expect, it, vi, beforeEach } from "vitest";

// Track calls to clearSessionCookie
const clearSessionCookieMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  clearSessionCookie: (...args: unknown[]) => clearSessionCookieMock(...args),
}));

import { POST } from "./route";

beforeEach(() => {
  clearSessionCookieMock.mockReset();
  clearSessionCookieMock.mockResolvedValue(undefined);
});

describe("POST /api/auth/logout", () => {
  it("returns { ok: true }", async () => {
    const response = await POST();
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it("clears the session cookie", async () => {
    await POST();
    expect(clearSessionCookieMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 status", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Golden Path
// ---------------------------------------------------------------------------

describe("Logout golden path", () => {
  it("clears cookie and responds with ok in a single request", async () => {
    const response = await POST();
    const body = await response.json();

    expect(clearSessionCookieMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
