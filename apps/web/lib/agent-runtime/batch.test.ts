import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock variables ────────────────────────────────────────────
const mockSql = vi.hoisted(() => vi.fn());
const mockCallReducer = vi.hoisted(() => vi.fn());
const mockCreateControlClient = vi.hoisted(() =>
  vi.fn(() => ({ sql: mockSql, callReducer: mockCallReducer }))
);

const mockDispatchJobFromPayload = vi.hoisted(() => vi.fn());

vi.mock("../server", () => ({
  createControlClient: mockCreateControlClient,
  dispatchJobFromPayload: mockDispatchJobFromPayload,
}));

import { submitBatch, getBatchStatus, type BatchPrompt } from "./batch";

// ── Helpers ───────────────────────────────────────────────────────────

function makePrompts(count: number): BatchPrompt[] {
  return Array.from({ length: count }, (_, i) => ({
    promptId: `prompt_${i + 1}`,
    prompt: `Do task ${i + 1}`,
    agentId: "claude-code",
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCallReducer.mockResolvedValue(undefined);
  mockSql.mockResolvedValue([]);
  mockDispatchJobFromPayload.mockResolvedValue({ job: { jobId: "job_1" } });
});

// ── submitBatch ───────────────────────────────────────────────────────

describe("submitBatch", () => {
  it("stores batch metadata via upsert_memory_document reducer", async () => {
    const prompts = makePrompts(3);

    await submitBatch({ operatorId: "op_1", prompts });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0]!;
    expect(reducerName).toBe("upsert_memory_document");

    // args[0] is the batchId (document_id), starts with batch_
    expect(args[0]).toMatch(/^batch_/);
    // args[1] is operatorId
    expect(args[1]).toBe("op_1");
    // args[2] is namespace
    expect(args[2]).toBe("batches");
  });

  it("stores correct totalPrompts count in metadata", async () => {
    const prompts = makePrompts(5);

    await submitBatch({ operatorId: "op_1", prompts });

    const [, args] = mockCallReducer.mock.calls[0]!;
    const content = JSON.parse(args[4] as string) as Record<string, unknown>;
    expect(content.totalPrompts).toBe(5);
    expect(content.completedCount).toBe(0);
    expect(content.failedCount).toBe(0);
    expect(content.status).toBe("queued");
  });

  it("dispatches each prompt as a separate job", async () => {
    const prompts = makePrompts(3);

    await submitBatch({ operatorId: "op_1", prompts });

    expect(mockDispatchJobFromPayload).toHaveBeenCalledTimes(3);
  });

  it("passes agentId from prompt when specified", async () => {
    const prompts: BatchPrompt[] = [
      { promptId: "p_1", prompt: "Task 1", agentId: "codex" },
    ];

    await submitBatch({ operatorId: "op_1", prompts });

    const dispatchArg = mockDispatchJobFromPayload.mock.calls[0]![0] as Record<string, unknown>;
    expect(dispatchArg.agentId).toBe("codex");
  });

  it("falls back to batch-level agentId when prompt has none", async () => {
    const prompts: BatchPrompt[] = [
      { promptId: "p_1", prompt: "Task 1" },
    ];

    await submitBatch({ operatorId: "op_1", prompts, agentId: "aider" });

    const dispatchArg = mockDispatchJobFromPayload.mock.calls[0]![0] as Record<string, unknown>;
    expect(dispatchArg.agentId).toBe("aider");
  });

  it("defaults to claude-code when no agentId anywhere", async () => {
    const prompts: BatchPrompt[] = [
      { promptId: "p_1", prompt: "Task 1" },
    ];

    await submitBatch({ operatorId: "op_1", prompts });

    const dispatchArg = mockDispatchJobFromPayload.mock.calls[0]![0] as Record<string, unknown>;
    expect(dispatchArg.agentId).toBe("claude-code");
  });

  it("passes batchId and promptId in context", async () => {
    const prompts: BatchPrompt[] = [
      { promptId: "my_prompt", prompt: "Task" },
    ];

    const result = await submitBatch({ operatorId: "op_1", prompts });

    const dispatchArg = mockDispatchJobFromPayload.mock.calls[0]![0] as Record<string, unknown>;
    const context = dispatchArg.context as Record<string, unknown>;
    expect(context.batchId).toBe(result.batchId);
    expect(context.promptId).toBe("my_prompt");
  });

  it("passes repoUrl in context when provided on prompt", async () => {
    const prompts: BatchPrompt[] = [
      { promptId: "p_1", prompt: "Task", repoUrl: "https://github.com/org/repo" },
    ];

    await submitBatch({ operatorId: "op_1", prompts });

    const dispatchArg = mockDispatchJobFromPayload.mock.calls[0]![0] as Record<string, unknown>;
    const context = dispatchArg.context as Record<string, unknown>;
    expect(context.repoUrl).toBe("https://github.com/org/repo");
  });

  it("returns correct BatchJob shape with running status", async () => {
    const prompts = makePrompts(2);

    const result = await submitBatch({ operatorId: "op_1", prompts });

    expect(result.batchId).toMatch(/^batch_/);
    expect(result.totalPrompts).toBe(2);
    expect(result.completedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.status).toBe("running");
    expect(result.createdAt).toBeTypeOf("number");
  });

  it("continues dispatching even when individual dispatch fails", async () => {
    const prompts = makePrompts(3);
    mockDispatchJobFromPayload
      .mockRejectedValueOnce(new Error("dispatch failed"))
      .mockResolvedValue({ job: { jobId: "job_ok" } });

    // Should not throw
    const result = await submitBatch({ operatorId: "op_1", prompts });
    expect(result.totalPrompts).toBe(3);
    // All 3 were attempted
    expect(mockDispatchJobFromPayload).toHaveBeenCalledTimes(3);
  });

  it("stores concurrency setting in metadata", async () => {
    const prompts = makePrompts(1);

    await submitBatch({ operatorId: "op_1", prompts, concurrency: 10 });

    const [, args] = mockCallReducer.mock.calls[0]!;
    const content = JSON.parse(args[4] as string) as Record<string, unknown>;
    expect(content.concurrency).toBe(10);
  });

  it("defaults concurrency to 5 when not specified", async () => {
    const prompts = makePrompts(1);

    await submitBatch({ operatorId: "op_1", prompts });

    const [, args] = mockCallReducer.mock.calls[0]!;
    const content = JSON.parse(args[4] as string) as Record<string, unknown>;
    expect(content.concurrency).toBe(5);
  });
});

// ── getBatchStatus ────────────────────────────────────────────────────

describe("getBatchStatus", () => {
  it("returns batch data when found in DB", async () => {
    mockSql.mockResolvedValueOnce([
      {
        content: JSON.stringify({
          totalPrompts: 10,
          completedCount: 7,
          failedCount: 1,
          status: "running",
        }),
      },
    ]);

    const batch = await getBatchStatus("batch_abc123");

    expect(batch).not.toBeNull();
    expect(batch!.batchId).toBe("batch_abc123");
    expect(batch!.totalPrompts).toBe(10);
    expect(batch!.completedCount).toBe(7);
    expect(batch!.failedCount).toBe(1);
    expect(batch!.status).toBe("running");
  });

  it("queries DB with the correct batchId", async () => {
    mockSql.mockResolvedValueOnce([
      {
        content: JSON.stringify({
          totalPrompts: 1,
          completedCount: 0,
          failedCount: 0,
          status: "queued",
        }),
      },
    ]);

    await getBatchStatus("batch_test_id");

    expect(mockSql).toHaveBeenCalledOnce();
    const query = mockSql.mock.calls[0]![0] as string;
    expect(query).toContain("batch_test_id");
  });

  it("returns null for unknown batch", async () => {
    mockSql.mockResolvedValueOnce([]);

    const batch = await getBatchStatus("batch_unknown");
    expect(batch).toBeNull();
  });

  it("returns null when DB throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB down"));

    const batch = await getBatchStatus("batch_fail");
    expect(batch).toBeNull();
  });

  it("maps all status values correctly", async () => {
    const statuses = ["queued", "running", "completed", "partial"] as const;

    for (const status of statuses) {
      mockSql.mockResolvedValueOnce([
        {
          content: JSON.stringify({
            totalPrompts: 1,
            completedCount: 0,
            failedCount: 0,
            status,
          }),
        },
      ]);

      const batch = await getBatchStatus(`batch_${status}`);
      expect(batch!.status).toBe(status);
    }
  });

  it("sets createdAt to 0 (not persisted in content)", async () => {
    mockSql.mockResolvedValueOnce([
      {
        content: JSON.stringify({
          totalPrompts: 1,
          completedCount: 0,
          failedCount: 0,
          status: "completed",
        }),
      },
    ]);

    const batch = await getBatchStatus("batch_ts");
    expect(batch!.createdAt).toBe(0);
  });
});
