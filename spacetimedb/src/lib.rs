use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};
use starbridge_core::{
    AgentRuntime, ApprovalStatus, BrowserArtifactKind, BrowserMode, BrowserTaskState,
    ControlPlaneTarget, DeliveryStatus, ExecutionOwner, ExecutionTarget, JobPriority, JobStatus,
    MessageChannel, MessageDirection, RunState, RunnerPresenceStatus, ScheduleStatus, StepState,
    ToolCallState, ToolRisk, WorkflowStage,
};

const WORKFLOW_STAGE_ROUTE: &str = "route";
const WORKFLOW_STAGE_ACT: &str = "act";
const WORKFLOW_STAGE_GATHER: &str = "gather";
const WORKFLOW_STAGE_VERIFY: &str = "verify";
const WORKFLOW_STAGE_LEARN: &str = "learn";

const WORKFLOW_RUN_STATUS_QUEUED: &str = "queued";
const WORKFLOW_RUN_STATUS_RUNNING: &str = "running";
const WORKFLOW_RUN_STATUS_BLOCKED: &str = "blocked";
const WORKFLOW_RUN_STATUS_AWAITING_APPROVAL: &str = "awaiting-approval";
const WORKFLOW_RUN_STATUS_COMPLETED: &str = "completed";
const WORKFLOW_RUN_STATUS_FAILED: &str = "failed";

const WORKFLOW_STEP_STATUS_READY: &str = "ready";
const WORKFLOW_STEP_STATUS_RUNNING: &str = "running";
const WORKFLOW_STEP_STATUS_BLOCKED: &str = "blocked";
const WORKFLOW_STEP_STATUS_AWAITING_APPROVAL: &str = "awaiting-approval";
const WORKFLOW_STEP_STATUS_COMPLETED: &str = "completed";
const WORKFLOW_STEP_STATUS_FAILED: &str = "failed";

const BROWSER_TASK_STATUS_QUEUED: &str = "queued";
const BROWSER_TASK_STATUS_RUNNING: &str = "running";
const BROWSER_TASK_STATUS_COMPLETED: &str = "completed";
const BROWSER_TASK_STATUS_FAILED: &str = "failed";

const JOB_STATUS_QUEUED: &str = "queued";
const JOB_STATUS_RUNNING: &str = "running";
const JOB_STATUS_COMPLETED: &str = "completed";
const JOB_STATUS_FAILED: &str = "failed";

const SCHEDULE_STATUS_READY: &str = "ready";
const SCHEDULE_STATUS_CLAIMED: &str = "claimed";

const EXECUTION_TARGET_BROWSER_WORKER: &str = "browser-worker";

#[table(accessor = agent_record, public)]
pub struct AgentRecord {
    #[primary_key]
    agent_id: String,
    display_name: String,
    runtime: String,
    control_plane: String,
    execution_target: String,
    workflow: String,
    model: String,
    tags_json: String,
    updated_at: Timestamp,
}

#[table(accessor = job_record, public)]
pub struct JobRecord {
    #[primary_key]
    job_id: String,
    agent_id: String,
    goal: String,
    priority: String,
    requested_by: String,
    requested_by_identity: Identity,
    context_json: String,
    status: String,
    runner_id: Option<String>,
    result_summary: Option<String>,
    created_at: Timestamp,
    updated_at: Timestamp,
}

#[table(accessor = memory_note, public)]
pub struct MemoryNote {
    #[auto_inc]
    id: u64,
    agent_id: String,
    namespace: String,
    content: String,
    created_at: Timestamp,
}

#[table(accessor = runner_presence, public)]
pub struct RunnerPresence {
    #[primary_key]
    runner_id: String,
    agent_id: String,
    control_plane: String,
    status: String,
    last_seen_at: Timestamp,
}

#[table(accessor = schedule_record, public)]
pub struct ScheduleRecord {
    #[primary_key]
    schedule_id: String,
    agent_id: String,
    control_plane: String,
    goal: String,
    interval_minutes: u32,
    priority: String,
    requested_by: String,
    enabled: bool,
    next_run_at_micros: i64,
    last_run_at_micros: Option<i64>,
    last_job_id: Option<String>,
    status: String,
    updated_at: Timestamp,
}

#[table(accessor = thread_record, public)]
pub struct ThreadRecord {
    #[primary_key]
    thread_id: String,
    channel: String,
    channel_thread_id: String,
    title: String,
    latest_message_at_micros: i64,
    created_at_micros: i64,
    updated_at_micros: i64,
}

#[table(accessor = message_event, public)]
pub struct MessageEvent {
    #[primary_key]
    event_id: String,
    thread_id: String,
    run_id: Option<String>,
    channel: String,
    direction: String,
    actor: String,
    content: String,
    metadata_json: String,
    created_at_micros: i64,
}

#[table(accessor = workflow_run, public)]
pub struct WorkflowRun {
    #[primary_key]
    run_id: String,
    thread_id: String,
    agent_id: String,
    goal: String,
    priority: String,
    trigger_source: String,
    requested_by: String,
    current_stage: String,
    status: String,
    summary: Option<String>,
    context_json: String,
    created_at_micros: i64,
    updated_at_micros: i64,
    completed_at_micros: Option<i64>,
}

#[table(accessor = workflow_step, public)]
pub struct WorkflowStep {
    #[primary_key]
    step_id: String,
    run_id: String,
    agent_id: String,
    stage: String,
    owner_execution: String,
    status: String,
    input_json: String,
    output_json: Option<String>,
    retry_count: u32,
    depends_on_step_id: Option<String>,
    approval_request_id: Option<String>,
    runner_id: Option<String>,
    created_at_micros: i64,
    updated_at_micros: i64,
    claimed_at_micros: Option<i64>,
    completed_at_micros: Option<i64>,
}

#[table(accessor = approval_request, public)]
pub struct ApprovalRequest {
    #[primary_key]
    approval_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    title: String,
    detail: String,
    status: String,
    risk: String,
    requested_by: String,
    resolution_json: Option<String>,
    created_at_micros: i64,
    updated_at_micros: i64,
}

#[table(accessor = tool_call_record, public)]
pub struct ToolCallRecord {
    #[primary_key]
    tool_call_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    tool_name: String,
    status: String,
    input_json: String,
    output_json: Option<String>,
    created_at_micros: i64,
    updated_at_micros: i64,
}

#[table(accessor = browser_task, public)]
pub struct BrowserTask {
    #[primary_key]
    task_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    mode: String,
    risk: String,
    status: String,
    owner_execution: String,
    url: String,
    request_json: String,
    result_json: Option<String>,
    runner_id: Option<String>,
    created_at_micros: i64,
    updated_at_micros: i64,
}

#[table(accessor = browser_artifact, public)]
pub struct BrowserArtifact {
    #[primary_key]
    artifact_id: String,
    task_id: String,
    run_id: String,
    step_id: String,
    kind: String,
    title: String,
    url: String,
    metadata_json: String,
    created_at_micros: i64,
}

#[table(accessor = delivery_attempt, public)]
pub struct DeliveryAttempt {
    #[primary_key]
    attempt_id: String,
    thread_id: String,
    run_id: Option<String>,
    channel: String,
    direction: String,
    status: String,
    target: String,
    payload_json: String,
    response_json: Option<String>,
    created_at_micros: i64,
    updated_at_micros: i64,
}

#[table(accessor = memory_document, public)]
pub struct MemoryDocument {
    #[primary_key]
    document_id: String,
    agent_id: String,
    namespace: String,
    source_kind: String,
    title: String,
    content: String,
    metadata_json: String,
    created_at_micros: i64,
    updated_at_micros: i64,
}

#[table(accessor = memory_chunk, public)]
pub struct MemoryChunk {
    #[primary_key]
    chunk_id: String,
    document_id: String,
    agent_id: String,
    namespace: String,
    ordinal: u32,
    content: String,
    metadata_json: String,
    created_at_micros: i64,
}

#[table(accessor = memory_embedding, public)]
pub struct MemoryEmbedding {
    #[primary_key]
    embedding_id: String,
    chunk_id: String,
    agent_id: String,
    namespace: String,
    model: String,
    dimensions: u32,
    vector_json: String,
    checksum: String,
    created_at_micros: i64,
}

#[table(accessor = retrieval_trace, public)]
pub struct RetrievalTrace {
    #[primary_key]
    trace_id: String,
    run_id: String,
    step_id: String,
    query_text: String,
    query_embedding_json: String,
    chunk_ids_json: String,
    metadata_json: String,
    created_at_micros: i64,
}

#[table(accessor = operator_account, public)]
pub struct OperatorAccount {
    #[primary_key]
    operator_id: String,
    identity: Identity,
    display_name: String,
    email: String,
    role: String,
    created_at: Timestamp,
    updated_at: Timestamp,
}

#[table(accessor = webauthn_credential, public)]
pub struct WebAuthnCredential {
    #[primary_key]
    credential_id: String,
    operator_id: String,
    public_key_json: String,
    counter: u64,
    transports_json: String,
    created_at: Timestamp,
}

#[table(accessor = auth_challenge, public)]
pub struct AuthChallenge {
    #[primary_key]
    challenge_id: String,
    challenge: String,
    operator_id: Option<String>,
    expires_at_micros: i64,
}

// ── Message Bus ─────────────────────────────────────────────────────
// Every message (inbound + outbound) flows through SpacetimeDB.
// 3 extraction layers: Raw → Structured → Embedded
// All entities tracked with UUIDs.

/// Layer 0: Raw inbound message — exactly as received from any channel.
#[table(accessor = raw_message, public)]
pub struct RawMessage {
    #[primary_key]
    message_id: String,           // UUID
    channel: String,              // slack, discord, github, telegram, web, email, system
    direction: String,            // inbound, outbound
    sender_entity_id: String,     // UUID → MessageEntity
    receiver_entity_id: Option<String>, // UUID → MessageEntity (None for broadcasts)
    thread_id: Option<String>,    // FK → ThreadRecord (if threaded)
    run_id: Option<String>,       // FK → WorkflowRun (if agent-initiated)
    raw_payload: String,          // Original payload (JSON string)
    content_text: String,         // Extracted plain text
    content_type: String,         // text, markdown, html, card, attachment
    platform_message_id: Option<String>, // Platform-native ID (slack ts, github comment id)
    platform_thread_id: Option<String>,  // Platform-native thread ID
    status: String,               // received, processing, processed, delivered, failed
    created_at_micros: i64,
    processed_at_micros: Option<i64>,
}

/// Layer 1: Structured extraction — parsed entities, intents, and metadata.
#[table(accessor = message_extraction, public)]
pub struct MessageExtraction {
    #[primary_key]
    extraction_id: String,        // UUID
    message_id: String,           // FK → RawMessage
    extraction_type: String,      // intent, entity, sentiment, summary, action_item, reference
    label: String,                // The extracted label (e.g., "deploy_request", "person:dex", "positive")
    value: String,                // Extracted value/text span
    confidence: f64,              // 0.0–1.0 confidence score
    metadata_json: String,        // Additional structured data
    created_at_micros: i64,
}

/// Layer 2: Entity resolution — unique identities across all channels.
#[table(accessor = message_entity, public)]
pub struct MessageEntity {
    #[primary_key]
    entity_id: String,            // UUID
    entity_type: String,          // user, bot, agent, channel, org, system
    display_name: String,
    // Platform-specific identifiers
    slack_user_id: Option<String>,
    discord_user_id: Option<String>,
    github_username: Option<String>,
    telegram_user_id: Option<String>,
    email_address: Option<String>,
    operator_id: Option<String>,  // FK → OperatorAccount (if linked)
    agent_id: Option<String>,     // FK → AgentRecord (if an agent)
    metadata_json: String,
    created_at_micros: i64,
    updated_at_micros: i64,
}

/// Layer 3: Embedded message — vector representation for semantic search.
#[table(accessor = message_embedding, public)]
pub struct MessageEmbeddingRecord {
    #[primary_key]
    embedding_id: String,         // UUID
    message_id: String,           // FK → RawMessage
    extraction_id: Option<String>, // FK → MessageExtraction (if embedding an extraction)
    entity_id: Option<String>,    // FK → MessageEntity (if embedding entity context)
    model: String,                // Embedding model used
    dimensions: u32,
    vector_json: String,          // Serialized float array
    content_hash: String,         // For dedup
    created_at_micros: i64,
}

/// Cross-channel conversation mapping — links messages across platforms.
#[table(accessor = conversation_link, public)]
pub struct ConversationLink {
    #[primary_key]
    link_id: String,              // UUID
    conversation_id: String,      // Shared conversation UUID across channels
    message_id: String,           // FK → RawMessage
    thread_id: Option<String>,    // FK → ThreadRecord
    channel: String,
    platform_thread_id: Option<String>,
    created_at_micros: i64,
}

/// Message routing rule — determines which agent handles which messages.
#[table(accessor = message_route, public)]
pub struct MessageRoute {
    #[primary_key]
    route_id: String,             // UUID
    channel: String,              // * for all, or specific channel
    entity_type: String,          // * for all, or specific entity type
    keyword_pattern: String,      // Regex or keyword list (JSON array)
    target_agent_id: String,      // FK → AgentRecord
    priority: u32,
    enabled: bool,
    created_at_micros: i64,
}

/// Trajectory log — persisted to SpacetimeDB for training data.
#[table(accessor = trajectory_log, public)]
pub struct TrajectoryLog {
    #[primary_key]
    trajectory_id: String,        // UUID
    run_id: String,               // FK → WorkflowRun
    step_id: String,              // FK → WorkflowStep
    agent_id: String,
    stage: String,
    instruction: String,
    context_toon: String,         // TOON-encoded context that was assembled
    output: String,               // Agent's response
    tool_calls_json: String,      // JSON array of tool calls
    success: bool,
    duration_ms: u64,
    created_at_micros: i64,
}

fn validate_identifier(value: String, field: &str) -> Result<String, String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(format!("{field} must not be empty"));
    }

    if !trimmed
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(format!("{field} must contain only letters, numbers, '-' or '_'"));
    }

    Ok(trimmed)
}

fn validate_text(value: String, field: &str) -> Result<String, String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(format!("{field} must not be empty"))
    } else {
        Ok(trimmed)
    }
}

fn normalize_json_blob(value: String, field: &str) -> Result<String, String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        Err(format!("{field} must not be empty"))
    } else {
        Ok(trimmed)
    }
}

fn validate_control_plane(value: String) -> Result<String, String> {
    validate_text(value, "control_plane")?
        .parse::<ControlPlaneTarget>()
        .map(|value| value.to_string())
}

fn validate_priority(value: String) -> Result<String, String> {
    validate_text(value, "priority")?
        .parse::<JobPriority>()
        .map(|value| value.to_string())
}

fn validate_channel(value: String) -> Result<String, String> {
    validate_text(value, "channel")?
        .parse::<MessageChannel>()
        .map(|value| value.to_string())
}

fn validate_direction(value: String) -> Result<String, String> {
    validate_text(value, "direction")?
        .parse::<MessageDirection>()
        .map(|value| value.to_string())
}

fn validate_stage(value: String) -> Result<String, String> {
    validate_text(value, "stage")?
        .parse::<WorkflowStage>()
        .map(|value| value.to_string())
}

fn validate_workflow_run_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<RunState>()
        .map(|value| value.to_string())
}

fn validate_step_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<StepState>()
        .map(|value| value.to_string())
}

fn validate_browser_mode(value: String) -> Result<String, String> {
    validate_text(value, "mode")?
        .parse::<BrowserMode>()
        .map(|value| value.to_string())
}

fn validate_browser_risk(value: String) -> Result<String, String> {
    validate_text(value, "risk")?
        .parse::<ToolRisk>()
        .map(|value| value.to_string())
}

fn validate_approval_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<ApprovalStatus>()
        .map(|value| value.to_string())
}

fn validate_delivery_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<DeliveryStatus>()
        .map(|value| value.to_string())
}

fn validate_execution_target(value: String) -> Result<String, String> {
    validate_text(value, "execution_target")?
        .parse::<ExecutionTarget>()
        .map(|value| value.to_string())
}

fn validate_execution_owner(value: String) -> Result<String, String> {
    validate_text(value, "owner_execution")?
        .parse::<ExecutionOwner>()
        .map(|value| value.to_string())
}

fn validate_runtime(value: String) -> Result<String, String> {
    validate_text(value, "runtime")?
        .parse::<AgentRuntime>()
        .map(|value| value.to_string())
}

fn validate_browser_task_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<BrowserTaskState>()
        .map(|value| value.to_string())
}

fn validate_job_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<JobStatus>()
        .map(|value| value.to_string())
}

fn validate_schedule_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<ScheduleStatus>()
        .map(|value| value.to_string())
}

fn validate_runner_presence_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<RunnerPresenceStatus>()
        .map(|value| value.to_string())
}

fn validate_tool_call_status(value: String) -> Result<String, String> {
    validate_text(value, "status")?
        .parse::<ToolCallState>()
        .map(|value| value.to_string())
}

fn validate_artifact_kind(value: String) -> Result<String, String> {
    validate_text(value, "kind")?
        .parse::<BrowserArtifactKind>()
        .map(|value| value.to_string())
}

fn now_micros(ctx: &ReducerContext) -> i64 {
    ctx.timestamp.to_micros_since_unix_epoch()
}

fn interval_to_micros(interval_minutes: u32) -> i64 {
    i64::from(interval_minutes) * 60 * 1_000_000
}

fn update_workflow_run_status(
    ctx: &ReducerContext,
    run_id: &str,
    status: String,
    current_stage: String,
    summary: Option<String>,
    completed_at_micros: Option<i64>,
) -> Result<(), String> {
    let Some(run) = ctx.db.workflow_run().run_id().find(run_id.to_string()) else {
        return Err("workflow run not found".to_string());
    };

    ctx.db.workflow_run().run_id().update(WorkflowRun {
        status: validate_workflow_run_status(status)?,
        current_stage,
        summary,
        updated_at_micros: now_micros(ctx),
        completed_at_micros,
        ..run
    });

    Ok(())
}

fn block_linked_step(ctx: &ReducerContext, step_id: &str, status: &str) -> Result<(), String> {
    let Some(step) = ctx.db.workflow_step().step_id().find(step_id.to_string()) else {
        return Err("workflow step not found".to_string());
    };

    ctx.db.workflow_step().step_id().update(WorkflowStep {
        status: validate_step_status(status.to_string())?,
        updated_at_micros: now_micros(ctx),
        ..step
    });

    Ok(())
}

#[reducer]
pub fn register_agent(
    ctx: &ReducerContext,
    agent_id: String,
    display_name: String,
    runtime: String,
    control_plane: String,
    execution_target: String,
    workflow: String,
    model: String,
    tags_json: String,
) -> Result<(), String> {
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let display_name = validate_text(display_name, "display_name")?;
    let runtime = validate_runtime(runtime)?;
    let control_plane = validate_control_plane(control_plane)?;
    let execution_target = validate_execution_target(execution_target)?;
    let workflow = validate_text(workflow, "workflow")?;
    let model = validate_text(model, "model")?;

    let row = AgentRecord {
        agent_id: agent_id.clone(),
        display_name,
        runtime,
        control_plane,
        execution_target,
        workflow,
        model,
        tags_json,
        updated_at: ctx.timestamp,
    };

    if ctx.db.agent_record().agent_id().find(agent_id.clone()).is_some() {
        ctx.db.agent_record().agent_id().update(row);
    } else {
        ctx.db.agent_record().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn remember(
    ctx: &ReducerContext,
    agent_id: String,
    namespace: String,
    content: String,
) -> Result<(), String> {
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let namespace = validate_text(namespace, "namespace")?;
    let content = validate_text(content, "content")?;

    ctx.db.memory_note().insert(MemoryNote {
        id: 0,
        agent_id,
        namespace,
        content,
        created_at: ctx.timestamp,
    });

    Ok(())
}

#[reducer]
pub fn enqueue_job(
    ctx: &ReducerContext,
    job_id: String,
    agent_id: String,
    goal: String,
    priority: String,
    requested_by: String,
    context_json: String,
) -> Result<(), String> {
    let job_id = validate_identifier(job_id, "job_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let goal = validate_text(goal, "goal")?;
    let priority = validate_priority(priority)?;
    let requested_by = validate_text(requested_by, "requested_by")?;
    let context_json = normalize_json_blob(context_json, "context_json")?;

    if ctx.db.agent_record().agent_id().find(agent_id.clone()).is_none() {
        return Err(format!("agent '{agent_id}' is not registered"));
    }

    ctx.db.job_record().insert(JobRecord {
        job_id,
        agent_id,
        goal,
        priority,
        requested_by,
        requested_by_identity: ctx.sender(),
        context_json,
        status: JOB_STATUS_QUEUED.to_string(),
        runner_id: None,
        result_summary: None,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });

    Ok(())
}

#[reducer]
pub fn start_job(ctx: &ReducerContext, job_id: String, runner_id: String) -> Result<(), String> {
    let job_id = validate_identifier(job_id, "job_id")?;
    let runner_id = validate_text(runner_id, "runner_id")?;

    if let Some(job) = ctx.db.job_record().job_id().find(job_id) {
        ctx.db.job_record().job_id().update(JobRecord {
            status: validate_job_status(JOB_STATUS_RUNNING.to_string())?,
            runner_id: Some(runner_id),
            updated_at: ctx.timestamp,
            ..job
        });
        Ok(())
    } else {
        Err("job not found".to_string())
    }
}

#[reducer]
pub fn complete_job(
    ctx: &ReducerContext,
    job_id: String,
    summary: String,
) -> Result<(), String> {
    transition_job(ctx, job_id, JOB_STATUS_COMPLETED.to_string(), Some(summary))
}

#[reducer]
pub fn fail_job(ctx: &ReducerContext, job_id: String, summary: String) -> Result<(), String> {
    transition_job(ctx, job_id, JOB_STATUS_FAILED.to_string(), Some(summary))
}

#[reducer]
pub fn upsert_presence(
    ctx: &ReducerContext,
    agent_id: String,
    runner_id: String,
    control_plane: String,
    status: String,
) -> Result<(), String> {
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let runner_id = validate_text(runner_id, "runner_id")?;
    let control_plane = validate_control_plane(control_plane)?;
    let status = validate_runner_presence_status(status)?;

    let row = RunnerPresence {
        runner_id,
        agent_id,
        control_plane,
        status,
        last_seen_at: ctx.timestamp,
    };

    if ctx
        .db
        .runner_presence()
        .runner_id()
        .find(row.runner_id.clone())
        .is_some()
    {
        ctx.db.runner_presence().runner_id().update(row);
    } else {
        ctx.db.runner_presence().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn register_schedule(
    ctx: &ReducerContext,
    schedule_id: String,
    agent_id: String,
    control_plane: String,
    goal: String,
    interval_minutes: u32,
    priority: String,
    requested_by: String,
    enabled: bool,
) -> Result<(), String> {
    let schedule_id = validate_identifier(schedule_id, "schedule_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let control_plane = validate_control_plane(control_plane)?;
    let goal = validate_text(goal, "goal")?;
    if interval_minutes == 0 {
        return Err("interval_minutes must be greater than zero".to_string());
    }
    let priority = validate_priority(priority)?;
    let requested_by = validate_text(requested_by, "requested_by")?;

    if ctx.db.agent_record().agent_id().find(agent_id.clone()).is_none() {
        return Err(format!("agent '{agent_id}' is not registered"));
    }

    if let Some(existing) = ctx.db.schedule_record().schedule_id().find(schedule_id.clone()) {
        ctx.db.schedule_record().schedule_id().update(ScheduleRecord {
            schedule_id,
            agent_id,
            control_plane,
            goal,
            interval_minutes,
            priority,
            requested_by,
            enabled,
            next_run_at_micros: existing.next_run_at_micros,
            last_run_at_micros: existing.last_run_at_micros,
            last_job_id: existing.last_job_id,
            status: existing.status,
            updated_at: ctx.timestamp,
        });
    } else {
        ctx.db.schedule_record().insert(ScheduleRecord {
            schedule_id,
            agent_id,
            control_plane,
            goal,
            interval_minutes,
            priority,
            requested_by,
            enabled,
            next_run_at_micros: now_micros(ctx),
            last_run_at_micros: None,
            last_job_id: None,
            status: SCHEDULE_STATUS_READY.to_string(),
            updated_at: ctx.timestamp,
        });
    }

    Ok(())
}

#[reducer]
pub fn claim_schedule_run(
    ctx: &ReducerContext,
    schedule_id: String,
    control_plane: String,
    expected_next_run_at_micros: i64,
    job_id: String,
    context_json: String,
) -> Result<(), String> {
    let schedule_id = validate_identifier(schedule_id, "schedule_id")?;
    let control_plane = validate_control_plane(control_plane)?;
    let job_id = validate_identifier(job_id, "job_id")?;
    let context_json = normalize_json_blob(context_json, "context_json")?;
    let now = now_micros(ctx);

    let Some(schedule) = ctx.db.schedule_record().schedule_id().find(schedule_id.clone()) else {
        return Err("schedule not found".to_string());
    };

    if schedule.control_plane != control_plane {
        return Err("schedule belongs to a different control plane".to_string());
    }

    if !schedule.enabled {
        return Err("schedule is disabled".to_string());
    }

    if schedule.next_run_at_micros != expected_next_run_at_micros {
        return Err("schedule lease changed".to_string());
    }

    if schedule.next_run_at_micros > now {
        return Err("schedule is not due".to_string());
    }

    if ctx.db.job_record().job_id().find(job_id.clone()).is_some() {
        return Err("job already exists".to_string());
    }

    ctx.db.job_record().insert(JobRecord {
        job_id: job_id.clone(),
        agent_id: schedule.agent_id.clone(),
        goal: schedule.goal.clone(),
        priority: schedule.priority.clone(),
        requested_by: schedule.requested_by.clone(),
        requested_by_identity: ctx.sender(),
        context_json,
        status: JOB_STATUS_QUEUED.to_string(),
        runner_id: None,
        result_summary: None,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });

    ctx.db.schedule_record().schedule_id().update(ScheduleRecord {
        next_run_at_micros: now + interval_to_micros(schedule.interval_minutes),
        last_run_at_micros: Some(now),
        last_job_id: Some(job_id),
        status: validate_schedule_status(SCHEDULE_STATUS_CLAIMED.to_string())?,
        updated_at: ctx.timestamp,
        ..schedule
    });

    Ok(())
}

#[reducer]
pub fn ingest_message(
    ctx: &ReducerContext,
    thread_id: String,
    channel: String,
    channel_thread_id: String,
    title: String,
    event_id: String,
    run_id: Option<String>,
    direction: String,
    actor: String,
    content: String,
    metadata_json: String,
) -> Result<(), String> {
    let thread_id = validate_identifier(thread_id, "thread_id")?;
    let channel = validate_channel(channel)?;
    let channel_thread_id = validate_text(channel_thread_id, "channel_thread_id")?;
    let title = validate_text(title, "title")?;
    let event_id = validate_identifier(event_id, "event_id")?;
    let direction = validate_direction(direction)?;
    let actor = validate_text(actor, "actor")?;
    let content = validate_text(content, "content")?;
    let metadata_json = normalize_json_blob(metadata_json, "metadata_json")?;
    let now = now_micros(ctx);

    let thread = ThreadRecord {
        thread_id: thread_id.clone(),
        channel: channel.clone(),
        channel_thread_id,
        title,
        latest_message_at_micros: now,
        created_at_micros: now,
        updated_at_micros: now,
    };

    if let Some(existing) = ctx.db.thread_record().thread_id().find(thread_id.clone()) {
        ctx.db.thread_record().thread_id().update(ThreadRecord {
            channel: channel.clone(),
            title: thread.title,
            channel_thread_id: thread.channel_thread_id,
            latest_message_at_micros: now,
            updated_at_micros: now,
            ..existing
        });
    } else {
        ctx.db.thread_record().insert(thread);
    }

    ctx.db.message_event().insert(MessageEvent {
        event_id,
        thread_id,
        run_id,
        channel,
        direction,
        actor,
        content,
        metadata_json,
        created_at_micros: now,
    });

    Ok(())
}

#[reducer]
pub fn start_workflow_run(
    ctx: &ReducerContext,
    run_id: String,
    thread_id: String,
    agent_id: String,
    goal: String,
    priority: String,
    trigger_source: String,
    requested_by: String,
    context_json: String,
) -> Result<(), String> {
    let run_id = validate_identifier(run_id, "run_id")?;
    let thread_id = validate_identifier(thread_id, "thread_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let goal = validate_text(goal, "goal")?;
    let priority = validate_priority(priority)?;
    let trigger_source = validate_text(trigger_source, "trigger_source")?;
    let requested_by = validate_text(requested_by, "requested_by")?;
    let context_json = normalize_json_blob(context_json, "context_json")?;
    let now = now_micros(ctx);

    if ctx.db.thread_record().thread_id().find(thread_id.clone()).is_none() {
        return Err("thread is not registered".to_string());
    }

    if ctx.db.agent_record().agent_id().find(agent_id.clone()).is_none() {
        return Err(format!("agent '{agent_id}' is not registered"));
    }

    if ctx.db.workflow_run().run_id().find(run_id.clone()).is_some() {
        return Err("workflow run already exists".to_string());
    }

    ctx.db.workflow_run().insert(WorkflowRun {
        run_id,
        thread_id,
        agent_id,
        goal,
        priority,
        trigger_source,
        requested_by,
        current_stage: WORKFLOW_STAGE_ROUTE.to_string(),
        status: WORKFLOW_RUN_STATUS_QUEUED.to_string(),
        summary: None,
        context_json,
        created_at_micros: now,
        updated_at_micros: now,
        completed_at_micros: None,
    });

    Ok(())
}

#[reducer]
pub fn enqueue_workflow_step(
    ctx: &ReducerContext,
    step_id: String,
    run_id: String,
    agent_id: String,
    stage: String,
    owner_execution: String,
    input_json: String,
    depends_on_step_id: Option<String>,
) -> Result<(), String> {
    let step_id = validate_identifier(step_id, "step_id")?;
    let run_id = validate_identifier(run_id, "run_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let stage = validate_stage(stage)?;
    let owner_execution = validate_execution_owner(owner_execution)?;
    let input_json = normalize_json_blob(input_json, "input_json")?;
    let depends_on_step_id = match depends_on_step_id {
        Some(candidate) => Some(validate_identifier(candidate, "depends_on_step_id")?),
        None => None,
    };
    let now = now_micros(ctx);

    if ctx.db.workflow_run().run_id().find(run_id.clone()).is_none() {
        return Err("workflow run is not registered".to_string());
    }

    if ctx.db.workflow_step().step_id().find(step_id.clone()).is_some() {
        return Err("workflow step already exists".to_string());
    }

    ctx.db.workflow_step().insert(WorkflowStep {
        step_id,
        run_id: run_id.clone(),
        agent_id,
        stage: stage.clone(),
        owner_execution,
        status: WORKFLOW_STEP_STATUS_READY.to_string(),
        input_json,
        output_json: None,
        retry_count: 0,
        depends_on_step_id,
        approval_request_id: None,
        runner_id: None,
        created_at_micros: now,
        updated_at_micros: now,
        claimed_at_micros: None,
        completed_at_micros: None,
    });

    update_workflow_run_status(
        ctx,
        &run_id,
        WORKFLOW_RUN_STATUS_QUEUED.to_string(),
        stage,
        None,
        None,
    )
}

#[reducer]
pub fn claim_workflow_step(
    ctx: &ReducerContext,
    step_id: String,
    owner_execution: String,
    runner_id: String,
) -> Result<(), String> {
    let step_id = validate_identifier(step_id, "step_id")?;
    let owner_execution = validate_execution_owner(owner_execution)?;
    let runner_id = validate_text(runner_id, "runner_id")?;
    let now = now_micros(ctx);

    let Some(step) = ctx.db.workflow_step().step_id().find(step_id.clone()) else {
        return Err("workflow step not found".to_string());
    };

    if step.owner_execution != owner_execution {
        return Err("workflow step belongs to a different execution target".to_string());
    }

    if step.status != WORKFLOW_STEP_STATUS_READY {
        return Err("workflow step is not ready".to_string());
    }

    ctx.db.workflow_step().step_id().update(WorkflowStep {
        status: WORKFLOW_STEP_STATUS_RUNNING.to_string(),
        runner_id: Some(runner_id),
        claimed_at_micros: Some(now),
        updated_at_micros: now,
        ..step
    });

    Ok(())
}

#[reducer]
pub fn complete_workflow_step(
    ctx: &ReducerContext,
    step_id: String,
    output_json: String,
) -> Result<(), String> {
    let step_id = validate_identifier(step_id, "step_id")?;
    let output_json = normalize_json_blob(output_json, "output_json")?;
    let now = now_micros(ctx);

    let Some(step) = ctx.db.workflow_step().step_id().find(step_id.clone()) else {
        return Err("workflow step not found".to_string());
    };
    let run_id = step.run_id.clone();
    let stage = step.stage.clone();

    ctx.db.workflow_step().step_id().update(WorkflowStep {
        status: WORKFLOW_STEP_STATUS_COMPLETED.to_string(),
        output_json: Some(output_json),
        updated_at_micros: now,
        completed_at_micros: Some(now),
        ..step
    });

    let (status_str, is_final) = run_status_after_step_completion(&stage);
    let status = status_str.to_string();
    let completed_at_micros = if is_final.is_some() {
        Some(now)
    } else {
        None
    };

    update_workflow_run_status(
        ctx,
        &run_id,
        status,
        stage,
        None,
        completed_at_micros,
    )
}

#[reducer]
pub fn fail_workflow_step(
    ctx: &ReducerContext,
    step_id: String,
    output_json: String,
) -> Result<(), String> {
    let step_id = validate_identifier(step_id, "step_id")?;
    let output_json = normalize_json_blob(output_json, "output_json")?;
    let now = now_micros(ctx);

    let Some(step) = ctx.db.workflow_step().step_id().find(step_id.clone()) else {
        return Err("workflow step not found".to_string());
    };
    let run_id = step.run_id.clone();
    let stage = step.stage.clone();

    ctx.db.workflow_step().step_id().update(WorkflowStep {
        status: WORKFLOW_STEP_STATUS_FAILED.to_string(),
        output_json: Some(output_json),
        updated_at_micros: now,
        completed_at_micros: Some(now),
        ..step
    });

    update_workflow_run_status(
        ctx,
        &run_id,
        WORKFLOW_RUN_STATUS_FAILED.to_string(),
        stage,
        None,
        Some(now),
    )
}

#[reducer]
pub fn request_approval(
    ctx: &ReducerContext,
    approval_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    title: String,
    detail: String,
    risk: String,
    requested_by: String,
) -> Result<(), String> {
    let approval_id = validate_identifier(approval_id, "approval_id")?;
    let run_id = validate_identifier(run_id, "run_id")?;
    let step_id = validate_identifier(step_id, "step_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let title = validate_text(title, "title")?;
    let detail = validate_text(detail, "detail")?;
    let risk = validate_browser_risk(risk)?;
    let requested_by = validate_text(requested_by, "requested_by")?;
    let now = now_micros(ctx);

    ctx.db.approval_request().insert(ApprovalRequest {
        approval_id: approval_id.clone(),
        run_id: run_id.clone(),
        step_id: step_id.clone(),
        agent_id,
        title,
        detail,
        status: "pending".to_string(),
        risk,
        requested_by,
        resolution_json: None,
        created_at_micros: now,
        updated_at_micros: now,
    });

    let Some(step) = ctx.db.workflow_step().step_id().find(step_id) else {
        return Err("workflow step not found".to_string());
    };

    ctx.db.workflow_step().step_id().update(WorkflowStep {
        status: WORKFLOW_STEP_STATUS_AWAITING_APPROVAL.to_string(),
        approval_request_id: Some(approval_id),
        updated_at_micros: now,
        ..step
    });

    update_workflow_run_status(
        ctx,
        &run_id,
        WORKFLOW_RUN_STATUS_AWAITING_APPROVAL.to_string(),
        WORKFLOW_STAGE_ACT.to_string(),
        None,
        None,
    )
}

#[reducer]
pub fn resolve_approval(
    ctx: &ReducerContext,
    approval_id: String,
    status: String,
    resolution_json: String,
) -> Result<(), String> {
    let approval_id = validate_identifier(approval_id, "approval_id")?;
    let status = validate_approval_status(status)?;
    let resolution_json = normalize_json_blob(resolution_json, "resolution_json")?;
    let now = now_micros(ctx);

    let Some(approval) = ctx.db.approval_request().approval_id().find(approval_id) else {
        return Err("approval request not found".to_string());
    };
    let approval_step_id = approval.step_id.clone();
    let approval_run_id = approval.run_id.clone();

    ctx.db.approval_request().approval_id().update(ApprovalRequest {
        status: status.clone(),
        resolution_json: Some(resolution_json),
        updated_at_micros: now,
        ..approval
    });

    let Some(step) = ctx.db.workflow_step().step_id().find(approval_step_id) else {
        return Err("workflow step not found".to_string());
    };

    let step_status = step_status_for_approval(&status).to_string();

    ctx.db.workflow_step().step_id().update(WorkflowStep {
        status: step_status.clone(),
        updated_at_micros: now,
        ..step
    });

    let run_status = run_status_for_step_status(&step_status).to_string();

    update_workflow_run_status(
        ctx,
        &approval_run_id,
        run_status,
        WORKFLOW_STAGE_ACT.to_string(),
        None,
        None,
    )
}

#[reducer]
pub fn record_tool_call(
    ctx: &ReducerContext,
    tool_call_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    tool_name: String,
    status: String,
    input_json: String,
    output_json: Option<String>,
) -> Result<(), String> {
    let tool_call_id = validate_identifier(tool_call_id, "tool_call_id")?;
    let run_id = validate_identifier(run_id, "run_id")?;
    let step_id = validate_identifier(step_id, "step_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let tool_name = validate_text(tool_name, "tool_name")?;
    let status = validate_tool_call_status(status)?;
    let input_json = normalize_json_blob(input_json, "input_json")?;
    let output_json = match output_json {
        Some(candidate) => Some(normalize_json_blob(candidate, "output_json")?),
        None => None,
    };
    let now = now_micros(ctx);

    let row = ToolCallRecord {
        tool_call_id: tool_call_id.clone(),
        run_id,
        step_id,
        agent_id,
        tool_name,
        status,
        input_json,
        output_json,
        created_at_micros: now,
        updated_at_micros: now,
    };

    if ctx
        .db
        .tool_call_record()
        .tool_call_id()
        .find(tool_call_id.clone())
        .is_some()
    {
        ctx.db.tool_call_record().tool_call_id().update(row);
    } else {
        ctx.db.tool_call_record().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn enqueue_browser_task(
    ctx: &ReducerContext,
    task_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    mode: String,
    risk: String,
    url: String,
    request_json: String,
) -> Result<(), String> {
    let task_id = validate_identifier(task_id, "task_id")?;
    let run_id = validate_identifier(run_id, "run_id")?;
    let step_id = validate_identifier(step_id, "step_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let mode = validate_browser_mode(mode)?;
    let risk = validate_browser_risk(risk)?;
    let url = validate_text(url, "url")?;
    let request_json = normalize_json_blob(request_json, "request_json")?;
    let now = now_micros(ctx);

    ctx.db.browser_task().insert(BrowserTask {
        task_id,
        run_id: run_id.clone(),
        step_id: step_id.clone(),
        agent_id,
        mode,
        risk,
        status: BROWSER_TASK_STATUS_QUEUED.to_string(),
        owner_execution: EXECUTION_TARGET_BROWSER_WORKER.to_string(),
        url,
        request_json,
        result_json: None,
        runner_id: None,
        created_at_micros: now,
        updated_at_micros: now,
    });

    block_linked_step(ctx, &step_id, WORKFLOW_STEP_STATUS_BLOCKED)?;
    update_workflow_run_status(
        ctx,
        &run_id,
        WORKFLOW_RUN_STATUS_BLOCKED.to_string(),
        WORKFLOW_STAGE_GATHER.to_string(),
        None,
        None,
    )
}

#[reducer]
pub fn claim_browser_task(
    ctx: &ReducerContext,
    task_id: String,
    runner_id: String,
) -> Result<(), String> {
    let task_id = validate_identifier(task_id, "task_id")?;
    let runner_id = validate_text(runner_id, "runner_id")?;
    let now = now_micros(ctx);

    let Some(task) = ctx.db.browser_task().task_id().find(task_id) else {
        return Err("browser task not found".to_string());
    };

    if task.status != BROWSER_TASK_STATUS_QUEUED {
        return Err("browser task is not queued".to_string());
    }

    ctx.db.browser_task().task_id().update(BrowserTask {
        status: validate_browser_task_status(BROWSER_TASK_STATUS_RUNNING.to_string())?,
        runner_id: Some(runner_id),
        updated_at_micros: now,
        ..task
    });

    Ok(())
}

#[reducer]
pub fn complete_browser_task(
    ctx: &ReducerContext,
    task_id: String,
    result_json: String,
) -> Result<(), String> {
    let task_id = validate_identifier(task_id, "task_id")?;
    let result_json = normalize_json_blob(result_json, "result_json")?;
    let now = now_micros(ctx);

    let Some(task) = ctx.db.browser_task().task_id().find(task_id) else {
        return Err("browser task not found".to_string());
    };
    let task_step_id = task.step_id.clone();
    let task_run_id = task.run_id.clone();

    ctx.db.browser_task().task_id().update(BrowserTask {
        status: validate_browser_task_status(BROWSER_TASK_STATUS_COMPLETED.to_string())?,
        result_json: Some(result_json),
        updated_at_micros: now,
        ..task
    });

    block_linked_step(ctx, &task_step_id, WORKFLOW_STEP_STATUS_READY)?;
    update_workflow_run_status(
        ctx,
        &task_run_id,
        WORKFLOW_RUN_STATUS_RUNNING.to_string(),
        WORKFLOW_STAGE_VERIFY.to_string(),
        None,
        None,
    )
}

#[reducer]
pub fn fail_browser_task(
    ctx: &ReducerContext,
    task_id: String,
    result_json: String,
) -> Result<(), String> {
    let task_id = validate_identifier(task_id, "task_id")?;
    let result_json = normalize_json_blob(result_json, "result_json")?;
    let now = now_micros(ctx);

    let Some(task) = ctx.db.browser_task().task_id().find(task_id) else {
        return Err("browser task not found".to_string());
    };
    let task_step_id = task.step_id.clone();
    let task_run_id = task.run_id.clone();

    ctx.db.browser_task().task_id().update(BrowserTask {
        status: validate_browser_task_status(BROWSER_TASK_STATUS_FAILED.to_string())?,
        result_json: Some(result_json),
        updated_at_micros: now,
        ..task
    });

    block_linked_step(ctx, &task_step_id, WORKFLOW_STEP_STATUS_FAILED)?;
    update_workflow_run_status(
        ctx,
        &task_run_id,
        WORKFLOW_RUN_STATUS_FAILED.to_string(),
        WORKFLOW_STAGE_VERIFY.to_string(),
        None,
        Some(now),
    )
}

#[reducer]
pub fn record_browser_artifact(
    ctx: &ReducerContext,
    artifact_id: String,
    task_id: String,
    run_id: String,
    step_id: String,
    kind: String,
    title: String,
    url: String,
    metadata_json: String,
) -> Result<(), String> {
    let artifact_id = validate_identifier(artifact_id, "artifact_id")?;
    let task_id = validate_identifier(task_id, "task_id")?;
    let run_id = validate_identifier(run_id, "run_id")?;
    let step_id = validate_identifier(step_id, "step_id")?;
    let kind = validate_artifact_kind(kind)?;
    let title = validate_text(title, "title")?;
    let url = validate_text(url, "url")?;
    let metadata_json = normalize_json_blob(metadata_json, "metadata_json")?;

    let row = BrowserArtifact {
        artifact_id: artifact_id.clone(),
        task_id,
        run_id,
        step_id,
        kind,
        title,
        url,
        metadata_json,
        created_at_micros: now_micros(ctx),
    };

    if ctx
        .db
        .browser_artifact()
        .artifact_id()
        .find(artifact_id.clone())
        .is_some()
    {
        ctx.db.browser_artifact().artifact_id().update(row);
    } else {
        ctx.db.browser_artifact().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn record_delivery_attempt(
    ctx: &ReducerContext,
    attempt_id: String,
    thread_id: String,
    run_id: Option<String>,
    channel: String,
    direction: String,
    status: String,
    target: String,
    payload_json: String,
    response_json: Option<String>,
) -> Result<(), String> {
    let attempt_id = validate_identifier(attempt_id, "attempt_id")?;
    let thread_id = validate_identifier(thread_id, "thread_id")?;
    let channel = validate_channel(channel)?;
    let direction = validate_direction(direction)?;
    let status = validate_delivery_status(status)?;
    let target = validate_text(target, "target")?;
    let payload_json = normalize_json_blob(payload_json, "payload_json")?;
    let response_json = match response_json {
        Some(candidate) => Some(normalize_json_blob(candidate, "response_json")?),
        None => None,
    };
    let now = now_micros(ctx);

    let row = DeliveryAttempt {
        attempt_id: attempt_id.clone(),
        thread_id,
        run_id,
        channel,
        direction,
        status,
        target,
        payload_json,
        response_json,
        created_at_micros: now,
        updated_at_micros: now,
    };

    if ctx
        .db
        .delivery_attempt()
        .attempt_id()
        .find(attempt_id.clone())
        .is_some()
    {
        ctx.db.delivery_attempt().attempt_id().update(row);
    } else {
        ctx.db.delivery_attempt().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn upsert_memory_document(
    ctx: &ReducerContext,
    document_id: String,
    agent_id: String,
    namespace: String,
    source_kind: String,
    title: String,
    content: String,
    metadata_json: String,
) -> Result<(), String> {
    let document_id = validate_identifier(document_id, "document_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let namespace = validate_text(namespace, "namespace")?;
    let source_kind = validate_text(source_kind, "source_kind")?;
    let title = validate_text(title, "title")?;
    let content = validate_text(content, "content")?;
    let metadata_json = normalize_json_blob(metadata_json, "metadata_json")?;
    let now = now_micros(ctx);

    let row = MemoryDocument {
        document_id: document_id.clone(),
        agent_id,
        namespace,
        source_kind,
        title,
        content,
        metadata_json,
        created_at_micros: now,
        updated_at_micros: now,
    };

    if ctx
        .db
        .memory_document()
        .document_id()
        .find(document_id.clone())
        .is_some()
    {
        ctx.db.memory_document().document_id().update(row);
    } else {
        ctx.db.memory_document().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn upsert_memory_chunk(
    ctx: &ReducerContext,
    chunk_id: String,
    document_id: String,
    agent_id: String,
    namespace: String,
    ordinal: u32,
    content: String,
    metadata_json: String,
) -> Result<(), String> {
    let chunk_id = validate_identifier(chunk_id, "chunk_id")?;
    let document_id = validate_identifier(document_id, "document_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let namespace = validate_text(namespace, "namespace")?;
    let content = validate_text(content, "content")?;
    let metadata_json = normalize_json_blob(metadata_json, "metadata_json")?;
    let now = now_micros(ctx);

    let row = MemoryChunk {
        chunk_id: chunk_id.clone(),
        document_id,
        agent_id,
        namespace,
        ordinal,
        content,
        metadata_json,
        created_at_micros: now,
    };

    if ctx
        .db
        .memory_chunk()
        .chunk_id()
        .find(chunk_id.clone())
        .is_some()
    {
        ctx.db.memory_chunk().chunk_id().update(row);
    } else {
        ctx.db.memory_chunk().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn upsert_memory_embedding(
    ctx: &ReducerContext,
    embedding_id: String,
    chunk_id: String,
    agent_id: String,
    namespace: String,
    model: String,
    dimensions: u32,
    vector_json: String,
    checksum: String,
) -> Result<(), String> {
    let embedding_id = validate_identifier(embedding_id, "embedding_id")?;
    let chunk_id = validate_identifier(chunk_id, "chunk_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let namespace = validate_text(namespace, "namespace")?;
    let model = validate_text(model, "model")?;
    if dimensions == 0 {
        return Err("dimensions must be greater than zero".to_string());
    }
    let vector_json = normalize_json_blob(vector_json, "vector_json")?;
    let checksum = validate_text(checksum, "checksum")?;
    let now = now_micros(ctx);

    let row = MemoryEmbedding {
        embedding_id: embedding_id.clone(),
        chunk_id,
        agent_id,
        namespace,
        model,
        dimensions,
        vector_json,
        checksum,
        created_at_micros: now,
    };

    if ctx
        .db
        .memory_embedding()
        .embedding_id()
        .find(embedding_id.clone())
        .is_some()
    {
        ctx.db.memory_embedding().embedding_id().update(row);
    } else {
        ctx.db.memory_embedding().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn record_retrieval_trace(
    ctx: &ReducerContext,
    trace_id: String,
    run_id: String,
    step_id: String,
    query_text: String,
    query_embedding_json: String,
    chunk_ids_json: String,
    metadata_json: String,
) -> Result<(), String> {
    let trace_id = validate_identifier(trace_id, "trace_id")?;
    let run_id = validate_identifier(run_id, "run_id")?;
    let step_id = validate_identifier(step_id, "step_id")?;
    let query_text = validate_text(query_text, "query_text")?;
    let query_embedding_json = normalize_json_blob(query_embedding_json, "query_embedding_json")?;
    let chunk_ids_json = normalize_json_blob(chunk_ids_json, "chunk_ids_json")?;
    let metadata_json = normalize_json_blob(metadata_json, "metadata_json")?;

    let row = RetrievalTrace {
        trace_id: trace_id.clone(),
        run_id,
        step_id,
        query_text,
        query_embedding_json,
        chunk_ids_json,
        metadata_json,
        created_at_micros: now_micros(ctx),
    };

    if ctx
        .db
        .retrieval_trace()
        .trace_id()
        .find(trace_id.clone())
        .is_some()
    {
        ctx.db.retrieval_trace().trace_id().update(row);
    } else {
        ctx.db.retrieval_trace().insert(row);
    }

    Ok(())
}

#[reducer]
pub fn append_learning_note(
    ctx: &ReducerContext,
    run_id: String,
    agent_id: String,
    namespace: String,
    content: String,
) -> Result<(), String> {
    let run_id = validate_identifier(run_id, "run_id")?;
    let agent_id = validate_identifier(agent_id, "agent_id")?;
    let namespace = validate_text(namespace, "namespace")?;
    let content = validate_text(content, "content")?;

    if ctx.db.workflow_run().run_id().find(run_id).is_none() {
        return Err("workflow run not found".to_string());
    }

    ctx.db.memory_note().insert(MemoryNote {
        id: 0,
        agent_id,
        namespace,
        content,
        created_at: ctx.timestamp,
    });

    Ok(())
}

fn transition_job(
    ctx: &ReducerContext,
    job_id: String,
    status: String,
    summary: Option<String>,
) -> Result<(), String> {
    let job_id = validate_identifier(job_id, "job_id")?;
    let summary = summary.map(|candidate| candidate.trim().to_string());

    if let Some(job) = ctx.db.job_record().job_id().find(job_id) {
        ctx.db.job_record().job_id().update(JobRecord {
            status: validate_job_status(status)?,
            result_summary: summary,
            updated_at: ctx.timestamp,
            ..job
        });
        Ok(())
    } else {
        Err("job not found".to_string())
    }
}

// ── Operator Authentication ─────────────────────────────────────────

#[reducer]
pub fn create_auth_challenge(
    ctx: &ReducerContext,
    challenge_id: String,
    challenge: String,
    operator_id: Option<String>,
    expires_at_micros: i64,
) -> Result<(), String> {
    let challenge_id = validate_identifier(challenge_id, "challenge_id")?;
    let challenge = validate_identifier(challenge, "challenge")?;
    ctx.db.auth_challenge().insert(AuthChallenge {
        challenge_id,
        challenge,
        operator_id,
        expires_at_micros,
    });
    Ok(())
}

#[reducer]
pub fn register_operator(
    ctx: &ReducerContext,
    operator_id: String,
    display_name: String,
    email: String,
    credential_id: String,
    public_key_json: String,
    transports_json: String,
) -> Result<(), String> {
    let operator_id = validate_identifier(operator_id, "operator_id")?;
    let display_name = validate_text(display_name, "display_name")?;
    let email = validate_identifier(email, "email")?;
    let credential_id = validate_identifier(credential_id, "credential_id")?;

    ctx.db.operator_account().insert(OperatorAccount {
        operator_id: operator_id.clone(),
        identity: ctx.sender(),
        display_name,
        email,
        role: "operator".to_string(),
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });

    ctx.db.webauthn_credential().insert(WebAuthnCredential {
        credential_id,
        operator_id,
        public_key_json,
        counter: 0,
        transports_json,
        created_at: ctx.timestamp,
    });

    Ok(())
}

#[reducer]
pub fn update_webauthn_counter(
    ctx: &ReducerContext,
    credential_id: String,
    new_counter: u64,
) -> Result<(), String> {
    let credential_id = validate_identifier(credential_id, "credential_id")?;
    if let Some(existing) = ctx.db.webauthn_credential().credential_id().find(&credential_id) {
        ctx.db.webauthn_credential().credential_id().update(WebAuthnCredential {
            counter: new_counter,
            ..existing
        });
        Ok(())
    } else {
        Err(format!("Credential {credential_id} not found"))
    }
}

#[reducer]
pub fn delete_auth_challenge(
    ctx: &ReducerContext,
    challenge_id: String,
) -> Result<(), String> {
    let challenge_id = validate_identifier(challenge_id, "challenge_id")?;
    ctx.db.auth_challenge().challenge_id().delete(&challenge_id);
    Ok(())
}

#[reducer]
pub fn delete_expired_challenges(
    ctx: &ReducerContext,
) -> Result<(), String> {
    let now_micros = ctx.timestamp.to_micros_since_unix_epoch();
    let expired: Vec<String> = ctx.db.auth_challenge()
        .iter()
        .filter(|c| c.expires_at_micros < now_micros)
        .map(|c| c.challenge_id.clone())
        .collect();
    for id in expired {
        ctx.db.auth_challenge().challenge_id().delete(&id);
    }
    Ok(())
}

// ── Message Bus ─────────────────────────────────────────────────────

#[reducer]
pub fn ingest_raw_message(
    ctx: &ReducerContext,
    message_id: String,
    channel: String,
    direction: String,
    sender_entity_id: String,
    receiver_entity_id: Option<String>,
    thread_id: Option<String>,
    run_id: Option<String>,
    raw_payload: String,
    content_text: String,
    content_type: String,
    platform_message_id: Option<String>,
    platform_thread_id: Option<String>,
) -> Result<(), String> {
    let message_id = validate_identifier(message_id, "message_id")?;
    let channel = validate_identifier(channel, "channel")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    ctx.db.raw_message().insert(RawMessage {
        message_id,
        channel,
        direction,
        sender_entity_id,
        receiver_entity_id,
        thread_id,
        run_id,
        raw_payload,
        content_text,
        content_type,
        platform_message_id,
        platform_thread_id,
        status: "received".to_string(),
        created_at_micros: now,
        processed_at_micros: None,
    });
    Ok(())
}

#[reducer]
pub fn add_message_extraction(
    ctx: &ReducerContext,
    extraction_id: String,
    message_id: String,
    extraction_type: String,
    label: String,
    value: String,
    confidence: f64,
    metadata_json: String,
) -> Result<(), String> {
    let extraction_id = validate_identifier(extraction_id, "extraction_id")?;
    let message_id = validate_identifier(message_id, "message_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    ctx.db.message_extraction().insert(MessageExtraction {
        extraction_id,
        message_id,
        extraction_type,
        label,
        value,
        confidence,
        metadata_json,
        created_at_micros: now,
    });
    Ok(())
}

#[reducer]
pub fn upsert_message_entity(
    ctx: &ReducerContext,
    entity_id: String,
    entity_type: String,
    display_name: String,
    slack_user_id: Option<String>,
    discord_user_id: Option<String>,
    github_username: Option<String>,
    telegram_user_id: Option<String>,
    email_address: Option<String>,
    operator_id: Option<String>,
    agent_id: Option<String>,
    metadata_json: String,
) -> Result<(), String> {
    let entity_id = validate_identifier(entity_id, "entity_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    let row = MessageEntity {
        entity_id: entity_id.clone(),
        entity_type,
        display_name,
        slack_user_id,
        discord_user_id,
        github_username,
        telegram_user_id,
        email_address,
        operator_id,
        agent_id,
        metadata_json,
        created_at_micros: now,
        updated_at_micros: now,
    };

    if ctx.db.message_entity().entity_id().find(&entity_id).is_some() {
        ctx.db.message_entity().entity_id().update(MessageEntity {
            updated_at_micros: now,
            ..row
        });
    } else {
        ctx.db.message_entity().insert(row);
    }
    Ok(())
}

#[reducer]
pub fn embed_message(
    ctx: &ReducerContext,
    embedding_id: String,
    message_id: String,
    extraction_id: Option<String>,
    entity_id: Option<String>,
    model: String,
    dimensions: u32,
    vector_json: String,
    content_hash: String,
) -> Result<(), String> {
    let embedding_id = validate_identifier(embedding_id, "embedding_id")?;
    let message_id = validate_identifier(message_id, "message_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    ctx.db.message_embedding().insert(MessageEmbeddingRecord {
        embedding_id,
        message_id,
        extraction_id,
        entity_id,
        model,
        dimensions,
        vector_json,
        content_hash,
        created_at_micros: now,
    });
    Ok(())
}

#[reducer]
pub fn link_conversation(
    ctx: &ReducerContext,
    link_id: String,
    conversation_id: String,
    message_id: String,
    thread_id: Option<String>,
    channel: String,
    platform_thread_id: Option<String>,
) -> Result<(), String> {
    let link_id = validate_identifier(link_id, "link_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    ctx.db.conversation_link().insert(ConversationLink {
        link_id,
        conversation_id,
        message_id,
        thread_id,
        channel,
        platform_thread_id,
        created_at_micros: now,
    });
    Ok(())
}

#[reducer]
pub fn set_message_route(
    ctx: &ReducerContext,
    route_id: String,
    channel: String,
    entity_type: String,
    keyword_pattern: String,
    target_agent_id: String,
    priority: u32,
    enabled: bool,
) -> Result<(), String> {
    let route_id = validate_identifier(route_id, "route_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    let row = MessageRoute {
        route_id: route_id.clone(),
        channel,
        entity_type,
        keyword_pattern,
        target_agent_id,
        priority,
        enabled,
        created_at_micros: now,
    };

    if ctx.db.message_route().route_id().find(&route_id).is_some() {
        ctx.db.message_route().route_id().update(row);
    } else {
        ctx.db.message_route().insert(row);
    }
    Ok(())
}

#[reducer]
pub fn update_message_status(
    ctx: &ReducerContext,
    message_id: String,
    status: String,
) -> Result<(), String> {
    let message_id = validate_identifier(message_id, "message_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    if let Some(msg) = ctx.db.raw_message().message_id().find(&message_id) {
        ctx.db.raw_message().message_id().update(RawMessage {
            status,
            processed_at_micros: Some(now),
            ..msg
        });
        Ok(())
    } else {
        Err(format!("Message {message_id} not found"))
    }
}

#[reducer]
pub fn log_trajectory(
    ctx: &ReducerContext,
    trajectory_id: String,
    run_id: String,
    step_id: String,
    agent_id: String,
    stage: String,
    instruction: String,
    context_toon: String,
    output: String,
    tool_calls_json: String,
    success: bool,
    duration_ms: u64,
) -> Result<(), String> {
    let trajectory_id = validate_identifier(trajectory_id, "trajectory_id")?;
    let now = ctx.timestamp.to_micros_since_unix_epoch();

    ctx.db.trajectory_log().insert(TrajectoryLog {
        trajectory_id,
        run_id,
        step_id,
        agent_id,
        stage,
        instruction,
        context_toon,
        output,
        tool_calls_json,
        success,
        duration_ms,
        created_at_micros: now,
    });
    Ok(())
}

// ── Extracted Pure Business Logic ──────────────────────────────────
// These functions contain critical status-transition rules extracted
// from reducers for testability. Reducers call these directly.

/// Determine run status after a workflow step completes.
/// Learn stage → run completed. Any other stage → run still running.
fn run_status_after_step_completion(stage: &str) -> (&'static str, Option<()>) {
    if stage == WORKFLOW_STAGE_LEARN {
        (WORKFLOW_RUN_STATUS_COMPLETED, Some(()))
    } else {
        (WORKFLOW_RUN_STATUS_RUNNING, None)
    }
}

/// Determine step status after an approval is resolved.
/// Approved → step ready to resume. Rejected → step failed.
fn step_status_for_approval(approval_status: &str) -> &'static str {
    if approval_status == "approved" {
        WORKFLOW_STEP_STATUS_READY
    } else {
        WORKFLOW_STEP_STATUS_FAILED
    }
}

/// Determine run status after a step status change from approval resolution.
/// Ready step → run running. Failed step → run failed.
fn run_status_for_step_status(step_status: &str) -> &'static str {
    if step_status == WORKFLOW_STEP_STATUS_READY {
        WORKFLOW_RUN_STATUS_RUNNING
    } else {
        WORKFLOW_RUN_STATUS_FAILED
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // validate_identifier
    // -------------------------------------------------------------------------

    #[test]
    fn identifier_empty_string_is_err() {
        let result = validate_identifier("".to_string(), "agent_id");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("agent_id"));
    }

    #[test]
    fn identifier_whitespace_only_is_err() {
        let result = validate_identifier("   ".to_string(), "agent_id");
        assert!(result.is_err());
    }

    #[test]
    fn identifier_valid_alphanumeric_dash_underscore() {
        let result = validate_identifier("run-01_test".to_string(), "run_id");
        assert_eq!(result.unwrap(), "run-01_test");
    }

    #[test]
    fn identifier_trims_leading_trailing_whitespace() {
        let result = validate_identifier("  run-01  ".to_string(), "run_id");
        assert_eq!(result.unwrap(), "run-01");
    }

    #[test]
    fn identifier_dot_is_err() {
        let result = validate_identifier("run.01".to_string(), "run_id");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("run_id"));
    }

    #[test]
    fn identifier_space_in_value_is_err() {
        let result = validate_identifier("run 01".to_string(), "run_id");
        assert!(result.is_err());
    }

    #[test]
    fn identifier_unicode_char_is_err() {
        let result = validate_identifier("rün-01".to_string(), "run_id");
        assert!(result.is_err());
    }

    #[test]
    fn identifier_error_message_contains_field_name() {
        let field = "my_special_field";
        let err = validate_identifier("bad.value".to_string(), field).unwrap_err();
        assert!(err.contains(field));
    }

    // -------------------------------------------------------------------------
    // validate_text
    // -------------------------------------------------------------------------

    #[test]
    fn text_empty_is_err() {
        let result = validate_text("".to_string(), "description");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("description"));
    }

    #[test]
    fn text_whitespace_only_is_err() {
        let result = validate_text("   \t\n  ".to_string(), "description");
        assert!(result.is_err());
    }

    #[test]
    fn text_non_empty_returns_trimmed_ok() {
        let result = validate_text("  hello world  ".to_string(), "description");
        assert_eq!(result.unwrap(), "hello world");
    }

    #[test]
    fn text_any_non_empty_is_ok() {
        assert!(validate_text("x".to_string(), "f").is_ok());
        assert!(validate_text("some text with spaces".to_string(), "f").is_ok());
        assert!(validate_text("123".to_string(), "f").is_ok());
    }

    // -------------------------------------------------------------------------
    // normalize_json_blob
    // -------------------------------------------------------------------------

    #[test]
    fn json_blob_empty_is_err() {
        let result = normalize_json_blob("".to_string(), "payload");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("payload"));
    }

    #[test]
    fn json_blob_whitespace_only_is_err() {
        let result = normalize_json_blob("   ".to_string(), "payload");
        assert!(result.is_err());
    }

    #[test]
    fn json_blob_valid_json_object_is_ok() {
        let result = normalize_json_blob(r#"{"key":"value"}"#.to_string(), "payload");
        assert!(result.is_ok());
    }

    #[test]
    fn json_blob_non_json_non_empty_is_ok() {
        // normalize_json_blob only checks non-empty; it does not parse
        let result = normalize_json_blob("not-json-at-all".to_string(), "payload");
        assert!(result.is_ok());
    }

    #[test]
    fn json_blob_trims_whitespace() {
        let result = normalize_json_blob("  {}  ".to_string(), "payload");
        assert_eq!(result.unwrap(), "{}");
    }

    // -------------------------------------------------------------------------
    // validate_control_plane
    // -------------------------------------------------------------------------

    #[test]
    fn control_plane_local_is_ok() {
        assert_eq!(
            validate_control_plane("local".to_string()).unwrap(),
            "local"
        );
    }

    #[test]
    fn control_plane_cloud_is_ok() {
        assert_eq!(
            validate_control_plane("cloud".to_string()).unwrap(),
            "cloud"
        );
    }

    #[test]
    fn control_plane_invalid_is_err() {
        assert!(validate_control_plane("mars".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_priority
    // -------------------------------------------------------------------------

    #[test]
    fn priority_normal_is_ok() {
        assert_eq!(validate_priority("normal".to_string()).unwrap(), "normal");
    }

    #[test]
    fn priority_invalid_is_err() {
        assert!(validate_priority("urgent".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_channel
    // -------------------------------------------------------------------------

    #[test]
    fn channel_slack_is_ok() {
        assert_eq!(validate_channel("slack".to_string()).unwrap(), "slack");
    }

    #[test]
    fn channel_invalid_is_err() {
        assert!(validate_channel("discord".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_direction
    // -------------------------------------------------------------------------

    #[test]
    fn direction_inbound_is_ok() {
        assert_eq!(
            validate_direction("inbound".to_string()).unwrap(),
            "inbound"
        );
    }

    #[test]
    fn direction_invalid_is_err() {
        assert!(validate_direction("sideways".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_stage
    // -------------------------------------------------------------------------

    #[test]
    fn stage_route_is_ok() {
        assert_eq!(validate_stage("route".to_string()).unwrap(), "route");
    }

    #[test]
    fn stage_act_is_ok() {
        assert_eq!(validate_stage("act".to_string()).unwrap(), "act");
    }

    #[test]
    fn stage_invalid_is_err() {
        assert!(validate_stage("deploy".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_workflow_run_status
    // -------------------------------------------------------------------------

    #[test]
    fn workflow_run_status_queued_is_ok() {
        assert_eq!(
            validate_workflow_run_status("queued".to_string()).unwrap(),
            "queued"
        );
    }

    #[test]
    fn workflow_run_status_awaiting_approval_is_ok() {
        assert_eq!(
            validate_workflow_run_status("awaiting-approval".to_string()).unwrap(),
            "awaiting-approval"
        );
    }

    #[test]
    fn workflow_run_status_invalid_is_err() {
        assert!(validate_workflow_run_status("pending".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_step_status
    // -------------------------------------------------------------------------

    #[test]
    fn step_status_ready_is_ok() {
        assert_eq!(
            validate_step_status("ready".to_string()).unwrap(),
            "ready"
        );
    }

    #[test]
    fn step_status_invalid_is_err() {
        assert!(validate_step_status("scheduled".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_browser_mode
    // -------------------------------------------------------------------------

    #[test]
    fn browser_mode_navigate_is_ok() {
        assert_eq!(
            validate_browser_mode("navigate".to_string()).unwrap(),
            "navigate"
        );
    }

    #[test]
    fn browser_mode_invalid_is_err() {
        assert!(validate_browser_mode("click".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_browser_risk
    // -------------------------------------------------------------------------

    #[test]
    fn browser_risk_low_is_ok() {
        assert_eq!(validate_browser_risk("low".to_string()).unwrap(), "low");
    }

    #[test]
    fn browser_risk_invalid_is_err() {
        assert!(validate_browser_risk("none".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_approval_status
    // -------------------------------------------------------------------------

    #[test]
    fn approval_status_approved_is_ok() {
        assert_eq!(
            validate_approval_status("approved".to_string()).unwrap(),
            "approved"
        );
    }

    #[test]
    fn approval_status_invalid_is_err() {
        assert!(validate_approval_status("granted".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_delivery_status
    // -------------------------------------------------------------------------

    #[test]
    fn delivery_status_sent_is_ok() {
        assert_eq!(
            validate_delivery_status("sent".to_string()).unwrap(),
            "sent"
        );
    }

    #[test]
    fn delivery_status_invalid_is_err() {
        assert!(validate_delivery_status("delivered".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_execution_target
    // -------------------------------------------------------------------------

    #[test]
    fn execution_target_local_runner_is_ok() {
        assert_eq!(
            validate_execution_target("local-runner".to_string()).unwrap(),
            "local-runner"
        );
    }

    #[test]
    fn execution_target_invalid_is_err() {
        assert!(validate_execution_target("cloud-runner".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_execution_owner
    // -------------------------------------------------------------------------

    #[test]
    fn execution_owner_browser_worker_is_ok() {
        assert_eq!(
            validate_execution_owner("browser-worker".to_string()).unwrap(),
            "browser-worker"
        );
    }

    #[test]
    fn execution_owner_invalid_is_err() {
        assert!(validate_execution_owner("unknown-worker".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_runtime
    // -------------------------------------------------------------------------

    #[test]
    fn runtime_rust_core_is_ok() {
        assert_eq!(
            validate_runtime("rust-core".to_string()).unwrap(),
            "rust-core"
        );
    }

    #[test]
    fn runtime_invalid_is_err() {
        assert!(validate_runtime("python".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_browser_task_status
    // -------------------------------------------------------------------------

    #[test]
    fn browser_task_status_queued_is_ok() {
        assert_eq!(
            validate_browser_task_status("queued".to_string()).unwrap(),
            "queued"
        );
    }

    #[test]
    fn browser_task_status_invalid_is_err() {
        assert!(validate_browser_task_status("waiting".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_job_status
    // -------------------------------------------------------------------------

    #[test]
    fn job_status_running_is_ok() {
        assert_eq!(
            validate_job_status("running".to_string()).unwrap(),
            "running"
        );
    }

    #[test]
    fn job_status_invalid_is_err() {
        assert!(validate_job_status("paused".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_schedule_status
    // -------------------------------------------------------------------------

    #[test]
    fn schedule_status_ready_is_ok() {
        assert_eq!(
            validate_schedule_status("ready".to_string()).unwrap(),
            "ready"
        );
    }

    #[test]
    fn schedule_status_claimed_is_ok() {
        assert_eq!(
            validate_schedule_status("claimed".to_string()).unwrap(),
            "claimed"
        );
    }

    #[test]
    fn schedule_status_invalid_is_err() {
        assert!(validate_schedule_status("expired".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_runner_presence_status
    // -------------------------------------------------------------------------

    #[test]
    fn runner_presence_alive_is_ok() {
        assert_eq!(
            validate_runner_presence_status("alive".to_string()).unwrap(),
            "alive"
        );
    }

    #[test]
    fn runner_presence_invalid_is_err() {
        assert!(validate_runner_presence_status("offline".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_tool_call_status
    // -------------------------------------------------------------------------

    #[test]
    fn tool_call_status_pending_is_ok() {
        assert_eq!(
            validate_tool_call_status("pending".to_string()).unwrap(),
            "pending"
        );
    }

    #[test]
    fn tool_call_status_invalid_is_err() {
        assert!(validate_tool_call_status("queued".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // validate_artifact_kind
    // -------------------------------------------------------------------------

    #[test]
    fn artifact_kind_screenshot_is_ok() {
        assert_eq!(
            validate_artifact_kind("screenshot".to_string()).unwrap(),
            "screenshot"
        );
    }

    #[test]
    fn artifact_kind_invalid_is_err() {
        assert!(validate_artifact_kind("video".to_string()).is_err());
    }

    // -------------------------------------------------------------------------
    // interval_to_micros
    // -------------------------------------------------------------------------

    #[test]
    fn interval_one_minute() {
        assert_eq!(interval_to_micros(1), 60_000_000);
    }

    #[test]
    fn interval_sixty_minutes() {
        assert_eq!(interval_to_micros(60), 3_600_000_000);
    }

    #[test]
    fn interval_zero_minutes() {
        assert_eq!(interval_to_micros(0), 0);
    }

    // -------------------------------------------------------------------------
    // Constants vs starbridge_core enum as_str() — safety net
    // -------------------------------------------------------------------------

    // WORKFLOW_STAGE_*
    #[test]
    fn constant_workflow_stage_route_matches_enum() {
        assert_eq!(WORKFLOW_STAGE_ROUTE, WorkflowStage::Route.as_str());
    }

    #[test]
    fn constant_workflow_stage_act_matches_enum() {
        assert_eq!(WORKFLOW_STAGE_ACT, WorkflowStage::Act.as_str());
    }

    #[test]
    fn constant_workflow_stage_gather_matches_enum() {
        assert_eq!(WORKFLOW_STAGE_GATHER, WorkflowStage::Gather.as_str());
    }

    #[test]
    fn constant_workflow_stage_verify_matches_enum() {
        assert_eq!(WORKFLOW_STAGE_VERIFY, WorkflowStage::Verify.as_str());
    }

    #[test]
    fn constant_workflow_stage_learn_matches_enum() {
        assert_eq!(WORKFLOW_STAGE_LEARN, WorkflowStage::Learn.as_str());
    }

    // WORKFLOW_RUN_STATUS_*
    #[test]
    fn constant_workflow_run_status_queued_matches_enum() {
        assert_eq!(WORKFLOW_RUN_STATUS_QUEUED, RunState::Queued.as_str());
    }

    #[test]
    fn constant_workflow_run_status_running_matches_enum() {
        assert_eq!(WORKFLOW_RUN_STATUS_RUNNING, RunState::Running.as_str());
    }

    #[test]
    fn constant_workflow_run_status_blocked_matches_enum() {
        assert_eq!(WORKFLOW_RUN_STATUS_BLOCKED, RunState::Blocked.as_str());
    }

    #[test]
    fn constant_workflow_run_status_awaiting_approval_matches_enum() {
        assert_eq!(
            WORKFLOW_RUN_STATUS_AWAITING_APPROVAL,
            RunState::WaitingApproval.as_str()
        );
    }

    #[test]
    fn constant_workflow_run_status_completed_matches_enum() {
        assert_eq!(
            WORKFLOW_RUN_STATUS_COMPLETED,
            RunState::Completed.as_str()
        );
    }

    #[test]
    fn constant_workflow_run_status_failed_matches_enum() {
        assert_eq!(WORKFLOW_RUN_STATUS_FAILED, RunState::Failed.as_str());
    }

    // WORKFLOW_STEP_STATUS_*
    #[test]
    fn constant_workflow_step_status_ready_matches_enum() {
        assert_eq!(WORKFLOW_STEP_STATUS_READY, StepState::Ready.as_str());
    }

    #[test]
    fn constant_workflow_step_status_running_matches_enum() {
        assert_eq!(WORKFLOW_STEP_STATUS_RUNNING, StepState::Running.as_str());
    }

    #[test]
    fn constant_workflow_step_status_blocked_matches_enum() {
        assert_eq!(WORKFLOW_STEP_STATUS_BLOCKED, StepState::Blocked.as_str());
    }

    #[test]
    fn constant_workflow_step_status_awaiting_approval_matches_enum() {
        assert_eq!(
            WORKFLOW_STEP_STATUS_AWAITING_APPROVAL,
            StepState::WaitingApproval.as_str()
        );
    }

    #[test]
    fn constant_workflow_step_status_completed_matches_enum() {
        assert_eq!(
            WORKFLOW_STEP_STATUS_COMPLETED,
            StepState::Completed.as_str()
        );
    }

    #[test]
    fn constant_workflow_step_status_failed_matches_enum() {
        assert_eq!(WORKFLOW_STEP_STATUS_FAILED, StepState::Failed.as_str());
    }

    // BROWSER_TASK_STATUS_*
    #[test]
    fn constant_browser_task_status_queued_matches_enum() {
        assert_eq!(
            BROWSER_TASK_STATUS_QUEUED,
            BrowserTaskState::Queued.as_str()
        );
    }

    #[test]
    fn constant_browser_task_status_running_matches_enum() {
        assert_eq!(
            BROWSER_TASK_STATUS_RUNNING,
            BrowserTaskState::Running.as_str()
        );
    }

    #[test]
    fn constant_browser_task_status_completed_matches_enum() {
        assert_eq!(
            BROWSER_TASK_STATUS_COMPLETED,
            BrowserTaskState::Completed.as_str()
        );
    }

    #[test]
    fn constant_browser_task_status_failed_matches_enum() {
        assert_eq!(
            BROWSER_TASK_STATUS_FAILED,
            BrowserTaskState::Failed.as_str()
        );
    }

    // JOB_STATUS_*
    #[test]
    fn constant_job_status_queued_matches_enum() {
        assert_eq!(JOB_STATUS_QUEUED, JobStatus::Queued.as_str());
    }

    #[test]
    fn constant_job_status_running_matches_enum() {
        assert_eq!(JOB_STATUS_RUNNING, JobStatus::Running.as_str());
    }

    #[test]
    fn constant_job_status_completed_matches_enum() {
        assert_eq!(JOB_STATUS_COMPLETED, JobStatus::Completed.as_str());
    }

    #[test]
    fn constant_job_status_failed_matches_enum() {
        assert_eq!(JOB_STATUS_FAILED, JobStatus::Failed.as_str());
    }

    // SCHEDULE_STATUS_*
    #[test]
    fn constant_schedule_status_ready_matches_enum() {
        assert_eq!(SCHEDULE_STATUS_READY, ScheduleStatus::Ready.as_str());
    }

    #[test]
    fn constant_schedule_status_claimed_matches_enum() {
        assert_eq!(SCHEDULE_STATUS_CLAIMED, ScheduleStatus::Claimed.as_str());
    }

    // ── Extracted Business Logic Tests ──────────────────────────────

    #[test]
    fn run_status_learn_stage_completes_run() {
        let (status, is_final) = run_status_after_step_completion(WORKFLOW_STAGE_LEARN);
        assert_eq!(status, WORKFLOW_RUN_STATUS_COMPLETED);
        assert!(is_final.is_some());
    }

    #[test]
    fn run_status_route_stage_keeps_running() {
        let (status, is_final) = run_status_after_step_completion(WORKFLOW_STAGE_ROUTE);
        assert_eq!(status, WORKFLOW_RUN_STATUS_RUNNING);
        assert!(is_final.is_none());
    }

    #[test]
    fn run_status_act_stage_keeps_running() {
        let (status, is_final) = run_status_after_step_completion(WORKFLOW_STAGE_ACT);
        assert_eq!(status, WORKFLOW_RUN_STATUS_RUNNING);
        assert!(is_final.is_none());
    }

    #[test]
    fn run_status_gather_stage_keeps_running() {
        let (status, is_final) = run_status_after_step_completion(WORKFLOW_STAGE_GATHER);
        assert_eq!(status, WORKFLOW_RUN_STATUS_RUNNING);
        assert!(is_final.is_none());
    }

    #[test]
    fn run_status_verify_stage_keeps_running() {
        let (status, is_final) = run_status_after_step_completion(WORKFLOW_STAGE_VERIFY);
        assert_eq!(status, WORKFLOW_RUN_STATUS_RUNNING);
        assert!(is_final.is_none());
    }

    #[test]
    fn approval_approved_sets_step_ready() {
        assert_eq!(step_status_for_approval("approved"), WORKFLOW_STEP_STATUS_READY);
    }

    #[test]
    fn approval_rejected_sets_step_failed() {
        assert_eq!(step_status_for_approval("rejected"), WORKFLOW_STEP_STATUS_FAILED);
    }

    #[test]
    fn approval_expired_sets_step_failed() {
        assert_eq!(step_status_for_approval("expired"), WORKFLOW_STEP_STATUS_FAILED);
    }

    #[test]
    fn approval_unknown_sets_step_failed() {
        assert_eq!(step_status_for_approval("garbage"), WORKFLOW_STEP_STATUS_FAILED);
    }

    #[test]
    fn run_status_for_ready_step_is_running() {
        assert_eq!(run_status_for_step_status(WORKFLOW_STEP_STATUS_READY), WORKFLOW_RUN_STATUS_RUNNING);
    }

    #[test]
    fn run_status_for_failed_step_is_failed() {
        assert_eq!(run_status_for_step_status(WORKFLOW_STEP_STATUS_FAILED), WORKFLOW_RUN_STATUS_FAILED);
    }

    #[test]
    fn run_status_for_unknown_step_status_is_failed() {
        assert_eq!(run_status_for_step_status("nonsense"), WORKFLOW_RUN_STATUS_FAILED);
    }
}
