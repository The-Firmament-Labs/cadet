import type {
  AgentManifest,
  ApprovalRequestRecord,
  BrowserArtifactRecord,
  BrowserTaskRecord,
  BrowserToolRequest,
  ControlPlaneTarget,
  DeliveryAttemptRecord,
  MemoryChunk,
  MemoryDocument,
  MemoryEmbedding,
  MessageEventRecord,
  NormalizedJobRequest,
  RegisteredScheduleRecord,
  RetrievalTrace,
  ScheduleRegistration,
  ThreadRecord,
  WorkflowRunRecord,
  WorkflowStepRecord
} from "@starbridge/core";

export interface StarbridgeControlClientOptions {
  baseUrl: string;
  database: string;
  authToken?: string | undefined;
  fetchImpl?: typeof fetch;
}

export interface RunnerPresenceRecord {
  runnerId: string;
  agentId: string;
  controlPlane: ControlPlaneTarget;
  status: string;
  lastSeenAtMicros: number;
}

interface SqlSchemaElement {
  name?: { some?: string } | null;
  algebraic_type?: Record<string, unknown>;
}

interface SqlResultSet {
  schema?: {
    elements?: SqlSchemaElement[];
  };
  rows?: unknown[][];
}

function asString(value: unknown, field: string): string {
  return String(value ?? "").trim();
}

function asNumber(value: unknown, field: string): number {
  const parsed = Number(value ?? 0);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to decode numeric field '${field}'`);
  }
  return parsed;
}

function asOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

export class StarbridgeControlClient {
  private static readonly schemaVersion = "9";
  private readonly baseUrl: string;
  private readonly database: string;
  private readonly authToken: string | undefined;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: StarbridgeControlClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.database = options.database;
    this.authToken = options.authToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async schema(): Promise<unknown> {
    return this.request(
      "GET",
      this.buildPath(`schema?version=${StarbridgeControlClient.schemaVersion}`)
    );
  }

  public async sql(query: string): Promise<unknown> {
    return this.request("POST", this.buildPath("sql"), query, {
      "content-type": "text/plain; charset=utf-8"
    });
  }

  public async selectAll(tableName: string): Promise<Record<string, unknown>[]> {
    return decodeSqlRows(await this.sql(`SELECT * FROM ${tableName}`));
  }

  public async registerAgent(manifest: AgentManifest): Promise<unknown> {
    return this.callReducer("register_agent", [
      manifest.id,
      manifest.name,
      manifest.runtime,
      manifest.deployment.controlPlane,
      manifest.deployment.execution,
      manifest.deployment.workflow,
      manifest.model,
      JSON.stringify(manifest.tags)
    ]);
  }

  public async remember(
    agentId: string,
    namespace: string,
    content: string
  ): Promise<unknown> {
    return this.callReducer("remember", [agentId, namespace, content]);
  }

  public async enqueueJob(job: NormalizedJobRequest): Promise<unknown> {
    return this.callReducer("enqueue_job", [
      job.jobId,
      job.agentId,
      job.goal,
      job.priority,
      job.requestedBy,
      JSON.stringify(job.context)
    ]);
  }

  public async markJobStarted(jobId: string, runnerId: string): Promise<unknown> {
    return this.callReducer("start_job", [jobId, runnerId]);
  }

  public async markJobCompleted(jobId: string, summary: string): Promise<unknown> {
    return this.callReducer("complete_job", [jobId, summary]);
  }

  public async markJobFailed(jobId: string, summary: string): Promise<unknown> {
    return this.callReducer("fail_job", [jobId, summary]);
  }

  public async registerSchedule(schedule: ScheduleRegistration): Promise<unknown> {
    return this.callReducer("register_schedule", [
      schedule.scheduleId,
      schedule.agentId,
      schedule.controlPlane,
      schedule.goal,
      schedule.intervalMinutes,
      schedule.priority,
      schedule.requestedBy,
      schedule.enabled
    ]);
  }

  public async claimScheduledRun(
    scheduleId: string,
    controlPlane: ControlPlaneTarget,
    expectedNextRunAtMicros: number,
    job: NormalizedJobRequest
  ): Promise<unknown> {
    return this.callReducer("claim_schedule_run", [
      scheduleId,
      controlPlane,
      expectedNextRunAtMicros,
      job.jobId,
      JSON.stringify(job.context)
    ]);
  }

  public async upsertPresence(
    agentId: string,
    runnerId: string,
    controlPlane: ControlPlaneTarget,
    status: string
  ): Promise<unknown> {
    return this.callReducer("upsert_presence", [agentId, runnerId, controlPlane, status]);
  }

  public async ingestMessage(payload: {
    threadId: string;
    channel: "web" | "slack" | "github" | "system";
    channelThreadId: string;
    title: string;
    eventId: string;
    runId?: string | null;
    direction: "inbound" | "outbound" | "system";
    actor: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.callReducer("ingest_message", [
      payload.threadId,
      payload.channel,
      payload.channelThreadId,
      payload.title,
      payload.eventId,
      payload.runId ?? null,
      payload.direction,
      payload.actor,
      payload.content,
      JSON.stringify(payload.metadata ?? {})
    ]);
  }

  public async startWorkflowRun(payload: {
    runId: string;
    threadId: string;
    agentId: string;
    goal: string;
    priority: NormalizedJobRequest["priority"];
    triggerSource: string;
    requestedBy: string;
    context: Record<string, unknown>;
  }): Promise<unknown> {
    return this.callReducer("start_workflow_run", [
      payload.runId,
      payload.threadId,
      payload.agentId,
      payload.goal,
      payload.priority,
      payload.triggerSource,
      payload.requestedBy,
      JSON.stringify(payload.context)
    ]);
  }

  public async enqueueWorkflowStep(payload: {
    stepId: string;
    runId: string;
    agentId: string;
    stage: WorkflowStepRecord["stage"];
    ownerExecution: WorkflowStepRecord["ownerExecution"];
    input: Record<string, unknown>;
    dependsOnStepId?: string | null;
  }): Promise<unknown> {
    return this.callReducer("enqueue_workflow_step", [
      payload.stepId,
      payload.runId,
      payload.agentId,
      payload.stage,
      payload.ownerExecution,
      JSON.stringify(payload.input),
      payload.dependsOnStepId ?? null
    ]);
  }

  public async claimWorkflowStep(
    stepId: string,
    ownerExecution: WorkflowStepRecord["ownerExecution"],
    runnerId: string
  ): Promise<unknown> {
    return this.callReducer("claim_workflow_step", [stepId, ownerExecution, runnerId]);
  }

  public async completeWorkflowStep(
    stepId: string,
    output: Record<string, unknown>
  ): Promise<unknown> {
    return this.callReducer("complete_workflow_step", [stepId, JSON.stringify(output)]);
  }

  public async failWorkflowStep(
    stepId: string,
    output: Record<string, unknown>
  ): Promise<unknown> {
    return this.callReducer("fail_workflow_step", [stepId, JSON.stringify(output)]);
  }

  public async requestApproval(payload: {
    approvalId: string;
    runId: string;
    stepId: string;
    agentId: string;
    title: string;
    detail: string;
    risk: ApprovalRequestRecord["risk"];
    requestedBy: string;
  }): Promise<unknown> {
    return this.callReducer("request_approval", [
      payload.approvalId,
      payload.runId,
      payload.stepId,
      payload.agentId,
      payload.title,
      payload.detail,
      payload.risk,
      payload.requestedBy
    ]);
  }

  public async resolveApproval(
    approvalId: string,
    status: ApprovalRequestRecord["status"],
    resolution: Record<string, unknown>
  ): Promise<unknown> {
    return this.callReducer("resolve_approval", [
      approvalId,
      status,
      JSON.stringify(resolution)
    ]);
  }

  public async recordToolCall(payload: {
    toolCallId: string;
    runId: string;
    stepId: string;
    agentId: string;
    toolName: string;
    status: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown> | null;
  }): Promise<unknown> {
    return this.callReducer("record_tool_call", [
      payload.toolCallId,
      payload.runId,
      payload.stepId,
      payload.agentId,
      payload.toolName,
      payload.status,
      JSON.stringify(payload.input),
      payload.output === undefined || payload.output === null
        ? null
        : JSON.stringify(payload.output)
    ]);
  }

  public async enqueueBrowserTask(request: BrowserToolRequest): Promise<unknown> {
    return this.callReducer("enqueue_browser_task", [
      request.taskId,
      request.runId,
      request.stepId,
      request.agentId,
      request.mode,
      request.risk,
      request.url,
      JSON.stringify({
        allowedDomains: request.allowedDomains,
        blockedDomains: request.blockedDomains,
        allowDownloads: request.allowDownloads,
        requestedBy: request.requestedBy,
        instructions: request.instructions,
        metadata: request.metadata
      })
    ]);
  }

  public async claimBrowserTask(taskId: string, runnerId: string): Promise<unknown> {
    return this.callReducer("claim_browser_task", [taskId, runnerId]);
  }

  public async completeBrowserTask(
    taskId: string,
    result: Record<string, unknown>
  ): Promise<unknown> {
    return this.callReducer("complete_browser_task", [taskId, JSON.stringify(result)]);
  }

  public async failBrowserTask(
    taskId: string,
    result: Record<string, unknown>
  ): Promise<unknown> {
    return this.callReducer("fail_browser_task", [taskId, JSON.stringify(result)]);
  }

  public async recordBrowserArtifact(payload: {
    artifactId: string;
    taskId: string;
    runId: string;
    stepId: string;
    kind: BrowserArtifactRecord["kind"];
    title: string;
    url: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.callReducer("record_browser_artifact", [
      payload.artifactId,
      payload.taskId,
      payload.runId,
      payload.stepId,
      payload.kind,
      payload.title,
      payload.url,
      JSON.stringify(payload.metadata ?? {})
    ]);
  }

  public async recordDeliveryAttempt(payload: {
    attemptId: string;
    threadId: string;
    runId?: string | null;
    channel: DeliveryAttemptRecord["channel"];
    direction: DeliveryAttemptRecord["direction"];
    status: DeliveryAttemptRecord["status"];
    target: string;
    payload: Record<string, unknown>;
    response?: Record<string, unknown> | null;
  }): Promise<unknown> {
    return this.callReducer("record_delivery_attempt", [
      payload.attemptId,
      payload.threadId,
      payload.runId ?? null,
      payload.channel,
      payload.direction,
      payload.status,
      payload.target,
      JSON.stringify(payload.payload),
      payload.response === undefined || payload.response === null
        ? null
        : JSON.stringify(payload.response)
    ]);
  }

  public async upsertMemoryDocument(document: Omit<MemoryDocument, "createdAtMicros" | "updatedAtMicros">): Promise<unknown> {
    return this.callReducer("upsert_memory_document", [
      document.documentId,
      document.agentId,
      document.namespace,
      document.sourceKind,
      document.title,
      document.content,
      document.metadataJson
    ]);
  }

  public async upsertMemoryChunk(chunk: Omit<MemoryChunk, "createdAtMicros">): Promise<unknown> {
    return this.callReducer("upsert_memory_chunk", [
      chunk.chunkId,
      chunk.documentId,
      chunk.agentId,
      chunk.namespace,
      chunk.ordinal,
      chunk.content,
      chunk.metadataJson
    ]);
  }

  public async upsertMemoryEmbedding(embedding: Omit<MemoryEmbedding, "createdAtMicros" | "vector"> & { vector: number[] }): Promise<unknown> {
    return this.callReducer("upsert_memory_embedding", [
      embedding.embeddingId,
      embedding.chunkId,
      embedding.agentId,
      embedding.namespace,
      embedding.model,
      embedding.dimensions,
      JSON.stringify(embedding.vector),
      embedding.checksum
    ]);
  }

  public async recordRetrievalTrace(trace: Omit<RetrievalTrace, "createdAtMicros" | "queryEmbedding" | "chunkIds"> & { queryEmbedding: number[]; chunkIds: string[] }): Promise<unknown> {
    return this.callReducer("record_retrieval_trace", [
      trace.traceId,
      trace.runId,
      trace.stepId,
      trace.queryText,
      JSON.stringify(trace.queryEmbedding),
      JSON.stringify(trace.chunkIds),
      trace.metadataJson
    ]);
  }

  public async appendLearningNote(
    runId: string,
    agentId: string,
    namespace: string,
    content: string
  ): Promise<unknown> {
    return this.callReducer("append_learning_note", [runId, agentId, namespace, content]);
  }

  public async listSchedules(): Promise<RegisteredScheduleRecord[]> {
    return this.selectAll("schedule_record").then((rows) =>
      rows.map((row) => ({
        scheduleId: asString(row.schedule_id, "schedule_id"),
        agentId: asString(row.agent_id, "agent_id"),
        controlPlane: asString(row.control_plane, "control_plane") as ControlPlaneTarget,
        goal: asString(row.goal, "goal"),
        intervalMinutes: asNumber(row.interval_minutes, "interval_minutes"),
        priority: asString(row.priority, "priority") as RegisteredScheduleRecord["priority"],
        enabled: Boolean(row.enabled),
        requestedBy: asString(row.requested_by, "requested_by"),
        nextRunAtMicros: asNumber(row.next_run_at_micros, "next_run_at_micros"),
        lastRunAtMicros:
          row.last_run_at_micros === null ? null : asNumber(row.last_run_at_micros, "last_run_at_micros"),
        lastJobId: asOptionalString(row.last_job_id)
      }))
    );
  }

  public async listPresence(): Promise<RunnerPresenceRecord[]> {
    return this.selectAll("runner_presence").then((rows) =>
      rows.map((row) => ({
        runnerId: asString(row.runner_id, "runner_id"),
        agentId: asString(row.agent_id, "agent_id"),
        controlPlane: asString(row.control_plane, "control_plane") as ControlPlaneTarget,
        status: asString(row.status, "status"),
        lastSeenAtMicros: asNumber(row.last_seen_at, "last_seen_at")
      }))
    );
  }

  public async listThreads(): Promise<ThreadRecord[]> {
    return this.selectAll("thread_record").then((rows) =>
      rows.map((row) => ({
        threadId: asString(row.thread_id, "thread_id"),
        channel: asString(row.channel, "channel") as ThreadRecord["channel"],
        channelThreadId: asString(row.channel_thread_id, "channel_thread_id"),
        title: asString(row.title, "title"),
        latestMessageAtMicros: asNumber(row.latest_message_at_micros, "latest_message_at_micros"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros")
      }))
    );
  }

  public async listMessageEvents(): Promise<MessageEventRecord[]> {
    return this.selectAll("message_event").then((rows) =>
      rows.map((row) => ({
        eventId: asString(row.event_id, "event_id"),
        threadId: asString(row.thread_id, "thread_id"),
        runId: asOptionalString(row.run_id),
        channel: asString(row.channel, "channel") as MessageEventRecord["channel"],
        direction: asString(row.direction, "direction") as MessageEventRecord["direction"],
        actor: asString(row.actor, "actor"),
        content: asString(row.content, "content"),
        metadataJson: asString(row.metadata_json, "metadata_json"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros")
      }))
    );
  }

  public async listWorkflowRuns(): Promise<WorkflowRunRecord[]> {
    return this.selectAll("workflow_run").then((rows) =>
      rows.map((row) => ({
        runId: asString(row.run_id, "run_id"),
        threadId: asString(row.thread_id, "thread_id"),
        agentId: asString(row.agent_id, "agent_id"),
        goal: asString(row.goal, "goal"),
        priority: asString(row.priority, "priority") as WorkflowRunRecord["priority"],
        triggerSource: asString(row.trigger_source, "trigger_source"),
        requestedBy: asString(row.requested_by, "requested_by"),
        currentStage: asString(row.current_stage, "current_stage") as WorkflowRunRecord["currentStage"],
        status: asString(row.status, "status") as WorkflowRunRecord["status"],
        summary: asOptionalString(row.summary),
        contextJson: asString(row.context_json, "context_json"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros"),
        completedAtMicros:
          row.completed_at_micros === null ? null : asNumber(row.completed_at_micros, "completed_at_micros")
      }))
    );
  }

  public async listWorkflowSteps(): Promise<WorkflowStepRecord[]> {
    return this.selectAll("workflow_step").then((rows) =>
      rows.map((row) => ({
        stepId: asString(row.step_id, "step_id"),
        runId: asString(row.run_id, "run_id"),
        agentId: asString(row.agent_id, "agent_id"),
        stage: asString(row.stage, "stage") as WorkflowStepRecord["stage"],
        ownerExecution: asString(row.owner_execution, "owner_execution") as WorkflowStepRecord["ownerExecution"],
        status: asString(row.status, "status") as WorkflowStepRecord["status"],
        inputJson: asString(row.input_json, "input_json"),
        outputJson: asOptionalString(row.output_json),
        retryCount: asNumber(row.retry_count, "retry_count"),
        dependsOnStepId: asOptionalString(row.depends_on_step_id),
        approvalRequestId: asOptionalString(row.approval_request_id),
        runnerId: asOptionalString(row.runner_id),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros"),
        claimedAtMicros:
          row.claimed_at_micros === null ? null : asNumber(row.claimed_at_micros, "claimed_at_micros"),
        completedAtMicros:
          row.completed_at_micros === null ? null : asNumber(row.completed_at_micros, "completed_at_micros")
      }))
    );
  }

  public async listApprovalRequests(): Promise<ApprovalRequestRecord[]> {
    return this.selectAll("approval_request").then((rows) =>
      rows.map((row) => ({
        approvalId: asString(row.approval_id, "approval_id"),
        runId: asString(row.run_id, "run_id"),
        stepId: asString(row.step_id, "step_id"),
        agentId: asString(row.agent_id, "agent_id"),
        title: asString(row.title, "title"),
        detail: asString(row.detail, "detail"),
        status: asString(row.status, "status") as ApprovalRequestRecord["status"],
        risk: asString(row.risk, "risk") as ApprovalRequestRecord["risk"],
        requestedBy: asString(row.requested_by, "requested_by"),
        resolutionJson: asOptionalString(row.resolution_json),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros")
      }))
    );
  }

  public async listBrowserTasks(): Promise<BrowserTaskRecord[]> {
    return this.selectAll("browser_task").then((rows) =>
      rows.map((row) => ({
        taskId: asString(row.task_id, "task_id"),
        runId: asString(row.run_id, "run_id"),
        stepId: asString(row.step_id, "step_id"),
        agentId: asString(row.agent_id, "agent_id"),
        mode: asString(row.mode, "mode") as BrowserTaskRecord["mode"],
        risk: asString(row.risk, "risk") as BrowserTaskRecord["risk"],
        status: asString(row.status, "status") as BrowserTaskRecord["status"],
        ownerExecution: "browser-worker",
        url: asString(row.url, "url"),
        requestJson: asString(row.request_json, "request_json"),
        resultJson: asOptionalString(row.result_json),
        runnerId: asOptionalString(row.runner_id),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros")
      }))
    );
  }

  public async listBrowserArtifacts(): Promise<BrowserArtifactRecord[]> {
    return this.selectAll("browser_artifact").then((rows) =>
      rows.map((row) => ({
        artifactId: asString(row.artifact_id, "artifact_id"),
        taskId: asString(row.task_id, "task_id"),
        runId: asString(row.run_id, "run_id"),
        stepId: asString(row.step_id, "step_id"),
        kind: asString(row.kind, "kind") as BrowserArtifactRecord["kind"],
        title: asString(row.title, "title"),
        url: asString(row.url, "url"),
        metadataJson: asString(row.metadata_json, "metadata_json"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros")
      }))
    );
  }

  public async listDeliveryAttempts(): Promise<DeliveryAttemptRecord[]> {
    return this.selectAll("delivery_attempt").then((rows) =>
      rows.map((row) => ({
        attemptId: asString(row.attempt_id, "attempt_id"),
        threadId: asString(row.thread_id, "thread_id"),
        runId: asOptionalString(row.run_id),
        channel: asString(row.channel, "channel") as DeliveryAttemptRecord["channel"],
        direction: asString(row.direction, "direction") as DeliveryAttemptRecord["direction"],
        status: asString(row.status, "status") as DeliveryAttemptRecord["status"],
        target: asString(row.target, "target"),
        payloadJson: asString(row.payload_json, "payload_json"),
        responseJson: asOptionalString(row.response_json),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros")
      }))
    );
  }

  public async listMemoryDocuments(): Promise<MemoryDocument[]> {
    return this.selectAll("memory_document").then((rows) =>
      rows.map((row) => ({
        documentId: asString(row.document_id, "document_id"),
        agentId: asString(row.agent_id, "agent_id"),
        namespace: asString(row.namespace, "namespace"),
        sourceKind: asString(row.source_kind, "source_kind"),
        title: asString(row.title, "title"),
        content: asString(row.content, "content"),
        metadataJson: asString(row.metadata_json, "metadata_json"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros"),
        updatedAtMicros: asNumber(row.updated_at_micros, "updated_at_micros")
      }))
    );
  }

  public async listMemoryChunks(): Promise<MemoryChunk[]> {
    return this.selectAll("memory_chunk").then((rows) =>
      rows.map((row) => ({
        chunkId: asString(row.chunk_id, "chunk_id"),
        documentId: asString(row.document_id, "document_id"),
        agentId: asString(row.agent_id, "agent_id"),
        namespace: asString(row.namespace, "namespace"),
        ordinal: asNumber(row.ordinal, "ordinal"),
        content: asString(row.content, "content"),
        metadataJson: asString(row.metadata_json, "metadata_json"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros")
      }))
    );
  }

  public async listMemoryEmbeddings(): Promise<MemoryEmbedding[]> {
    return this.selectAll("memory_embedding").then((rows) =>
      rows.map((row) => ({
        embeddingId: asString(row.embedding_id, "embedding_id"),
        chunkId: asString(row.chunk_id, "chunk_id"),
        agentId: asString(row.agent_id, "agent_id"),
        namespace: asString(row.namespace, "namespace"),
        model: asString(row.model, "model"),
        dimensions: asNumber(row.dimensions, "dimensions"),
        vector: JSON.parse(asString(row.vector_json, "vector_json")) as number[],
        checksum: asString(row.checksum, "checksum"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros")
      }))
    );
  }

  public async listRetrievalTraces(): Promise<RetrievalTrace[]> {
    return this.selectAll("retrieval_trace").then((rows) =>
      rows.map((row) => ({
        traceId: asString(row.trace_id, "trace_id"),
        runId: asString(row.run_id, "run_id"),
        stepId: asString(row.step_id, "step_id"),
        queryText: asString(row.query_text, "query_text"),
        queryEmbedding: JSON.parse(asString(row.query_embedding_json, "query_embedding_json")) as number[],
        chunkIds: JSON.parse(asString(row.chunk_ids_json, "chunk_ids_json")) as string[],
        metadataJson: asString(row.metadata_json, "metadata_json"),
        createdAtMicros: asNumber(row.created_at_micros, "created_at_micros")
      }))
    );
  }

  public async callReducer(name: string, args: unknown[]): Promise<unknown> {
    return this.request("POST", this.buildPath(`call/${name}`), JSON.stringify(args), {
      "content-type": "application/json"
    });
  }

  private buildPath(pathname: string): string {
    return `${this.baseUrl}/v1/database/${this.database}/${pathname}`;
  }

  private async request(
    method: "GET" | "POST",
    url: string,
    body?: string,
    extraHeaders: HeadersInit = {}
  ): Promise<unknown> {
    const headers = new Headers(extraHeaders);

    if (this.authToken) {
      headers.set("authorization", `Bearer ${this.authToken}`);
    }

    const init: RequestInit = {
      method,
      headers
    };

    if (body !== undefined) {
      init.body = body;
    }

    const response = await this.fetchImpl(url, init);

    if (!response.ok) {
      throw new Error(`Control plane request failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }

    return response.text();
  }
}

function decodeSqlRows(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }

  const [result] = payload as SqlResultSet[];
  if (!result) {
    return [];
  }

  const elements = result.schema?.elements ?? [];
  const rows = result.rows ?? [];

  return rows.map((row) => {
    const decoded: Record<string, unknown> = {};
    row.forEach((value, index) => {
      const element = elements[index];
      const name = element?.name?.some;

      if (!name) {
        return;
      }

      decoded[name] = decodeSqlValue(element.algebraic_type, value);
    });
    return decoded;
  });
}

function decodeSqlValue(type: Record<string, unknown> | undefined, value: unknown): unknown {
  if (!type || value === null) {
    return value;
  }

  if ("String" in type || "Bool" in type || "U32" in type || "U64" in type || "I64" in type) {
    return value;
  }

  if ("Product" in type && Array.isArray((type.Product as { elements?: unknown[] }).elements)) {
    const product = type.Product as { elements?: SqlSchemaElement[] };
    const productElements = product.elements ?? [];
    if (
      productElements.length === 1 &&
      productElements[0]?.name?.some === "__timestamp_micros_since_unix_epoch__" &&
      Array.isArray(value)
    ) {
      return value[0] ?? null;
    }

    if (
      productElements.length === 1 &&
      productElements[0]?.name?.some === "__identity__" &&
      Array.isArray(value)
    ) {
      return value[0] ?? null;
    }

    if (Array.isArray(value)) {
      return productElements.reduce<Record<string, unknown>>((result, element, index) => {
        const name = element.name?.some;
        if (name) {
          result[name] = decodeSqlValue(element.algebraic_type, value[index]);
        }
        return result;
      }, {});
    }
  }

  if (
    "Sum" in type &&
    Array.isArray((type.Sum as { variants?: unknown[] }).variants) &&
    Array.isArray(value)
  ) {
    const sum = type.Sum as { variants?: SqlSchemaElement[] };
    const variants = sum.variants ?? [];
    const variantIndex = Number(value[0] ?? -1);
    const variant = variants[variantIndex];
    const variantName = variant?.name?.some;

    if (variantName === "none") {
      return null;
    }

    if (variantName === "some" && variant) {
      return decodeSqlValue(variant.algebraic_type, value[1]);
    }
  }

  return value;
}
