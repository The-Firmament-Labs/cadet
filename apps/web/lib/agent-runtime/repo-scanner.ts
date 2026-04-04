/**
 * Repo Scanner — First-run memory seeding
 *
 * On first connect (no existing learnings), scans the connected repo for
 * conventions, patterns, and config. Seeds memory_documents so agents are
 * useful immediately instead of starting from zero.
 *
 * Scanned: package.json, tsconfig, test config, CI/CD config, README,
 * deployment config, linters, git info.
 */

import { createControlClient } from "../server";

interface RepoSignal {
  id: string;
  namespace: string;
  title: string;
  content: string;
}

/**
 * Check if repo has been scanned already (any memory_document with source_kind "repo-scan" exists).
 */
export async function isRepoScanned(operatorId: string): Promise<boolean> {
  const client = createControlClient();
  const rows = await client.sql(
    `SELECT document_id FROM memory_document WHERE source_kind = 'repo-scan' LIMIT 1`,
  );
  return (rows as unknown[]).length > 0;
}

/**
 * Scan a repo's sandbox or local filesystem and seed memory.
 * Called from the onboarding flow or first agent run.
 */
export async function scanAndSeedRepo(
  operatorId: string,
  repoFiles: Record<string, string>,
): Promise<{ seeded: number; signals: string[] }> {
  const signals: RepoSignal[] = [];

  // Package.json — scripts, deps, engines
  if (repoFiles["package.json"]) {
    try {
      const pkg = JSON.parse(repoFiles["package.json"]);
      const parts: string[] = [];

      if (pkg.scripts) {
        const scriptKeys = Object.keys(pkg.scripts);
        parts.push(`Scripts: ${scriptKeys.join(", ")}`);
        if (pkg.scripts.test) parts.push(`Test command: ${pkg.scripts.test}`);
        if (pkg.scripts.build) parts.push(`Build command: ${pkg.scripts.build}`);
        if (pkg.scripts.dev) parts.push(`Dev command: ${pkg.scripts.dev}`);
        if (pkg.scripts.lint) parts.push(`Lint command: ${pkg.scripts.lint}`);
      }

      if (pkg.dependencies) {
        const deps = Object.keys(pkg.dependencies);
        const frameworks = deps.filter((d) =>
          ["next", "react", "vue", "svelte", "express", "fastify", "hono", "nest"].some((f) => d.includes(f)),
        );
        if (frameworks.length > 0) parts.push(`Frameworks: ${frameworks.join(", ")}`);

        const testing = deps.filter((d) =>
          ["vitest", "jest", "playwright", "cypress", "mocha"].some((t) => d.includes(t)),
        );
        if (testing.length > 0) parts.push(`Testing: ${testing.join(", ")}`);
      }

      if (pkg.devDependencies) {
        const devDeps = Object.keys(pkg.devDependencies);
        const testing = devDeps.filter((d) =>
          ["vitest", "jest", "playwright", "cypress", "mocha"].some((t) => d.includes(t)),
        );
        if (testing.length > 0) parts.push(`Dev testing: ${testing.join(", ")}`);
      }

      if (pkg.engines) parts.push(`Engines: ${JSON.stringify(pkg.engines)}`);
      if (pkg.type) parts.push(`Module type: ${pkg.type}`);

      if (parts.length > 0) {
        signals.push({
          id: "repo_scan_package",
          namespace: "repo-conventions",
          title: "Package configuration",
          content: parts.join("\n"),
        });
      }
    } catch { /* malformed package.json */ }
  }

  // TypeScript config
  if (repoFiles["tsconfig.json"]) {
    try {
      const tsconfig = JSON.parse(repoFiles["tsconfig.json"]);
      const parts: string[] = [];
      const co = tsconfig.compilerOptions ?? {};
      if (co.strict !== undefined) parts.push(`Strict mode: ${co.strict}`);
      if (co.target) parts.push(`Target: ${co.target}`);
      if (co.module) parts.push(`Module: ${co.module}`);
      if (co.paths) parts.push(`Path aliases: ${Object.keys(co.paths).join(", ")}`);
      if (co.baseUrl) parts.push(`Base URL: ${co.baseUrl}`);

      if (parts.length > 0) {
        signals.push({
          id: "repo_scan_tsconfig",
          namespace: "repo-conventions",
          title: "TypeScript configuration",
          content: parts.join("\n"),
        });
      }
    } catch { /* */ }
  }

  // CI/CD config
  for (const [path, content] of Object.entries(repoFiles)) {
    if (
      path.includes(".github/workflows/") ||
      path === ".gitlab-ci.yml" ||
      path === "vercel.json" ||
      path === "vercel.ts" ||
      path === "Dockerfile"
    ) {
      signals.push({
        id: `repo_scan_ci_${path.replace(/[^a-z0-9]/gi, "_")}`,
        namespace: "repo-deployment",
        title: `CI/CD: ${path}`,
        content: content.slice(0, 500),
      });
    }
  }

  // Linting config
  for (const lintFile of [".eslintrc.json", ".eslintrc.js", "eslint.config.js", "biome.json", ".prettierrc"]) {
    if (repoFiles[lintFile]) {
      signals.push({
        id: `repo_scan_lint_${lintFile.replace(/[^a-z0-9]/gi, "_")}`,
        namespace: "repo-conventions",
        title: `Linting: ${lintFile}`,
        content: repoFiles[lintFile]!.slice(0, 300),
      });
    }
  }

  // Test configuration
  for (const testFile of ["vitest.config.ts", "jest.config.ts", "jest.config.js", "playwright.config.ts"]) {
    if (repoFiles[testFile]) {
      signals.push({
        id: `repo_scan_test_${testFile.replace(/[^a-z0-9]/gi, "_")}`,
        namespace: "repo-testing",
        title: `Test config: ${testFile}`,
        content: repoFiles[testFile]!.slice(0, 500),
      });
    }
  }

  // README summary (first 1000 chars — agents need to know the project purpose)
  if (repoFiles["README.md"]) {
    signals.push({
      id: "repo_scan_readme",
      namespace: "repo-overview",
      title: "Project README",
      content: repoFiles["README.md"]!.slice(0, 1000),
    });
  }

  // CLAUDE.md / AGENTS.md — existing AI instructions
  for (const aiFile of ["CLAUDE.md", "AGENTS.md", ".cursorrules"]) {
    if (repoFiles[aiFile]) {
      signals.push({
        id: `repo_scan_ai_${aiFile.replace(/[^a-z0-9]/gi, "_")}`,
        namespace: "repo-ai-instructions",
        title: `AI instructions: ${aiFile}`,
        content: repoFiles[aiFile]!.slice(0, 1500),
      });
    }
  }

  // Cargo.toml for Rust projects
  if (repoFiles["Cargo.toml"]) {
    signals.push({
      id: "repo_scan_cargo",
      namespace: "repo-conventions",
      title: "Cargo workspace config",
      content: repoFiles["Cargo.toml"]!.slice(0, 500),
    });
  }

  // Seed to SpacetimeDB
  const client = createControlClient();
  let seeded = 0;

  for (const signal of signals) {
    try {
      await client.callReducer("upsert_memory_document", [
        signal.id,
        "system",
        signal.namespace,
        "repo-scan",       // source_kind (4th arg)
        signal.title,      // title (5th arg)
        signal.content,    // content (6th arg)
        JSON.stringify({ operatorId, scannedAt: new Date().toISOString() }),
      ]);
      seeded++;
    } catch {
      // best-effort per signal
    }
  }

  return { seeded, signals: signals.map((s) => s.title) };
}

/**
 * Quick scan from a sandbox — reads key files and seeds memory.
 */
export async function scanSandboxRepo(
  operatorId: string,
  sandboxId: string,
  vercelAccessToken: string,
): Promise<{ seeded: number; signals: string[] }> {
  const filesToScan = [
    "package.json",
    "tsconfig.json",
    "README.md",
    "CLAUDE.md",
    "AGENTS.md",
    ".cursorrules",
    "Cargo.toml",
    "vercel.json",
    "vercel.ts",
    "Dockerfile",
    ".eslintrc.json",
    "eslint.config.js",
    "biome.json",
    ".prettierrc",
    "vitest.config.ts",
    "jest.config.ts",
    "playwright.config.ts",
    ".github/workflows/ci.yml",
    ".github/workflows/deploy.yml",
  ];

  const repoFiles: Record<string, string> = {};

  // Read files from sandbox
  for (const filePath of filesToScan) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/sandbox/sandboxes/${sandboxId}/files/content?path=${encodeURIComponent(filePath)}`,
        { headers: { Authorization: `Bearer ${vercelAccessToken}` } },
      );
      if (res.ok) {
        repoFiles[filePath] = await res.text();
      }
    } catch {
      // file doesn't exist or not readable
    }
  }

  return scanAndSeedRepo(operatorId, repoFiles);
}
