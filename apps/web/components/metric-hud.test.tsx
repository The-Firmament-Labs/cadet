import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeAll } from "vitest";

// The source component files use JSX without `import React` (automatic runtime).
// Vitest without explicit config uses the classic JSX transform, so we inject
// React onto globalThis so the components can resolve it at runtime.
beforeAll(() => {
  (globalThis as Record<string, unknown>).React = React;
});

// Mock the @/ aliased import that vitest can't resolve
vi.mock("@/lib/utils", () => ({
  cn: (...inputs: (string | boolean | undefined | null)[]) =>
    inputs.filter((x) => typeof x === "string" && x.length > 0).join(" "),
}));

import { MetricHUD } from "./metric-hud";

describe("MetricHUD", () => {
  it("renders with bg-background class for default variant", () => {
    const markup = renderToStaticMarkup(<MetricHUD value={42} label="Active Runs" />);
    expect(markup).toContain("bg-background");
    expect(markup).not.toContain("bg-primary");
  });

  it("renders with bg-primary class for highlight variant", () => {
    const markup = renderToStaticMarkup(<MetricHUD value={7} label="Pending" variant="highlight" />);
    expect(markup).toContain("bg-primary");
    expect(markup).toContain("text-primary-foreground");
  });

  it("renders the value in the output", () => {
    const markup = renderToStaticMarkup(<MetricHUD value={99} label="Total" />);
    expect(markup).toContain("99");
  });

  it("renders the label in the output", () => {
    const markup = renderToStaticMarkup(<MetricHUD value={0} label="Connected Agents" />);
    expect(markup).toContain("Connected Agents");
  });

  it("renders the code sublabel when provided", () => {
    const markup = renderToStaticMarkup(
      <MetricHUD value={3} label="Runs" code="/api/cron/reconcile" />
    );
    expect(markup).toContain("/api/cron/reconcile");
  });

  it("does NOT render a code sublabel when omitted", () => {
    const markup = renderToStaticMarkup(<MetricHUD value={3} label="Runs" />);
    // The code sublabel paragraph should not be in the output at all.
    // We check that font-mono (the code-specific class) is absent.
    expect(markup).not.toContain("font-mono");
  });

  it("renders string values correctly", () => {
    const markup = renderToStaticMarkup(<MetricHUD value="N/A" label="Status" />);
    expect(markup).toContain("N/A");
  });
});

// ---------------------------------------------------------------------------
// Golden Path
// ---------------------------------------------------------------------------

describe("MetricHUD golden path", () => {
  it("renders a fully configured highlight metric with code sublabel", () => {
    const markup = renderToStaticMarkup(
      <MetricHUD value={12} label="Active Workflows" code="workflow_run" variant="highlight" />
    );
    expect(markup).toContain("12");
    expect(markup).toContain("Active Workflows");
    expect(markup).toContain("workflow_run");
    expect(markup).toContain("bg-primary");
    expect(markup).toContain("text-primary-foreground");
  });
});
