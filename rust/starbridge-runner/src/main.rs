use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::Path,
    process::{self, Command},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::Duration,
};

use starbridge_control_client::cadet_control::{
    append_learning_note, browser_task_table::BrowserTaskTableAccess, claim_browser_task,
    claim_workflow_step, complete_browser_task, complete_workflow_step, enqueue_browser_task,
    enqueue_workflow_step, fail_browser_task, fail_workflow_step, ingest_message,
    memory_embedding_table::MemoryEmbeddingTableAccess, message_event_table::MessageEventTableAccess,
    record_browser_artifact, record_delivery_attempt, record_retrieval_trace, record_tool_call,
    upsert_memory_chunk, upsert_memory_document, upsert_memory_embedding, upsert_presence,
    workflow_run_table::WorkflowRunTableAccess, workflow_step_table::WorkflowStepTableAccess, BrowserTask,
    DbConnection, MessageEvent, RemoteReducers, RemoteTables, WorkflowRun, WorkflowStep,
};
use reqwest::blocking::Client;
use serde_json::{json, Value};
use spacetimedb_sdk::{DbContext, Table, TableWithPrimaryKey};
use starbridge_core::{
    compose_prompt, deterministic_embedding, execute_local_job, execute_workflow_stage, AgentManifest,
    BrowserTaskState, EventBus, ExecutionOwner, JobEnvelope, JobPriority, MessageChannel,
    RunnerPresenceStatus, RuntimeEvent, StepState, ToolCallState, WorkflowStage,
};

#[derive(Clone)]
struct WorkerState {
    owner: ExecutionOwner,
    runner_id: String,
    manifests: Arc<HashMap<String, AgentManifest>>,
    active_steps: Arc<Mutex<HashSet<String>>>,
    active_tasks: Arc<Mutex<HashSet<String>>>,
}

fn print_usage() {
    eprintln!(
        "Usage:\n  starbridge-runner prompt --agent-file <path> --goal <text>\n  starbridge-runner run-once --agent-file <path> --goal <text> [--job-id <id>] [--priority <priority>] [--requested-by <value>] [--created-at <iso>]\n  starbridge-runner worker --owner <local-runner|container-runner|browser-worker|learning-worker> [--manifest-dir <path>] [--db-url <url>] [--database <name>]\n  starbridge-runner inspect --run-id <id> [--db-url <url>] [--database <name>]\n  starbridge-runner replay --run-id <id> [--db-url <url>] [--database <name>]"
    );
}

fn read_flag(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|arg| arg == flag)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

fn read_flag_or_env(args: &[String], flag: &str, env_name: &str, default: &str) -> String {
    read_flag(args, flag)
        .or_else(|| env::var(env_name).ok())
        .unwrap_or_else(|| default.to_string())
}

fn default_manifest_directory() -> String {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../examples/agents")
        .to_string_lossy()
        .into_owned()
}

fn load_manifest(path: &str) -> Result<AgentManifest, String> {
    let source = fs::read_to_string(path).map_err(|error| format!("Cannot read manifest: {error}"))?;
    serde_json::from_str(&source).map_err(|error| format!("Invalid manifest JSON: {error}"))
}

fn load_manifest_directory(path: &str) -> Result<HashMap<String, AgentManifest>, String> {
    let mut manifests = HashMap::new();
    for entry in fs::read_dir(path).map_err(|error| format!("Cannot read manifest dir: {error}"))? {
        let entry = entry.map_err(|error| format!("Cannot read manifest entry: {error}"))?;
        let manifest_path = entry.path();
        if manifest_path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let manifest = load_manifest(&manifest_path.to_string_lossy())?;
        manifests.insert(manifest.id.clone(), manifest);
    }
    Ok(manifests)
}

fn build_job(args: &[String], agent_id: &str, goal: String) -> JobEnvelope {
    JobEnvelope {
        job_id: read_flag(args, "--job-id").unwrap_or_else(|| "job_preview".to_string()),
        agent_id: agent_id.to_string(),
        goal,
        priority: read_flag(args, "--priority")
            .and_then(|value| value.parse::<JobPriority>().ok())
            .unwrap_or(JobPriority::Normal),
        requested_by: read_flag(args, "--requested-by").unwrap_or_else(|| "operator".to_string()),
        created_at: read_flag(args, "--created-at")
            .unwrap_or_else(|| "2026-03-27T00:00:00.000Z".to_string()),
    }
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

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn parse_json(text: &str) -> Value {
    serde_json::from_str(text).unwrap_or_else(|_| json!({}))
}

fn workflow_run_value(run: &WorkflowRun) -> Value {
    json!({
        "runId": run.run_id,
        "threadId": run.thread_id,
        "agentId": run.agent_id,
        "goal": run.goal,
        "priority": run.priority,
        "triggerSource": run.trigger_source,
        "requestedBy": run.requested_by,
        "currentStage": run.current_stage,
        "status": run.status,
        "summary": run.summary,
        "context": parse_json(&run.context_json),
        "createdAtMicros": run.created_at_micros,
        "updatedAtMicros": run.updated_at_micros,
        "completedAtMicros": run.completed_at_micros,
    })
}

fn workflow_step_value(step: &WorkflowStep) -> Value {
    json!({
        "stepId": step.step_id,
        "runId": step.run_id,
        "agentId": step.agent_id,
        "stage": step.stage,
        "ownerExecution": step.owner_execution,
        "status": step.status,
        "input": parse_json(&step.input_json),
        "output": step.output_json.as_deref().map(parse_json),
        "retryCount": step.retry_count,
        "dependsOnStepId": step.depends_on_step_id,
        "approvalRequestId": step.approval_request_id,
        "runnerId": step.runner_id,
        "createdAtMicros": step.created_at_micros,
        "updatedAtMicros": step.updated_at_micros,
        "claimedAtMicros": step.claimed_at_micros,
        "completedAtMicros": step.completed_at_micros,
    })
}

fn browser_task_value(task: &BrowserTask) -> Value {
    json!({
        "taskId": task.task_id,
        "runId": task.run_id,
        "stepId": task.step_id,
        "agentId": task.agent_id,
        "mode": task.mode,
        "risk": task.risk,
        "status": task.status,
        "ownerExecution": task.owner_execution,
        "url": task.url,
        "request": parse_json(&task.request_json),
        "result": task.result_json.as_deref().map(parse_json),
        "runnerId": task.runner_id,
        "createdAtMicros": task.created_at_micros,
        "updatedAtMicros": task.updated_at_micros,
    })
}

fn message_event_value(message: &MessageEvent) -> Value {
    json!({
        "eventId": message.event_id,
        "threadId": message.thread_id,
        "runId": message.run_id,
        "channel": message.channel,
        "direction": message.direction,
        "actor": message.actor,
        "content": message.content,
        "metadata": parse_json(&message.metadata_json),
        "createdAtMicros": message.created_at_micros,
    })
}

fn next_stage(stage: WorkflowStage) -> Option<WorkflowStage> {
    stage.next()
}

fn owner_for_stage(
    manifest: &AgentManifest,
    stage: WorkflowStage,
    browser_required: bool,
) -> ExecutionOwner {
    match stage {
        WorkflowStage::Learn => ExecutionOwner::LearningWorker,
        WorkflowStage::Gather | WorkflowStage::Verify if browser_required => {
            ExecutionOwner::BrowserWorker
        }
        WorkflowStage::Route => ExecutionOwner::from_target(manifest.deployment.execution),
        _ if manifest.deployment.execution.to_string() == "vercel-edge" => {
            ExecutionOwner::ContainerRunner
        }
        _ => ExecutionOwner::from_target(manifest.deployment.execution),
    }
}

fn browser_required(input: &Value) -> bool {
    input
        .get("browserRequired")
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn enqueue_next_step(
    reducers: &RemoteReducers,
    tables: &RemoteTables,
    manifest: &AgentManifest,
    step: &WorkflowStep,
    input: &Value,
    outcome: &Value,
) {
    let Ok(current_stage) = step.stage.parse::<WorkflowStage>() else {
        return;
    };
    let Some(stage) = next_stage(current_stage) else {
        return;
    };

    let next_step_id = format!("{}_{}", step.run_id, stage);
    if tables.workflow_step().step_id().find(&next_step_id).is_some() {
        return;
    }

    let mut next_input = input.as_object().cloned().unwrap_or_default();
    next_input.insert("goal".to_string(), json!(input.get("goal").and_then(Value::as_str).unwrap_or_default()));
    next_input.insert("runId".to_string(), json!(step.run_id));
    next_input.insert("threadId".to_string(), input.get("threadId").cloned().unwrap_or(Value::Null));
    next_input.insert(
        "channel".to_string(),
        input
            .get("channel")
            .cloned()
            .unwrap_or_else(|| json!(MessageChannel::System.as_str())),
    );
    next_input.insert("browserRequired".to_string(), json!(browser_required(input)));
    next_input.insert(
        "browserMode".to_string(),
        input.get("browserMode").cloned().unwrap_or(json!("read")),
    );
    next_input.insert("previousStage".to_string(), json!(current_stage.as_str()));
    next_input.insert("previousOutput".to_string(), outcome.clone());

    let _ = reducers.enqueue_workflow_step(
        next_step_id,
        step.run_id.clone(),
        step.agent_id.clone(),
        stage.to_string(),
        owner_for_stage(manifest, stage, browser_required(input)).to_string(),
        serde_json::to_string(&next_input).unwrap_or_else(|_| "{}".to_string()),
        Some(step.step_id.clone()),
    );
}

fn record_retrieval(
    reducers: &RemoteReducers,
    tables: &RemoteTables,
    manifest: &AgentManifest,
    step: &WorkflowStep,
    input: &Value,
) {
    let query_text = input
        .get("goal")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    if query_text.is_empty() {
        return;
    }

    let query_embedding = deterministic_embedding(&query_text, 16);
    let mut scored: Vec<(String, f64)> = tables
        .memory_embedding()
        .iter()
        .filter(|embedding| {
            embedding.agent_id == manifest.id && embedding.namespace == manifest.memory.namespace
        })
        .filter_map(|embedding| {
            let vector: Vec<f64> = serde_json::from_str(&embedding.vector_json).ok()?;
            if vector.len() != query_embedding.len() {
                return None;
            }
            let dot = vector
                .iter()
                .zip(query_embedding.iter())
                .map(|(left, right)| left * right)
                .sum::<f64>();
            Some((embedding.chunk_id.clone(), dot))
        })
        .collect();

    scored.sort_by(|left, right| right.1.partial_cmp(&left.1).unwrap_or(std::cmp::Ordering::Equal));
    let selected: Vec<String> = scored
        .into_iter()
        .take(manifest.learning_policy.max_retrieved_chunks)
        .map(|(chunk_id, _)| chunk_id)
        .collect();

    if selected.is_empty() {
        return;
    }

    let _ = reducers.record_retrieval_trace(
        format!("trace_{}", step.step_id),
        step.run_id.clone(),
        step.step_id.clone(),
        query_text,
        serde_json::to_string(&query_embedding).unwrap_or_else(|_| "[]".to_string()),
        serde_json::to_string(&selected).unwrap_or_else(|_| "[]".to_string()),
        json!({
            "agentId": manifest.id,
            "namespace": manifest.memory.namespace,
        })
        .to_string(),
    );
}

fn persist_learning(
    reducers: &RemoteReducers,
    manifest: &AgentManifest,
    step: &WorkflowStep,
    outcome: &Value,
) {
    let summary = outcome
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Cadet learning summary");
    let document_id = format!("doc_{}", step.run_id);
    let chunk_id = format!("chunk_{}_0", step.run_id);
    let embedding_id = format!("embedding_{}_0", step.run_id);
    let content = json!({
        "runId": step.run_id,
        "stage": step.stage,
        "summary": summary,
        "output": outcome,
    })
    .to_string();
    let vector = deterministic_embedding(&content, 16);

    let _ = reducers.upsert_memory_document(
        document_id.clone(),
        manifest.id.clone(),
        manifest.memory.namespace.clone(),
        "workflow-run".to_string(),
        format!("Workflow {}", step.run_id),
        content.clone(),
        "{}".to_string(),
    );
    let _ = reducers.upsert_memory_chunk(
        chunk_id.clone(),
        document_id,
        manifest.id.clone(),
        manifest.memory.namespace.clone(),
        0,
        content.clone(),
        "{}".to_string(),
    );
    let _ = reducers.upsert_memory_embedding(
        embedding_id,
        chunk_id,
        manifest.id.clone(),
        manifest.memory.namespace.clone(),
        "deterministic-local".to_string(),
        vector.len() as u32,
        serde_json::to_string(&vector).unwrap_or_else(|_| "[]".to_string()),
        format!("checksum_{}", step.run_id),
    );
    let _ = reducers.append_learning_note(
        step.run_id.clone(),
        manifest.id.clone(),
        manifest.memory.namespace.clone(),
        summary.to_string(),
    );
}

fn record_summary_message(
    reducers: &RemoteReducers,
    manifest: &AgentManifest,
    step: &WorkflowStep,
    input: &Value,
    outcome: &Value,
) {
    let Some(thread_id) = input.get("threadId").and_then(Value::as_str) else {
        return;
    };
    let channel = input
        .get("channel")
        .and_then(Value::as_str)
        .unwrap_or(MessageChannel::System.as_str())
        .to_string();
    let summary = outcome
        .get("summary")
        .and_then(Value::as_str)
        .unwrap_or("Cadet completed the workflow")
        .to_string();

    let _ = reducers.ingest_message(
        thread_id.to_string(),
        channel.clone(),
        thread_id.to_string(),
        format!("{} summary", manifest.name),
        format!("evt_{}_summary", step.run_id),
        Some(step.run_id.clone()),
        "outbound".to_string(),
        manifest.id.clone(),
        summary.clone(),
        "{}".to_string(),
    );
    let _ = reducers.record_delivery_attempt(
        format!("delivery_{}_summary", step.run_id),
        thread_id.to_string(),
        Some(step.run_id.clone()),
        channel,
        "outbound".to_string(),
        "queued".to_string(),
        input
            .get("requestedBy")
            .and_then(Value::as_str)
            .unwrap_or("operator")
            .to_string(),
        json!({ "summary": summary }).to_string(),
        None,
    );
}

fn process_workflow_step(
    reducers: &RemoteReducers,
    tables: &RemoteTables,
    state: &WorkerState,
    step: &WorkflowStep,
) {
    let mut active = state.active_steps.lock().expect("active steps mutex poisoned");
    if !active.insert(step.step_id.clone()) {
        return;
    }
    drop(active);

    let result = (|| -> Result<(), String> {
        let manifest = state
            .manifests
            .get(&step.agent_id)
            .ok_or_else(|| format!("Unknown manifest '{}'", step.agent_id))?;
        let input = parse_json(&step.input_json);

        record_retrieval(reducers, tables, manifest, step, &input);

        if state.owner == ExecutionOwner::BrowserWorker {
            let completed_task = tables
                .browser_task()
                .iter()
                .find(|task| {
                    task.step_id == step.step_id
                        && task
                            .status
                            .parse::<BrowserTaskState>()
                            .map(|status| status == BrowserTaskState::Completed)
                            .unwrap_or(false)
                });

            if let Some(task) = completed_task {
                let output = task
                    .result_json
                    .as_deref()
                    .map(parse_json)
                    .unwrap_or_else(|| json!({ "summary": "Browser task completed" }));
                reducers
                    .complete_workflow_step(step.step_id.clone(), output.to_string())
                    .map_err(|error| error.to_string())?;
                enqueue_next_step(reducers, tables, manifest, step, &input, &output);
                return Ok(());
            }

            let existing_task = tables
                .browser_task()
                .iter()
                .any(|task| {
                    task.step_id == step.step_id
                        && task
                            .status
                            .parse::<BrowserTaskState>()
                            .map(|status| status != BrowserTaskState::Failed)
                            .unwrap_or(false)
                });
            if !existing_task {
                let request = json!({
                    "instructions": format!("{} {}", manifest.name, step.stage),
                    "goal": input.get("goal").cloned().unwrap_or(json!("")),
                    "browserMode": input.get("browserMode").cloned().unwrap_or(json!("read")),
                });
                reducers
                    .enqueue_browser_task(
                        format!("task_{}", step.step_id),
                        step.run_id.clone(),
                        step.step_id.clone(),
                        step.agent_id.clone(),
                        input
                            .get("browserMode")
                            .and_then(Value::as_str)
                            .unwrap_or("read")
                            .to_string(),
                        "medium".to_string(),
                        input
                            .get("targetUrl")
                            .and_then(Value::as_str)
                            .unwrap_or("https://example.com")
                            .to_string(),
                        request.to_string(),
                    )
                    .map_err(|error| error.to_string())?;
            }
            return Ok(());
        }

        let stage = step
            .stage
            .parse::<WorkflowStage>()
            .map_err(|error| format!("Invalid workflow stage '{}': {error}", step.stage))?;
        let outcome = execute_workflow_stage(manifest, stage, &input);
        reducers
            .record_tool_call(
                format!("tool_{}", step.step_id),
                step.run_id.clone(),
                step.step_id.clone(),
                step.agent_id.clone(),
                format!("workflow::{}", stage),
                ToolCallState::Completed.to_string(),
                step.input_json.clone(),
                Some(outcome.output.to_string()),
            )
            .map_err(|error| error.to_string())?;
        reducers
            .complete_workflow_step(step.step_id.clone(), outcome.output.to_string())
            .map_err(|error| error.to_string())?;

        if stage == WorkflowStage::Summarize {
            record_summary_message(reducers, manifest, step, &input, &outcome.output);
        }

        if stage == WorkflowStage::Learn {
            persist_learning(reducers, manifest, step, &outcome.output);
        } else {
            enqueue_next_step(reducers, tables, manifest, step, &input, &outcome.output);
        }

        Ok(())
    })();

    if let Err(error) = result {
        let _ = reducers.fail_workflow_step(
            step.step_id.clone(),
            json!({ "error": error }).to_string(),
        );
    }

    state
        .active_steps
        .lock()
        .expect("active steps mutex poisoned")
        .remove(&step.step_id);
}

fn run_browser_task(url: &str) -> Result<(String, String, Option<String>), String> {
    let browser_command = format!(
        "agent-browser open {} && agent-browser wait --load networkidle && agent-browser get text body",
        shell_escape(url)
    );
    let browser_output = Command::new("sh")
        .arg("-lc")
        .arg(browser_command)
        .output();

    if let Ok(output) = browser_output {
        if output.status.success() {
            let content = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let screenshot_output = Command::new("sh")
                .arg("-lc")
                .arg("agent-browser screenshot --full")
                .output()
                .ok()
                .filter(|candidate| candidate.status.success())
                .map(|candidate| String::from_utf8_lossy(&candidate.stdout).trim().to_string())
                .filter(|candidate| !candidate.is_empty());

            return Ok((
                format!("Browser worker captured {}", url),
                content,
                screenshot_output,
            ));
        }
    }

    let client = Client::builder()
        .build()
        .map_err(|error| format!("HTTP browser fallback setup failed: {error}"))?;
    let content = client
        .get(url)
        .send()
        .and_then(|response| response.text())
        .map_err(|error| format!("HTTP browser fallback failed: {error}"))?;
    Ok((
        format!("Browser worker fetched {}", url),
        content,
        None,
    ))
}

fn process_browser_task(
    reducers: &RemoteReducers,
    state: &WorkerState,
    task: &BrowserTask,
) {
    let mut active = state.active_tasks.lock().expect("active tasks mutex poisoned");
    if !active.insert(task.task_id.clone()) {
        return;
    }
    drop(active);

    let result = (|| -> Result<(), String> {
        let (summary, content, screenshot) = run_browser_task(&task.url)?;
        let result_json = json!({
            "summary": summary,
            "content": content,
            "mode": task.mode,
            "url": task.url,
        });

        reducers
            .record_tool_call(
                format!("tool_{}", task.task_id),
                task.run_id.clone(),
                task.step_id.clone(),
                task.agent_id.clone(),
                "browser".to_string(),
                ToolCallState::Completed.to_string(),
                task.request_json.clone(),
                Some(result_json.to_string()),
            )
            .map_err(|error| error.to_string())?;
        reducers
            .record_browser_artifact(
                format!("artifact_{}_text", task.task_id),
                task.task_id.clone(),
                task.run_id.clone(),
                task.step_id.clone(),
                "text".to_string(),
                format!("Browser text for {}", task.url),
                format!("inline://browser-text/{}", task.task_id),
                json!({ "contentPreview": content.chars().take(800).collect::<String>() }).to_string(),
            )
            .map_err(|error| error.to_string())?;

        if let Some(path) = screenshot {
            let _ = reducers.record_browser_artifact(
                format!("artifact_{}_screenshot", task.task_id),
                task.task_id.clone(),
                task.run_id.clone(),
                task.step_id.clone(),
                "screenshot".to_string(),
                format!("Browser screenshot for {}", task.url),
                path,
                "{}".to_string(),
            );
        }

        reducers
            .complete_browser_task(task.task_id.clone(), result_json.to_string())
            .map_err(|error| error.to_string())?;
        Ok(())
    })();

    if let Err(error) = result {
        let _ = reducers.fail_browser_task(task.task_id.clone(), json!({ "error": error }).to_string());
    }

    state
        .active_tasks
        .lock()
        .expect("active tasks mutex poisoned")
        .remove(&task.task_id);
}

fn maybe_handle_step(reducers: &RemoteReducers, tables: &RemoteTables, state: &WorkerState, step: &WorkflowStep) {
    if step.owner_execution != state.owner.to_string() {
        return;
    }

    let Ok(step_status) = step.status.parse::<StepState>() else {
        return;
    };

    if step_status == StepState::Ready {
        let _ = reducers.claim_workflow_step(
            step.step_id.clone(),
            state.owner.to_string(),
            state.runner_id.clone(),
        );
        return;
    }

    if step_status == StepState::Running && step.runner_id.as_deref() == Some(state.runner_id.as_str()) {
        process_workflow_step(reducers, tables, state, step);
    }
}

fn maybe_handle_browser_task(reducers: &RemoteReducers, state: &WorkerState, task: &BrowserTask) {
    if state.owner != ExecutionOwner::BrowserWorker
        || task.owner_execution != ExecutionOwner::BrowserWorker.to_string()
    {
        return;
    }

    let Ok(task_status) = task.status.parse::<BrowserTaskState>() else {
        return;
    };

    if task_status == BrowserTaskState::Queued {
        let _ = reducers.claim_browser_task(task.task_id.clone(), state.runner_id.clone());
        return;
    }

    if task_status == BrowserTaskState::Running
        && task.runner_id.as_deref() == Some(state.runner_id.as_str())
    {
        process_browser_task(reducers, state, task);
    }
}

fn inspect_run(base_url: &str, database: &str, run_id: &str) -> Result<(), String> {
    let connection = connect(database, base_url)?;
    let run = connection
        .db
        .workflow_run()
        .iter()
        .find(|candidate| candidate.run_id == run_id)
        .ok_or_else(|| format!("Unknown workflow run '{run_id}'"))?;
    let steps: Vec<_> = connection
        .db
        .workflow_step()
        .iter()
        .filter(|candidate| candidate.run_id == run_id)
        .map(|step| workflow_step_value(&step))
        .collect();
    let tasks: Vec<_> = connection
        .db
        .browser_task()
        .iter()
        .filter(|candidate| candidate.run_id == run_id)
        .map(|task| browser_task_value(&task))
        .collect();
    let messages: Vec<_> = connection
        .db
        .message_event()
        .iter()
        .filter(|candidate| candidate.run_id.as_deref() == Some(run_id))
        .map(|message| message_event_value(&message))
        .collect();

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "run": workflow_run_value(&run),
            "steps": steps,
            "browserTasks": tasks,
            "messages": messages,
        }))
        .map_err(|error| error.to_string())?
    );

    Ok(())
}

fn replay_run(base_url: &str, database: &str, run_id: &str) -> Result<(), String> {
    let connection = connect(database, base_url)?;
    let run = connection
        .db
        .workflow_run()
        .iter()
        .find(|candidate| candidate.run_id == run_id)
        .ok_or_else(|| format!("Unknown workflow run '{run_id}'"))?;
    let step = connection
        .db
        .workflow_step()
        .iter()
        .filter(|candidate| candidate.run_id == run_id)
        .filter(|candidate| {
            candidate
                .status
                .parse::<StepState>()
                .map(|status| matches!(status, StepState::Failed | StepState::Blocked))
                .unwrap_or(false)
        })
        .max_by_key(|candidate| candidate.updated_at_micros)
        .ok_or_else(|| format!("Run '{run_id}' has no failed or blocked step"))?;

    let retry_step_id = format!("{}_retry_{}", step.step_id, chrono_like_timestamp());
    connection
        .reducers
        .enqueue_workflow_step(
            retry_step_id.clone(),
            run.run_id.clone(),
            run.agent_id.clone(),
            step.stage.clone(),
            step.owner_execution.clone(),
            step.input_json.clone(),
            step.depends_on_step_id.clone(),
        )
        .map_err(|error| error.to_string())?;

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "runId": run_id,
            "retryStepId": retry_step_id,
            "stage": step.stage,
        }))
        .map_err(|error| error.to_string())?
    );

    Ok(())
}

fn chrono_like_timestamp() -> String {
    format!("{:x}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_micros())
        .unwrap_or_default())
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

fn run_worker(args: &[String]) -> Result<(), String> {
    let owner = read_flag(args, "--owner").ok_or("--owner is required".to_string())?;
    let base_url = read_flag_or_env(args, "--db-url", "SPACETIMEDB_URL", "http://127.0.0.1:3000");
    let database = read_flag_or_env(args, "--database", "SPACETIMEDB_DATABASE", "starbridge-control");
    let manifest_dir = read_flag(args, "--manifest-dir").unwrap_or_else(default_manifest_directory);
    let manifests = Arc::new(load_manifest_directory(&manifest_dir)?);
    let owner = owner.parse::<ExecutionOwner>()?;
    let runner_id = format!("{}@{}", owner, chrono_like_timestamp());

    let state = WorkerState {
        owner,
        runner_id: runner_id.clone(),
        manifests,
        active_steps: Arc::new(Mutex::new(HashSet::new())),
        active_tasks: Arc::new(Mutex::new(HashSet::new())),
    };

    let connection = connect(&database, &base_url)?;
    if let Some(manifest) = state.manifests.values().next() {
        let _ = connection.reducers.upsert_presence(
            manifest.id.clone(),
            runner_id.clone(),
            manifest.deployment.control_plane.to_string(),
            RunnerPresenceStatus::Alive.to_string(),
        );
    }

    {
        let state = state.clone();
        connection.db.workflow_step().on_insert(move |ctx, step| {
            maybe_handle_step(&ctx.reducers, &ctx.db, &state, step);
        });
    }
    {
        let state = state.clone();
        connection.db.workflow_step().on_update(move |ctx, _old, new| {
            maybe_handle_step(&ctx.reducers, &ctx.db, &state, new);
        });
    }
    {
        let state = state.clone();
        connection.db.browser_task().on_insert(move |ctx, task| {
            maybe_handle_browser_task(&ctx.reducers, &state, task);
        });
    }
    {
        let state = state.clone();
        connection.db.browser_task().on_update(move |ctx, _old, new| {
            maybe_handle_browser_task(&ctx.reducers, &state, new);
        });
    }

    for step in connection.db.workflow_step().iter() {
        maybe_handle_step(&connection.reducers, &connection.db, &state, &step);
    }
    for task in connection.db.browser_task().iter() {
        maybe_handle_browser_task(&connection.reducers, &state, &task);
    }

    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "ok": true,
            "owner": state.owner.to_string(),
            "runnerId": runner_id,
            "database": database,
            "baseUrl": base_url,
            "manifestDir": manifest_dir,
        }))
        .map_err(|error| error.to_string())?
    );

    loop {
        thread::sleep(Duration::from_secs(30));
        if let Some(manifest) = state.manifests.values().next() {
            let _ = connection.reducers.upsert_presence(
                manifest.id.clone(),
                runner_id.clone(),
                manifest.deployment.control_plane.to_string(),
                RunnerPresenceStatus::Alive.to_string(),
            );
        }
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().skip(1).collect();
    let command = args.first().cloned();

    match command.as_deref() {
        Some("prompt") | Some("run-once") => {
            let agent_file =
                read_flag(&args, "--agent-file").ok_or("--agent-file is required".to_string())?;
            let goal = read_flag(&args, "--goal").ok_or("--goal is required".to_string())?;
            let manifest = load_manifest(&agent_file)?;
            let job = build_job(&args, &manifest.id, goal);
            let prompt = compose_prompt(&manifest, &job);

            if command.as_deref() == Some("prompt") {
                println!("{prompt}");
                return Ok(());
            }

            let bus = EventBus::new(16);
            let mut receiver = bus.subscribe();
            bus.emit(RuntimeEvent::JobStarted {
                job_id: job.job_id.clone(),
                runner_id: "runner-local".to_string(),
            })
            .map_err(|error| error.to_string())?;

            let event = receiver
                .try_recv()
                .map_err(|error| format!("Failed to receive runtime event: {error}"))?;
            let result = execute_local_job(&manifest, &job);

            println!(
                "{}",
                serde_json::to_string_pretty(&json!({
                    "manifest": manifest,
                    "job": job,
                    "prompt": prompt,
                    "event": event,
                    "result": result
                }))
                .map_err(|error| error.to_string())?
            );
            Ok(())
        }
        Some("worker") => run_worker(&args),
        Some("inspect") => {
            let run_id = read_flag(&args, "--run-id").ok_or("--run-id is required".to_string())?;
            let base_url =
                read_flag_or_env(&args, "--db-url", "SPACETIMEDB_URL", "http://127.0.0.1:3000");
            let database = read_flag_or_env(&args, "--database", "SPACETIMEDB_DATABASE", "starbridge-control");
            inspect_run(&base_url, &database, &run_id)
        }
        Some("replay") => {
            let run_id = read_flag(&args, "--run-id").ok_or("--run-id is required".to_string())?;
            let base_url =
                read_flag_or_env(&args, "--db-url", "SPACETIMEDB_URL", "http://127.0.0.1:3000");
            let database = read_flag_or_env(&args, "--database", "SPACETIMEDB_DATABASE", "starbridge-control");
            replay_run(&base_url, &database, &run_id)
        }
        _ => {
            print_usage();
            Ok(())
        }
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use starbridge_core::{
        AgentManifest, AgentRuntime, BrowserToolPolicy, ControlPlaneTarget, DeploymentPolicy,
        ExecutionOwner, ExecutionTarget, LearningPolicy, MemoryPolicy, ToolPolicy, WorkflowStage,
    };
    use starbridge_control_client::cadet_control::{
        BrowserTask, MessageEvent, WorkflowRun, WorkflowStep,
    };

    // ── helpers ──────────────────────────────────────────────────────────────

    fn make_manifest(execution: ExecutionTarget) -> AgentManifest {
        AgentManifest {
            id: "test-agent".to_string(),
            name: "Test Agent".to_string(),
            description: "".to_string(),
            system: "".to_string(),
            model: "claude-3-5-sonnet".to_string(),
            runtime: AgentRuntime::RustCore,
            deployment: DeploymentPolicy {
                control_plane: ControlPlaneTarget::Local,
                execution,
                workflow: "default".to_string(),
            },
            tags: vec![],
            tools: ToolPolicy {
                allow_exec: false,
                allow_browser: false,
                allow_network: false,
                allow_mcp: false,
                browser: BrowserToolPolicy::default(),
            },
            memory: MemoryPolicy {
                namespace: "test".to_string(),
                max_notes: 10,
                summarize_after: 5,
            },
            schedules: vec![],
            workflow_templates: vec![],
            tool_profiles: vec![],
            handoff_rules: vec![],
            learning_policy: LearningPolicy::default(),
        }
    }

    fn make_workflow_run() -> WorkflowRun {
        WorkflowRun {
            run_id: "run_001".to_string(),
            thread_id: "thread_001".to_string(),
            agent_id: "agent_001".to_string(),
            goal: "Do the thing".to_string(),
            priority: "normal".to_string(),
            trigger_source: "operator".to_string(),
            requested_by: "user".to_string(),
            current_stage: "route".to_string(),
            status: "running".to_string(),
            summary: Some("All good".to_string()),
            context_json: r#"{"key":"value"}"#.to_string(),
            created_at_micros: 1_000_000,
            updated_at_micros: 2_000_000,
            completed_at_micros: Some(3_000_000),
        }
    }

    fn make_workflow_step() -> WorkflowStep {
        WorkflowStep {
            step_id: "step_001".to_string(),
            run_id: "run_001".to_string(),
            agent_id: "agent_001".to_string(),
            stage: "route".to_string(),
            owner_execution: "local-runner".to_string(),
            status: "running".to_string(),
            input_json: r#"{"goal":"Do it"}"#.to_string(),
            output_json: Some(r#"{"summary":"done"}"#.to_string()),
            retry_count: 0,
            depends_on_step_id: None,
            approval_request_id: None,
            runner_id: Some("runner-42".to_string()),
            created_at_micros: 100,
            updated_at_micros: 200,
            claimed_at_micros: Some(150),
            completed_at_micros: Some(250),
        }
    }

    fn make_browser_task() -> BrowserTask {
        BrowserTask {
            task_id: "task_001".to_string(),
            run_id: "run_001".to_string(),
            step_id: "step_001".to_string(),
            agent_id: "agent_001".to_string(),
            mode: "read".to_string(),
            risk: "medium".to_string(),
            status: "queued".to_string(),
            owner_execution: "browser-worker".to_string(),
            url: "https://example.com".to_string(),
            request_json: r#"{"instructions":"browse"}"#.to_string(),
            result_json: Some(r#"{"content":"page text"}"#.to_string()),
            runner_id: None,
            created_at_micros: 100,
            updated_at_micros: 200,
        }
    }

    fn make_message_event() -> MessageEvent {
        MessageEvent {
            event_id: "evt_001".to_string(),
            thread_id: "thread_001".to_string(),
            run_id: Some("run_001".to_string()),
            channel: "web".to_string(),
            direction: "outbound".to_string(),
            actor: "agent_001".to_string(),
            content: "Hello world".to_string(),
            metadata_json: r#"{"key":"meta"}"#.to_string(),
            created_at_micros: 999,
        }
    }

    // ── read_flag ─────────────────────────────────────────────────────────────

    #[test]
    fn read_flag_present_with_value() {
        let args = vec![
            "--foo".to_string(),
            "bar".to_string(),
            "--baz".to_string(),
            "qux".to_string(),
        ];
        assert_eq!(read_flag(&args, "--foo"), Some("bar".to_string()));
    }

    #[test]
    fn read_flag_second_flag_present() {
        let args = vec![
            "--foo".to_string(),
            "bar".to_string(),
            "--baz".to_string(),
            "qux".to_string(),
        ];
        assert_eq!(read_flag(&args, "--baz"), Some("qux".to_string()));
    }

    #[test]
    fn read_flag_absent_returns_none() {
        let args = vec!["--foo".to_string(), "bar".to_string()];
        assert_eq!(read_flag(&args, "--missing"), None);
    }

    #[test]
    fn read_flag_at_end_no_value_returns_none() {
        let args = vec!["--foo".to_string(), "bar".to_string(), "--last".to_string()];
        // "--last" is the final element; index+1 is out-of-bounds
        assert_eq!(read_flag(&args, "--last"), None);
    }

    #[test]
    fn read_flag_empty_args() {
        let args: Vec<String> = vec![];
        assert_eq!(read_flag(&args, "--foo"), None);
    }

    // ── websocket_url ─────────────────────────────────────────────────────────

    #[test]
    fn websocket_url_http_becomes_ws() {
        assert_eq!(websocket_url("http://localhost:3000"), "ws://localhost:3000");
    }

    #[test]
    fn websocket_url_https_becomes_wss() {
        assert_eq!(
            websocket_url("https://myhost.example.com"),
            "wss://myhost.example.com"
        );
    }

    #[test]
    fn websocket_url_already_ws_unchanged() {
        assert_eq!(websocket_url("ws://already"), "ws://already");
    }

    #[test]
    fn websocket_url_already_wss_unchanged() {
        assert_eq!(websocket_url("wss://already"), "wss://already");
    }

    #[test]
    fn websocket_url_arbitrary_scheme_unchanged() {
        assert_eq!(websocket_url("tcp://something"), "tcp://something");
    }

    // ── shell_escape ──────────────────────────────────────────────────────────

    #[test]
    fn shell_escape_plain_string() {
        assert_eq!(shell_escape("hello world"), "'hello world'");
    }

    #[test]
    fn shell_escape_empty_string() {
        assert_eq!(shell_escape(""), "''");
    }

    #[test]
    fn shell_escape_contains_single_quote() {
        // The pattern replaces ' with '\'' so "it's" → 'it'\''s'
        assert_eq!(shell_escape("it's"), "'it'\\''s'");
    }

    #[test]
    fn shell_escape_multiple_single_quotes() {
        // "a'b'c" → 'a'\''b'\''c'
        assert_eq!(shell_escape("a'b'c"), "'a'\\''b'\\''c'");
    }

    #[test]
    fn shell_escape_no_special_chars() {
        assert_eq!(shell_escape("no-specials"), "'no-specials'");
    }

    // ── parse_json ────────────────────────────────────────────────────────────

    #[test]
    fn parse_json_valid_object() {
        let result = parse_json(r#"{"key":"value","num":42}"#);
        assert_eq!(result["key"], json!("value"));
        assert_eq!(result["num"], json!(42));
    }

    #[test]
    fn parse_json_valid_array() {
        let result = parse_json(r#"[1,2,3]"#);
        assert_eq!(result, json!([1, 2, 3]));
    }

    #[test]
    fn parse_json_invalid_returns_empty_object() {
        let result = parse_json("not json at all");
        assert_eq!(result, json!({}));
    }

    #[test]
    fn parse_json_empty_string_returns_empty_object() {
        let result = parse_json("");
        assert_eq!(result, json!({}));
    }

    #[test]
    fn parse_json_empty_object_literal() {
        let result = parse_json("{}");
        assert_eq!(result, json!({}));
    }

    // ── workflow_run_value ────────────────────────────────────────────────────

    #[test]
    fn workflow_run_value_fields_present() {
        let run = make_workflow_run();
        let v = workflow_run_value(&run);
        assert_eq!(v["runId"], json!("run_001"));
        assert_eq!(v["threadId"], json!("thread_001"));
        assert_eq!(v["agentId"], json!("agent_001"));
        assert_eq!(v["goal"], json!("Do the thing"));
        assert_eq!(v["priority"], json!("normal"));
        assert_eq!(v["triggerSource"], json!("operator"));
        assert_eq!(v["requestedBy"], json!("user"));
        assert_eq!(v["currentStage"], json!("route"));
        assert_eq!(v["status"], json!("running"));
        assert_eq!(v["summary"], json!("All good"));
        assert_eq!(v["createdAtMicros"], json!(1_000_000_i64));
        assert_eq!(v["updatedAtMicros"], json!(2_000_000_i64));
        assert_eq!(v["completedAtMicros"], json!(3_000_000_i64));
    }

    #[test]
    fn workflow_run_value_context_parsed() {
        let run = make_workflow_run();
        let v = workflow_run_value(&run);
        // context_json is parsed into an object, not left as a string
        assert_eq!(v["context"]["key"], json!("value"));
    }

    #[test]
    fn workflow_run_value_null_summary() {
        let mut run = make_workflow_run();
        run.summary = None;
        let v = workflow_run_value(&run);
        assert_eq!(v["summary"], json!(null));
    }

    // ── workflow_step_value ───────────────────────────────────────────────────

    #[test]
    fn workflow_step_value_fields_present() {
        let step = make_workflow_step();
        let v = workflow_step_value(&step);
        assert_eq!(v["stepId"], json!("step_001"));
        assert_eq!(v["runId"], json!("run_001"));
        assert_eq!(v["agentId"], json!("agent_001"));
        assert_eq!(v["stage"], json!("route"));
        assert_eq!(v["ownerExecution"], json!("local-runner"));
        assert_eq!(v["status"], json!("running"));
        assert_eq!(v["retryCount"], json!(0_u32));
        assert_eq!(v["runnerId"], json!("runner-42"));
        assert_eq!(v["createdAtMicros"], json!(100_i64));
        assert_eq!(v["updatedAtMicros"], json!(200_i64));
        assert_eq!(v["claimedAtMicros"], json!(150_i64));
        assert_eq!(v["completedAtMicros"], json!(250_i64));
    }

    #[test]
    fn workflow_step_value_output_parsed() {
        let step = make_workflow_step();
        let v = workflow_step_value(&step);
        // output_json is Some → parsed
        assert_eq!(v["output"]["summary"], json!("done"));
    }

    #[test]
    fn workflow_step_value_null_output_when_none() {
        let mut step = make_workflow_step();
        step.output_json = None;
        let v = workflow_step_value(&step);
        assert_eq!(v["output"], json!(null));
    }

    // ── browser_task_value ────────────────────────────────────────────────────

    #[test]
    fn browser_task_value_fields_present() {
        let task = make_browser_task();
        let v = browser_task_value(&task);
        assert_eq!(v["taskId"], json!("task_001"));
        assert_eq!(v["runId"], json!("run_001"));
        assert_eq!(v["stepId"], json!("step_001"));
        assert_eq!(v["agentId"], json!("agent_001"));
        assert_eq!(v["mode"], json!("read"));
        assert_eq!(v["risk"], json!("medium"));
        assert_eq!(v["status"], json!("queued"));
        assert_eq!(v["ownerExecution"], json!("browser-worker"));
        assert_eq!(v["url"], json!("https://example.com"));
        assert_eq!(v["createdAtMicros"], json!(100_i64));
        assert_eq!(v["updatedAtMicros"], json!(200_i64));
    }

    #[test]
    fn browser_task_value_request_parsed() {
        let task = make_browser_task();
        let v = browser_task_value(&task);
        assert_eq!(v["request"]["instructions"], json!("browse"));
    }

    #[test]
    fn browser_task_value_result_parsed() {
        let task = make_browser_task();
        let v = browser_task_value(&task);
        assert_eq!(v["result"]["content"], json!("page text"));
    }

    #[test]
    fn browser_task_value_null_result_when_none() {
        let mut task = make_browser_task();
        task.result_json = None;
        let v = browser_task_value(&task);
        assert_eq!(v["result"], json!(null));
    }

    // ── message_event_value ───────────────────────────────────────────────────

    #[test]
    fn message_event_value_fields_present() {
        let msg = make_message_event();
        let v = message_event_value(&msg);
        assert_eq!(v["eventId"], json!("evt_001"));
        assert_eq!(v["threadId"], json!("thread_001"));
        assert_eq!(v["runId"], json!("run_001"));
        assert_eq!(v["channel"], json!("web"));
        assert_eq!(v["direction"], json!("outbound"));
        assert_eq!(v["actor"], json!("agent_001"));
        assert_eq!(v["content"], json!("Hello world"));
        assert_eq!(v["createdAtMicros"], json!(999_i64));
    }

    #[test]
    fn message_event_value_metadata_parsed() {
        let msg = make_message_event();
        let v = message_event_value(&msg);
        assert_eq!(v["metadata"]["key"], json!("meta"));
    }

    #[test]
    fn message_event_value_null_run_id() {
        let mut msg = make_message_event();
        msg.run_id = None;
        let v = message_event_value(&msg);
        assert_eq!(v["runId"], json!(null));
    }

    // ── next_stage ────────────────────────────────────────────────────────────

    #[test]
    fn next_stage_route_to_plan() {
        assert_eq!(next_stage(WorkflowStage::Route), Some(WorkflowStage::Plan));
    }

    #[test]
    fn next_stage_plan_to_gather() {
        assert_eq!(next_stage(WorkflowStage::Plan), Some(WorkflowStage::Gather));
    }

    #[test]
    fn next_stage_gather_to_act() {
        assert_eq!(next_stage(WorkflowStage::Gather), Some(WorkflowStage::Act));
    }

    #[test]
    fn next_stage_act_to_verify() {
        assert_eq!(next_stage(WorkflowStage::Act), Some(WorkflowStage::Verify));
    }

    #[test]
    fn next_stage_verify_to_summarize() {
        assert_eq!(
            next_stage(WorkflowStage::Verify),
            Some(WorkflowStage::Summarize)
        );
    }

    #[test]
    fn next_stage_summarize_to_learn() {
        assert_eq!(
            next_stage(WorkflowStage::Summarize),
            Some(WorkflowStage::Learn)
        );
    }

    #[test]
    fn next_stage_learn_is_none() {
        assert_eq!(next_stage(WorkflowStage::Learn), None);
    }

    // ── browser_required ─────────────────────────────────────────────────────

    #[test]
    fn browser_required_true_when_flag_is_true() {
        let context = json!({ "browserRequired": true });
        assert!(browser_required(&context));
    }

    #[test]
    fn browser_required_false_when_flag_is_false() {
        let context = json!({ "browserRequired": false });
        assert!(!browser_required(&context));
    }

    #[test]
    fn browser_required_false_when_key_missing() {
        let context = json!({ "goal": "do something" });
        assert!(!browser_required(&context));
    }

    #[test]
    fn browser_required_false_for_non_bool_value() {
        let context = json!({ "browserRequired": "yes" });
        assert!(!browser_required(&context));
    }

    #[test]
    fn browser_required_false_for_empty_object() {
        let context = json!({});
        assert!(!browser_required(&context));
    }

    // ── owner_for_stage ───────────────────────────────────────────────────────

    #[test]
    fn owner_for_stage_learn_always_learning_worker() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Learn, false),
            ExecutionOwner::LearningWorker
        );
    }

    #[test]
    fn owner_for_stage_learn_ignores_browser_required() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Learn, true),
            ExecutionOwner::LearningWorker
        );
    }

    #[test]
    fn owner_for_stage_gather_with_browser_required() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Gather, true),
            ExecutionOwner::BrowserWorker
        );
    }

    #[test]
    fn owner_for_stage_verify_with_browser_required() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Verify, true),
            ExecutionOwner::BrowserWorker
        );
    }

    #[test]
    fn owner_for_stage_gather_without_browser_uses_manifest() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Gather, false),
            ExecutionOwner::LocalRunner
        );
    }

    #[test]
    fn owner_for_stage_verify_without_browser_uses_manifest() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Verify, false),
            ExecutionOwner::LocalRunner
        );
    }

    #[test]
    fn owner_for_stage_route_uses_manifest_execution() {
        let manifest = make_manifest(ExecutionTarget::ContainerRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Route, false),
            ExecutionOwner::ContainerRunner
        );
    }

    #[test]
    fn owner_for_stage_act_vercel_edge_becomes_container_runner() {
        // vercel-edge cannot run heavy stages; the wildcard arm redirects to ContainerRunner
        let manifest = make_manifest(ExecutionTarget::VercelEdge);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Act, false),
            ExecutionOwner::ContainerRunner
        );
    }

    #[test]
    fn owner_for_stage_plan_vercel_edge_becomes_container_runner() {
        let manifest = make_manifest(ExecutionTarget::VercelEdge);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Plan, false),
            ExecutionOwner::ContainerRunner
        );
    }

    #[test]
    fn owner_for_stage_act_local_runner_stays_local() {
        let manifest = make_manifest(ExecutionTarget::LocalRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Act, false),
            ExecutionOwner::LocalRunner
        );
    }

    #[test]
    fn owner_for_stage_summarize_container_runner() {
        let manifest = make_manifest(ExecutionTarget::ContainerRunner);
        assert_eq!(
            owner_for_stage(&manifest, WorkflowStage::Summarize, false),
            ExecutionOwner::ContainerRunner
        );
    }
}
