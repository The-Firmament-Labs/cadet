use std::{
    env,
    sync::mpsc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use spacetimedb_sdk::DbContext;
use starbridge_control_client::cadet_control::{
    claim_browser_task, claim_workflow_step, enqueue_browser_task, enqueue_workflow_step,
    ingest_message, record_retrieval_trace, request_approval, start_workflow_run,
    upsert_memory_chunk, upsert_memory_document, upsert_memory_embedding, DbConnection,
};
use starbridge_core::deterministic_embedding;

macro_rules! invoke_and_wait {
    ($reducers:expr, $method:ident, $label:literal $(, $args:expr )* $(,)?) => {{
        let (result_tx, result_rx) = mpsc::channel();
        $reducers
            .$method($($args, )* move |_ctx, result| {
                let _ = result_tx.send(normalize_reducer_result(result));
            })
            .map_err(|error| format!("Failed to dispatch {}: {}", $label, error))?;

        result_rx
            .recv_timeout(Duration::from_secs(10))
            .map_err(|_| format!("Timed out waiting for {}", $label))??;
    }};
}

fn main() -> Result<(), String> {
    let base_url = env::var("SPACETIMEDB_URL").unwrap_or_else(|_| "http://127.0.0.1:3000".to_string());
    let database =
        env::var("SPACETIMEDB_DATABASE").unwrap_or_else(|_| "starbridge-control".to_string());
    let connection = connect(&database, &base_url)?;
    let suffix = timestamp_suffix();
    let thread_id = format!("thread-dioxus-{suffix}");
    let run_id = format!("run-dioxus-{suffix}");
    let route_step_id = format!("{run_id}_route");
    let verify_step_id = format!("{run_id}_verify");
    let browser_task_id = format!("browser-{suffix}");
    let approval_id = format!("approval-{suffix}");
    let workflow_document_id = format!("doc-workflow-{suffix}");
    let retrieval_document_id = format!("doc-retrieval-{suffix}");
    let trace_id = format!("trace-{suffix}");
    let reducers = &connection.reducers;
    let query_embedding = deterministic_embedding(
        "dioxus live operator rollout vectors 3d projection telemetry surface",
        18,
    );

    invoke_and_wait!(
        reducers,
        ingest_message_then,
        "ingest_message",
        thread_id.clone(),
        "web".to_string(),
        thread_id.clone(),
        "Dioxus live mission control".to_string(),
        format!("event-{suffix}"),
            Some(run_id.clone()),
            "inbound".to_string(),
            "operator".to_string(),
            "Render the new Dioxus mission control against live Spacetime data.".to_string(),
            "{\"source\":\"codex\",\"mode\":\"live\"}".to_string(),
    );

    invoke_and_wait!(
        reducers,
        start_workflow_run_then,
        "start_workflow_run",
        run_id.clone(),
        thread_id.clone(),
        "operator".to_string(),
        "Render the new Dioxus mission control against live Spacetime data.".to_string(),
        "high".to_string(),
        "web".to_string(),
        "operator".to_string(),
        "{\"source\":\"codex\",\"ui\":\"dioxus\",\"live\":true}".to_string(),
    );

    invoke_and_wait!(
        reducers,
        enqueue_workflow_step_then,
        "enqueue_workflow_step_route",
        route_step_id.clone(),
        run_id.clone(),
        "operator".to_string(),
        "route".to_string(),
        "vercel-edge".to_string(),
            format!(
                "{{\"goal\":\"{}\",\"browserRequired\":true,\"threadId\":\"{}\",\"channel\":\"web\"}}",
                "Render the new Dioxus mission control against live Spacetime data.",
                thread_id
            ),
            None,
    );

    invoke_and_wait!(
        reducers,
        claim_workflow_step_then,
        "claim_workflow_step_route",
        route_step_id.clone(),
        "vercel-edge".to_string(),
        "seed-operator".to_string(),
    );

    invoke_and_wait!(
        reducers,
        enqueue_workflow_step_then,
        "enqueue_workflow_step_verify",
        verify_step_id.clone(),
        run_id.clone(),
        "operator".to_string(),
        "verify".to_string(),
        "browser-worker".to_string(),
            format!(
                "{{\"goal\":\"{}\",\"browserRequired\":true,\"browserMode\":\"monitor\",\"threadId\":\"{}\",\"channel\":\"web\"}}",
                "Render the new Dioxus mission control against live Spacetime data.",
                thread_id
            ),
            Some(route_step_id.clone()),
    );

    invoke_and_wait!(
        reducers,
        claim_workflow_step_then,
        "claim_workflow_step_verify",
        verify_step_id.clone(),
        "browser-worker".to_string(),
        "browser-seed-1".to_string(),
    );

    invoke_and_wait!(
        reducers,
        request_approval_then,
        "request_approval",
        approval_id,
        run_id.clone(),
        verify_step_id.clone(),
        "operator".to_string(),
        "Approve browser verification capture".to_string(),
            "The browser worker will capture the active operator window and keep the artifact attached to the verification step."
                .to_string(),
            "medium".to_string(),
            "operator".to_string(),
    );

    invoke_and_wait!(
        reducers,
        enqueue_browser_task_then,
        "enqueue_browser_task",
        browser_task_id.clone(),
        run_id.clone(),
        verify_step_id.clone(),
        "operator".to_string(),
            "monitor".to_string(),
            "medium".to_string(),
            "http://127.0.0.1:3001/docs".to_string(),
            "{\"allowedDomains\":[\"127.0.0.1\",\"localhost\"],\"blockedDomains\":[],\"allowDownloads\":false,\"requestedBy\":\"operator\",\"instructions\":\"Verify the Dioxus operator docs surface and capture the active run state.\",\"metadata\":{\"seededBy\":\"codex\"}}".to_string(),
    );

    invoke_and_wait!(
        reducers,
        claim_browser_task_then,
        "claim_browser_task",
        browser_task_id.clone(),
        "browser-seed-1".to_string(),
    );

    invoke_and_wait!(
        reducers,
        upsert_memory_document_then,
        "upsert_memory_document_workflow",
            workflow_document_id.clone(),
            "operator".to_string(),
            "cadet/workflows".to_string(),
            "run-summary".to_string(),
            "Dioxus live operator rollout".to_string(),
            "The Dioxus desktop surface now loads a live Spacetime snapshot through the shared control-client crate.".to_string(),
            "{\"seededBy\":\"codex\"}".to_string(),
    );

    invoke_and_wait!(
        reducers,
        upsert_memory_document_then,
        "upsert_memory_document_retrieval",
        retrieval_document_id.clone(),
        "researcher".to_string(),
        "cadet/retrieval".to_string(),
        "learning-note".to_string(),
        "Vector memory telemetry".to_string(),
        "The memory view renders real embeddings as a 3D telemetry field so operators can inspect chunk geometry, query drift, and namespace density.".to_string(),
        "{\"seededBy\":\"codex\",\"mode\":\"vector-field\"}".to_string(),
    );

    let chunk_specs = vec![
        (
            workflow_document_id.clone(),
            "operator".to_string(),
            "cadet/workflows".to_string(),
            "Verify summaries must carry browser artifact references before summarize can complete."
                .to_string(),
            "{\"kind\":\"summary\",\"lane\":\"verify\"}".to_string(),
        ),
        (
            workflow_document_id.clone(),
            "operator".to_string(),
            "cadet/workflows".to_string(),
            "Approval-heavy runs stay blocked until the operator resolves the pending verify request."
                .to_string(),
            "{\"kind\":\"policy\",\"lane\":\"verify\"}".to_string(),
        ),
        (
            retrieval_document_id.clone(),
            "researcher".to_string(),
            "cadet/retrieval".to_string(),
            "Each retrieval trace stores the query embedding and exact chunk lineage for replayable memory lookups."
                .to_string(),
            "{\"kind\":\"trace\",\"lane\":\"learn\"}".to_string(),
        ),
        (
            retrieval_document_id,
            "researcher".to_string(),
            "cadet/retrieval".to_string(),
            "Deterministic embeddings let the native client render stable vector geometry across test runs."
                .to_string(),
            "{\"kind\":\"embedding\",\"lane\":\"learn\"}".to_string(),
        ),
    ];
    let mut chunk_ids = Vec::new();

    for (index, (document_id, agent_id, namespace, content, metadata_json)) in
        chunk_specs.into_iter().enumerate()
    {
        let chunk_id = format!("chunk-{suffix}-{}", index + 1);
        let embedding_id = format!("embedding-{suffix}-{}", index + 1);
        let vector = deterministic_embedding(&content, 18);
        let vector_json =
            serde_json::to_string(&vector).map_err(|error| format!("Failed to encode vector: {error}"))?;

        invoke_and_wait!(
            reducers,
            upsert_memory_chunk_then,
            "upsert_memory_chunk",
            chunk_id.clone(),
            document_id,
            agent_id.clone(),
            namespace.clone(),
            index as u32,
            content,
            metadata_json,
        );

        invoke_and_wait!(
            reducers,
            upsert_memory_embedding_then,
            "upsert_memory_embedding",
            embedding_id,
            chunk_id.clone(),
            agent_id,
            namespace,
            "deterministic-v1".to_string(),
            18,
            vector_json,
            format!("seed-{suffix}-{}", index + 1),
        );

        chunk_ids.push(chunk_id);
    }

    invoke_and_wait!(
        reducers,
        record_retrieval_trace_then,
        "record_retrieval_trace",
        trace_id,
        run_id.clone(),
        verify_step_id.clone(),
        "dioxus live operator rollout".to_string(),
        serde_json::to_string(&query_embedding)
            .map_err(|error| format!("Failed to encode query embedding: {error}"))?,
        serde_json::to_string(&chunk_ids[..3])
            .map_err(|error| format!("Failed to encode chunk ids: {error}"))?,
        "{\"seededBy\":\"codex\",\"mode\":\"vector-field\"}".to_string(),
    );

    println!(
        "{{\"threadId\":\"{}\",\"runId\":\"{}\",\"verifyStepId\":\"{}\",\"browserTaskId\":\"{}\"}}",
        thread_id, run_id, verify_step_id, browser_task_id
    );

    Ok(())
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

fn websocket_url(value: &str) -> String {
    if let Some(rest) = value.strip_prefix("http://") {
        format!("ws://{rest}")
    } else if let Some(rest) = value.strip_prefix("https://") {
        format!("wss://{rest}")
    } else {
        value.to_string()
    }
}

fn timestamp_suffix() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn normalize_reducer_result<E: ToString>(result: Result<Result<(), String>, E>) -> Result<(), String> {
    match result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => Err(error),
        Err(error) => Err(error.to_string()),
    }
}
