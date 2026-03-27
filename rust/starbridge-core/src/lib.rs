use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolPolicy {
    pub allow_exec: bool,
    pub allow_browser: bool,
    pub allow_network: bool,
    pub allow_mcp: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryPolicy {
    pub namespace: String,
    pub max_notes: usize,
    pub summarize_after: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentPolicy {
    pub control_plane: String,
    pub execution: String,
    pub workflow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system: String,
    pub model: String,
    pub runtime: String,
    pub deployment: DeploymentPolicy,
    pub tags: Vec<String>,
    pub tools: ToolPolicy,
    pub memory: MemoryPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JobEnvelope {
    pub job_id: String,
    pub agent_id: String,
    pub goal: String,
    pub priority: String,
    pub requested_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExecutionOutcome {
    pub summary: String,
    pub actions: Vec<String>,
    pub memory_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RuntimeEvent {
    JobQueued { job_id: String, agent_id: String },
    JobStarted { job_id: String, runner_id: String },
    MemoryRecorded { agent_id: String, namespace: String },
    JobCompleted { job_id: String, summary: String },
    JobFailed { job_id: String, summary: String },
}

#[derive(Debug, thiserror::Error)]
pub enum EventBusError {
    #[error("no event listeners are attached")]
    NoSubscribers,
}

#[derive(Debug, Clone)]
pub struct EventBus {
    sender: broadcast::Sender<RuntimeEvent>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<RuntimeEvent> {
        self.sender.subscribe()
    }

    pub fn emit(&self, event: RuntimeEvent) -> Result<(), EventBusError> {
        self.sender
            .send(event)
            .map(|_| ())
            .map_err(|_| EventBusError::NoSubscribers)
    }
}

pub fn compose_prompt(manifest: &AgentManifest, job: &JobEnvelope) -> String {
    let policy = format!(
        "exec={}, browser={}, network={}, mcp={}",
        manifest.tools.allow_exec,
        manifest.tools.allow_browser,
        manifest.tools.allow_network,
        manifest.tools.allow_mcp
    );

    [
        "# Agent".to_string(),
        format!("{} ({})", manifest.name, manifest.id),
        String::new(),
        "# Mission".to_string(),
        manifest.system.clone(),
        String::new(),
        "# Job".to_string(),
        format!("Goal: {}", job.goal),
        format!("Priority: {}", job.priority),
        format!("Requested by: {}", job.requested_by),
        format!("Control plane: {}", manifest.deployment.control_plane),
        format!("Execution: {}", manifest.deployment.execution),
        format!("Memory namespace: {}", manifest.memory.namespace),
        format!("Tool policy: {}", policy),
    ]
    .join("\n")
}

pub fn execute_local_job(manifest: &AgentManifest, job: &JobEnvelope) -> ExecutionOutcome {
    let normalized_goal = job.goal.to_lowercase();
    let actions = if normalized_goal.contains("launch") || normalized_goal.contains("plan") {
        vec![
            "Map the requested outcome to the current agent workflow.".to_string(),
            "Break the work into reviewable milestones with owners and risks.".to_string(),
            "Return the smallest safe next step and any required approvals.".to_string(),
        ]
    } else if normalized_goal.contains("audit") || normalized_goal.contains("policy") {
        vec![
            "Extract the policy scope and impacted systems.".to_string(),
            "Identify risk, ambiguity, and missing sign-off.".to_string(),
            "Recommend the least risky path to merge or rollback.".to_string(),
        ]
    } else {
        vec![
            "Clarify the operating objective.".to_string(),
            "Choose the minimal execution path.".to_string(),
            "Return a concise operator handoff.".to_string(),
        ]
    };

    let summary = format!(
        "{} executed '{}' locally and produced {} bounded actions.",
        manifest.name,
        job.goal,
        actions.len()
    );

    ExecutionOutcome {
        memory_note: format!("{}: {}", job.job_id, summary),
        summary,
        actions,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_manifest() -> AgentManifest {
        AgentManifest {
            id: "researcher".to_string(),
            name: "Researcher".to_string(),
            description: "Research agent".to_string(),
            system: "Stay factual".to_string(),
            model: "gpt-5.4".to_string(),
            runtime: "rust-core".to_string(),
            deployment: DeploymentPolicy {
                control_plane: "local".to_string(),
                execution: "local-runner".to_string(),
                workflow: "research".to_string(),
            },
            tags: vec!["research".to_string()],
            tools: ToolPolicy {
                allow_exec: true,
                allow_browser: true,
                allow_network: true,
                allow_mcp: true,
            },
            memory: MemoryPolicy {
                namespace: "research".to_string(),
                max_notes: 200,
                summarize_after: 20,
            },
        }
    }

    fn sample_job() -> JobEnvelope {
        JobEnvelope {
            job_id: "job_fixed".to_string(),
            agent_id: "researcher".to_string(),
            goal: "Audit the release plan".to_string(),
            priority: "high".to_string(),
            requested_by: "dex".to_string(),
            created_at: "2026-03-27T00:00:00.000Z".to_string(),
        }
    }

    #[test]
    fn compose_prompt_contains_mission_and_policy() {
        let prompt = compose_prompt(&sample_manifest(), &sample_job());
        assert!(prompt.contains("Audit the release plan"));
        assert!(prompt.contains("exec=true"));
        assert!(prompt.contains("Control plane: local"));
        assert!(prompt.contains("Memory namespace: research"));
    }

    #[test]
    fn execute_local_job_returns_deterministic_actions() {
        let outcome = execute_local_job(&sample_manifest(), &sample_job());
        assert_eq!(outcome.actions.len(), 3);
        assert!(outcome.summary.contains("executed 'Audit the release plan' locally"));
        assert!(outcome.memory_note.contains("job_fixed"));
    }

    #[test]
    fn event_bus_delivers_events() {
        let bus = EventBus::new(16);
        let mut receiver = bus.subscribe();
        bus.emit(RuntimeEvent::JobQueued {
            job_id: "job_fixed".to_string(),
            agent_id: "researcher".to_string(),
        })
        .expect("receiver is attached");

        let event = receiver.try_recv().expect("event should be buffered");
        assert_eq!(
            event,
            RuntimeEvent::JobQueued {
                job_id: "job_fixed".to_string(),
                agent_id: "researcher".to_string()
            }
        );
    }
}
