import type {
  AgentManifest,
  ControlPlaneTarget,
  NormalizedJobRequest,
  RegisteredScheduleRecord,
  ScheduleRegistration
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

  public async listSchedules(): Promise<RegisteredScheduleRecord[]> {
    return this.selectAll("schedule_record").then((rows) =>
      rows.map((row) => ({
        scheduleId: String(row.schedule_id),
        agentId: String(row.agent_id),
        controlPlane: String(row.control_plane) as ControlPlaneTarget,
        goal: String(row.goal),
        intervalMinutes: Number(row.interval_minutes),
        priority: String(row.priority) as RegisteredScheduleRecord["priority"],
        enabled: Boolean(row.enabled),
        requestedBy: String(row.requested_by),
        nextRunAtMicros: Number(row.next_run_at_micros),
        lastRunAtMicros:
          row.last_run_at_micros === null ? null : Number(row.last_run_at_micros),
        lastJobId: row.last_job_id === null ? null : String(row.last_job_id)
      }))
    );
  }

  public async listPresence(): Promise<RunnerPresenceRecord[]> {
    return this.selectAll("runner_presence").then((rows) =>
      rows.map((row) => ({
        runnerId: String(row.runner_id),
        agentId: String(row.agent_id),
        controlPlane: String(row.control_plane) as ControlPlaneTarget,
        status: String(row.status),
        lastSeenAtMicros: Number(row.last_seen_at)
      }))
    );
  }

  public async upsertPresence(
    agentId: string,
    runnerId: string,
    controlPlane: ControlPlaneTarget,
    status: string
  ): Promise<unknown> {
    return this.callReducer("upsert_presence", [agentId, runnerId, controlPlane, status]);
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

  if ("Sum" in type && Array.isArray((type.Sum as { variants?: unknown[] }).variants) && Array.isArray(value)) {
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
