import { describe, expect, it } from "vitest";

import { getOperatorSpacetimeToken, encodeSession, decodeSession, type OperatorSession } from "./auth";

describe("getOperatorSpacetimeToken", () => {
  it("returns the token when present on the session", () => {
    const session: OperatorSession = {
      operatorId: "op-1",
      displayName: "Dex",
      email: "dex@example.com",
      role: "admin",
      spacetimeToken: "oidc-token",
    };

    expect(getOperatorSpacetimeToken(session)).toBe("oidc-token");
  });

  it("returns undefined when the session does not carry a token", () => {
    const session: OperatorSession = {
      operatorId: "op-1",
      displayName: "Dex",
      email: "dex@example.com",
      role: "admin",
    };

    expect(getOperatorSpacetimeToken(session)).toBeUndefined();
    expect(getOperatorSpacetimeToken(null)).toBeUndefined();
  });
});

describe("session encoding", () => {
  it("round-trips encode and decode", () => {
    const session: OperatorSession = {
      operatorId: "op-42",
      displayName: "Test Operator",
      email: "test@cadet.dev",
      role: "operator",
    };

    const encoded = encodeSession(session);
    const decoded = decodeSession(encoded);

    expect(decoded).toEqual(session);
  });

  it("returns null for invalid encoded values", () => {
    expect(decodeSession("not-valid-base64url")).toBeNull();
    expect(decodeSession("")).toBeNull();
  });
});
