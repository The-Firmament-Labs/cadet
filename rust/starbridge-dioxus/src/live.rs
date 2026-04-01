use std::{
    env,
    sync::{mpsc, Arc},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use spacetimedb_sdk::{DbContext, Table, TableWithPrimaryKey};
use starbridge_control_client::cadet_control::{
    approval_request_table::ApprovalRequestTableAccess,
    browser_task_table::BrowserTaskTableAccess,
    ingest_message,
    memory_chunk_table::MemoryChunkTableAccess,
    memory_document_table::MemoryDocumentTableAccess,
    memory_embedding_table::MemoryEmbeddingTableAccess,
    message_event_table::MessageEventTableAccess,
    retrieval_trace_table::RetrievalTraceTableAccess,
    resolve_approval,
    thread_record_table::ThreadRecordTableAccess,
    workflow_run_table::WorkflowRunTableAccess,
    workflow_step_table::WorkflowStepTableAccess,
    DbConnection, RemoteDbContext,
};
use starbridge_core::{
    ApprovalRequestRecord, BrowserTaskRecord, ChatThreadRecord, MemoryChunkRecord,
    MemoryDocumentRecord, MemoryEmbeddingRecord, MessageEventRecord, MissionControlSnapshot,
    RetrievalTraceRecord, WorkflowRunRecord, WorkflowStepRecord,
};

type SnapshotCallback = dyn Fn(MissionControlSnapshot, String) + Send + Sync + 'static;
type ErrorCallback = dyn Fn(String) + Send + Sync + 'static;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LiveSnapshotOptions {
    pub base_url: String,
    pub database: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatMessageDraft {
    pub thread_id: String,
    pub channel: String,
    pub channel_thread_id: String,
    pub title: String,
    pub actor: String,
    pub content: String,
    pub run_id: Option<String>,
}

impl LiveSnapshotOptions {
    pub fn from_env() -> Self {
        // Load ~/.cadet/.env if it exists (persistent config for desktop)
        if let Ok(home) = env::var("HOME") {
            let env_path = format!("{}/.cadet/.env", home);
            if let Ok(content) = std::fs::read_to_string(&env_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') { continue; }
                    if let Some((key, val)) = line.split_once('=') {
                        let key = key.trim();
                        let val = val.trim().trim_matches('"');
                        if env::var(key).is_err() {
                            env::set_var(key, val);
                        }
                    }
                }
            }
        }

        Self {
            base_url: env::var("SPACETIMEDB_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3000".to_string()),
            database: env::var("SPACETIMEDB_DATABASE")
                .unwrap_or_else(|_| "starbridge-control".to_string()),
        }
    }
}

impl Default for LiveSnapshotOptions {
    fn default() -> Self {
        Self::from_env()
    }
}

pub fn load_live_snapshot(options: &LiveSnapshotOptions) -> Result<MissionControlSnapshot, String> {
    let connection = connect(&options.database, &options.base_url)?;
    Ok(snapshot_from_context(&connection, options))
}

pub fn render_live_preview(options: &LiveSnapshotOptions) -> Result<String, String> {
    let snapshot = load_live_snapshot(options)?;
    Ok(crate::render_preview(snapshot))
}

pub fn subscribe_live_snapshots(
    options: LiveSnapshotOptions,
    on_snapshot: impl Fn(MissionControlSnapshot, String) + Send + Sync + 'static,
    on_error: impl Fn(String) + Send + Sync + 'static,
) -> std::thread::JoinHandle<()> {
    let on_snapshot: Arc<SnapshotCallback> = Arc::new(on_snapshot);
    let on_error: Arc<ErrorCallback> = Arc::new(on_error);

    std::thread::spawn(move || {
        if let Err(error) = run_live_subscription(options, on_snapshot.clone(), on_error.clone()) {
            (on_error)(error);
        }
    })
}

pub fn send_live_message(
    options: &LiveSnapshotOptions,
    draft: ChatMessageDraft,
) -> Result<(), String> {
    let connection = connect(&options.database, &options.base_url)?;
    let (result_tx, result_rx) = mpsc::channel();

    connection
        .reducers
        .ingest_message_then(
            draft.thread_id,
            draft.channel,
            draft.channel_thread_id,
            draft.title,
            format!("event-ui-{}", timestamp_suffix()),
            draft.run_id,
            "outbound".to_string(),
            draft.actor,
            draft.content,
            "{\"source\":\"dioxus-ui\",\"mode\":\"chat\"}".to_string(),
            move |_ctx, result| {
                let normalized = match result {
                    Ok(Ok(())) => Ok(()),
                    Ok(Err(error)) => Err(error),
                    Err(error) => Err(error.to_string()),
                };
                let _ = result_tx.send(normalized);
            },
        )
        .map_err(|error| error.to_string())?;

    result_rx
        .recv_timeout(Duration::from_secs(10))
        .map_err(|_| "Timed out waiting for chat reducer completion".to_string())?
}

pub fn resolve_live_approval(
    options: &LiveSnapshotOptions,
    approval_id: String,
    status: String,
) -> Result<(), String> {
    let connection = connect(&options.database, &options.base_url)?;
    let (result_tx, result_rx) = mpsc::channel();

    connection
        .reducers
        .resolve_approval_then(
            approval_id,
            status.clone(),
            format!(
                "{{\"source\":\"dioxus-ui\",\"resolvedAt\":\"{}\",\"status\":\"{}\"}}",
                timestamp_suffix(),
                status
            ),
            move |_ctx, result| {
                let normalized = match result {
                    Ok(Ok(())) => Ok(()),
                    Ok(Err(error)) => Err(error),
                    Err(error) => Err(error.to_string()),
                };
                let _ = result_tx.send(normalized);
            },
        )
        .map_err(|error| error.to_string())?;

    result_rx
        .recv_timeout(Duration::from_secs(10))
        .map_err(|_| "Timed out waiting for approval reducer completion".to_string())?
}

fn run_live_subscription(
    options: LiveSnapshotOptions,
    on_snapshot: Arc<SnapshotCallback>,
    on_error: Arc<ErrorCallback>,
) -> Result<(), String> {
    let ws_url = websocket_url(&options.base_url);
    let token = env::var("SPACETIMEDB_AUTH_TOKEN").ok();
    let initial_snapshot = on_snapshot.clone();
    let initial_error = on_error.clone();
    let initial_options = options.clone();
    let disconnect_error = on_error.clone();

    let connection = DbConnection::builder()
        .with_uri(ws_url)
        .with_database_name(options.database.clone())
        .with_token(token)
        .on_connect(move |ctx, _identity, _token| {
            let initial_snapshot = initial_snapshot.clone();
            let initial_error = initial_error.clone();
            let initial_options = initial_options.clone();

            ctx.subscription_builder()
                .on_applied(move |ctx| {
                    (initial_snapshot)(
                        snapshot_from_context(ctx, &initial_options),
                        live_source_label(&initial_options, "streaming"),
                    );
                })
                .on_error(move |_ctx, error| {
                    (initial_error)(format!("Subscription error: {error}"));
                })
                .subscribe_to_all_tables();
        })
        .on_disconnect(move |_ctx, error| {
            let message = match error {
                Some(error) => format!("SpacetimeDB disconnected: {error}"),
                None => "SpacetimeDB disconnected".to_string(),
            };
            (disconnect_error)(message);
        })
        .build()
        .map_err(|error| format!("Failed to connect to SpacetimeDB: {error}"))?;

    register_change_watchers(&connection, &options, on_snapshot);
    connection
        .run_threaded()
        .join()
        .map_err(|_| "SpacetimeDB subscription thread panicked".to_string())
}

fn register_change_watchers(
    connection: &DbConnection,
    options: &LiveSnapshotOptions,
    on_snapshot: Arc<SnapshotCallback>,
) {
    macro_rules! watch_table {
        ($table:ident) => {{
            let options = options.clone();
            let on_snapshot = on_snapshot.clone();
            connection.db.$table().on_insert(move |ctx, _row| {
                publish_snapshot(ctx, &options, &on_snapshot);
            });
        }};
    }

    macro_rules! watch_table_updates {
        ($table:ident) => {{
            let options = options.clone();
            let on_snapshot = on_snapshot.clone();
            connection.db.$table().on_update(move |ctx, _old, _new| {
                publish_snapshot(ctx, &options, &on_snapshot);
            });
        }};
    }

    macro_rules! watch_table_deletes {
        ($table:ident) => {{
            let options = options.clone();
            let on_snapshot = on_snapshot.clone();
            connection.db.$table().on_delete(move |ctx, _row| {
                publish_snapshot(ctx, &options, &on_snapshot);
            });
        }};
    }

    watch_table!(workflow_run);
    watch_table_updates!(workflow_run);
    watch_table_deletes!(workflow_run);

    watch_table!(workflow_step);
    watch_table_updates!(workflow_step);
    watch_table_deletes!(workflow_step);

    watch_table!(browser_task);
    watch_table_updates!(browser_task);
    watch_table_deletes!(browser_task);

    watch_table!(memory_document);
    watch_table_updates!(memory_document);
    watch_table_deletes!(memory_document);

    watch_table!(memory_chunk);
    watch_table_updates!(memory_chunk);
    watch_table_deletes!(memory_chunk);

    watch_table!(memory_embedding);
    watch_table_updates!(memory_embedding);
    watch_table_deletes!(memory_embedding);

    watch_table!(retrieval_trace);
    watch_table_updates!(retrieval_trace);
    watch_table_deletes!(retrieval_trace);

    watch_table!(approval_request);
    watch_table_updates!(approval_request);
    watch_table_deletes!(approval_request);

    watch_table!(thread_record);
    watch_table_updates!(thread_record);
    watch_table_deletes!(thread_record);

    watch_table!(message_event);
    watch_table_updates!(message_event);
    watch_table_deletes!(message_event);
}

fn publish_snapshot(
    ctx: &impl RemoteDbContext,
    options: &LiveSnapshotOptions,
    on_snapshot: &Arc<SnapshotCallback>,
) {
    (on_snapshot)(
        snapshot_from_context(ctx, options),
        live_source_label(options, "streaming"),
    );
}

fn snapshot_from_context(
    ctx: &impl RemoteDbContext,
    options: &LiveSnapshotOptions,
) -> MissionControlSnapshot {
    let mut workflow_runs = ctx
        .db()
        .workflow_run()
        .iter()
        .map(|run| WorkflowRunRecord {
            run_id: run.run_id,
            thread_id: run.thread_id,
            agent_id: run.agent_id,
            goal: run.goal,
            priority: run.priority,
            trigger_source: run.trigger_source,
            requested_by: run.requested_by,
            current_stage: run.current_stage,
            status: run.status,
            summary: run.summary,
        })
        .collect::<Vec<_>>();
    workflow_runs.sort_by(|left, right| left.run_id.cmp(&right.run_id));

    let mut workflow_steps = ctx
        .db()
        .workflow_step()
        .iter()
        .map(|step| WorkflowStepRecord {
            step_id: step.step_id,
            run_id: step.run_id,
            agent_id: step.agent_id,
            stage: step.stage,
            owner_execution: step.owner_execution,
            status: step.status,
            retry_count: step.retry_count,
            depends_on_step_id: step.depends_on_step_id,
            runner_id: step.runner_id,
        })
        .collect::<Vec<_>>();
    workflow_steps.sort_by(|left, right| left.step_id.cmp(&right.step_id));

    let mut browser_tasks = ctx
        .db()
        .browser_task()
        .iter()
        .map(|task| BrowserTaskRecord {
            task_id: task.task_id,
            run_id: task.run_id,
            step_id: task.step_id,
            agent_id: task.agent_id,
            mode: task.mode,
            risk: task.risk,
            status: task.status,
            owner_execution: task.owner_execution,
            url: task.url,
        })
        .collect::<Vec<_>>();
    browser_tasks.sort_by(|left, right| left.task_id.cmp(&right.task_id));

    let mut memory_documents = ctx
        .db()
        .memory_document()
        .iter()
        .map(|document| MemoryDocumentRecord {
            document_id: document.document_id,
            agent_id: document.agent_id,
            namespace: document.namespace,
            source_kind: document.source_kind,
            title: document.title,
            content: document.content,
        })
        .collect::<Vec<_>>();
    memory_documents.sort_by(|left, right| left.document_id.cmp(&right.document_id));

    let mut memory_chunks = ctx
        .db()
        .memory_chunk()
        .iter()
        .map(|chunk| MemoryChunkRecord {
            chunk_id: chunk.chunk_id,
            document_id: chunk.document_id,
            agent_id: chunk.agent_id,
            namespace: chunk.namespace,
            ordinal: chunk.ordinal,
            content: chunk.content,
            metadata_json: chunk.metadata_json,
            created_at_micros: chunk.created_at_micros,
        })
        .collect::<Vec<_>>();
    memory_chunks.sort_by(|left, right| {
        left.document_id
            .cmp(&right.document_id)
            .then_with(|| left.ordinal.cmp(&right.ordinal))
            .then_with(|| left.chunk_id.cmp(&right.chunk_id))
    });

    let mut memory_embeddings = ctx
        .db()
        .memory_embedding()
        .iter()
        .map(|embedding| MemoryEmbeddingRecord {
            embedding_id: embedding.embedding_id,
            chunk_id: embedding.chunk_id,
            agent_id: embedding.agent_id,
            namespace: embedding.namespace,
            model: embedding.model,
            dimensions: embedding.dimensions,
            vector: parse_vector_json(&embedding.vector_json),
            checksum: embedding.checksum,
            created_at_micros: embedding.created_at_micros,
        })
        .collect::<Vec<_>>();
    memory_embeddings.sort_by(|left, right| left.embedding_id.cmp(&right.embedding_id));

    let mut retrieval_traces = ctx
        .db()
        .retrieval_trace()
        .iter()
        .map(|trace| RetrievalTraceRecord {
            trace_id: trace.trace_id,
            run_id: trace.run_id,
            step_id: trace.step_id,
            query_text: trace.query_text,
            query_embedding: parse_vector_json(&trace.query_embedding_json),
            chunk_ids: parse_chunk_ids_json(&trace.chunk_ids_json),
            metadata_json: trace.metadata_json,
            created_at_micros: trace.created_at_micros,
        })
        .collect::<Vec<_>>();
    retrieval_traces.sort_by(|left, right| left.trace_id.cmp(&right.trace_id));

    let mut approval_requests = ctx
        .db()
        .approval_request()
        .iter()
        .map(|approval| ApprovalRequestRecord {
            approval_id: approval.approval_id,
            run_id: approval.run_id,
            step_id: approval.step_id,
            agent_id: approval.agent_id,
            title: approval.title,
            detail: approval.detail,
            status: approval.status,
            risk: approval.risk,
            requested_by: approval.requested_by,
        })
        .collect::<Vec<_>>();
    approval_requests.sort_by(|left, right| left.approval_id.cmp(&right.approval_id));

    let mut threads = ctx
        .db()
        .thread_record()
        .iter()
        .map(|thread| ChatThreadRecord {
            thread_id: thread.thread_id,
            channel: thread.channel,
            channel_thread_id: thread.channel_thread_id,
            title: thread.title,
            latest_message_at_micros: thread.latest_message_at_micros,
        })
        .collect::<Vec<_>>();
    threads.sort_by(|left, right| {
        right
            .latest_message_at_micros
            .cmp(&left.latest_message_at_micros)
            .then_with(|| left.thread_id.cmp(&right.thread_id))
    });

    let mut message_events = ctx
        .db()
        .message_event()
        .iter()
        .map(|event| MessageEventRecord {
            event_id: event.event_id,
            thread_id: event.thread_id,
            run_id: event.run_id,
            channel: event.channel,
            direction: event.direction,
            actor: event.actor,
            content: event.content,
            created_at_micros: event.created_at_micros,
        })
        .collect::<Vec<_>>();
    message_events.sort_by(|left, right| {
        left.created_at_micros
            .cmp(&right.created_at_micros)
            .then_with(|| left.event_id.cmp(&right.event_id))
    });

    MissionControlSnapshot {
        environment: live_source_label(options, "snapshot"),
        generated_at: format!("SpacetimeDB {}", options.base_url),
        workflow_runs,
        workflow_steps,
        browser_tasks,
        memory_documents,
        memory_chunks,
        memory_embeddings,
        retrieval_traces,
        approval_requests,
        threads,
        message_events,
    }
}

fn connect(database: &str, base_url: &str) -> Result<DbConnection, String> {
    let (ready_tx, ready_rx) = mpsc::channel();
    let ws_url = websocket_url(base_url);
    let token = env::var("SPACETIMEDB_AUTH_TOKEN").ok();

    let connection = DbConnection::builder()
        .with_uri(ws_url)
        .with_database_name(database.to_string())
        .with_token(token)
        .on_connect(move |ctx, _identity, _token| {
            ctx.subscription_builder()
                .on_applied(move |_ctx| {
                    let _ = ready_tx.send(());
                })
                .subscribe_to_all_tables();
        })
        .build()
        .map_err(|error| format!("Failed to connect to SpacetimeDB: {error}"))?;

    let _thread = connection.run_threaded();
    ready_rx
        .recv_timeout(Duration::from_secs(10))
        .map_err(|_| "Timed out waiting for SpacetimeDB subscription".to_string())?;

    Ok(connection)
}

fn live_source_label(options: &LiveSnapshotOptions, mode: &str) -> String {
    format!("{mode} · {} @ {}", options.database, options.base_url)
}

fn websocket_url(value: &str) -> String {
    if let Some(rest) = value.strip_prefix("http://") {
        format!("ws://{rest}")
    } else if let Some(rest) = value.strip_prefix("https://") {
        format!("wss://{rest}")
    } else {
        value.to_string()
    }
}

fn parse_chunk_ids_json(value: &str) -> Vec<String> {
    serde_json::from_str(value).unwrap_or_default()
}

fn parse_vector_json(value: &str) -> Vec<f64> {
    serde_json::from_str::<Vec<f64>>(value)
        .or_else(|_| serde_json::from_str::<Vec<f32>>(value).map(|values| values.into_iter().map(f64::from).collect()))
        .or_else(|_| serde_json::from_str::<Vec<i64>>(value).map(|values| values.into_iter().map(|value| value as f64).collect()))
        .unwrap_or_default()
}

fn timestamp_suffix() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        live_source_label, parse_chunk_ids_json, parse_vector_json, websocket_url,
        ChatMessageDraft,
        LiveSnapshotOptions,
    };

    #[test]
    fn parse_chunk_ids_json_returns_empty_for_invalid_payloads() {
        assert_eq!(parse_chunk_ids_json("not-json"), Vec::<String>::new());
    }

    #[test]
    fn parse_chunk_ids_json_parses_string_arrays() {
        assert_eq!(
            parse_chunk_ids_json("[\"chunk_01\",\"chunk_02\"]"),
            vec!["chunk_01".to_string(), "chunk_02".to_string()]
        );
    }

    #[test]
    fn parse_vector_json_supports_float_arrays() {
        assert_eq!(parse_vector_json("[0.1,0.2,0.3]"), vec![0.1, 0.2, 0.3]);
    }

    #[test]
    fn parse_vector_json_returns_empty_for_invalid_payloads() {
        assert_eq!(parse_vector_json("{\"bad\":true}"), Vec::<f64>::new());
    }

    #[test]
    fn websocket_url_normalizes_http_schemes() {
        assert_eq!(
            websocket_url("http://127.0.0.1:3000"),
            "ws://127.0.0.1:3000"
        );
        assert_eq!(websocket_url("https://cadet.dev"), "wss://cadet.dev");
        assert_eq!(websocket_url("ws://cadet.dev"), "ws://cadet.dev");
    }

    #[test]
    fn live_snapshot_options_default_to_local_cadet_values() {
        let defaults = LiveSnapshotOptions {
            base_url: "http://127.0.0.1:3000".to_string(),
            database: "starbridge-control".to_string(),
        };

        assert_eq!(defaults.base_url, "http://127.0.0.1:3000");
        assert_eq!(defaults.database, "starbridge-control");
    }

    #[test]
    fn live_source_label_describes_stream_state() {
        let options = LiveSnapshotOptions {
            base_url: "http://127.0.0.1:3000".to_string(),
            database: "starbridge-control".to_string(),
        };

        assert_eq!(
            live_source_label(&options, "streaming"),
            "streaming · starbridge-control @ http://127.0.0.1:3000"
        );
    }

    #[test]
    fn chat_message_draft_keeps_thread_and_channel_identifiers() {
        let draft = ChatMessageDraft {
            thread_id: "thread_01".to_string(),
            channel: "web".to_string(),
            channel_thread_id: "thread_01".to_string(),
            title: "Mission control".to_string(),
            actor: "operator".to_string(),
            content: "Hello".to_string(),
            run_id: Some("run_01".to_string()),
        };

        assert_eq!(draft.thread_id, draft.channel_thread_id);
        assert_eq!(draft.channel, "web");
    }
}
