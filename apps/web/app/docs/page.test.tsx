import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import DocsPage from "./page";

describe("DocsPage", () => {
  test("renders the operator guide and docs links", () => {
    const markup = renderToStaticMarkup(<DocsPage />);

    expect(markup).toContain("Cadet");
    expect(markup).toContain("Operator Guide");
    expect(markup).toContain("Browser use is a first-class capability");
    expect(markup).toContain("GitHub automation is part of the operator surface.");
    expect(markup).toContain("https://github.com/Dexploarer/cadet/blob/main/docs/AGENT_MANIFESTS.md");
  });
});
