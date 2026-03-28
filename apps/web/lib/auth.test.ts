import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";

import { getOperatorSpacetimeToken } from "./auth";

describe("getOperatorSpacetimeToken", () => {
  it("returns the OIDC token when present on the session", () => {
    const session = {
      expires: "2099-01-01T00:00:00.000Z",
      spacetimeToken: "oidc-token",
      user: { email: "dex@example.com" }
    } satisfies Session;

    expect(getOperatorSpacetimeToken(session)).toBe("oidc-token");
  });

  it("returns undefined when the session does not carry a token", () => {
    const session = {
      expires: "2099-01-01T00:00:00.000Z",
      user: { email: "dex@example.com" }
    } satisfies Session;

    expect(getOperatorSpacetimeToken(session)).toBeUndefined();
    expect(getOperatorSpacetimeToken(null)).toBeUndefined();
  });
});
