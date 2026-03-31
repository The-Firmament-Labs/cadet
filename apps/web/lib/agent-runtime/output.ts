/**
 * Cadet Agent Output Parser
 *
 * Normalizes output from any coding agent into typed events.
 * Handles both ACP JSON-RPC agents and raw text agents.
 */

export type AgentOutputEvent =
  | { type: "thinking"; content: string; timestamp: number }
  | { type: "text"; content: string; timestamp: number }
  | { type: "tool-call"; name: string; input: unknown; output?: unknown; timestamp: number }
  | { type: "diff"; file: string; content: string; timestamp: number }
  | { type: "error"; message: string; timestamp: number }
  | { type: "complete"; stopReason: string; timestamp: number };

/**
 * Parse a line of ACP JSON-RPC output into typed events.
 * ACP agents send newline-delimited JSON with `jsonrpc: "2.0"` messages.
 */
export function parseAcpLine(line: string): AgentOutputEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("{")) return null;

  try {
    const msg = JSON.parse(trimmed) as Record<string, unknown>;

    // JSON-RPC notification: session/update
    if (msg.method === "session/update" && msg.params) {
      const params = msg.params as Record<string, unknown>;
      const content = params.content as Record<string, unknown> | undefined;

      if (content?.type === "thinking") {
        return { type: "thinking", content: String(content.text ?? ""), timestamp: Date.now() };
      }
      if (content?.type === "text") {
        return { type: "text", content: String(content.text ?? ""), timestamp: Date.now() };
      }
      if (content?.type === "tool_use" || content?.type === "tool_call") {
        return {
          type: "tool-call",
          name: String(content.name ?? content.toolName ?? "unknown"),
          input: content.input ?? content.arguments ?? {},
          timestamp: Date.now(),
        };
      }
      if (content?.type === "tool_result") {
        return {
          type: "tool-call",
          name: String(content.name ?? "tool"),
          input: {},
          output: content.output ?? content.content,
          timestamp: Date.now(),
        };
      }
    }

    // JSON-RPC response (prompt complete)
    if (msg.result && typeof msg.id !== "undefined") {
      const result = msg.result as Record<string, unknown>;
      const stopReason = String(result.stopReason ?? "end_turn");
      return { type: "complete", stopReason, timestamp: Date.now() };
    }

    // JSON-RPC error
    if (msg.error && typeof msg.id !== "undefined") {
      const error = msg.error as Record<string, unknown>;
      return { type: "error", message: String(error.message ?? "Unknown error"), timestamp: Date.now() };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse raw text output from non-ACP agents.
 * Extracts diffs (unified format), errors, and plain text.
 */
export function parseRawOutput(output: string): AgentOutputEvent[] {
  const events: AgentOutputEvent[] = [];
  const lines = output.split("\n");
  let currentDiff: { file: string; lines: string[] } | null = null;

  for (const line of lines) {
    // Detect diff headers
    if (line.startsWith("diff --git") || line.startsWith("--- a/") || line.startsWith("+++ b/")) {
      if (line.startsWith("+++ b/")) {
        currentDiff = { file: line.slice(6), lines: [] };
      }
      continue;
    }

    // Accumulate diff content
    if (currentDiff && (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@") || line.startsWith(" "))) {
      currentDiff.lines.push(line);
      continue;
    }

    // End of diff block
    if (currentDiff && currentDiff.lines.length > 0) {
      events.push({
        type: "diff",
        file: currentDiff.file,
        content: currentDiff.lines.join("\n"),
        timestamp: Date.now(),
      });
      currentDiff = null;
    }

    // Detect errors
    if (line.toLowerCase().includes("error:") || line.toLowerCase().includes("fatal:")) {
      events.push({ type: "error", message: line.trim(), timestamp: Date.now() });
      continue;
    }

    // Plain text
    if (line.trim()) {
      events.push({ type: "text", content: line, timestamp: Date.now() });
    }
  }

  // Flush remaining diff
  if (currentDiff && currentDiff.lines.length > 0) {
    events.push({
      type: "diff",
      file: currentDiff.file,
      content: currentDiff.lines.join("\n"),
      timestamp: Date.now(),
    });
  }

  events.push({ type: "complete", stopReason: "end_turn", timestamp: Date.now() });
  return events;
}
