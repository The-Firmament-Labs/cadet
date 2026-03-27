import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  test("renders the Cadet landing-page narrative", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const orbitMatches = markup.match(/data-orbit-float="true"/g) ?? [];

    expect(markup).toContain("Cadet");
    expect(markup).toContain("Put local and edge agents into the same event horizon.");
    expect(markup).toContain("Read the operator guide");
    expect(markup).toContain("Mission log");
    expect(markup).toContain("/api/cron/reconcile");
    expect(markup).toContain("data-orbit-float");
    expect(orbitMatches.length).toBeGreaterThanOrEqual(4);
  });
});
