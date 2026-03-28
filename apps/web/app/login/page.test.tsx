import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("../../lib/auth", () => ({
  getOperatorProviders: () => [],
  getOperatorSession: vi.fn(async () => null),
  isOperatorAuthEnabled: () => false
}));

vi.mock("../../lib/env", () => ({
  getOperatorAuthConfig: () => ({
    enabled: false,
    secret: undefined,
    allowedEmails: [],
    providers: []
  })
}));

import LoginPage from "./page";

describe("LoginPage", () => {
  test("renders setup guidance when operator auth is disabled", async () => {
    const markup = renderToStaticMarkup(
      await LoginPage({ searchParams: Promise.resolve({}) })
    );

    expect(markup).toContain("Operator Access");
    expect(markup).toContain("Auth not configured");
    expect(markup).toContain("SPACETIMEAUTH_*");
    expect(markup).toContain("AUTH0_*");
  });
});
