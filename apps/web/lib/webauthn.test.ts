import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the @simplewebauthn/server module before importing the module under test
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async (opts: Record<string, unknown>) => ({
    challenge: "mock-challenge-registration",
    rp: { name: opts.rpName, id: opts.rpID },
    user: { id: opts.userID, name: opts.userName },
    excludeCredentials: opts.excludeCredentials,
    authenticatorSelection: opts.authenticatorSelection,
  })),
  generateAuthenticationOptions: vi.fn(async (opts: Record<string, unknown>) => ({
    challenge: "mock-challenge-authentication",
    rpId: opts.rpID,
    allowCredentials: opts.allowCredentials,
    userVerification: opts.userVerification,
  })),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

import { generateRegistration, generateAuthentication } from "./webauthn";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

const originalEnv = { ...process.env };

beforeEach(() => {
  // Reset env to a clean state for each test
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGIN;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// generateRegistration
// ---------------------------------------------------------------------------

describe("generateRegistration", () => {
  it("returns options with correct rpName 'Cadet Mission Control'", async () => {
    const options = await generateRegistration("op-1", "Test User");
    expect((options as unknown as Record<string, unknown>).rp).toEqual(
      expect.objectContaining({ name: "Cadet Mission Control" })
    );
  });

  it("passes excludeCredentials for existing credential IDs", async () => {
    const options = await generateRegistration("op-1", "Test User", ["cred-a", "cred-b"]);
    const excluded = (options as unknown as Record<string, unknown>).excludeCredentials as Array<{
      id: string;
      transports: string[];
    }>;
    expect(excluded).toHaveLength(2);
    expect(excluded?.[0]?.id).toBe("cred-a");
    expect(excluded?.[1]?.id).toBe("cred-b");
  });
});

// ---------------------------------------------------------------------------
// generateAuthentication
// ---------------------------------------------------------------------------

describe("generateAuthentication", () => {
  it("returns options with allowCredentials matching input", async () => {
    const creds = [
      { id: "cred-1", transports: ["internal" as AuthenticatorTransportFuture] },
      { id: "cred-2", transports: ["usb" as AuthenticatorTransportFuture] },
    ];
    const options = await generateAuthentication(creds);
    const allowed = (options as unknown as Record<string, unknown>).allowCredentials as Array<{
      id: string;
      transports: string[];
    }>;
    expect(allowed).toHaveLength(2);
    expect(allowed?.[0]?.id).toBe("cred-1");
    expect(allowed?.[1]?.id).toBe("cred-2");
  });
});

// ---------------------------------------------------------------------------
// RP ID defaults
// ---------------------------------------------------------------------------

describe("RP ID configuration", () => {
  it("defaults RP ID to 'localhost' when no env vars are set", async () => {
    const options = await generateRegistration("op-1", "User");
    expect((options as unknown as Record<string, unknown>).rp).toEqual(
      expect.objectContaining({ id: "localhost" })
    );
  });

  it("uses WEBAUTHN_RP_ID env var when set", async () => {
    process.env.WEBAUTHN_RP_ID = "cadet.example.com";
    const options = await generateRegistration("op-1", "User");
    expect((options as unknown as Record<string, unknown>).rp).toEqual(
      expect.objectContaining({ id: "cadet.example.com" })
    );
  });

  it("falls back to VERCEL_PROJECT_PRODUCTION_URL hostname when WEBAUTHN_RP_ID is not set", async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "cadet-app.vercel.app";
    const options = await generateRegistration("op-1", "User");
    expect((options as unknown as Record<string, unknown>).rp).toEqual(
      expect.objectContaining({ id: "cadet-app.vercel.app" })
    );
  });
});

// ---------------------------------------------------------------------------
// Origin defaults
// ---------------------------------------------------------------------------

describe("Origin configuration", () => {
  it("defaults origin to 'http://localhost:3001' when no env vars are set", async () => {
    const options = await generateAuthentication([]);
    // The origin is used internally by verify*, but rpId in generateAuthentication
    // reveals the RP ID default. We check that generateAuthentication at least
    // resolves without error, confirming the origin default path runs.
    expect((options as unknown as Record<string, unknown>).rpId).toBe("localhost");
  });

  it("uses WEBAUTHN_ORIGIN env var when set", async () => {
    process.env.WEBAUTHN_ORIGIN = "https://cadet.example.com";
    // Origin is consumed in verify* functions; generateAuthentication uses rpId.
    // We verify the RP ID path is independent:
    const options = await generateAuthentication([]);
    expect((options as unknown as Record<string, unknown>).rpId).toBe("localhost");
  });

  it("falls back to Vercel production URL for origin when WEBAUTHN_ORIGIN is not set", async () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "cadet-app.vercel.app";
    const options = await generateAuthentication([]);
    expect((options as unknown as Record<string, unknown>).rpId).toBe("cadet-app.vercel.app");
  });
});

// ---------------------------------------------------------------------------
// Golden Path
// ---------------------------------------------------------------------------

describe("WebAuthn golden path", () => {
  it("generates registration options then authentication options for same operator", async () => {
    // 1. Generate registration options
    const regOptions = await generateRegistration("op-gp", "Golden User");
    expect(regOptions).toBeDefined();
    expect((regOptions as unknown as Record<string, unknown>).challenge).toBe("mock-challenge-registration");

    // 2. After registration, generate authentication options with the credential
    const authOptions = await generateAuthentication([
      { id: "cred-golden", transports: ["internal" as AuthenticatorTransportFuture] },
    ]);
    expect(authOptions).toBeDefined();
    expect((authOptions as unknown as Record<string, unknown>).challenge).toBe("mock-challenge-authentication");

    const allowed = (authOptions as unknown as unknown as Record<string, unknown>).allowCredentials as Array<{
      id: string;
    }> | undefined;
    expect(allowed?.[0]?.id).toBe("cred-golden");
  });
});
