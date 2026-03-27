import { describe, expect, it } from "vitest";

import { getSafeServerEnv, getServerEnv, requireSpacetimeServerEnv } from "./env";

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
      hasSpacetimeConfig: true
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
