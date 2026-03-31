/**
 * Tests for apps/web/lib/api-response.ts
 *
 * No external dependencies — all helpers wrap Response.json(), which is
 * available in the Node.js test environment used by Vitest.
 *
 * Every test verifies: HTTP status code, `ok` envelope field, and the
 * shape of the `result` or `error` payload.
 */

import { describe, expect, it } from "vitest";
import {
  apiOk,
  apiError,
  apiNotFound,
  apiUnauthorized,
  apiForbidden,
  apiUnavailable,
  errorMessage,
} from "../api-response";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// apiOk
// ---------------------------------------------------------------------------

describe("apiOk", () => {
  it("returns HTTP 200", () => {
    expect(apiOk().status).toBe(200);
  });

  it("returns { ok: true } without a result field when no argument is supplied", async () => {
    const body = await bodyOf(apiOk());
    expect(body).toEqual({ ok: true });
  });

  it("includes a result field when a value is provided", async () => {
    const body = await bodyOf(apiOk({ id: "run_1" }));
    expect(body).toEqual({ ok: true, result: { id: "run_1" } });
  });

  it("includes result when the value is null", async () => {
    const body = await bodyOf(apiOk(null));
    expect(body).toEqual({ ok: true, result: null });
  });

  it("includes result when the value is 0 (falsy but defined)", async () => {
    const body = await bodyOf(apiOk(0));
    expect(body).toEqual({ ok: true, result: 0 });
  });

  it("includes result when the value is an array", async () => {
    const body = await bodyOf(apiOk([1, 2, 3]));
    expect(body).toEqual({ ok: true, result: [1, 2, 3] });
  });

  it("does not include a result field when value is undefined", async () => {
    const body = await bodyOf(apiOk(undefined));
    expect(Object.prototype.hasOwnProperty.call(body, "result")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// apiError
// ---------------------------------------------------------------------------

describe("apiError", () => {
  it("returns HTTP 400 by default", () => {
    expect(apiError(new Error("boom")).status).toBe(400);
  });

  it("uses the provided custom status code", () => {
    expect(apiError("bad input", 422).status).toBe(422);
  });

  it("extracts the message from an Error instance", async () => {
    const body = await bodyOf(apiError(new Error("something broke")));
    expect(body).toEqual({ ok: false, error: "something broke" });
  });

  it("uses a plain string as the error message", async () => {
    const body = await bodyOf(apiError("custom error message"));
    expect(body).toEqual({ ok: false, error: "custom error message" });
  });

  it("falls back to 'Unknown error' for an unknown error type", async () => {
    const body = await bodyOf(apiError({ weird: "object" }));
    expect(body).toEqual({ ok: false, error: "Unknown error" });
  });

  it("falls back to 'Unknown error' for a numeric thrown value", async () => {
    const body = await bodyOf(apiError(404));
    expect(body).toEqual({ ok: false, error: "Unknown error" });
  });

  it("falls back to 'Unknown error' for null", async () => {
    const body = await bodyOf(apiError(null));
    expect(body).toEqual({ ok: false, error: "Unknown error" });
  });

  it("falls back to 'Unknown error' for undefined", async () => {
    const body = await bodyOf(apiError(undefined));
    expect(body).toEqual({ ok: false, error: "Unknown error" });
  });
});

// ---------------------------------------------------------------------------
// apiNotFound
// ---------------------------------------------------------------------------

describe("apiNotFound", () => {
  it("returns HTTP 404", () => {
    expect(apiNotFound().status).toBe(404);
  });

  it("returns the default 'Not found' message", async () => {
    const body = await bodyOf(apiNotFound());
    expect(body).toEqual({ ok: false, error: "Not found" });
  });

  it("uses a custom message when supplied", async () => {
    const body = await bodyOf(apiNotFound("Run not found"));
    expect(body).toEqual({ ok: false, error: "Run not found" });
  });
});

// ---------------------------------------------------------------------------
// apiUnauthorized
// ---------------------------------------------------------------------------

describe("apiUnauthorized", () => {
  it("returns HTTP 401", () => {
    expect(apiUnauthorized().status).toBe(401);
  });

  it("returns the default 'Unauthorized' message", async () => {
    const body = await bodyOf(apiUnauthorized());
    expect(body).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("uses a custom message when supplied", async () => {
    const body = await bodyOf(apiUnauthorized("Token expired"));
    expect(body).toEqual({ ok: false, error: "Token expired" });
  });
});

// ---------------------------------------------------------------------------
// apiForbidden
// ---------------------------------------------------------------------------

describe("apiForbidden", () => {
  it("returns HTTP 403", () => {
    expect(apiForbidden().status).toBe(403);
  });

  it("returns the default 'Forbidden' message", async () => {
    const body = await bodyOf(apiForbidden());
    expect(body).toEqual({ ok: false, error: "Forbidden" });
  });

  it("uses a custom message when supplied", async () => {
    const body = await bodyOf(apiForbidden("Insufficient permissions"));
    expect(body).toEqual({ ok: false, error: "Insufficient permissions" });
  });
});

// ---------------------------------------------------------------------------
// apiUnavailable
// ---------------------------------------------------------------------------

describe("apiUnavailable", () => {
  it("returns HTTP 503", () => {
    expect(apiUnavailable().status).toBe(503);
  });

  it("returns the default 'Service unavailable' message", async () => {
    const body = await bodyOf(apiUnavailable());
    expect(body).toEqual({ ok: false, error: "Service unavailable" });
  });

  it("uses a custom message when supplied", async () => {
    const body = await bodyOf(apiUnavailable("SpacetimeDB is unreachable"));
    expect(body).toEqual({ ok: false, error: "SpacetimeDB is unreachable" });
  });
});

// ---------------------------------------------------------------------------
// errorMessage
// ---------------------------------------------------------------------------

describe("errorMessage", () => {
  it("extracts the message from an Error instance", () => {
    expect(errorMessage(new Error("test error"))).toBe("test error");
  });

  it("returns a plain string as-is", () => {
    expect(errorMessage("plain string error")).toBe("plain string error");
  });

  it("returns the default fallback for unknown types", () => {
    expect(errorMessage({ code: 42 })).toBe("Unknown error");
  });

  it("uses a custom fallback when provided", () => {
    expect(errorMessage(null, "custom fallback")).toBe("custom fallback");
  });

  it("returns 'Unknown error' for numeric values", () => {
    expect(errorMessage(500)).toBe("Unknown error");
  });

  it("returns 'Unknown error' for undefined", () => {
    expect(errorMessage(undefined)).toBe("Unknown error");
  });
});
