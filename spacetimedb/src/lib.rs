use spacetimedb::{reducer, table, Identity, ReducerContext, Table, Timestamp};

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

fn validate_control_plane(value: String) -> Result<String, String> {
    let control_plane = validate_text(value, "control_plane")?;
    if control_plane == "local" || control_plane == "cloud" {
        Ok(control_plane)
    } else {
        Err("control_plane must be local or cloud".to_string())
    }
}

fn validate_priority(value: String) -> Result<String, String> {
    let priority = validate_text(value, "priority")?;
    if priority == "low" || priority == "normal" || priority == "high" {
        Ok(priority)
    } else {
        Err("priority must be low, normal, or high".to_string())
    }
}

fn now_micros(ctx: &ReducerContext) -> i64 {
    ctx.timestamp.to_micros_since_unix_epoch()
}

fn interval_to_micros(interval_minutes: u32) -> i64 {
    i64::from(interval_minutes) * 60 * 1_000_000
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
    let runtime = validate_text(runtime, "runtime")?;
    let control_plane = validate_control_plane(control_plane)?;
    let execution_target = validate_text(execution_target, "execution_target")?;
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
        status: "queued".to_string(),
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
            status: "running".to_string(),
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
    transition_job(ctx, job_id, "completed".to_string(), Some(summary))
}

#[reducer]
pub fn fail_job(ctx: &ReducerContext, job_id: String, summary: String) -> Result<(), String> {
    transition_job(ctx, job_id, "failed".to_string(), Some(summary))
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
    let status = validate_text(status, "status")?;

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
            status: "ready".to_string(),
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

    if ctx
        .db
        .job_record()
        .job_id()
        .find(job_id.clone())
        .is_some()
    {
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
        status: "queued".to_string(),
        runner_id: None,
        result_summary: None,
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
    });

    ctx.db.schedule_record().schedule_id().update(ScheduleRecord {
        next_run_at_micros: now + interval_to_micros(schedule.interval_minutes),
        last_run_at_micros: Some(now),
        last_job_id: Some(job_id),
        status: "claimed".to_string(),
        updated_at: ctx.timestamp,
        ..schedule
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
            status,
            result_summary: summary,
            updated_at: ctx.timestamp,
            ..job
        });
        Ok(())
    } else {
        Err("job not found".to_string())
    }
}
