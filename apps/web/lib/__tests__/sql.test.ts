/**
 * Tests for apps/web/lib/sql.ts
 *
 * sqlEscape must neutralise characters that could mutate a SpacetimeDB SQL
 * query: single quotes, backslashes, and null bytes. All other content must
 * pass through unchanged.
 */

import { describe, expect, it } from "vitest";
import { sqlEscape } from "../sql";

// ---------------------------------------------------------------------------
// Normal / safe input
// ---------------------------------------------------------------------------

describe("sqlEscape — normal strings", () => {
  it("leaves plain ASCII strings unchanged", () => {
    expect(sqlEscape("hello world")).toBe("hello world");
  });

  it("returns an empty string unchanged", () => {
    expect(sqlEscape("")).toBe("");
  });

  it("leaves digits and symbols that are not special unchanged", () => {
    expect(sqlEscape("user-123@example.com")).toBe("user-123@example.com");
  });

  it("leaves forward slashes unchanged", () => {
    expect(sqlEscape("path/to/resource")).toBe("path/to/resource");
  });
});

// ---------------------------------------------------------------------------
// Single-quote escaping
// ---------------------------------------------------------------------------

describe("sqlEscape — single quotes", () => {
  it("doubles a single single-quote", () => {
    expect(sqlEscape("it's")).toBe("it''s");
  });

  it("doubles multiple single-quotes", () => {
    expect(sqlEscape("it's a 'test'")).toBe("it''s a ''test''");
  });

  it("handles a string that is only a single-quote", () => {
    expect(sqlEscape("'")).toBe("''");
  });

  it("handles back-to-back single-quotes", () => {
    expect(sqlEscape("''")).toBe("''''");
  });

  it("does not alter double quotes", () => {
    expect(sqlEscape('"quoted"')).toBe('"quoted"');
  });
});

// ---------------------------------------------------------------------------
// Backslash escaping
// ---------------------------------------------------------------------------

describe("sqlEscape — backslashes", () => {
  it("doubles a single backslash", () => {
    expect(sqlEscape("C:\\Users")).toBe("C:\\\\Users");
  });

  it("doubles multiple backslashes", () => {
    expect(sqlEscape("a\\b\\c")).toBe("a\\\\b\\\\c");
  });

  it("handles a string that is only a backslash", () => {
    expect(sqlEscape("\\")).toBe("\\\\");
  });

  it("escapes backslash before single-quote correctly", () => {
    // Input: \' — output should be \\''
    expect(sqlEscape("\\'")).toBe("\\\\''");
  });

  it("handles consecutive backslashes", () => {
    expect(sqlEscape("\\\\")).toBe("\\\\\\\\");
  });
});

// ---------------------------------------------------------------------------
// Null byte stripping
// ---------------------------------------------------------------------------

describe("sqlEscape — null bytes", () => {
  it("strips a null byte from the middle of a string", () => {
    expect(sqlEscape("hel\0lo")).toBe("hello");
  });

  it("strips a leading null byte", () => {
    expect(sqlEscape("\0hello")).toBe("hello");
  });

  it("strips a trailing null byte", () => {
    expect(sqlEscape("hello\0")).toBe("hello");
  });

  it("strips multiple null bytes", () => {
    expect(sqlEscape("a\0b\0c")).toBe("abc");
  });

  it("returns empty string for a string that is only null bytes", () => {
    expect(sqlEscape("\0\0\0")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Unicode
// ---------------------------------------------------------------------------

describe("sqlEscape — unicode", () => {
  it("leaves standard unicode characters unchanged", () => {
    expect(sqlEscape("café")).toBe("café");
    expect(sqlEscape("日本語")).toBe("日本語");
    expect(sqlEscape("emoji 🚀")).toBe("emoji 🚀");
  });

  it("still escapes single-quotes in unicode strings", () => {
    expect(sqlEscape("naïve 'string'")).toBe("naïve ''string''");
  });
});

// ---------------------------------------------------------------------------
// Combined scenarios
// ---------------------------------------------------------------------------

describe("sqlEscape — combined injection patterns", () => {
  it("neutralises a classic SQL injection payload", () => {
    const payload = "'; DROP TABLE users; --";
    const result = sqlEscape(payload);
    expect(result).toBe("''; DROP TABLE users; --");
    // The output must not start with an unescaped single-quote
    expect(result.startsWith("''")).toBe(true);
  });

  it("handles a payload mixing backslash and single-quote", () => {
    expect(sqlEscape("\\'; malicious")).toBe("\\\\''; malicious");
  });

  it("handles all special characters combined", () => {
    expect(sqlEscape("\\\0'")).toBe("\\\\''");
  });
});
