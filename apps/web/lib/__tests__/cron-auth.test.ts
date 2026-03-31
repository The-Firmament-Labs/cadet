/**
 * Tests for apps/web/lib/cron-auth.ts
 *
 * Strategy:
 *  - getServerEnv is mocked so each test can inject any CRON_SECRET value
 *    without touching process.env.
 *  - Both supported header schemes (Authorization: Bearer and x-cron-secret)
 *    are covered for the positive and negative paths.
 *  - Empty-string and whitespace edge cases verify the trimming behaviour
 *    that safeEquals relies on.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const { mockGetServerEnv } = vi.hoisted(() => ({
  mockGetServerEnv: vi.fn(),
}));

vi.mock("../env", () => ({
  getServerEnv: mockGetServerEnv,
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { verifyCronAuth, cronUnauthorized } from "../cron-auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://app.example.com/api/cron/run", { headers });
}

function withSecret(secret: string | undefined) {
  mockGetServerEnv.mockReturnValue({ cronSecret: secret });
}

// ---------------------------------------------------------------------------
// verifyCronAuth — CRON_SECRET not configured
// ---------------------------------------------------------------------------

describe("verifyCronAuth — CRON_SECRET not configured", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when cronSecret is undefined", () => {
    withSecret(undefined);
    const result = verifyCronAuth(makeRequest());
    expect(result.authorized).toBe(false);
    expect(result.reason).toMatch(/not configured/i);
  });

  it("rejects when cronSecret is an empty string", () => {
    // getServerEnv trims whitespace and returns undefined for blank values,
    // but guard against a misconfigured mock returning ""
    withSecret("");
    const result = verifyCronAuth(makeRequest());
    expect(result.authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// verifyCronAuth — Authorization: Bearer header
// ---------------------------------------------------------------------------

describe("verifyCronAuth — Authorization: Bearer header", () => {
  const SECRET = "super-secret-cron-value";

  beforeEach(() => {
    vi.clearAllMocks();
    withSecret(SECRET);
  });

  it("authorizes a request with the correct Bearer token", () => {
    const req = makeRequest({ authorization: `Bearer ${SECRET}` });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects a request with a wrong Bearer token", () => {
    const req = makeRequest({ authorization: "Bearer wrong-secret" });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects when the Bearer token is empty", () => {
    const req = makeRequest({ authorization: "Bearer " });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
  });

  it("rejects a Bearer token that is a prefix of the real secret", () => {
    const req = makeRequest({
      authorization: `Bearer ${SECRET.slice(0, 5)}`,
    });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
  });

  it("rejects a Bearer token that is a superset of the real secret", () => {
    const req = makeRequest({
      authorization: `Bearer ${SECRET}EXTRA`,
    });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
  });

  it("strips leading/trailing whitespace from the bearer token before comparing", () => {
    const req = makeRequest({ authorization: `Bearer  ${SECRET}  ` });
    // trimmed value should match
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyCronAuth — x-cron-secret header
// ---------------------------------------------------------------------------

describe("verifyCronAuth — x-cron-secret header", () => {
  const SECRET = "cron-header-secret-99";

  beforeEach(() => {
    vi.clearAllMocks();
    withSecret(SECRET);
  });

  it("authorizes a request with the correct x-cron-secret header", () => {
    const req = makeRequest({ "x-cron-secret": SECRET });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(true);
  });

  it("rejects a request with a wrong x-cron-secret header", () => {
    const req = makeRequest({ "x-cron-secret": "not-the-right-value" });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects when the x-cron-secret header is empty", () => {
    const req = makeRequest({ "x-cron-secret": "" });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
  });

  it("strips surrounding whitespace from the header value before comparing", () => {
    const req = makeRequest({ "x-cron-secret": `  ${SECRET}  ` });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyCronAuth — no credentials supplied
// ---------------------------------------------------------------------------

describe("verifyCronAuth — no credentials supplied", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withSecret("some-secret");
  });

  it("rejects a request that has neither Authorization nor x-cron-secret", () => {
    const req = makeRequest();
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects a request with an Authorization header that is not Bearer", () => {
    const req = makeRequest({ authorization: "Basic dXNlcjpwYXNz" });
    const result = verifyCronAuth(req);
    expect(result.authorized).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cronUnauthorized
// ---------------------------------------------------------------------------

describe("cronUnauthorized", () => {
  it("returns a 401 response", () => {
    const res = cronUnauthorized();
    expect(res.status).toBe(401);
  });

  it("returns ok: false in the JSON body", async () => {
    const res = cronUnauthorized();
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(typeof body.error).toBe("string");
  });
});
