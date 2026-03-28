import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  test("renders the Cadet landing-page narrative", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const orbitMatches = markup.match(/data-orbit-float="true"/g) ?? [];

    expect(markup).toContain("Cadet");
    expect(markup).toContain("Deploy local and edge agents into unified orbit.");
    expect(markup).toContain("View Telemetry");
    expect(markup).toContain("MISSION.LOG");
    expect(markup).toContain("/api/cron/reconcile");
    expect(markup).toContain("data-orbit-float");
    expect(orbitMatches.length).toBeGreaterThanOrEqual(4);
  });
});
