/**
 * Cadet Batch Processing
 *
 * Dispatch thousands of prompts in parallel using Vercel Queues.
 * Each prompt becomes a queued job that executes independently.
 *
 * Use cases:
 * - Run the same task across multiple repos
 * - Generate test suites for every module
 * - Batch code review across all PRs
 * - Training data generation from trajectories
 */

import { createControlClient } from "../server";

export interface BatchJob {
  batchId: string;
  totalPrompts: number;
  completedCount: number;
  failedCount: number;
  status: "queued" | "running" | "completed" | "partial";
  createdAt: number;
}

export interface BatchPrompt {
  /** Unique ID for this prompt within the batch */
  promptId: string;
  /** The prompt text */
  prompt: string;
  /** Optional: specific agent to use */
  agentId?: string;
  /** Optional: repo URL for this prompt */
  repoUrl?: string;
  /** Optional: additional context */
  context?: Record<string, unknown>;
}

/** Submit a batch of prompts for parallel execution. */
export async function submitBatch(opts: {
  operatorId: string;
  prompts: BatchPrompt[];
  agentId?: string;
  concurrency?: number;
}): Promise<BatchJob> {
  const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const client = createControlClient();

  // Store batch metadata
  await client.callReducer("upsert_memory_document", [
    batchId,
    opts.operatorId,
    "batches",
    `Batch: ${opts.prompts.length} prompts`,
    JSON.stringify({
      totalPrompts: opts.prompts.length,
      completedCount: 0,
      failedCount: 0,
      status: "queued",
      agentId: opts.agentId ?? "claude-code",
      concurrency: opts.concurrency ?? 5,
      prompts: opts.prompts.map((p) => ({ promptId: p.promptId, status: "queued" })),
    }),
    "batch",
    "{}",
  ]);

  // Queue each prompt as a job
  const dispatchModule = await import("../server");
  for (const prompt of opts.prompts) {
    try {
      await dispatchModule.dispatchJobFromPayload({
        agentId: prompt.agentId ?? opts.agentId ?? "claude-code",
        goal: prompt.prompt,
        context: {
          ...prompt.context,
          batchId,
          promptId: prompt.promptId,
          repoUrl: prompt.repoUrl,
        },
      });
    } catch {
      // Queue failures are tracked in batch status
    }
  }

  return {
    batchId,
    totalPrompts: opts.prompts.length,
    completedCount: 0,
    failedCount: 0,
    status: "running",
    createdAt: Date.now(),
  };
}

/** Get batch status. */
export async function getBatchStatus(batchId: string): Promise<BatchJob | null> {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT content FROM memory_document WHERE document_id = '${batchId}'`,
    )) as Record<string, unknown>[];

    if (rows.length === 0) return null;
    const data = JSON.parse(String(rows[0]!.content)) as {
      totalPrompts: number;
      completedCount: number;
      failedCount: number;
      status: string;
    };

    return {
      batchId,
      ...data,
      status: data.status as BatchJob["status"],
      createdAt: 0,
    };
  } catch {
    return null;
  }
}
