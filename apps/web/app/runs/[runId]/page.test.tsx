import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("../../../lib/server", () => ({
  loadRunDetails: vi.fn(async () => ({
    run: {
      runId: "run_job_1",
      threadId: "thread_1",
      agentId: "operator",
      goal: "Sweep incidents",
      priority: "high",
      triggerSource: "cron:reconcile",
      requestedBy: "scheduler",
      currentStage: "verify",
      status: "running",
      summary: null,
      contextJson: "{}",
      createdAtMicros: 100,
      updatedAtMicros: 200,
      completedAtMicros: null
    },
    job: {
      jobId: "job_1",
      agentId: "operator",
      goal: "Sweep incidents",
      priority: "high",
      requestedBy: "scheduler",
      requestedByIdentity: "identity_scheduler",
      contextJson: "{}",
      status: "running",
      runnerId: "runner_1",
      resultSummary: null,
      createdAtMicros: 100,
      updatedAtMicros: 200
    },
    steps: [
      {
        stepId: "step_route",
        runId: "run_job_1",
        agentId: "operator",
        stage: "route",
        ownerExecution: "container-runner",
        status: "completed",
        inputJson: "{}",
        outputJson: "{}",
        retryCount: 0,
        dependsOnStepId: null,
        approvalRequestId: null,
        runnerId: "runner_1",
        createdAtMicros: 100,
        updatedAtMicros: 150,
        claimedAtMicros: 110,
        completedAtMicros: 150
      }
    ],
    messages: [],
    toolCalls: [
      {
        toolCallId: "tool_step_1",
        runId: "run_job_1",
        stepId: "step_route",
        agentId: "operator",
        toolName: "workflow::route",
        status: "completed",
        inputJson: "{}",
        outputJson: "{}",
        createdAtMicros: 120,
        updatedAtMicros: 130
      }
    ],
    approvals: [],
    browserTasks: [],
    browserArtifacts: [],
    retrievalTraces: []
  }))
}));

import RunDetailPage from "./page";

describe("RunDetailPage", () => {
  test("renders linked job and tool call details", async () => {
    const markup = renderToStaticMarkup(
      await RunDetailPage({ params: Promise.resolve({ runId: "run_job_1" }) })
    );

    expect(markup).toContain("Sweep incidents");
    expect(markup).toContain("Job");
    expect(markup).toContain("job_1");
    expect(markup).toContain("Tool Calls");
    expect(markup).toContain("workflow::route");
  });
});
