import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import HomePage from "./page";

describe("HomePage", () => {
  test("renders the Cadet landing-page narrative", () => {
    const markup = renderToStaticMarkup(<HomePage />);
    const astronautMatches = markup.match(/astronaut-cadet\.png/g) ?? [];

    expect(markup).toContain("Cadet");
    expect(markup).toContain("Put local and edge agents into the same event horizon.");
    expect(markup).toContain("Mission log");
    expect(markup).toContain("/api/cron/reconcile");
    expect(markup).toContain("data-orbit-float");
    expect(astronautMatches.length).toBeGreaterThanOrEqual(4);
  });
});
