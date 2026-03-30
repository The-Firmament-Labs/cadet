import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

// Mock GSAP (client-side animation library, not available in test)
vi.mock("gsap", () => ({
  default: { registerPlugin: vi.fn(), utils: { toArray: () => [] }, to: vi.fn() },
  gsap: { registerPlugin: vi.fn(), utils: { toArray: () => [] }, to: vi.fn() },
}));
vi.mock("@gsap/react", () => ({
  useGSAP: vi.fn(),
}));

// Mock server-only modules before importing the component
vi.mock("@/lib/env", () => ({
  getSafeServerEnv: () => ({
    controlPlaneUrl: "http://localhost:3001",
    spacetimeUrl: "http://localhost:3000",
    database: "test-db",
    hasAuthToken: false,
    hasCronSecret: true,
    hasSpacetimeConfig: true,
    hasOperatorAuth: false,
    hasVercelOAuth: false,
  }),
}));

vi.mock("@/lib/cloud-agents", () => ({
  cloudAgentCatalog: [
    {
      id: "saturn",
      name: "Saturn",
      runtime: "edge-function",
      deployment: { execution: "vercel-edge" },
      schedules: [{ id: "s1" }],
    },
  ],
}));

// Import CadetLanding directly (client component, can be rendered sync)
import { CadetLanding } from "./cadet-landing";

describe("HomePage", () => {
  test("renders the Cadet landing-page narrative", () => {
    const markup = renderToStaticMarkup(
      <CadetLanding
        cloudAgents={[{ id: "saturn", name: "Saturn", runtime: "edge-function", execution: "vercel-edge", scheduleCount: 1 }]}
        env={{
          controlPlaneUrl: "http://localhost:3001",
          spacetimeUrl: "http://localhost:3000",
          database: "test-db",
          hasCronSecret: true,
          hasOperatorAuth: false,
        }}
      />
    );
    const orbitMatches = markup.match(/data-orbit-float/g) ?? [];

    expect(markup).toContain("Cadet");
    expect(markup).toContain("Deploy local and edge agents into unified orbit.");
    expect(markup).toContain("MISSION.LOG");
    expect(markup).toContain("/api/cron/reconcile");
    expect(markup).toContain("data-orbit-float");
    expect(orbitMatches.length).toBeGreaterThanOrEqual(4);
  });
});
