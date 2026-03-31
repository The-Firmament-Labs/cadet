/**
 * Tests for apps/web/lib/token-store.ts
 *
 * Strategy:
 *  - createControlClient (from @/lib/server) is mocked at the module level.
 *  - refreshAccessToken (from @/lib/vercel-auth) is mocked to avoid real HTTP.
 *  - getServerEnv (from @/lib/env) is mocked per-test to control credential
 *    availability.
 *  - AUTH_SECRET is set in process.env before tests so encrypt/decrypt work.
 *  - We exercise the encrypt/decrypt round-trip indirectly through
 *    storeVercelTokens + getVercelAccessToken.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const { mockClient, mockRefreshAccessToken, mockGetServerEnv } = vi.hoisted(() => ({
  mockClient: {
    sql: vi.fn(),
    callReducer: vi.fn(),
  },
  mockRefreshAccessToken: vi.fn(),
  mockGetServerEnv: vi.fn(),
}));

vi.mock("@/lib/server", () => ({
  createControlClient: vi.fn(() => mockClient),
}));

vi.mock("@/lib/vercel-auth", () => ({
  refreshAccessToken: mockRefreshAccessToken,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: mockGetServerEnv,
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { storeVercelTokens, getVercelAccessToken } from "../token-store";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const AUTH_SECRET_VALUE = "test-auth-secret-for-unit-tests";

beforeEach(() => {
  vi.clearAllMocks();
  // Provide a real AUTH_SECRET so the crypto functions operate normally
  process.env.AUTH_SECRET = AUTH_SECRET_VALUE;

  // Default: env has Vercel credentials
  mockGetServerEnv.mockReturnValue({
    vercelClientId: "client_id",
    vercelClientSecret: "client_secret",
  });

  // Default: callReducer succeeds
  mockClient.callReducer.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
});

// ---------------------------------------------------------------------------
// storeVercelTokens
// ---------------------------------------------------------------------------

describe("storeVercelTokens", () => {
  it("calls upsert_operator_token reducer with the correct operatorId", async () => {
    await storeVercelTokens("op_42", "access_token_abc", "refresh_token_def", 1700000000000);

    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(reducerName).toBe("upsert_operator_token");
    expect(args[0]).toBe("op_42");
    expect(args[1]).toBe("vercel");
  });

  it("stores encrypted access and refresh tokens, not the raw values", async () => {
    await storeVercelTokens("op_42", "plaintext_access", "plaintext_refresh", 1700000000000);

    const [, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    const storedAccess = args[2] as string;
    const storedRefresh = args[3] as string;

    // Encrypted values must not equal the plaintext
    expect(storedAccess).not.toBe("plaintext_access");
    expect(storedRefresh).not.toBe("plaintext_refresh");

    // They should be in iv:tag:ciphertext format
    expect(storedAccess.split(":")).toHaveLength(3);
    expect(storedRefresh.split(":")).toHaveLength(3);
  });

  it("converts expiresAtMs to microseconds when calling the reducer", async () => {
    const expiresAtMs = 1700000000000;
    await storeVercelTokens("op_42", "at", "rt", expiresAtMs);

    const [, args] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(args[4]).toBe(expiresAtMs * 1000);
  });

  it("throws when AUTH_SECRET is not set", async () => {
    delete process.env.AUTH_SECRET;
    await expect(
      storeVercelTokens("op_42", "at", "rt", 1700000000000),
    ).rejects.toThrow("AUTH_SECRET");
  });
});

// ---------------------------------------------------------------------------
// getVercelAccessToken — token not found
// ---------------------------------------------------------------------------

describe("getVercelAccessToken — token not found", () => {
  it("returns null when there are no rows for the operator", async () => {
    mockClient.sql.mockResolvedValue([]);

    const result = await getVercelAccessToken("op_unknown");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getVercelAccessToken — valid (non-expired) token
// ---------------------------------------------------------------------------

describe("getVercelAccessToken — non-expired token", () => {
  it("decrypts and returns the access token without refreshing", async () => {
    // Store a token first so we can capture its encrypted form
    const accessToken = "valid_access_token_xyz";
    const refreshToken = "valid_refresh_token_xyz";
    const futureMs = Date.now() + 3_600_000; // 1 hour from now

    await storeVercelTokens("op_42", accessToken, refreshToken, futureMs);
    const [, storeArgs] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];

    // Simulate the DB returning the encrypted values
    mockClient.sql.mockResolvedValue([
      {
        access_token_encrypted: storeArgs[2],
        refresh_token_encrypted: storeArgs[3],
        expires_at_micros: BigInt(futureMs * 1000).toString(),
      },
    ]);

    const result = await getVercelAccessToken("op_42");
    expect(result).toBe(accessToken);
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getVercelAccessToken — expired token, auto-refresh success
// ---------------------------------------------------------------------------

describe("getVercelAccessToken — expired token, refresh succeeds", () => {
  it("calls refreshAccessToken and returns the new access token", async () => {
    const oldAccess = "old_access";
    const oldRefresh = "old_refresh";
    const pastMs = Date.now() - 1000; // already expired

    await storeVercelTokens("op_42", oldAccess, oldRefresh, pastMs);
    const [, storeArgs] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];

    mockClient.sql.mockResolvedValue([
      {
        access_token_encrypted: storeArgs[2],
        refresh_token_encrypted: storeArgs[3],
        expires_at_micros: BigInt(pastMs * 1000).toString(),
      },
    ]);
    vi.clearAllMocks();
    mockClient.callReducer.mockResolvedValue(undefined);

    const newTokenResponse = {
      access_token: "new_access_token",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "new_refresh_token",
    };
    mockRefreshAccessToken.mockResolvedValue(newTokenResponse);

    // Re-setup sql mock after clearAllMocks
    mockClient.sql.mockResolvedValue([
      {
        access_token_encrypted: storeArgs[2],
        refresh_token_encrypted: storeArgs[3],
        expires_at_micros: BigInt(pastMs * 1000).toString(),
      },
    ]);

    const result = await getVercelAccessToken("op_42");
    expect(result).toBe("new_access_token");
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce();
  });

  it("stores the new tokens after a successful refresh", async () => {
    const oldAccess = "old_access";
    const oldRefresh = "old_refresh";
    const pastMs = Date.now() - 1000;

    await storeVercelTokens("op_42", oldAccess, oldRefresh, pastMs);
    const [, storeArgs] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];

    vi.clearAllMocks();
    mockClient.callReducer.mockResolvedValue(undefined);
    mockClient.sql.mockResolvedValue([
      {
        access_token_encrypted: storeArgs[2],
        refresh_token_encrypted: storeArgs[3],
        expires_at_micros: BigInt(pastMs * 1000).toString(),
      },
    ]);
    mockRefreshAccessToken.mockResolvedValue({
      access_token: "new_access",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "new_refresh",
    });

    await getVercelAccessToken("op_42");

    // callReducer should be invoked once more to persist the new tokens
    expect(mockClient.callReducer).toHaveBeenCalledOnce();
    const [reducerName] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];
    expect(reducerName).toBe("upsert_operator_token");
  });
});

// ---------------------------------------------------------------------------
// getVercelAccessToken — expired token, refresh fails
// ---------------------------------------------------------------------------

describe("getVercelAccessToken — expired token, refresh fails", () => {
  it("returns null when refreshAccessToken throws", async () => {
    const pastMs = Date.now() - 1000;

    await storeVercelTokens("op_42", "at", "rt", pastMs);
    const [, storeArgs] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];

    vi.clearAllMocks();
    mockClient.sql.mockResolvedValue([
      {
        access_token_encrypted: storeArgs[2],
        refresh_token_encrypted: storeArgs[3],
        expires_at_micros: BigInt(pastMs * 1000).toString(),
      },
    ]);
    mockRefreshAccessToken.mockRejectedValue(new Error("refresh_token_expired"));

    const result = await getVercelAccessToken("op_42");
    expect(result).toBeNull();
  });

  it("returns null when Vercel credentials are not configured", async () => {
    mockGetServerEnv.mockReturnValue({
      vercelClientId: undefined,
      vercelClientSecret: undefined,
    });

    const pastMs = Date.now() - 1000;
    await storeVercelTokens("op_42", "at", "rt", pastMs);
    const [, storeArgs] = mockClient.callReducer.mock.calls[0] as [string, unknown[]];

    vi.clearAllMocks();
    mockClient.sql.mockResolvedValue([
      {
        access_token_encrypted: storeArgs[2],
        refresh_token_encrypted: storeArgs[3],
        expires_at_micros: BigInt(pastMs * 1000).toString(),
      },
    ]);
    mockGetServerEnv.mockReturnValue({
      vercelClientId: undefined,
      vercelClientSecret: undefined,
    });

    const result = await getVercelAccessToken("op_42");
    expect(result).toBeNull();
    expect(mockRefreshAccessToken).not.toHaveBeenCalled();
  });
});
