import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeAll } from "vitest";

// Inject React globally for source files that use automatic JSX runtime
beforeAll(() => {
  (globalThis as Record<string, unknown>).React = React;
});

// Mock the @/ aliased imports that vitest can't resolve
vi.mock("@/lib/utils", () => ({
  cn: (...inputs: (string | boolean | undefined | null)[]) =>
    inputs.filter((x) => typeof x === "string" && x.length > 0).join(" "),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    className,
    variant: _variant,
    asChild: _asChild,
    ...rest
  }: React.PropsWithChildren<{
    className?: string;
    variant?: string;
    asChild?: boolean;
    [key: string]: unknown;
  }>) => {
    return React.createElement("span", { className: className ?? "", ...rest }, children);
  },
}));

import { StatusBadge } from "./status-badge";

// ---------------------------------------------------------------------------
// Each status renders the correct text
// ---------------------------------------------------------------------------

describe("StatusBadge – status text rendering", () => {
  const statuses = [
    "running",
    "completed",
    "failed",
    "blocked",
    "queued",
    "pending",
    "active",
  ];

  for (const status of statuses) {
    it(`renders text "${status}" for status="${status}"`, () => {
      const markup = renderToStaticMarkup(<StatusBadge status={status} />);
      expect(markup).toContain(status);
    });
  }
});

// ---------------------------------------------------------------------------
// Unknown status falls back to queued styling
// ---------------------------------------------------------------------------

describe("StatusBadge – fallback styling", () => {
  it("renders unknown status with queued color classes", () => {
    const knownMarkup = renderToStaticMarkup(<StatusBadge status="queued" />);
    const unknownMarkup = renderToStaticMarkup(<StatusBadge status="some-weird-status" />);

    // Both should share the same color classes from the queued entry (#1a1a1a)
    expect(unknownMarkup).toContain("some-weird-status");
    expect(knownMarkup).toContain("#1a1a1a");
    expect(unknownMarkup).toContain("#1a1a1a");
  });
});

// ---------------------------------------------------------------------------
// Badge renders with inline and uppercase
// ---------------------------------------------------------------------------

describe("StatusBadge – element characteristics", () => {
  it("renders as a span element (inline)", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="running" />);
    expect(markup).toMatch(/<span\b/);
  });

  it("renders with uppercase class", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="running" />);
    expect(markup).toContain("uppercase");
  });

  it("renders with font-mono class", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="running" />);
    expect(markup).toContain("font-mono");
  });
});

// ---------------------------------------------------------------------------
// Golden Path
// ---------------------------------------------------------------------------

describe("StatusBadge golden path", () => {
  it("renders a running badge with correct text, styling, and element type", () => {
    const markup = renderToStaticMarkup(<StatusBadge status="running" />);

    // Correct text
    expect(markup).toContain("running");
    // Is an inline span
    expect(markup).toMatch(/<span\b/);
    // Has uppercase styling
    expect(markup).toContain("uppercase");
    // Has the running-specific color
    expect(markup).toContain("#e07b5a");
  });
});
