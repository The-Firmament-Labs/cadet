/**
 * Cadet Skills System
 *
 * On-demand knowledge documents loaded into agent context only when needed.
 * Progressive disclosure: list (metadata only) → view (full content) → reference (specific file).
 *
 * Hermes uses flat files. We use SpacetimeDB — skills are searchable, versionable,
 * installable from remote registries, and shared across operators.
 */

import { createControlClient } from "../server";
import { sqlEscape } from "../sql";

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  /** Token cost estimate for full content */
  tokenEstimate: number;
  /** Platform restrictions */
  platforms?: string[];
  /** Required env vars */
  requiredEnvVars?: string[];
  /** When this skill should auto-activate */
  activationPatterns?: string[];
  /** Source: built-in, installed, operator-created */
  source: "builtin" | "installed" | "operator";
}

export interface Skill extends SkillMetadata {
  /** Full skill content (markdown) */
  content: string;
  /** Additional reference files */
  references?: Array<{ path: string; content: string }>;
}

// ── Built-in skills ──────────────────────────────────────────────────

const BUILTIN_SKILLS: Skill[] = [
  {
    id: "git-workflow",
    name: "Git Workflow",
    description: "Branch naming, commit messages, PR conventions, rebase vs merge strategies",
    category: "workflow",
    version: "1.0.0",
    author: "cadet",
    tokenEstimate: 800,
    source: "builtin",
    activationPatterns: ["git", "commit", "branch", "merge", "rebase", "pr", "pull request"],
    content: `# Git Workflow

## Branch Naming
- Feature: \`feat/<short-description>\`
- Fix: \`fix/<issue-or-description>\`
- Agent: \`cadet/<run-id>\`

## Commit Messages
Use Conventional Commits: \`type(scope): description\`
Types: feat, fix, chore, docs, test, refactor, perf, ci

## PR Conventions
- Title: concise, under 72 chars
- Body: ## Summary + ## Test Plan
- One logical change per PR
- Link to issues with Fixes #N

## Strategy
- Rebase for feature branches onto main
- Merge commits for release branches
- Squash for single-commit PRs`,
  },
  {
    id: "testing-patterns",
    name: "Testing Patterns",
    description: "Unit, integration, and E2E testing patterns for TypeScript/React projects",
    category: "testing",
    version: "1.0.0",
    author: "cadet",
    tokenEstimate: 1200,
    source: "builtin",
    activationPatterns: ["test", "spec", "vitest", "jest", "playwright", "coverage"],
    content: `# Testing Patterns

## Unit Tests (Vitest)
- One test file per module: \`module.test.ts\`
- Use vi.mock for external deps, vi.hoisted for mock factories
- Test behavior not implementation
- \`describe\` per function, \`it\` per scenario

## Integration Tests
- Test through public API boundaries
- Mock only external services (DB, HTTP)
- Use real implementations for internal modules

## Component Tests
- Render with @testing-library/react
- Query by role/label, not test-id
- Test user interactions, not state

## E2E Tests (Playwright)
- One spec per user flow
- Use page objects for reusable selectors
- Assert visible outcomes, not DOM structure`,
  },
  {
    id: "security-checklist",
    name: "Security Checklist",
    description: "OWASP top 10 prevention, input validation, auth patterns, secret management",
    category: "security",
    version: "1.0.0",
    author: "cadet",
    tokenEstimate: 1000,
    source: "builtin",
    activationPatterns: ["auth", "security", "sql", "injection", "xss", "csrf", "token", "secret", "password", "encrypt"],
    content: `# Security Checklist

## Input Validation
- Validate at system boundaries (API routes, form handlers)
- Use zod schemas for runtime validation
- sqlEscape() for all SQL interpolation — never trust user input

## Authentication
- HMAC-signed session cookies (not JWT in cookies)
- Timing-safe comparison for secrets
- Rate limit auth endpoints
- WebAuthn/passkeys > passwords

## Authorization
- Check ownership on every resource access
- Operator-scoped queries (WHERE operator_id = ...)
- Verify sandbox ownership before exec

## Secrets
- Never hardcode — use env vars
- Rotate regularly
- Encrypt at rest (AES-256-GCM for token store)

## Headers
- HMAC signature verification for webhooks (Slack, GitHub)
- Replay protection (timestamp check, 5min window)
- CORS: explicit origin allowlist`,
  },
  {
    id: "api-design",
    name: "API Design",
    description: "REST API conventions, error handling, pagination, versioning",
    category: "architecture",
    version: "1.0.0",
    author: "cadet",
    tokenEstimate: 900,
    source: "builtin",
    activationPatterns: ["api", "endpoint", "route", "rest", "response", "status code"],
    content: `# API Design

## Response Shape
Always: \`{ ok: boolean, ...data }\` or \`{ ok: false, error: string }\`
Use apiError/apiOk/apiNotFound helpers consistently.

## Status Codes
- 200: Success
- 201: Created
- 400: Bad request (validation)
- 401: Unauthorized (no/invalid session)
- 403: Forbidden (valid session, wrong permissions)
- 404: Not found
- 500: Server error

## Pagination
\`?limit=N&offset=M\` with default limit 50, max 200.
Return \`{ ok: true, items: [], total: N }\`.

## Naming
- Plural nouns: /api/agents, /api/runs
- Nested resources: /api/agents/[agentId]/sessions
- Actions as verbs: /api/runs/[runId]/retry`,
  },
  {
    id: "performance",
    name: "Performance Optimization",
    description: "Caching, query optimization, bundle size, lazy loading patterns",
    category: "performance",
    version: "1.0.0",
    author: "cadet",
    tokenEstimate: 800,
    source: "builtin",
    activationPatterns: ["slow", "performance", "cache", "optimize", "bundle", "lazy", "latency"],
    content: `# Performance

## SpacetimeDB Queries
- Use BTree indexes on frequently queried columns
- LIMIT all queries — never unbounded SELECT *
- Batch related queries with Promise.all()

## Next.js
- Server Components by default (zero client JS)
- Push 'use client' to leaf components
- Use next/image and next/font
- Streaming with Suspense for heavy pages

## Caching
- Edge Config for feature flags
- Runtime Cache for expensive computations
- CDN cache for static assets

## Bundle
- Dynamic imports for heavy components
- Tree-shake unused exports
- Monitor with @next/bundle-analyzer`,
  },
];

// ── Skill operations ─────────────────────────────────────────────────

/** List all available skills (metadata only — cheap). */
export async function listSkills(): Promise<SkillMetadata[]> {
  const builtinMeta: SkillMetadata[] = BUILTIN_SKILLS.map(({ content, references, ...meta }) => meta);

  try {
    const client = createControlClient();
    const rows = (await client.sql(
      "SELECT skill_id, name, description, category, version, author, token_estimate, source FROM agent_skill ORDER BY name ASC",
    )) as Record<string, unknown>[];

    const dbSkills: SkillMetadata[] = rows.map((r) => ({
      id: String(r.skill_id),
      name: String(r.name),
      description: String(r.description),
      category: String(r.category),
      version: String(r.version),
      author: String(r.author),
      tokenEstimate: Number(r.token_estimate ?? 500),
      source: String(r.source ?? "installed") as SkillMetadata["source"],
    }));

    return [...builtinMeta, ...dbSkills];
  } catch {
    return builtinMeta;
  }
}

/** Load full skill content by ID. */
export async function viewSkill(skillId: string): Promise<Skill | null> {
  // Check built-ins first
  const builtin = BUILTIN_SKILLS.find((s) => s.id === skillId);
  if (builtin) return builtin;

  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT * FROM agent_skill WHERE skill_id = '${sqlEscape(skillId)}'`,
    )) as Record<string, unknown>[];

    if (rows.length === 0) return null;
    const r = rows[0]!;
    return {
      id: String(r.skill_id),
      name: String(r.name),
      description: String(r.description),
      category: String(r.category),
      version: String(r.version),
      author: String(r.author),
      tokenEstimate: Number(r.token_estimate ?? 500),
      source: String(r.source ?? "installed") as SkillMetadata["source"],
      content: String(r.content),
    };
  } catch {
    return null;
  }
}

/** Find skills that match activation patterns for a given goal. */
export async function matchSkills(goal: string): Promise<SkillMetadata[]> {
  const words = goal.toLowerCase().split(/\s+/).filter(Boolean);
  const all = await listSkills();

  return all.filter((skill) => {
    if (!skill.activationPatterns) return false;
    return skill.activationPatterns.some((pattern) =>
      words.some((word) => word.includes(pattern) || pattern.includes(word)),
    );
  });
}

/** Install a skill from content (operator-created or from registry). */
export async function installSkill(skill: Omit<Skill, "source">): Promise<void> {
  const client = createControlClient();
  await client.callReducer("upsert_agent_skill", [
    skill.id,
    skill.name,
    skill.description,
    skill.category,
    skill.version,
    skill.author,
    skill.tokenEstimate,
    skill.content,
    JSON.stringify(skill.activationPatterns ?? []),
    "installed",
  ]);
}

/** Delete an installed skill. */
export async function removeSkill(skillId: string): Promise<void> {
  const client = createControlClient();
  await client.callReducer("delete_agent_skill", [skillId]);
}
