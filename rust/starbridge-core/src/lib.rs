use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fmt, str::FromStr};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum WorkflowStage {
    Route,
    Plan,
    Gather,
    Act,
    Verify,
    Summarize,
    Learn,
}

impl WorkflowStage {
    pub const ALL: [WorkflowStage; 7] = [
        WorkflowStage::Route,
        WorkflowStage::Plan,
        WorkflowStage::Gather,
        WorkflowStage::Act,
        WorkflowStage::Verify,
        WorkflowStage::Summarize,
        WorkflowStage::Learn,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            WorkflowStage::Route => "route",
            WorkflowStage::Plan => "plan",
            WorkflowStage::Gather => "gather",
            WorkflowStage::Act => "act",
            WorkflowStage::Verify => "verify",
            WorkflowStage::Summarize => "summarize",
            WorkflowStage::Learn => "learn",
        }
    }

    pub fn next(self) -> Option<Self> {
        match self {
            WorkflowStage::Route => Some(WorkflowStage::Plan),
            WorkflowStage::Plan => Some(WorkflowStage::Gather),
            WorkflowStage::Gather => Some(WorkflowStage::Act),
            WorkflowStage::Act => Some(WorkflowStage::Verify),
            WorkflowStage::Verify => Some(WorkflowStage::Summarize),
            WorkflowStage::Summarize => Some(WorkflowStage::Learn),
            WorkflowStage::Learn => None,
        }
    }
}

impl fmt::Display for WorkflowStage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for WorkflowStage {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "route" => Ok(WorkflowStage::Route),
            "plan" => Ok(WorkflowStage::Plan),
            "gather" => Ok(WorkflowStage::Gather),
            "act" => Ok(WorkflowStage::Act),
            "verify" => Ok(WorkflowStage::Verify),
            "summarize" => Ok(WorkflowStage::Summarize),
            "learn" => Ok(WorkflowStage::Learn),
            _ => Err(format!("unsupported workflow stage '{value}'")),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutionTarget {
    LocalRunner,
    VercelEdge,
    ContainerRunner,
    MaincloudRunner,
}

impl ExecutionTarget {
    pub fn as_str(self) -> &'static str {
        match self {
            ExecutionTarget::LocalRunner => "local-runner",
            ExecutionTarget::VercelEdge => "vercel-edge",
            ExecutionTarget::ContainerRunner => "container-runner",
            ExecutionTarget::MaincloudRunner => "maincloud-runner",
        }
    }
}

impl fmt::Display for ExecutionTarget {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ExecutionTarget {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "local-runner" => Ok(ExecutionTarget::LocalRunner),
            "vercel-edge" => Ok(ExecutionTarget::VercelEdge),
            "container-runner" => Ok(ExecutionTarget::ContainerRunner),
            "maincloud-runner" => Ok(ExecutionTarget::MaincloudRunner),
            _ => Err(format!("unsupported execution target '{value}'")),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutionOwner {
    LocalRunner,
    VercelEdge,
    ContainerRunner,
    MaincloudRunner,
    BrowserWorker,
    LearningWorker,
    ExternalAgent,
}

impl ExecutionOwner {
    pub fn as_str(self) -> &'static str {
        match self {
            ExecutionOwner::LocalRunner => "local-runner",
            ExecutionOwner::VercelEdge => "vercel-edge",
            ExecutionOwner::ContainerRunner => "container-runner",
            ExecutionOwner::MaincloudRunner => "maincloud-runner",
            ExecutionOwner::BrowserWorker => "browser-worker",
            ExecutionOwner::LearningWorker => "learning-worker",
            ExecutionOwner::ExternalAgent => "external-agent",
        }
    }

    pub fn from_target(target: ExecutionTarget) -> Self {
        match target {
            ExecutionTarget::LocalRunner => ExecutionOwner::LocalRunner,
            ExecutionTarget::VercelEdge => ExecutionOwner::VercelEdge,
            ExecutionTarget::ContainerRunner => ExecutionOwner::ContainerRunner,
            ExecutionTarget::MaincloudRunner => ExecutionOwner::MaincloudRunner,
        }
    }
}

impl fmt::Display for ExecutionOwner {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ExecutionOwner {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "local-runner" => Ok(ExecutionOwner::LocalRunner),
            "vercel-edge" => Ok(ExecutionOwner::VercelEdge),
            "container-runner" => Ok(ExecutionOwner::ContainerRunner),
            "maincloud-runner" => Ok(ExecutionOwner::MaincloudRunner),
            "browser-worker" => Ok(ExecutionOwner::BrowserWorker),
            "learning-worker" => Ok(ExecutionOwner::LearningWorker),
            "external-agent" => Ok(ExecutionOwner::ExternalAgent),
            _ => Err(format!("unsupported execution owner '{value}'")),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum RunState {
    Queued,
    Running,
    Blocked,
    WaitingApproval,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum StepState {
    Ready,
    Claimed,
    Running,
    Blocked,
    WaitingApproval,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ToolRisk {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserToolPolicy {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub allowed_domains: Vec<String>,
    #[serde(default)]
    pub blocked_domains: Vec<String>,
    #[serde(default = "default_max_browser_sessions")]
    pub max_concurrent_sessions: usize,
    #[serde(default)]
    pub allow_downloads: bool,
    #[serde(default = "default_browser_mode")]
    pub default_mode: String,
    #[serde(default = "default_browser_approval_modes")]
    pub requires_approval_for: Vec<String>,
}

impl Default for BrowserToolPolicy {
    fn default() -> Self {
        Self {
            enabled: false,
            allowed_domains: Vec::new(),
            blocked_domains: Vec::new(),
            max_concurrent_sessions: default_max_browser_sessions(),
            allow_downloads: false,
            default_mode: default_browser_mode(),
            requires_approval_for: default_browser_approval_modes(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolPolicy {
    pub allow_exec: bool,
    pub allow_browser: bool,
    pub allow_network: bool,
    pub allow_mcp: bool,
    #[serde(default)]
    pub browser: BrowserToolPolicy,
}

impl ToolPolicy {
    pub fn browser_policy(&self) -> BrowserToolPolicy {
        let mut policy = self.browser.clone();
        if self.allow_browser {
            policy.enabled = true;
        }
        policy
    }
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
    pub execution: ExecutionTarget,
    pub workflow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowTemplate {
    pub id: String,
    pub description: String,
    pub stages: Vec<WorkflowStage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolProfile {
    pub id: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HandoffRule {
    pub id: String,
    #[serde(default)]
    pub when_goal_includes: Vec<String>,
    pub to: ExecutionOwner,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LearningPolicy {
    #[serde(default = "default_learning_enabled")]
    pub enabled: bool,
    #[serde(default = "default_summarize_every_runs")]
    pub summarize_every_runs: usize,
    #[serde(default = "default_learning_enabled")]
    pub embed_memory: bool,
    #[serde(default = "default_max_retrieved_chunks")]
    pub max_retrieved_chunks: usize,
}

impl Default for LearningPolicy {
    fn default() -> Self {
        Self {
            enabled: default_learning_enabled(),
            summarize_every_runs: default_summarize_every_runs(),
            embed_memory: default_learning_enabled(),
            max_retrieved_chunks: default_max_retrieved_chunks(),
        }
    }
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
    #[serde(default)]
    pub schedules: Vec<Value>,
    #[serde(default)]
    pub workflow_templates: Vec<WorkflowTemplate>,
    #[serde(default)]
    pub tool_profiles: Vec<ToolProfile>,
    #[serde(default)]
    pub handoff_rules: Vec<HandoffRule>,
    #[serde(default)]
    pub learning_policy: LearningPolicy,
}

impl AgentManifest {
    pub fn primary_workflow_template(&self) -> WorkflowTemplate {
        self.workflow_templates.first().cloned().unwrap_or(WorkflowTemplate {
            id: "default".to_string(),
            description: "Cadet default workflow".to_string(),
            stages: WorkflowStage::ALL.to_vec(),
        })
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StageExecutionOutcome {
    pub stage: String,
    pub summary: String,
    pub actions: Vec<String>,
    pub memory_note: Option<String>,
    pub output: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RuntimeEvent {
    JobQueued { job_id: String, agent_id: String },
    JobStarted { job_id: String, runner_id: String },
    WorkflowStepClaimed { step_id: String, runner_id: String },
    WorkflowStepCompleted { step_id: String, stage: String },
    BrowserTaskQueued { task_id: String, step_id: String },
    BrowserTaskCompleted { task_id: String, step_id: String },
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

fn default_browser_mode() -> String {
    "read".to_string()
}

fn default_browser_approval_modes() -> Vec<String> {
    vec!["form".to_string(), "download".to_string()]
}

fn default_max_browser_sessions() -> usize {
    2
}

fn default_learning_enabled() -> bool {
    true
}

fn default_summarize_every_runs() -> usize {
    5
}

fn default_max_retrieved_chunks() -> usize {
    8
}

pub fn compose_prompt(manifest: &AgentManifest, job: &JobEnvelope) -> String {
    let browser = manifest.tools.browser_policy();
    let policy = format!(
        "exec={}, browser={}, browserMode={}, network={}, mcp={}",
        manifest.tools.allow_exec,
        browser.enabled,
        browser.default_mode,
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
        format!("Workflow template: {}", manifest.primary_workflow_template().id),
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

pub fn execute_workflow_stage(
    manifest: &AgentManifest,
    stage: WorkflowStage,
    input: &Value,
) -> StageExecutionOutcome {
    let goal = input
        .get("goal")
        .and_then(Value::as_str)
        .unwrap_or("unknown objective");
    let browser_required = input
        .get("browserRequired")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let actions = match stage {
        WorkflowStage::Route => vec![
            "Confirm the correct workflow template and ownership.".to_string(),
            "Capture browser and approval requirements before long-lived work starts.".to_string(),
        ],
        WorkflowStage::Plan => vec![
            "Convert the request into a typed execution plan.".to_string(),
            "Choose local, browser, or learning execution boundaries.".to_string(),
        ],
        WorkflowStage::Gather => {
            if browser_required {
                vec![
                    "Collect the browser evidence required for the run.".to_string(),
                    "Persist the browser result as a task artifact.".to_string(),
                ]
            } else {
                vec![
                    "Gather the highest-signal local context and memory.".to_string(),
                    "Persist retrieval traces for the prompt pack.".to_string(),
                ]
            }
        }
        WorkflowStage::Act => vec![
            "Execute the bounded task plan.".to_string(),
            "Persist tool calls, side effects, and approvals.".to_string(),
        ],
        WorkflowStage::Verify => vec![
            "Verify the result against the requested outcome.".to_string(),
            "Attach artifacts or browser traces for operator review.".to_string(),
        ],
        WorkflowStage::Summarize => vec![
            "Write the operator-facing summary.".to_string(),
            "Publish the outbound message and delivery attempt.".to_string(),
        ],
        WorkflowStage::Learn => vec![
            "Compact the run into reusable memory.".to_string(),
            "Persist embeddings-backed retrieval material.".to_string(),
        ],
    };

    let summary = format!(
        "{} completed the '{}' stage for '{}'.",
        manifest.name, stage, goal
    );
    let memory_note = match stage {
        WorkflowStage::Summarize | WorkflowStage::Learn => Some(format!("{}: {}", manifest.id, summary)),
        _ => None,
    };

    StageExecutionOutcome {
        stage: stage.to_string(),
        summary: summary.clone(),
        actions: actions.clone(),
        memory_note,
        output: json!({
            "stage": stage.as_str(),
            "goal": goal,
            "summary": summary,
            "actions": actions,
            "browserRequired": browser_required,
        }),
    }
}

pub fn deterministic_embedding(text: &str, dimensions: usize) -> Vec<f64> {
    let dimensions = dimensions.max(4);
    let mut vector = vec![0.0_f64; dimensions];

    for (index, byte) in text.bytes().enumerate() {
        let slot = index % dimensions;
        vector[slot] += f64::from(byte) / 255.0;
    }

    let norm = vector.iter().map(|value| value * value).sum::<f64>().sqrt();
    if norm == 0.0 {
        return vector;
    }

    vector.into_iter().map(|value| value / norm).collect()
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
                execution: ExecutionTarget::LocalRunner,
                workflow: "research".to_string(),
            },
            tags: vec!["research".to_string()],
            tools: ToolPolicy {
                allow_exec: true,
                allow_browser: true,
                allow_network: true,
                allow_mcp: true,
                browser: BrowserToolPolicy {
                    enabled: true,
                    allowed_domains: vec!["github.com".to_string()],
                    blocked_domains: vec![],
                    max_concurrent_sessions: 2,
                    allow_downloads: false,
                    default_mode: "read".to_string(),
                    requires_approval_for: vec!["form".to_string(), "download".to_string()],
                },
            },
            memory: MemoryPolicy {
                namespace: "research".to_string(),
                max_notes: 200,
                summarize_after: 20,
            },
            schedules: vec![],
            workflow_templates: vec![],
            tool_profiles: vec![],
            handoff_rules: vec![],
            learning_policy: LearningPolicy {
                enabled: true,
                summarize_every_runs: 5,
                embed_memory: true,
                max_retrieved_chunks: 8,
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
        assert!(prompt.contains("browserMode=read"));
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

    #[test]
    fn deterministic_embedding_is_stable() {
        let one = deterministic_embedding("cadet", 8);
        let two = deterministic_embedding("cadet", 8);
        assert_eq!(one, two);
        assert_eq!(one.len(), 8);
    }

    #[test]
    fn workflow_stage_roundtrips() {
        let stage = WorkflowStage::from_str("verify").expect("valid stage");
        assert_eq!(stage, WorkflowStage::Verify);
        assert_eq!(stage.to_string(), "verify");
        assert_eq!(WorkflowStage::Verify.next(), Some(WorkflowStage::Summarize));
        assert_eq!(WorkflowStage::Learn.next(), None);
    }

    #[test]
    fn execution_owner_from_target_roundtrips() {
        let target = ExecutionTarget::from_str("container-runner").expect("valid target");
        let owner = ExecutionOwner::from_target(target);
        assert_eq!(owner, ExecutionOwner::ContainerRunner);
        assert_eq!(owner.to_string(), "container-runner");
    }
}
