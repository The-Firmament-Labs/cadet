/**
 * API Route Integration Tests
 *
 * Validates that API routes return correct status codes and response shapes.
 * Runs against a live dev server.
 *
 * Skip if CADET_BASE_URL is not set.
 * Run with: CADET_BASE_URL=http://localhost:3000 bun test integration
 */

import { describe, expect, it } from "vitest";

const BASE_URL = process.env.CADET_BASE_URL;
const skip = !BASE_URL;

// Helper to make authenticated requests
async function api(path: string, opts: RequestInit = {}) {
  const sessionToken = process.env.CADET_TEST_SESSION ?? "";
  return fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      Cookie: `cadet_session=${sessionToken}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
  });
}

describe.skipIf(skip)("API Route Integration", () => {

  // ── Public routes (no auth required) ──────────────────────────────

  describe("public routes", () => {
    it("GET /api/health returns 200 with ok: true", async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.status).toBeDefined();
    });

    it("GET /api/catalog returns 200 with agents array", async () => {
      const res = await fetch(`${BASE_URL}/api/catalog`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.agents)).toBe(true);
    });
  });

  // ── Auth-required routes (need valid session) ─────────────────────

  describe.skipIf(!process.env.CADET_TEST_SESSION)("authenticated routes", () => {

    it("GET /api/auth/me returns operator info", async () => {
      const res = await api("/api/auth/me");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.operator).toBeDefined();
      expect(body.operator.operatorId).toBeTruthy();
    });

    it("GET /api/runs returns runs array", async () => {
      const res = await api("/api/runs");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.runs)).toBe(true);
    });

    it("GET /api/runs?limit=5 respects limit", async () => {
      const res = await api("/api/runs?limit=5");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.runs.length).toBeLessThanOrEqual(5);
    });

    it("GET /api/agents/config returns agents", async () => {
      const res = await api("/api/agents/config");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("GET /api/memory returns documents array", async () => {
      const res = await api("/api/memory");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.documents)).toBe(true);
    });

    it("GET /api/threads returns threads array", async () => {
      const res = await api("/api/threads");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.threads)).toBe(true);
    });

    it("GET /api/approvals returns approvals array", async () => {
      const res = await api("/api/approvals");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.approvals)).toBe(true);
    });

    it("GET /api/usage returns usage metrics", async () => {
      const res = await api("/api/usage");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.usage).toBeDefined();
      expect(typeof body.usage.runs).toBe("number");
    });

    it("GET /api/chat returns messages array", async () => {
      const res = await api("/api/chat");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.messages)).toBe(true);
    });

    it("GET /api/sandboxes returns sandboxes", async () => {
      const res = await api("/api/sandboxes");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("GET /api/webhooks returns webhooks array", async () => {
      const res = await api("/api/webhooks");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.webhooks)).toBe(true);
    });
  });

  // ── Auth rejection ────────────────────────────────────────────────

  describe("auth rejection", () => {
    it("GET /api/auth/me without session returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/auth/me`);
      expect(res.status).toBe(401);
    });

    it("GET /api/runs without session returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/runs`);
      expect(res.status).toBe(401);
    });

    it("POST /api/chat without session returns 401", async () => {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── 404 for unknown resources ─────────────────────────────────────

  describe.skipIf(!process.env.CADET_TEST_SESSION)("404 handling", () => {
    it("GET /api/agents/nonexistent returns 404", async () => {
      const res = await api("/api/agents/nonexistent_agent_xyz");
      expect(res.status).toBe(404);
    });

    it("GET /api/memory/nonexistent returns 404", async () => {
      const res = await api("/api/memory/nonexistent_doc_xyz");
      expect(res.status).toBe(404);
    });

    it("GET /api/threads/nonexistent returns 404", async () => {
      const res = await api("/api/threads/nonexistent_thread_xyz");
      expect(res.status).toBe(404);
    });
  });
});
