#!/usr/bin/env bun

import { runCli } from "./commands";

runCli(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown CLI error";
  console.error(message);
  process.exitCode = 1;
});

