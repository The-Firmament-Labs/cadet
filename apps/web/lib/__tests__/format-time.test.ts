/**
 * Tests for apps/web/lib/format-time.ts
 *
 * Uses vi.useFakeTimers to pin Date.now() so all relative-time assertions
 * are deterministic. Real toLocaleDateString / toLocaleString output is
 * locale-dependent; tests that call them verify only the type and
 * non-emptiness rather than an exact string.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeAgo, microsAgo, microsToLocale } from "../format-time";

// ---------------------------------------------------------------------------
// Constants (mirror the implementation for clarity)
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Freeze time at a convenient reference point
// ---------------------------------------------------------------------------

const NOW = new Date("2026-03-30T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// timeAgo — "just now"
// ---------------------------------------------------------------------------

describe("timeAgo — just now (< 1 minute)", () => {
  it("returns 'just now' for the current timestamp", () => {
    expect(timeAgo(NOW)).toBe("just now");
  });

  it("returns 'just now' for 1 second ago", () => {
    expect(timeAgo(NOW - 1_000)).toBe("just now");
  });

  it("returns 'just now' for 59 seconds ago", () => {
    expect(timeAgo(NOW - 59_000)).toBe("just now");
  });

  it("returns 'just now' for a future timestamp (negative diff)", () => {
    // diff < 0 < MINUTE, so "just now"
    expect(timeAgo(NOW + 5_000)).toBe("just now");
  });

  it("accepts a Date object as input", () => {
    expect(timeAgo(new Date(NOW - 30_000))).toBe("just now");
  });
});

// ---------------------------------------------------------------------------
// timeAgo — minutes
// ---------------------------------------------------------------------------

describe("timeAgo — minutes (1 min to < 1 hour)", () => {
  it("returns '1m ago' for exactly 1 minute ago", () => {
    expect(timeAgo(NOW - MINUTE)).toBe("1m ago");
  });

  it("returns '5m ago' for 5 minutes ago", () => {
    expect(timeAgo(NOW - 5 * MINUTE)).toBe("5m ago");
  });

  it("returns '59m ago' for 59 minutes ago", () => {
    expect(timeAgo(NOW - 59 * MINUTE)).toBe("59m ago");
  });

  it("returns '30m ago' for 30 minutes and 30 seconds ago (floors)", () => {
    expect(timeAgo(NOW - 30 * MINUTE - 30_000)).toBe("30m ago");
  });

  it("accepts a Date object for minute-range input", () => {
    expect(timeAgo(new Date(NOW - 10 * MINUTE))).toBe("10m ago");
  });
});

// ---------------------------------------------------------------------------
// timeAgo — hours
// ---------------------------------------------------------------------------

describe("timeAgo — hours (1 hour to < 1 day)", () => {
  it("returns '1h ago' for exactly 1 hour ago", () => {
    expect(timeAgo(NOW - HOUR)).toBe("1h ago");
  });

  it("returns '6h ago' for 6 hours ago", () => {
    expect(timeAgo(NOW - 6 * HOUR)).toBe("6h ago");
  });

  it("returns '23h ago' for 23 hours ago", () => {
    expect(timeAgo(NOW - 23 * HOUR)).toBe("23h ago");
  });

  it("floors fractional hours", () => {
    // 2h 45m → floors to 2h
    expect(timeAgo(NOW - 2 * HOUR - 45 * MINUTE)).toBe("2h ago");
  });
});

// ---------------------------------------------------------------------------
// timeAgo — days
// ---------------------------------------------------------------------------

describe("timeAgo — days (1 day to < 7 days)", () => {
  it("returns '1d ago' for exactly 1 day ago", () => {
    expect(timeAgo(NOW - DAY)).toBe("1d ago");
  });

  it("returns '3d ago' for 3 days ago", () => {
    expect(timeAgo(NOW - 3 * DAY)).toBe("3d ago");
  });

  it("returns '6d ago' for 6 days ago", () => {
    expect(timeAgo(NOW - 6 * DAY)).toBe("6d ago");
  });

  it("floors fractional days", () => {
    // 2 days 20 hours → floors to 2d
    expect(timeAgo(NOW - 2 * DAY - 20 * HOUR)).toBe("2d ago");
  });
});

// ---------------------------------------------------------------------------
// timeAgo — locale date (>= 7 days)
// ---------------------------------------------------------------------------

describe("timeAgo — locale date string (>= 7 days)", () => {
  it("returns a non-empty string for exactly 7 days ago", () => {
    const result = timeAgo(NOW - 7 * DAY);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Not a relative "ago" string
    expect(result).not.toMatch(/ago$/);
  });

  it("returns a non-empty string for 30 days ago", () => {
    const result = timeAgo(NOW - 30 * DAY);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns the locale date (not relative) for very old timestamps", () => {
    const result = timeAgo(new Date("2020-01-01").getTime());
    expect(result).not.toMatch(/ago$/);
  });
});

// ---------------------------------------------------------------------------
// microsAgo
// ---------------------------------------------------------------------------

describe("microsAgo", () => {
  it("converts microseconds to milliseconds before delegating to timeAgo", () => {
    // 2 minutes ago in microseconds
    const micros = (NOW - 2 * MINUTE) * 1000;
    expect(microsAgo(micros)).toBe("2m ago");
  });

  it("returns 'just now' for a micros timestamp equal to now", () => {
    expect(microsAgo(NOW * 1000)).toBe("just now");
  });

  it("returns a locale string for a micros timestamp > 7 days ago", () => {
    const micros = (NOW - 8 * DAY) * 1000;
    const result = microsAgo(micros);
    expect(result).not.toMatch(/ago$/);
  });
});

// ---------------------------------------------------------------------------
// microsToLocale
// ---------------------------------------------------------------------------

describe("microsToLocale", () => {
  it("returns a non-empty locale string", () => {
    const micros = NOW * 1000;
    const result = microsToLocale(micros);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns different strings for different timestamps", () => {
    const a = microsToLocale(NOW * 1000);
    const b = microsToLocale((NOW - DAY) * 1000);
    expect(a).not.toBe(b);
  });

  it("is consistent — same micros value produces the same output", () => {
    const micros = NOW * 1000;
    expect(microsToLocale(micros)).toBe(microsToLocale(micros));
  });
});
