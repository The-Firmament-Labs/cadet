import { describe, expect, it } from "vitest";

import {
  encodeSession,
  decodeSession,
  getOperatorSpacetimeToken,
  requireOperatorApiSession,
  isOperatorAuthEnabled,
  getOperatorProviders,
  type OperatorSession,
} from "./auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validSession(overrides?: Partial<OperatorSession>): OperatorSession {
  return {
    operatorId: "op-42",
    displayName: "Test Operator",
    email: "test@cadet.dev",
    role: "operator",
    ...overrides,
  };
}

function requestWithCookie(cookie: string): Request {
  return new Request("http://localhost:3001/api/test", {
    headers: { cookie },
  });
}

// ---------------------------------------------------------------------------
// encodeSession / decodeSession
// ---------------------------------------------------------------------------

describe("encodeSession / decodeSession", () => {
  it("round-trips a session with all required fields", () => {
    const session = validSession();
    const encoded = encodeSession(session);
    const decoded = decodeSession(encoded);
    expect(decoded).toEqual(session);
  });

  it("round-trips a session that includes a spacetimeToken", () => {
    const session = validSession({ spacetimeToken: "tok-abc" });
    const encoded = encodeSession(session);
    const decoded = decodeSession(encoded);
    expect(decoded).toEqual(session);
  });

  it("produces a base64url string (no +, /, or = padding)", () => {
    const encoded = encodeSession(validSession());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("decodeSession – rejection", () => {
  it("returns null for an empty string", () => {
    expect(decodeSession("")).toBeNull();
  });

  it("returns null for arbitrary non-base64 text", () => {
    expect(decodeSession("not-valid-base64url!!!")).toBeNull();
  });

  it("returns null for valid base64 that is not JSON", () => {
    const encoded = Buffer.from("hello world").toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("returns null when operatorId is missing", () => {
    const payload = { displayName: "X", email: "x@y.com", role: "admin" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("returns null when displayName is missing", () => {
    const payload = { operatorId: "op-1", email: "x@y.com", role: "admin" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("returns null when email is missing", () => {
    const payload = { operatorId: "op-1", displayName: "X", role: "admin" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("returns null when role is missing", () => {
    const payload = { operatorId: "op-1", displayName: "X", email: "x@y.com" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("returns null when a required field has wrong type (number instead of string)", () => {
    const payload = { operatorId: 42, displayName: "X", email: "x@y.com", role: "admin" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });

  it("returns null for JSON array instead of object", () => {
    const encoded = Buffer.from("[1,2,3]").toString("base64url");
    expect(decodeSession(encoded)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOperatorSpacetimeToken
// ---------------------------------------------------------------------------

describe("getOperatorSpacetimeToken", () => {
  it("returns the token when present on the session", () => {
    const session = validSession({ spacetimeToken: "oidc-token" });
    expect(getOperatorSpacetimeToken(session)).toBe("oidc-token");
  });

  it("returns undefined when the session does not carry a token", () => {
    expect(getOperatorSpacetimeToken(validSession())).toBeUndefined();
  });

  it("returns undefined when session is null", () => {
    expect(getOperatorSpacetimeToken(null)).toBeUndefined();
  });

  it("returns undefined when session is undefined", () => {
    expect(getOperatorSpacetimeToken(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// requireOperatorApiSession
// ---------------------------------------------------------------------------

describe("requireOperatorApiSession", () => {
  it("extracts session from a valid cookie header", async () => {
    const session = validSession({ spacetimeToken: "stdb-tok" });
    const encoded = encodeSession(session);
    const request = requestWithCookie(`cadet_session=${encoded}`);

    const result = await requireOperatorApiSession(request);
    expect(result.unauthorized).toBeNull();
    expect(result.authToken).toBe("stdb-tok");
  });

  it("returns authToken undefined when session has no spacetimeToken", async () => {
    const session = validSession();
    const encoded = encodeSession(session);
    const request = requestWithCookie(`cadet_session=${encoded}`);

    const result = await requireOperatorApiSession(request);
    expect(result.unauthorized).toBeNull();
    expect(result.authToken).toBeUndefined();
  });

  it("returns 401 when no cookie header is present", async () => {
    const request = new Request("http://localhost:3001/api/test");
    const result = await requireOperatorApiSession(request);

    expect(result.unauthorized).not.toBeNull();
    expect(result.unauthorized!.status).toBe(401);
    const body = await result.unauthorized!.json();
    expect(body).toEqual({ ok: false, error: "Authentication required" });
  });

  it("returns 401 when cookie header exists but has no cadet_session", async () => {
    const request = requestWithCookie("other_cookie=value");
    const result = await requireOperatorApiSession(request);

    expect(result.unauthorized).not.toBeNull();
    expect(result.unauthorized!.status).toBe(401);
  });

  it("returns 401 for a corrupt/invalid session cookie value", async () => {
    const request = requestWithCookie("cadet_session=garbage!!!notbase64");
    const result = await requireOperatorApiSession(request);

    expect(result.unauthorized).not.toBeNull();
    expect(result.unauthorized!.status).toBe(401);
    const body = await result.unauthorized!.json();
    expect(body).toEqual({ ok: false, error: "Invalid session" });
  });

  it("extracts session when cadet_session is not the first cookie", async () => {
    const session = validSession({ spacetimeToken: "tok" });
    const encoded = encodeSession(session);
    const request = requestWithCookie(`foo=bar; cadet_session=${encoded}; baz=qux`);

    const result = await requireOperatorApiSession(request);
    expect(result.unauthorized).toBeNull();
    expect(result.authToken).toBe("tok");
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility helpers
// ---------------------------------------------------------------------------

describe("backward compatibility helpers", () => {
  it("isOperatorAuthEnabled always returns true", () => {
    expect(isOperatorAuthEnabled()).toBe(true);
  });

  it("getOperatorProviders returns webauthn passkey", () => {
    expect(getOperatorProviders()).toEqual([{ id: "webauthn", name: "Passkey" }]);
  });
});

// ---------------------------------------------------------------------------
// Golden Path
// ---------------------------------------------------------------------------

describe("Auth golden path", () => {
  it("creates session, encodes, decodes, verifies fields, extracts from cookie, confirms identity", async () => {
    // 1. Create the session
    const session: OperatorSession = {
      operatorId: "op-golden",
      displayName: "Golden Operator",
      email: "golden@cadet.dev",
      role: "admin",
      spacetimeToken: "stdb-golden-token",
    };

    // 2. Encode
    const encoded = encodeSession(session);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    // 3. Decode
    const decoded = decodeSession(encoded);
    expect(decoded).not.toBeNull();

    // 4. Verify all fields match
    expect(decoded!.operatorId).toBe("op-golden");
    expect(decoded!.displayName).toBe("Golden Operator");
    expect(decoded!.email).toBe("golden@cadet.dev");
    expect(decoded!.role).toBe("admin");
    expect(decoded!.spacetimeToken).toBe("stdb-golden-token");

    // 5. Use in an API request via cookie header
    const request = requestWithCookie(`cadet_session=${encoded}`);
    const result = await requireOperatorApiSession(request);

    // 6. Confirm operator identity is accessible
    expect(result.unauthorized).toBeNull();
    expect(result.authToken).toBe("stdb-golden-token");
  });
});
