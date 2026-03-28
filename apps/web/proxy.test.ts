import { describe, expect, it, vi } from "vitest";

// Mock next/server to provide NextResponse and NextRequest
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return actual;
});

import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { encodeSession, type OperatorSession } from "./lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(path: string, sessionCookie?: string): NextRequest {
  const url = `http://localhost:3001${path}`;
  const req = new NextRequest(url);
  if (sessionCookie) {
    req.cookies.set("cadet_session", sessionCookie);
  }
  return req;
}

function validEncodedSession(): string {
  const session: OperatorSession = {
    operatorId: "op-proxy",
    displayName: "Proxy Tester",
    email: "proxy@cadet.dev",
    role: "operator",
  };
  return encodeSession(session);
}

// ---------------------------------------------------------------------------
// Public paths — return NextResponse.next()
// ---------------------------------------------------------------------------

describe("proxy – public paths pass through", () => {
  const publicPaths = [
    "/",
    "/sign-in",
    "/sign-up",
    "/docs",
    "/api/health",
  ];

  for (const path of publicPaths) {
    it(`allows ${path} without authentication`, () => {
      const response = proxy(makeRequest(path));
      // NextResponse.next() does not redirect
      expect(response.headers.get("location")).toBeNull();
      expect(response.status).toBe(200);
    });
  }
});

describe("proxy – static assets are public", () => {
  it("allows /_next/static/chunk.js", () => {
    const response = proxy(makeRequest("/_next/static/chunk.js"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows /visuals/img.png", () => {
    const response = proxy(makeRequest("/visuals/img.png"));
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy – API routes that skip auth", () => {
  const openApiPaths = [
    "/api/cron/reconcile",
    "/api/agents/register",
    "/api/jobs/dispatch",
    "/api/github/webhook",
    "/api/slack/events",
  ];

  for (const path of openApiPaths) {
    it(`allows ${path} without authentication`, () => {
      const response = proxy(makeRequest(path));
      expect(response.headers.get("location")).toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// Protected paths — redirect when no session cookie
// ---------------------------------------------------------------------------

describe("proxy – dashboard paths redirect when no session cookie", () => {
  const protectedPaths = [
    "/dashboard",
    "/dashboard/agents",
    "/dashboard/runs/abc",
  ];

  for (const path of protectedPaths) {
    it(`redirects ${path} to /sign-in when unauthenticated`, () => {
      const response = proxy(makeRequest(path));
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location")!);
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("next")).toBe(path);
    });
  }
});

// ---------------------------------------------------------------------------
// Protected paths — pass through when session cookie present
// ---------------------------------------------------------------------------

describe("proxy – dashboard paths pass through when authenticated", () => {
  it("allows /dashboard when session cookie is present", () => {
    const response = proxy(makeRequest("/dashboard", validEncodedSession()));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("allows /dashboard/agents when session cookie is present", () => {
    const response = proxy(makeRequest("/dashboard/agents", validEncodedSession()));
    expect(response.headers.get("location")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Redirect includes ?next= parameter
// ---------------------------------------------------------------------------

describe("proxy – redirect includes original path as next parameter", () => {
  it("encodes /dashboard/runs/abc as next param", () => {
    const response = proxy(makeRequest("/dashboard/runs/abc"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/dashboard/runs/abc");
  });

  it("encodes /settings as next param", () => {
    const response = proxy(makeRequest("/settings"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/settings");
  });
});

// ---------------------------------------------------------------------------
// Golden Path
// ---------------------------------------------------------------------------

describe("Route protection golden path", () => {
  it("unauthenticated /dashboard redirects, then authenticated /dashboard passes through", () => {
    // Step 1: Unauthenticated request to /dashboard
    const unauthResponse = proxy(makeRequest("/dashboard"));
    expect(unauthResponse.status).toBe(307);
    const redirectUrl = new URL(unauthResponse.headers.get("location")!);
    expect(redirectUrl.pathname).toBe("/sign-in");
    expect(redirectUrl.searchParams.get("next")).toBe("/dashboard");

    // Step 2: After authentication, cookie is present
    const authResponse = proxy(makeRequest("/dashboard", validEncodedSession()));
    expect(authResponse.headers.get("location")).toBeNull();
    expect(authResponse.status).toBe(200);
  });
});
