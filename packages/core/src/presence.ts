export type RunnerPresenceStatus = "alive" | "running" | "idle" | "stale";

export const runnerPresenceStatuses: readonly RunnerPresenceStatus[] = [
  "alive",
  "running",
  "idle",
  "stale"
] as const;

export function isRunnerPresenceStatus(value: string): value is RunnerPresenceStatus {
  return (runnerPresenceStatuses as readonly string[]).includes(value);
}

export function parseRunnerPresenceStatus(
  value: string,
  field = "runner presence status"
): RunnerPresenceStatus {
  if (!isRunnerPresenceStatus(value)) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return value;
}
