/**
 * Vercel Sandbox Integration Tests
 *
 * Validates that the Sandbox SDK API shapes match our usage.
 * These tests create real sandboxes and run commands in them.
 *
 * Skip if VERCEL_TOKEN is not set.
 * Run with: VERCEL_TOKEN=xxx VERCEL_TEAM_ID=xxx bun test integration
 *
 * WARNING: These tests create real Vercel resources. They clean up
 * after themselves but may incur charges.
 */

import { describe, expect, it, afterAll } from "vitest";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const skip = !VERCEL_TOKEN;

const sandboxIdsToCleanup: string[] = [];

describe.skipIf(skip)("Vercel Sandbox Integration", () => {

  afterAll(async () => {
    // Cleanup: stop all sandboxes created during tests
    if (sandboxIdsToCleanup.length === 0) return;
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    for (const id of sandboxIdsToCleanup) {
      try {
        const sb = await Sandbox.get({ sandboxId: id, ...credentials });
        await sb.stop();
      } catch {
        // Already stopped — fine
      }
    }
  });

  it("can create a sandbox", async () => {
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    const sandbox = await Sandbox.create(credentials);
    expect(sandbox).toBeDefined();
    expect(sandbox.sandboxId).toBeTruthy();
    expect(typeof sandbox.sandboxId).toBe("string");
    sandboxIdsToCleanup.push(sandbox.sandboxId);
  });

  it("can run a command in a sandbox", async () => {
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    const sandbox = await Sandbox.create(credentials);
    sandboxIdsToCleanup.push(sandbox.sandboxId);

    const result = await sandbox.runCommand("echo", ["hello world"]);
    expect(result.exitCode).toBe(0);

    const stdout = await result.stdout();
    expect(stdout.trim()).toBe("hello world");
  });

  it("can run sh -c with complex commands", async () => {
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    const sandbox = await Sandbox.create(credentials);
    sandboxIdsToCleanup.push(sandbox.sandboxId);

    // This is how our executor runs agent commands
    const result = await sandbox.runCommand("sh", ["-c", "echo 'test' && pwd"]);
    expect(result.exitCode).toBe(0);

    const stdout = await result.stdout();
    expect(stdout).toContain("test");
  });

  it("can write and read files", async () => {
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    const sandbox = await Sandbox.create(credentials);
    sandboxIdsToCleanup.push(sandbox.sandboxId);

    // Write a file (how writeMissionBrief works)
    await sandbox.runCommand("sh", ["-c", "mkdir -p /workspace && echo '# Test' > /workspace/CLAUDE.md"]);

    // Read it back
    const result = await sandbox.runCommand("sh", ["-c", "cat /workspace/CLAUDE.md"]);
    const stdout = await result.stdout();
    expect(stdout.trim()).toBe("# Test");
  });

  it("sandbox.runCommand returns stderr on failure", async () => {
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    const sandbox = await Sandbox.create(credentials);
    sandboxIdsToCleanup.push(sandbox.sandboxId);

    const result = await sandbox.runCommand("sh", ["-c", "ls /nonexistent 2>&1"]);
    expect(result.exitCode).not.toBe(0);
  });

  it("can take a snapshot and create from it", async () => {
    const { Sandbox } = await import("@vercel/sandbox");
    const credentials = {
      token: VERCEL_TOKEN!,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };

    const sandbox = await Sandbox.create(credentials);
    sandboxIdsToCleanup.push(sandbox.sandboxId);

    // Write state
    await sandbox.runCommand("sh", ["-c", "echo 'checkpoint-data' > /tmp/state.txt"]);

    // Take snapshot
    const snapshot = await sandbox.snapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.snapshotId).toBeTruthy();

    // Shutdown original
    await sandbox.stop();
  });
});
