const MAX_RETRIES = 8;
const MAX_DELAY_MS = 300_000; // 5 minutes

const NON_RETRYABLE_ERRORS = new Set([
  "Unauthorized",
  "Forbidden",
  "Invalid manifest",
  "Operator not found",
  "Agent not found",
  "Sandbox limit reached",
]);

function isNonRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  for (const pattern of NON_RETRYABLE_ERRORS) {
    if (error.message.includes(pattern)) return true;
  }
  return false;
}

export function shouldRetry(
  attempt: number,
  error: unknown,
): { retry: boolean; delayMs: number; reason: string } {
  if (isNonRetryable(error)) {
    return {
      retry: false,
      delayMs: 0,
      reason: `Non-retryable: ${error instanceof Error ? error.message : "unknown"}`,
    };
  }

  if (attempt >= MAX_RETRIES) {
    return {
      retry: false,
      delayMs: 0,
      reason: `Max retries exhausted (${MAX_RETRIES})`,
    };
  }

  const delayMs = Math.min(1000 * 2 ** attempt, MAX_DELAY_MS);
  return {
    retry: true,
    delayMs,
    reason: `Retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms`,
  };
}
