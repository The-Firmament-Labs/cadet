/**
 * Tests for apps/web/lib/vercel-auth.ts
 *
 * Strategy:
 *  - jose is mocked at the module level to avoid network calls to JWKS endpoints.
 *  - fetch is replaced with vi.stubGlobal so each test can control HTTP responses.
 *  - Pure functions (generatePKCE, safeCompare, buildAuthorizeUrl) are tested
 *    against real crypto to validate the actual S256 / timing-safe semantics.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const { mockJwtVerify, mockCreateRemoteJWKSet } = vi.hoisted(() => ({
  mockJwtVerify: vi.fn(),
  mockCreateRemoteJWKSet: vi.fn(() => "mock-jwks-keyset"),
}));

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
  createRemoteJWKSet: mockCreateRemoteJWKSet,
}));

// ---------------------------------------------------------------------------
// Subject under test — imported AFTER mocks are declared
// ---------------------------------------------------------------------------

import {
  generatePKCE,
  generateState,
  safeCompare,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  verifyIdToken,
} from "../vercel-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// generatePKCE
// ---------------------------------------------------------------------------

describe("generatePKCE", () => {
  it("returns non-empty codeVerifier and codeChallenge strings", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    expect(typeof codeVerifier).toBe("string");
    expect(codeVerifier.length).toBeGreaterThan(0);
    expect(typeof codeChallenge).toBe("string");
    expect(codeChallenge.length).toBeGreaterThan(0);
  });

  it("produces a base64url-encoded codeVerifier (no +, /, or = padding)", () => {
    const { codeVerifier } = generatePKCE();
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a base64url-encoded codeChallenge", () => {
    const { codeChallenge } = generatePKCE();
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("codeChallenge is the S256 (SHA-256 base64url) hash of codeVerifier", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();
    const expected = createHash("sha256").update(codeVerifier).digest("base64url");
    expect(codeChallenge).toBe(expected);
  });

  it("generates unique pairs on each call", () => {
    const first = generatePKCE();
    const second = generatePKCE();
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).not.toBe(second.codeChallenge);
  });
});

// ---------------------------------------------------------------------------
// generateState
// ---------------------------------------------------------------------------

describe("generateState", () => {
  it("returns a non-empty base64url string", () => {
    const state = generateState();
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state.length).toBeGreaterThan(0);
  });

  it("generates unique values on each call", () => {
    expect(generateState()).not.toBe(generateState());
  });
});

// ---------------------------------------------------------------------------
// safeCompare
// ---------------------------------------------------------------------------

describe("safeCompare", () => {
  it("returns true for identical strings", () => {
    expect(safeCompare("secret-token", "secret-token")).toBe(true);
  });

  it("returns false for strings that differ in content", () => {
    expect(safeCompare("secret-token", "wrong-token!")).toBe(false);
  });

  it("returns false when lengths differ (length-mismatch short-circuit)", () => {
    expect(safeCompare("short", "longer-string")).toBe(false);
  });

  it("returns false for empty vs non-empty strings", () => {
    expect(safeCompare("", "x")).toBe(false);
    expect(safeCompare("x", "")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
  });

  it("is case-sensitive", () => {
    expect(safeCompare("Token", "token")).toBe(false);
  });

  it("handles strings with special characters", () => {
    const val = "abc!@#$%^&*()_+-=[]{}|;':\",./<>?";
    expect(safeCompare(val, val)).toBe(true);
    expect(safeCompare(val, val + "x")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildAuthorizeUrl
// ---------------------------------------------------------------------------

describe("buildAuthorizeUrl", () => {
  const BASE_OPTS = {
    clientId: "client_123",
    redirectUri: "https://app.example.com/callback",
    state: "random-state",
    codeChallenge: "challenge-abc",
  };

  it("points to the Vercel authorize endpoint", () => {
    const url = buildAuthorizeUrl(BASE_OPTS);
    expect(url.startsWith("https://vercel.com/oauth/authorize?")).toBe(true);
  });

  it("includes all required OAuth params", () => {
    const url = buildAuthorizeUrl(BASE_OPTS);
    const params = new URL(url).searchParams;

    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe("client_123");
    expect(params.get("redirect_uri")).toBe("https://app.example.com/callback");
    expect(params.get("scope")).toBe("openid profile email");
    expect(params.get("state")).toBe("random-state");
    expect(params.get("code_challenge")).toBe("challenge-abc");
    expect(params.get("code_challenge_method")).toBe("S256");
  });

  it("URL-encodes the redirect_uri", () => {
    const url = buildAuthorizeUrl({
      ...BASE_OPTS,
      redirectUri: "https://app.example.com/auth/callback?foo=bar",
    });
    expect(url).toContain("redirect_uri=");
    // The raw URL should not contain an un-encoded '?' inside the value
    const raw = url.slice(url.indexOf("?") + 1);
    const params = new URLSearchParams(raw);
    expect(params.get("redirect_uri")).toBe(
      "https://app.example.com/auth/callback?foo=bar",
    );
  });
});

// ---------------------------------------------------------------------------
// exchangeCodeForTokens
// ---------------------------------------------------------------------------

describe("exchangeCodeForTokens", () => {
  const EXCHANGE_OPTS = {
    code: "auth-code-xyz",
    codeVerifier: "verifier-abc",
    clientId: "client_123",
    clientSecret: "secret_456",
    redirectUri: "https://app.example.com/callback",
  };

  const MOCK_TOKEN_RESPONSE = {
    access_token: "at_abc",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "rt_def",
    id_token: "it_ghi",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the Vercel token endpoint with correct body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(makeFetchResponse(MOCK_TOKEN_RESPONSE));

    await exchangeCodeForTokens(EXCHANGE_OPTS);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/oauth/access_token");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );

    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code-xyz");
    expect(body.get("code_verifier")).toBe("verifier-abc");
    expect(body.get("client_id")).toBe("client_123");
    expect(body.get("client_secret")).toBe("secret_456");
    expect(body.get("redirect_uri")).toBe("https://app.example.com/callback");
  });

  it("returns the parsed token response on success", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(MOCK_TOKEN_RESPONSE));

    const result = await exchangeCodeForTokens(EXCHANGE_OPTS);
    expect(result).toEqual(MOCK_TOKEN_RESPONSE);
  });

  it("throws with status code when the server returns a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse("invalid_grant", false, 400),
    );

    await expect(exchangeCodeForTokens(EXCHANGE_OPTS)).rejects.toThrow(
      "Token exchange failed (400)",
    );
  });

  it("includes the error body text in the thrown error message", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse("token_expired", false, 401),
    );

    await expect(exchangeCodeForTokens(EXCHANGE_OPTS)).rejects.toThrow(
      "token_expired",
    );
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe("refreshAccessToken", () => {
  const REFRESH_OPTS = {
    refreshToken: "rt_abc",
    clientId: "client_123",
    clientSecret: "secret_456",
  };

  const MOCK_REFRESH_RESPONSE = {
    access_token: "at_new",
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: "rt_new",
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs grant_type=refresh_token with the correct body", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(MOCK_REFRESH_RESPONSE));

    await refreshAccessToken(REFRESH_OPTS);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt_abc");
    expect(body.get("client_id")).toBe("client_123");
    expect(body.get("client_secret")).toBe("secret_456");
  });

  it("returns the refreshed token response on success", async () => {
    vi.mocked(fetch).mockResolvedValue(makeFetchResponse(MOCK_REFRESH_RESPONSE));

    const result = await refreshAccessToken(REFRESH_OPTS);
    expect(result.access_token).toBe("at_new");
    expect(result.refresh_token).toBe("rt_new");
  });

  it("throws with status code when the server returns a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeFetchResponse("refresh_expired", false, 400),
    );

    await expect(refreshAccessToken(REFRESH_OPTS)).rejects.toThrow(
      "Token refresh failed (400)",
    );
  });
});

// ---------------------------------------------------------------------------
// verifyIdToken
// ---------------------------------------------------------------------------

describe("verifyIdToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed claims when jose.jwtVerify resolves with a sub claim", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user_42",
        email: "user@example.com",
        name: "Test User",
        picture: "https://example.com/avatar.png",
      },
    });

    const claims = await verifyIdToken("id-token-string", "client_123");

    expect(claims).toEqual({
      sub: "user_42",
      email: "user@example.com",
      name: "Test User",
      picture: "https://example.com/avatar.png",
    });
  });

  it("passes the issuer and audience to jose.jwtVerify", async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: "user_99" } });

    await verifyIdToken("id-token-string", "my-client-id");

    expect(mockJwtVerify).toHaveBeenCalledWith(
      "id-token-string",
      expect.anything(),
      expect.objectContaining({
        issuer: "https://vercel.com",
        audience: "my-client-id",
      }),
    );
  });

  it("throws when the token payload is missing the sub claim", async () => {
    mockJwtVerify.mockResolvedValue({ payload: { email: "user@example.com" } });

    await expect(verifyIdToken("no-sub-token", "client_123")).rejects.toThrow(
      "missing 'sub' claim",
    );
  });

  it("omits optional fields when they are absent from the payload", async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: "user_55" } });

    const claims = await verifyIdToken("minimal-token", "client_123");
    expect(claims.email).toBeUndefined();
    expect(claims.name).toBeUndefined();
    expect(claims.picture).toBeUndefined();
  });

  it("omits optional fields when they are non-string types", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "user_55", email: 42, name: true, picture: null },
    });

    const claims = await verifyIdToken("typed-token", "client_123");
    expect(claims.email).toBeUndefined();
    expect(claims.name).toBeUndefined();
    expect(claims.picture).toBeUndefined();
  });

  it("propagates verification errors thrown by jose.jwtVerify", async () => {
    mockJwtVerify.mockRejectedValue(new Error("JWTExpired: token expired"));

    await expect(verifyIdToken("expired-token", "client_123")).rejects.toThrow(
      "JWTExpired",
    );
  });
});
