import { describe, expect, it } from "vitest";

import {
  getOperatorAuthConfig,
  getSafeServerEnv,
  getServerEnv,
  hasSpacetimeConfig,
  isOperatorEmailAllowed,
  requireSpacetimeServerEnv
} from "./env";

function asProcessEnv(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("getServerEnv", () => {
  it("derives the control plane URL from Vercel runtime metadata", () => {
    const env = getServerEnv(asProcessEnv({
      VERCEL_URL: "cadet-preview.vercel.app"
    }));

    expect(env.controlPlaneUrl).toBe("https://cadet-preview.vercel.app");
    expect(env.spacetimeUrl).toBe("http://127.0.0.1:3000");
    expect(env.database).toBe("starbridge-control");
  });

  it("trims secret-bearing values before returning them", () => {
    const env = getServerEnv(asProcessEnv({
      NEXT_PUBLIC_CONTROL_PLANE_URL: " https://cadet.example.com ",
      SPACETIMEDB_URL: " https://maincloud.spacetimedb.com ",
      SPACETIMEDB_DATABASE: " cadet-control ",
      SPACETIMEDB_AUTH_TOKEN: " token-value ",
      CRON_SECRET: " cron-value "
    }));

    expect(env).toEqual({
      controlPlaneUrl: "https://cadet.example.com",
      spacetimeUrl: "https://maincloud.spacetimedb.com",
      database: "cadet-control",
      authToken: "token-value",
      cronSecret: "cron-value"
    });
  });
});

describe("getSafeServerEnv", () => {
  it("exposes booleans instead of raw secrets", () => {
    expect(
      getSafeServerEnv(asProcessEnv({
        NEXT_PUBLIC_CONTROL_PLANE_URL: "https://cadet.example.com",
        SPACETIMEDB_URL: "https://maincloud.spacetimedb.com",
        SPACETIMEDB_DATABASE: "cadet-control",
        SPACETIMEDB_AUTH_TOKEN: "token-value",
        CRON_SECRET: "cron-value"
      }))
    ).toEqual({
      controlPlaneUrl: "https://cadet.example.com",
      spacetimeUrl: "https://maincloud.spacetimedb.com",
      database: "cadet-control",
      hasAuthToken: true,
      hasCronSecret: true,
      hasSpacetimeConfig: true,
      hasOperatorAuth: false
    });
  });
});

describe("requireSpacetimeServerEnv", () => {
  it("throws on Vercel when SpacetimeDB configuration is missing", () => {
    expect(() =>
      requireSpacetimeServerEnv(asProcessEnv({
        VERCEL: "1",
        VERCEL_URL: "cadet-hazel.vercel.app"
      }))
    ).toThrowError(/Missing SPACETIMEDB_URL or SPACETIMEDB_DATABASE/);
  });

  it("accepts fully configured Vercel runtime env", () => {
    expect(
      requireSpacetimeServerEnv(asProcessEnv({
        VERCEL: "1",
        VERCEL_PROJECT_PRODUCTION_URL: "cadet-hazel.vercel.app",
        SPACETIMEDB_URL: "https://maincloud.spacetimedb.com",
        SPACETIMEDB_DATABASE: "cadet-control"
      }))
    ).toMatchObject({
      controlPlaneUrl: "https://cadet-hazel.vercel.app",
      spacetimeUrl: "https://maincloud.spacetimedb.com",
      database: "cadet-control"
    });
  });
});

describe("getOperatorAuthConfig", () => {
  it("prefers SpacetimeAuth defaults when the provider is configured", () => {
    expect(
      getOperatorAuthConfig(asProcessEnv({
        AUTH_SECRET: " test-secret ",
        SPACETIMEAUTH_CLIENT_ID: " client_123 ",
        SPACETIMEAUTH_CLIENT_SECRET: " secret_123 ",
        OPERATOR_AUTH_ALLOWED_EMAILS: " Dex@example.com,ops@example.com "
      }))
    ).toEqual({
      enabled: true,
      secret: "test-secret",
      allowedEmails: ["dex@example.com", "ops@example.com"],
      providers: [
        {
          id: "spacetimeauth",
          name: "SpacetimeAuth",
          issuer: "https://auth.spacetimedb.com/oidc",
          clientId: "client_123",
          clientSecret: "secret_123"
        }
      ]
    });
  });

  it("normalizes Auth0 domains into an issuer-backed provider", () => {
    expect(
      getOperatorAuthConfig(asProcessEnv({
        AUTH0_DOMAIN: "cadet.us.auth0.com/",
        AUTH0_CLIENT_ID: "auth0-client",
        AUTH0_CLIENT_SECRET: "auth0-secret"
      })).providers
    ).toEqual([
      {
        id: "auth0",
        name: "Auth0",
        issuer: "https://cadet.us.auth0.com/",
        domain: "cadet.us.auth0.com",
        clientId: "auth0-client",
        clientSecret: "auth0-secret"
      }
    ]);
  });
});

describe("isOperatorEmailAllowed", () => {
  it("allows all emails when no allowlist is configured", () => {
    expect(isOperatorEmailAllowed([], "anyone@example.com")).toBe(true);
  });

  it("matches normalized emails against the allowlist", () => {
    expect(isOperatorEmailAllowed(["dex@example.com"], " Dex@Example.com ")).toBe(true);
    expect(isOperatorEmailAllowed(["dex@example.com"], "ops@example.com")).toBe(false);
    expect(isOperatorEmailAllowed(["dex@example.com"], undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extended coverage: defaults, URL normalization, masking, spacetime config
// ---------------------------------------------------------------------------

describe("getServerEnv – defaults when no env vars are set", () => {
  it("returns localhost defaults for all URLs", () => {
    const env = getServerEnv(asProcessEnv({}));
    expect(env.controlPlaneUrl).toBe("http://localhost:3001");
    expect(env.spacetimeUrl).toBe("http://127.0.0.1:3000");
    expect(env.database).toBe("starbridge-control");
    expect(env.authToken).toBeUndefined();
    expect(env.cronSecret).toBeUndefined();
  });
});

describe("getServerEnv – URL normalization", () => {
  it("adds https:// prefix to bare hostnames for control plane URL", () => {
    const env = getServerEnv(asProcessEnv({
      NEXT_PUBLIC_CONTROL_PLANE_URL: "cadet.example.com"
    }));
    expect(env.controlPlaneUrl).toBe("https://cadet.example.com");
  });

  it("preserves http:// prefix when explicitly set", () => {
    const env = getServerEnv(asProcessEnv({
      NEXT_PUBLIC_CONTROL_PLANE_URL: "http://local.dev:3000"
    }));
    expect(env.controlPlaneUrl).toBe("http://local.dev:3000");
  });

  it("treats empty/whitespace values as unset", () => {
    const env = getServerEnv(asProcessEnv({
      SPACETIMEDB_AUTH_TOKEN: "   ",
      CRON_SECRET: ""
    }));
    expect(env.authToken).toBeUndefined();
    expect(env.cronSecret).toBeUndefined();
  });
});

describe("getSafeServerEnv – masks sensitive values", () => {
  it("exposes hasAuthToken as true when token is set", () => {
    const safe = getSafeServerEnv(asProcessEnv({
      SPACETIMEDB_AUTH_TOKEN: "super-secret"
    }));
    expect(safe.hasAuthToken).toBe(true);
    expect((safe as unknown as Record<string, unknown>).authToken).toBeUndefined();
  });

  it("exposes hasCronSecret as true when cron secret is set", () => {
    const safe = getSafeServerEnv(asProcessEnv({
      CRON_SECRET: "cron-secret-value"
    }));
    expect(safe.hasCronSecret).toBe(true);
    expect((safe as unknown as Record<string, unknown>).cronSecret).toBeUndefined();
  });

  it("exposes hasAuthToken as false when token is not set", () => {
    const safe = getSafeServerEnv(asProcessEnv({}));
    expect(safe.hasAuthToken).toBe(false);
    expect(safe.hasCronSecret).toBe(false);
  });
});

describe("hasSpacetimeConfig", () => {
  it("returns true when both URL and database are set", () => {
    expect(hasSpacetimeConfig(asProcessEnv({
      SPACETIMEDB_URL: "http://localhost:3000",
      SPACETIMEDB_DATABASE: "mydb"
    }))).toBe(true);
  });

  it("returns false when only URL is set", () => {
    expect(hasSpacetimeConfig(asProcessEnv({
      SPACETIMEDB_URL: "http://localhost:3000"
    }))).toBe(false);
  });

  it("returns false when only database is set", () => {
    expect(hasSpacetimeConfig(asProcessEnv({
      SPACETIMEDB_DATABASE: "mydb"
    }))).toBe(false);
  });

  it("returns false when neither is set", () => {
    expect(hasSpacetimeConfig(asProcessEnv({}))).toBe(false);
  });
});

describe("requireSpacetimeServerEnv – Vercel without config", () => {
  it("throws when on Vercel (VERCEL=1) without SpacetimeDB config", () => {
    expect(() =>
      requireSpacetimeServerEnv(asProcessEnv({ VERCEL: "1" }))
    ).toThrowError(/Missing SPACETIMEDB_URL or SPACETIMEDB_DATABASE/);
  });

  it("throws when on Vercel (VERCEL_ENV=production) without SpacetimeDB config", () => {
    expect(() =>
      requireSpacetimeServerEnv(asProcessEnv({ VERCEL_ENV: "production" }))
    ).toThrowError(/Missing SPACETIMEDB_URL or SPACETIMEDB_DATABASE/);
  });

  it("does NOT throw outside Vercel even without SpacetimeDB config", () => {
    expect(() =>
      requireSpacetimeServerEnv(asProcessEnv({}))
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Env golden path
// ---------------------------------------------------------------------------

describe("Env golden path", () => {
  it("fully configured production env: getServerEnv returns correct values, getSafeServerEnv masks secrets, hasSpacetimeConfig is true, requireSpacetimeServerEnv does not throw", () => {
    const source = asProcessEnv({
      VERCEL: "1",
      NEXT_PUBLIC_CONTROL_PLANE_URL: "https://cadet.example.com",
      SPACETIMEDB_URL: "https://maincloud.spacetimedb.com",
      SPACETIMEDB_DATABASE: "cadet-control",
      SPACETIMEDB_AUTH_TOKEN: "secret-token",
      CRON_SECRET: "cron-secret"
    });

    // getServerEnv returns real values
    const env = getServerEnv(source);
    expect(env.authToken).toBe("secret-token");
    expect(env.cronSecret).toBe("cron-secret");

    // getSafeServerEnv hides them
    const safe = getSafeServerEnv(source);
    expect(safe.hasAuthToken).toBe(true);
    expect(safe.hasCronSecret).toBe(true);
    expect((safe as unknown as Record<string, unknown>).authToken).toBeUndefined();

    // hasSpacetimeConfig detects valid config
    expect(safe.hasSpacetimeConfig).toBe(true);

    // requireSpacetimeServerEnv does not throw
    expect(() => requireSpacetimeServerEnv(source)).not.toThrow();
  });
});
