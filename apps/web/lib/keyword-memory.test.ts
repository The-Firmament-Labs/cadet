/**
 * Tests for apps/web/lib/keyword-memory.ts
 *
 * Tests the pure extractKeywordMemories() function only — no mocks needed
 * since it is regex-only with no external dependencies.
 */

import { describe, it, expect } from "vitest";
import { extractKeywordMemories } from "./keyword-memory";

// ---------------------------------------------------------------------------
// Preference detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – preferences", () => {
  it("extracts 'I prefer' preferences", () => {
    const matches = extractKeywordMemories("I prefer TypeScript over JavaScript");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("preference");
    expect(matches[0]!.extract).toContain("TypeScript");
  });

  it("extracts 'I like' preferences", () => {
    const matches = extractKeywordMemories("I like using functional components");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("preference");
  });

  it("extracts 'I always' preferences", () => {
    const matches = extractKeywordMemories("I always run tests before deploying");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("preference");
  });

  it("extracts 'I never' preferences", () => {
    const matches = extractKeywordMemories("I never use var in JavaScript");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("preference");
  });

  it("extracts \"don't ever\" preferences", () => {
    const matches = extractKeywordMemories("don't ever commit directly to main");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("preference");
  });

  it("extracts 'please always' preferences", () => {
    const matches = extractKeywordMemories("please always add type annotations");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("preference");
  });
});

// ---------------------------------------------------------------------------
// Identity detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – identity", () => {
  it("extracts name from 'my name is'", () => {
    const matches = extractKeywordMemories("my name is Alice");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("identity");
    expect(matches[0]!.extract).toContain("Alice");
  });

  it("extracts role from \"I'm a\"", () => {
    const matches = extractKeywordMemories("I'm a backend engineer at Acme Corp");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("identity");
  });

  it("extracts title from 'my role is'", () => {
    const matches = extractKeywordMemories("my role is senior developer");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("identity");
  });

  it("extracts employer from 'I work at'", () => {
    const matches = extractKeywordMemories("I work at Acme Corp on the platform team");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("identity");
  });
});

// ---------------------------------------------------------------------------
// Tech stack detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – tech-stack", () => {
  it("extracts 'we use' tech stack", () => {
    const matches = extractKeywordMemories("we use Next.js and Convex for our stack");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("tech-stack");
  });

  it("extracts 'our stack is' tech stack", () => {
    const matches = extractKeywordMemories("our stack is React, Node, and PostgreSQL");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("tech-stack");
  });

  it("extracts deployment info from 'we deploy with'", () => {
    const matches = extractKeywordMemories("we deploy with Vercel and Railway");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("tech-stack");
  });

  it("extracts 'our repo is' tech stack", () => {
    const matches = extractKeywordMemories("our repo is a monorepo using Turborepo");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("tech-stack");
  });

  it("extracts 'we run on' tech stack", () => {
    const matches = extractKeywordMemories("we run on Kubernetes in AWS");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("tech-stack");
  });
});

// ---------------------------------------------------------------------------
// Correction detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – correction", () => {
  it("extracts 'actually it's' corrections", () => {
    const matches = extractKeywordMemories("actually it's deployed on Railway not Heroku");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("correction");
  });

  it("extracts 'no, it's' corrections", () => {
    const matches = extractKeywordMemories("no, it's in the packages directory");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("correction");
  });

  it("extracts 'the correct' corrections", () => {
    const matches = extractKeywordMemories("the correct answer is TypeScript not JavaScript");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("correction");
  });
});

// ---------------------------------------------------------------------------
// Workflow detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – workflow", () => {
  it("extracts 'we always' workflow rules", () => {
    const matches = extractKeywordMemories("we always run lint before committing");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("workflow");
  });

  it("extracts 'never push' workflow rules", () => {
    const matches = extractKeywordMemories("never push directly to main branch");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("workflow");
  });

  it("extracts 'our process is' workflow rules", () => {
    const matches = extractKeywordMemories("our process is to open a PR and wait for review");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("workflow");
  });

  it("extracts 'the rule is' workflow rules", () => {
    const matches = extractKeywordMemories("the rule is to always squash commits");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("workflow");
  });
});

// ---------------------------------------------------------------------------
// Contact detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – contact", () => {
  it("extracts 'email me at' contact", () => {
    const matches = extractKeywordMemories("email me at alice@example.com");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("contact");
  });

  it("extracts 'reach me on' contact", () => {
    const matches = extractKeywordMemories("reach me on Slack at @alice");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("contact");
  });

  it("extracts 'my handle is' contact", () => {
    const matches = extractKeywordMemories("my handle is @alice_dev");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("contact");
  });
});

// ---------------------------------------------------------------------------
// Project context detection
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – project", () => {
  it("extracts \"we're building\" project context", () => {
    const matches = extractKeywordMemories("we're building a real-time dashboard for IoT devices");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("project");
  });

  it("extracts 'the project is' context", () => {
    const matches = extractKeywordMemories("the project is called Cadet and it's a coding agent");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("project");
  });

  it("extracts 'we're working on' project context", () => {
    const matches = extractKeywordMemories("we're working on a new auth system");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.category).toBe("project");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("extractKeywordMemories – edge cases", () => {
  it("returns empty array for unmatched messages", () => {
    const matches = extractKeywordMemories("hello how are you");
    expect(matches).toHaveLength(0);
  });

  it("returns empty array for very short messages", () => {
    const matches = extractKeywordMemories("hi");
    expect(matches).toHaveLength(0);
  });

  it("returns empty array for empty string", () => {
    const matches = extractKeywordMemories("");
    expect(matches).toHaveLength(0);
  });

  it("strips trailing punctuation from extracts", () => {
    const matches = extractKeywordMemories("I prefer tabs over spaces!");
    expect(matches[0]?.extract).not.toMatch(/[.!?]$/);
  });

  it("deduplicates matches within same category", () => {
    // Both "I prefer React" and "I prefer TypeScript" match the preference pattern,
    // but they produce different extracts so both are returned — the deduplication
    // only collapses identical extract+category pairs.
    const matches = extractKeywordMemories("I prefer React and I prefer TypeScript");
    const extracts = matches.map((m) => m.extract.toLowerCase());
    expect(new Set(extracts).size).toBe(extracts.length);
  });

  it("extracts multiple categories from one message", () => {
    const matches = extractKeywordMemories("my name is Bob and we use Python for our backend");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    const categories = matches.map((m) => m.category);
    expect(categories).toContain("identity");
    expect(categories).toContain("tech-stack");
  });

  it("each match has category, pattern, and extract fields", () => {
    const matches = extractKeywordMemories("I prefer Rust over Go");
    expect(matches.length).toBeGreaterThan(0);
    const m = matches[0]!;
    expect(typeof m.category).toBe("string");
    expect(typeof m.pattern).toBe("string");
    expect(typeof m.extract).toBe("string");
  });

  it("extract length is always at least 3 characters", () => {
    const matches = extractKeywordMemories("I prefer TypeScript, we use Bun for our runtime");
    for (const m of matches) {
      expect(m.extract.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("is case-insensitive for trigger phrases", () => {
    const lower = extractKeywordMemories("i prefer spaces over tabs");
    const upper = extractKeywordMemories("I Prefer spaces over tabs");
    expect(lower.length).toBeGreaterThan(0);
    expect(upper.length).toBeGreaterThan(0);
    expect(lower[0]!.category).toBe(upper[0]!.category);
  });
});
