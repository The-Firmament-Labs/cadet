#!/usr/bin/env tsx
/**
 * Create a Vercel Sandbox snapshot for an agent environment.
 *
 * Usage:
 *   VERCEL_TOKEN=xxx VERCEL_TEAM_ID=xxx VERCEL_PROJECT_ID=xxx tsx scripts/create-sandbox-snapshot.ts [agentId]
 *
 * If agentId is provided, uses that agent's sandbox config from cloudAgentCatalog.
 * Otherwise creates a default Node.js 24 snapshot with common dev tools.
 */

import { Sandbox } from "@vercel/sandbox";
import { cloudAgentCatalog } from "../lib/cloud-agents";
import type { SandboxEnvironment } from "@starbridge/core";

const agentId = process.argv[2];

const defaultEnv: SandboxEnvironment = {
  runtime: "node24",
  systemPackages: ["git", "jq", "ripgrep"],
  packages: ["typescript", "tsx", "prettier", "eslint"],
  setupCommands: [
    "git config --global user.name 'Cadet Agent'",
    "git config --global user.email 'agent@cadet.dev'",
  ],
  vcpus: 2,
};

async function main() {
  let env: SandboxEnvironment;

  if (agentId) {
    const agent = cloudAgentCatalog.find((a) => a.id === agentId);
    if (!agent) {
      console.error(`Agent '${agentId}' not found in catalog`);
      process.exit(1);
    }
    if (!agent.deployment.sandbox) {
      console.error(`Agent '${agentId}' has no sandbox environment config`);
      process.exit(1);
    }
    env = agent.deployment.sandbox;
    console.log(`Creating snapshot for agent '${agentId}' (${env.runtime})`);
  } else {
    env = defaultEnv;
    console.log("Creating default snapshot (node24 + dev tools)");
  }

  const credentials = {
    token: process.env.VERCEL_TOKEN!,
    teamId: process.env.VERCEL_TEAM_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  };

  if (!credentials.token) {
    console.error("VERCEL_TOKEN is required");
    process.exit(1);
  }

  console.log("Creating sandbox...");
  const sandbox = await Sandbox.create({
    ...credentials,
    runtime: "node24",
    timeout: 300_000,
  });
  console.log(`Sandbox created: ${sandbox.sandboxId}`);

  // Install system packages
  if (env.systemPackages?.length) {
    console.log(`Installing system packages: ${env.systemPackages.join(", ")}`);
    await sandbox.runCommand("sh", [
      "-c",
      `sudo dnf install -y --skip-broken ${env.systemPackages.join(" ")} 2>&1`,
    ]);
  }

  // Install runtime packages
  if (env.packages?.length) {
    console.log(`Installing packages: ${env.packages.join(", ")}`);
    if (env.runtime === "bun") {
      await sandbox.runCommand("sh", ["-c", "curl -fsSL https://bun.sh/install | bash 2>&1"]);
      await sandbox.runCommand("sh", ["-c", `~/.bun/bin/bun add ${env.packages.join(" ")} 2>&1`]);
    } else if (env.runtime === "python3") {
      await sandbox.runCommand("pip3", ["install", ...env.packages]);
    } else {
      await sandbox.runCommand("npm", ["install", "-g", ...env.packages]);
    }
  }

  // Run setup commands
  if (env.setupCommands?.length) {
    console.log("Running setup commands...");
    for (const cmd of env.setupCommands) {
      console.log(`  $ ${cmd}`);
      await sandbox.runCommand("sh", ["-c", cmd]);
    }
  }

  // Create snapshot
  console.log("Creating snapshot...");
  const snapshot = await sandbox.snapshot();
  console.log(`\nSnapshot created successfully!`);
  console.log(`  Snapshot ID: ${snapshot.snapshotId}`);
  console.log(`\nSet this in your agent manifest or .env:`);
  if (agentId) {
    console.log(`  Agent '${agentId}' sandbox.snapshotId: "${snapshot.snapshotId}"`);
  }
  console.log(`  SANDBOX_DEFAULT_TEMPLATE=${snapshot.snapshotId}`);

  await sandbox.stop();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
