/**
 * Tests for apps/web/lib/agent-runtime/output.ts
 *
 * Strategy:
 *   - parseAcpLine: verify every branch of the JSON-RPC parser.
 *   - parseRawOutput: verify diff detection, error detection, plain text,
 *     empty input, and that a 'complete' event is always appended last.
 *   - No external dependencies — pure functions only.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAcpLine, parseRawOutput } from "./output";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSessionUpdate(contentType: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      content: { type: contentType, ...extra },
    },
  });
}

// ---------------------------------------------------------------------------
// parseAcpLine
// ---------------------------------------------------------------------------

describe("parseAcpLine — thinking content", () => {
  it("returns a thinking event with the correct content", () => {
    const line = makeSessionUpdate("thinking", { text: "Let me analyse this..." });
    const event = parseAcpLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe("thinking");
    if (event!.type === "thinking") {
      expect(event!.content).toBe("Let me analyse this...");
    }
  });

  it("returns a thinking event with empty content when text is absent", () => {
    const line = makeSessionUpdate("thinking");
    const event = parseAcpLine(line);
    expect(event!.type).toBe("thinking");
    if (event!.type === "thinking") {
      expect(event!.content).toBe("");
    }
  });

  it("attaches a numeric timestamp", () => {
    const before = Date.now();
    const event = parseAcpLine(makeSessionUpdate("thinking", { text: "hi" }));
    const after = Date.now();
    expect(event!.timestamp).toBeGreaterThanOrEqual(before);
    expect(event!.timestamp).toBeLessThanOrEqual(after);
  });
});

describe("parseAcpLine — text content", () => {
  it("returns a text event with the correct content", () => {
    const line = makeSessionUpdate("text", { text: "Here is the fix." });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("text");
    if (event!.type === "text") {
      expect(event!.content).toBe("Here is the fix.");
    }
  });

  it("returns a text event with empty content when text is absent", () => {
    const line = makeSessionUpdate("text");
    const event = parseAcpLine(line);
    expect(event!.type).toBe("text");
    if (event!.type === "text") {
      expect(event!.content).toBe("");
    }
  });
});

describe("parseAcpLine — tool_use / tool_call content", () => {
  it("returns a tool-call event for tool_use type", () => {
    const line = makeSessionUpdate("tool_use", { name: "read_file", input: { path: "/src/index.ts" } });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("tool-call");
    if (event!.type === "tool-call") {
      expect(event!.name).toBe("read_file");
      expect(event!.input).toEqual({ path: "/src/index.ts" });
    }
  });

  it("returns a tool-call event for tool_call type", () => {
    const line = makeSessionUpdate("tool_call", { toolName: "run_tests", arguments: { suite: "all" } });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("tool-call");
    if (event!.type === "tool-call") {
      expect(event!.name).toBe("run_tests");
    }
  });

  it("uses 'unknown' as name when name and toolName are absent", () => {
    const line = makeSessionUpdate("tool_use", { input: {} });
    const event = parseAcpLine(line);
    if (event!.type === "tool-call") {
      expect(event!.name).toBe("unknown");
    }
  });
});

describe("parseAcpLine — tool_result content", () => {
  it("returns a tool-call event with output populated", () => {
    const line = makeSessionUpdate("tool_result", { name: "read_file", output: "file contents here" });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("tool-call");
    if (event!.type === "tool-call") {
      expect(event!.output).toBe("file contents here");
    }
  });

  it("falls back to content field when output is absent", () => {
    const line = makeSessionUpdate("tool_result", { content: "fallback content" });
    const event = parseAcpLine(line);
    if (event!.type === "tool-call") {
      expect(event!.output).toBe("fallback content");
    }
  });
});

describe("parseAcpLine — JSON-RPC response (complete)", () => {
  it("returns a complete event with stopReason from result", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { stopReason: "end_turn" } });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("complete");
    if (event!.type === "complete") {
      expect(event!.stopReason).toBe("end_turn");
    }
  });

  it("defaults stopReason to 'end_turn' when not in result", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 2, result: {} });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("complete");
    if (event!.type === "complete") {
      expect(event!.stopReason).toBe("end_turn");
    }
  });

  it("handles id of 0 (falsy) correctly", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 0, result: { stopReason: "max_tokens" } });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("complete");
  });
});

describe("parseAcpLine — JSON-RPC error", () => {
  it("returns an error event with the error message", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32600, message: "Invalid Request" } });
    const event = parseAcpLine(line);
    expect(event!.type).toBe("error");
    if (event!.type === "error") {
      expect(event!.message).toBe("Invalid Request");
    }
  });

  it("defaults to 'Unknown error' when error.message is absent", () => {
    const line = JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32600 } });
    const event = parseAcpLine(line);
    if (event!.type === "error") {
      expect(event!.message).toBe("Unknown error");
    }
  });
});

describe("parseAcpLine — invalid / non-JSON input", () => {
  it("returns null for invalid JSON", () => {
    expect(parseAcpLine("{not valid json}")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseAcpLine("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(parseAcpLine("   ")).toBeNull();
  });

  it("returns null for non-JSON plain text", () => {
    expect(parseAcpLine("plain text output")).toBeNull();
  });

  it("returns null for a JSON array (not an object)", () => {
    expect(parseAcpLine("[1, 2, 3]")).toBeNull();
  });

  it("returns null for a JSON object that matches no known pattern", () => {
    expect(parseAcpLine(JSON.stringify({ foo: "bar" }))).toBeNull();
  });

  it("returns null for a session/update with unknown content type", () => {
    const line = makeSessionUpdate("image", { url: "http://example.com/img.png" });
    expect(parseAcpLine(line)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseRawOutput
// ---------------------------------------------------------------------------

describe("parseRawOutput — plain text lines", () => {
  it("returns a text event for each non-empty line", () => {
    const events = parseRawOutput("line one\nline two\nline three");
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents).toHaveLength(3);
  });

  it("skips blank lines (no text event created)", () => {
    const events = parseRawOutput("line one\n\nline two");
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents).toHaveLength(2);
  });

  it("preserves line content verbatim", () => {
    const events = parseRawOutput("Hello, world!");
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents[0]).toMatchObject({ type: "text", content: "Hello, world!" });
  });
});

describe("parseRawOutput — diff detection", () => {
  it("emits a diff event for a unified diff block", () => {
    const diffOutput = [
      "diff --git a/src/index.ts b/src/index.ts",
      "--- a/src/index.ts",
      "+++ b/src/index.ts",
      "@@ -1,3 +1,4 @@",
      " const x = 1;",
      "+const y = 2;",
      "-const z = 3;",
    ].join("\n");

    const events = parseRawOutput(diffOutput);
    const diffEvents = events.filter((e) => e.type === "diff");
    expect(diffEvents).toHaveLength(1);
    if (diffEvents[0]!.type === "diff") {
      expect(diffEvents[0]!.file).toBe("src/index.ts");
      expect(diffEvents[0]!.content).toContain("+const y = 2;");
    }
  });

  it("does not emit a text event for diff header lines", () => {
    const diffOutput = "diff --git a/foo.ts b/foo.ts\n--- a/foo.ts\n+++ b/foo.ts\n+added line\n";
    const events = parseRawOutput(diffOutput);
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents).toHaveLength(0);
  });

  it("uses the file path from the +++ b/ line", () => {
    const diffOutput = "+++ b/lib/utils/helper.ts\n+new code";
    const events = parseRawOutput(diffOutput);
    const diffEvents = events.filter((e) => e.type === "diff");
    expect(diffEvents).toHaveLength(1);
    if (diffEvents[0]!.type === "diff") {
      expect(diffEvents[0]!.file).toBe("lib/utils/helper.ts");
    }
  });
});

describe("parseRawOutput — error line detection", () => {
  it("emits an error event for lines containing 'error:'", () => {
    const events = parseRawOutput("TypeScript error: cannot find module 'foo'");
    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
  });

  it("emits an error event for lines containing 'fatal:'", () => {
    const events = parseRawOutput("fatal: repository 'https://github.com/x/y' not found");
    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
  });

  it("is case-insensitive for error detection", () => {
    const events = parseRawOutput("ERROR: something went wrong");
    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
  });

  it("does not emit a text event for error lines", () => {
    const events = parseRawOutput("fatal: something broken");
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents).toHaveLength(0);
  });
});

describe("parseRawOutput — empty output", () => {
  it("still appends a complete event for empty string", () => {
    const events = parseRawOutput("");
    const completeEvents = events.filter((e) => e.type === "complete");
    expect(completeEvents).toHaveLength(1);
  });

  it("returns only the complete event for all-whitespace input", () => {
    const events = parseRawOutput("   \n   \n   ");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("complete");
  });
});

describe("parseRawOutput — complete event is always last", () => {
  it("appends complete as the final event for plain text", () => {
    const events = parseRawOutput("some text output\nmore text");
    expect(events[events.length - 1]!.type).toBe("complete");
  });

  it("appends complete as the final event for diff output", () => {
    const diffOutput = "+++ b/foo.ts\n+added line\n";
    const events = parseRawOutput(diffOutput);
    expect(events[events.length - 1]!.type).toBe("complete");
  });

  it("appends complete as the final event for error output", () => {
    const events = parseRawOutput("error: failed to compile");
    expect(events[events.length - 1]!.type).toBe("complete");
  });

  it("complete event has stopReason of 'end_turn'", () => {
    const events = parseRawOutput("some output");
    const complete = events[events.length - 1]!;
    expect(complete.type).toBe("complete");
    if (complete.type === "complete") {
      expect(complete.stopReason).toBe("end_turn");
    }
  });
});

describe("parseRawOutput — mixed content", () => {
  it("handles mixed text, diff, and error lines correctly", () => {
    const output = [
      "Running linter...",
      "diff --git a/src/app.ts b/src/app.ts",
      "+++ b/src/app.ts",
      "+const x = 1;",
      "Done running linter.",
      "error: lint failed on 1 file",
    ].join("\n");

    const events = parseRawOutput(output);
    const types = events.map((e) => e.type);
    expect(types).toContain("text");
    expect(types).toContain("diff");
    expect(types).toContain("error");
    expect(types).toContain("complete");
    expect(types[types.length - 1]).toBe("complete");
  });
});
