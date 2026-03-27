use std::{env, fs, process};

use starbridge_core::{
    compose_prompt, execute_local_job, AgentManifest, EventBus, JobEnvelope, RuntimeEvent,
};

fn print_usage() {
    eprintln!(
        "Usage:\n  starbridge-runner prompt --agent-file <path> --goal <text>\n  starbridge-runner run-once --agent-file <path> --goal <text> [--job-id <id>] [--priority <priority>] [--requested-by <value>] [--created-at <iso>]"
    );
}

fn read_flag(args: &[String], flag: &str) -> Option<String> {
    args.iter()
        .position(|arg| arg == flag)
        .and_then(|index| args.get(index + 1))
        .cloned()
}

fn load_manifest(path: &str) -> Result<AgentManifest, String> {
    let source = fs::read_to_string(path).map_err(|error| format!("Cannot read manifest: {error}"))?;
    serde_json::from_str(&source).map_err(|error| format!("Invalid manifest JSON: {error}"))
}

fn build_job(args: &[String], agent_id: &str, goal: String) -> JobEnvelope {
    JobEnvelope {
        job_id: read_flag(args, "--job-id").unwrap_or_else(|| "job_preview".to_string()),
        agent_id: agent_id.to_string(),
        goal,
        priority: read_flag(args, "--priority").unwrap_or_else(|| "normal".to_string()),
        requested_by: read_flag(args, "--requested-by").unwrap_or_else(|| "operator".to_string()),
        created_at: read_flag(args, "--created-at")
            .unwrap_or_else(|| "2026-03-27T00:00:00.000Z".to_string()),
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
                serde_json::to_string_pretty(&serde_json::json!({
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
