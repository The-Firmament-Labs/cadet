use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fmt, str::FromStr};
use tokio::sync::broadcast;

pub mod context_engine;
pub mod subscriptions;

macro_rules! string_enum {
    (pub enum $name:ident { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
        pub enum $name {
            $(
                #[serde(rename = $value)]
                $variant,
            )+
        }

        impl $name {
            pub const ALL: [Self; string_enum!(@count $($variant),+)] = [$(Self::$variant),+];

            pub const fn as_str(self) -> &'static str {
                match self {
                    $(Self::$variant => $value,)+
                }
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(self.as_str())
            }
        }

        impl FromStr for $name {
            type Err = String;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                match value {
                    $($value => Ok(Self::$variant),)+
                    _ => Err(format!("unsupported {} '{}'", stringify!($name), value)),
                }
            }
        }
    };
    (@count $head:ident $(,$tail:ident)*) => {
        1usize $(+ string_enum!(@count $tail))*
    };
    (@count) => {
        0usize
    };
}

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

string_enum!(
    pub enum ControlPlaneTarget {
        Local => "local",
        Cloud => "cloud",
    }
);

string_enum!(
    pub enum AgentRuntime {
        RustCore => "rust-core",
        BunSidecar => "bun-sidecar",
        EdgeFunction => "edge-function",
    }
);

string_enum!(
    pub enum BrowserMode {
        Read => "read",
        Extract => "extract",
        Navigate => "navigate",
        Form => "form",
        Download => "download",
        Monitor => "monitor",
    }
);

string_enum!(
    pub enum JobPriority {
        Low => "low",
        Normal => "normal",
        High => "high",
    }
);

string_enum!(
    pub enum MessageDirection {
        Inbound => "inbound",
        Outbound => "outbound",
        System => "system",
    }
);

string_enum!(
    pub enum MessageChannel {
        Web => "web",
        Slack => "slack",
        Github => "github",
        System => "system",
    }
);

string_enum!(
    pub enum ApprovalStatus {
        Pending => "pending",
        Approved => "approved",
        Rejected => "rejected",
        Expired => "expired",
    }
);

string_enum!(
    pub enum DeliveryStatus {
        Queued => "queued",
        Sent => "sent",
        Failed => "failed",
        Retrying => "retrying",
    }
);

string_enum!(
    pub enum JobStatus {
        Queued => "queued",
        Running => "running",
        Completed => "completed",
        Failed => "failed",
    }
);

string_enum!(
    pub enum ScheduleStatus {
        Ready => "ready",
        Claimed => "claimed",
    }
);

string_enum!(
    pub enum RunnerPresenceStatus {
        Alive => "alive",
        Running => "running",
        Idle => "idle",
        Stale => "stale",
    }
);

string_enum!(
    pub enum BrowserArtifactKind {
        Screenshot => "screenshot",
        Text => "text",
        Pdf => "pdf",
        Html => "html",
        Trace => "trace",
    }
);

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

impl RunState {
    pub fn as_str(self) -> &'static str {
        match self {
            RunState::Queued => "queued",
            RunState::Running => "running",
            RunState::Blocked => "blocked",
            RunState::WaitingApproval => "awaiting-approval",
            RunState::Completed => "completed",
            RunState::Failed => "failed",
            RunState::Cancelled => "cancelled",
        }
    }
}

impl fmt::Display for RunState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for RunState {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "queued" => Ok(RunState::Queued),
            "running" => Ok(RunState::Running),
            "blocked" => Ok(RunState::Blocked),
            "awaiting-approval" => Ok(RunState::WaitingApproval),
            "completed" => Ok(RunState::Completed),
            "failed" => Ok(RunState::Failed),
            "cancelled" => Ok(RunState::Cancelled),
            _ => Err(format!("unsupported run state '{value}'")),
        }
    }
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

impl StepState {
    pub fn as_str(self) -> &'static str {
        match self {
            StepState::Ready => "ready",
            StepState::Claimed => "claimed",
            StepState::Running => "running",
            StepState::Blocked => "blocked",
            StepState::WaitingApproval => "awaiting-approval",
            StepState::Completed => "completed",
            StepState::Failed => "failed",
            StepState::Cancelled => "cancelled",
        }
    }
}

impl fmt::Display for StepState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for StepState {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "ready" => Ok(StepState::Ready),
            "claimed" => Ok(StepState::Claimed),
            "running" => Ok(StepState::Running),
            "blocked" => Ok(StepState::Blocked),
            "awaiting-approval" => Ok(StepState::WaitingApproval),
            "completed" => Ok(StepState::Completed),
            "failed" => Ok(StepState::Failed),
            "cancelled" => Ok(StepState::Cancelled),
            _ => Err(format!("unsupported step state '{value}'")),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum BrowserTaskState {
    Queued,
    Claimed,
    Running,
    Blocked,
    Completed,
    Failed,
}

impl BrowserTaskState {
    pub fn as_str(self) -> &'static str {
        match self {
            BrowserTaskState::Queued => "queued",
            BrowserTaskState::Claimed => "claimed",
            BrowserTaskState::Running => "running",
            BrowserTaskState::Blocked => "blocked",
            BrowserTaskState::Completed => "completed",
            BrowserTaskState::Failed => "failed",
        }
    }
}

impl fmt::Display for BrowserTaskState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for BrowserTaskState {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "queued" => Ok(BrowserTaskState::Queued),
            "claimed" => Ok(BrowserTaskState::Claimed),
            "running" => Ok(BrowserTaskState::Running),
            "blocked" => Ok(BrowserTaskState::Blocked),
            "completed" => Ok(BrowserTaskState::Completed),
            "failed" => Ok(BrowserTaskState::Failed),
            _ => Err(format!("unsupported browser task state '{value}'")),
        }
    }
}

string_enum!(
    pub enum ToolRisk {
        Low => "low",
        Medium => "medium",
        High => "high",
    }
);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ToolCallState {
    Pending,
    Running,
    Completed,
    Failed,
}

impl ToolCallState {
    pub fn as_str(self) -> &'static str {
        match self {
            ToolCallState::Pending => "pending",
            ToolCallState::Running => "running",
            ToolCallState::Completed => "completed",
            ToolCallState::Failed => "failed",
        }
    }
}

impl fmt::Display for ToolCallState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ToolCallState {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "pending" => Ok(ToolCallState::Pending),
            "running" => Ok(ToolCallState::Running),
            "completed" => Ok(ToolCallState::Completed),
            "failed" => Ok(ToolCallState::Failed),
            _ => Err(format!("unsupported tool call state '{value}'")),
        }
    }
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
    pub default_mode: BrowserMode,
    #[serde(default = "default_browser_approval_modes")]
    pub requires_approval_for: Vec<BrowserMode>,
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
    pub control_plane: ControlPlaneTarget,
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
    #[serde(default)]
    pub allow_exec: Option<bool>,
    #[serde(default)]
    pub allow_network: Option<bool>,
    #[serde(default)]
    pub allow_mcp: Option<bool>,
    #[serde(default)]
    pub browser: Option<PartialBrowserToolPolicy>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PartialBrowserToolPolicy {
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub allowed_domains: Option<Vec<String>>,
    #[serde(default)]
    pub blocked_domains: Option<Vec<String>>,
    #[serde(default)]
    pub max_concurrent_sessions: Option<usize>,
    #[serde(default)]
    pub allow_downloads: Option<bool>,
    #[serde(default)]
    pub default_mode: Option<BrowserMode>,
    #[serde(default)]
    pub requires_approval_for: Option<Vec<BrowserMode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentScheduleDefinition {
    pub id: String,
    pub goal: String,
    pub interval_minutes: usize,
    pub priority: JobPriority,
    pub enabled: bool,
    pub requested_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AgentManifest {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system: String,
    pub model: String,
    pub runtime: AgentRuntime,
    pub deployment: DeploymentPolicy,
    pub tags: Vec<String>,
    pub tools: ToolPolicy,
    pub memory: MemoryPolicy,
    #[serde(default)]
    pub schedules: Vec<AgentScheduleDefinition>,
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
    pub priority: JobPriority,
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
    pub stage: WorkflowStage,
    pub summary: String,
    pub actions: Vec<String>,
    pub memory_note: Option<String>,
    pub output: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowRunRecord {
    pub run_id: String,
    pub thread_id: String,
    pub agent_id: String,
    pub goal: String,
    pub priority: String,
    pub trigger_source: String,
    pub requested_by: String,
    pub current_stage: String,
    pub status: String,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStepRecord {
    pub step_id: String,
    pub run_id: String,
    pub agent_id: String,
    pub stage: String,
    pub owner_execution: String,
    pub status: String,
    pub retry_count: u32,
    pub depends_on_step_id: Option<String>,
    pub runner_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTaskRecord {
    pub task_id: String,
    pub run_id: String,
    pub step_id: String,
    pub agent_id: String,
    pub mode: String,
    pub risk: String,
    pub status: String,
    pub owner_execution: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryDocumentRecord {
    pub document_id: String,
    pub agent_id: String,
    pub namespace: String,
    pub source_kind: String,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryChunkRecord {
    pub chunk_id: String,
    pub document_id: String,
    pub agent_id: String,
    pub namespace: String,
    pub ordinal: u32,
    pub content: String,
    pub metadata_json: String,
    pub created_at_micros: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryEmbeddingRecord {
    pub embedding_id: String,
    pub chunk_id: String,
    pub agent_id: String,
    pub namespace: String,
    pub model: String,
    pub dimensions: u32,
    pub vector: Vec<f64>,
    pub checksum: String,
    pub created_at_micros: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RetrievalTraceRecord {
    pub trace_id: String,
    pub run_id: String,
    pub step_id: String,
    pub query_text: String,
    pub query_embedding: Vec<f64>,
    pub chunk_ids: Vec<String>,
    pub metadata_json: String,
    pub created_at_micros: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequestRecord {
    pub approval_id: String,
    pub run_id: String,
    pub step_id: String,
    pub agent_id: String,
    pub title: String,
    pub detail: String,
    pub status: String,
    pub risk: String,
    pub requested_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatThreadRecord {
    pub thread_id: String,
    pub channel: String,
    pub channel_thread_id: String,
    pub title: String,
    pub latest_message_at_micros: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MessageEventRecord {
    pub event_id: String,
    pub thread_id: String,
    pub run_id: Option<String>,
    pub channel: String,
    pub direction: String,
    pub actor: String,
    pub content: String,
    pub created_at_micros: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MissionControlSnapshot {
    pub environment: String,
    pub generated_at: String,
    #[serde(default)]
    pub workflow_runs: Vec<WorkflowRunRecord>,
    #[serde(default)]
    pub workflow_steps: Vec<WorkflowStepRecord>,
    #[serde(default)]
    pub browser_tasks: Vec<BrowserTaskRecord>,
    #[serde(default)]
    pub memory_documents: Vec<MemoryDocumentRecord>,
    #[serde(default)]
    pub memory_chunks: Vec<MemoryChunkRecord>,
    #[serde(default)]
    pub memory_embeddings: Vec<MemoryEmbeddingRecord>,
    #[serde(default)]
    pub retrieval_traces: Vec<RetrievalTraceRecord>,
    #[serde(default)]
    pub approval_requests: Vec<ApprovalRequestRecord>,
    #[serde(default)]
    pub threads: Vec<ChatThreadRecord>,
    #[serde(default)]
    pub message_events: Vec<MessageEventRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RuntimeEvent {
    JobQueued { job_id: String, agent_id: String },
    JobStarted { job_id: String, runner_id: String },
    WorkflowStepClaimed { step_id: String, runner_id: String },
    WorkflowStepCompleted { step_id: String, stage: WorkflowStage },
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

fn default_browser_mode() -> BrowserMode {
    BrowserMode::Read
}

fn default_browser_approval_modes() -> Vec<BrowserMode> {
    vec![BrowserMode::Form, BrowserMode::Download]
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
        format!(
            "Workflow template: {}",
            manifest.primary_workflow_template().id
        ),
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
        stage,
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
            runtime: AgentRuntime::RustCore,
            deployment: DeploymentPolicy {
                control_plane: ControlPlaneTarget::Local,
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
                    default_mode: BrowserMode::Read,
                    requires_approval_for: vec![BrowserMode::Form, BrowserMode::Download],
                },
            },
            memory: MemoryPolicy {
                namespace: "research".to_string(),
                max_notes: 200,
                summarize_after: 20,
            },
            schedules: vec![AgentScheduleDefinition {
                id: "daily-audit".to_string(),
                goal: "Audit new regressions".to_string(),
                interval_minutes: 15,
                priority: JobPriority::High,
                enabled: true,
                requested_by: "scheduler".to_string(),
            }],
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
            priority: JobPriority::High,
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
        assert!(outcome
            .summary
            .contains("executed 'Audit the release plan' locally"));
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

    #[test]
    fn run_and_step_states_roundtrip() {
        let run = RunState::from_str("awaiting-approval").expect("valid run state");
        assert_eq!(run, RunState::WaitingApproval);
        assert_eq!(run.to_string(), "awaiting-approval");

        let step = StepState::from_str("blocked").expect("valid step state");
        assert_eq!(step, StepState::Blocked);
        assert_eq!(step.to_string(), "blocked");
    }

    #[test]
    fn browser_task_state_roundtrips() {
        let state = BrowserTaskState::from_str("completed").expect("valid browser task state");
        assert_eq!(state, BrowserTaskState::Completed);
        assert_eq!(state.to_string(), "completed");
    }

    #[test]
    fn tool_call_state_roundtrips() {
        let state = ToolCallState::from_str("failed").expect("valid tool call state");
        assert_eq!(state, ToolCallState::Failed);
        assert_eq!(state.to_string(), "failed");
    }

    #[test]
    fn manifest_contract_roundtrips_through_canonical_types() {
        let manifest = sample_manifest();
        let parsed: AgentManifest =
            serde_json::from_value(serde_json::to_value(&manifest).expect("serialize manifest"))
                .expect("deserialize manifest");

        assert_eq!(parsed.runtime, AgentRuntime::RustCore);
        assert_eq!(parsed.deployment.control_plane, ControlPlaneTarget::Local);
        assert_eq!(parsed.tools.browser.default_mode, BrowserMode::Read);
        assert_eq!(
            parsed.tools.browser.requires_approval_for,
            vec![BrowserMode::Form, BrowserMode::Download]
        );
        assert_eq!(parsed.schedules[0].priority, JobPriority::High);
    }

    #[test]
    fn supplemental_phase_zero_vocabulary_roundtrips() {
        assert_eq!(
            ControlPlaneTarget::from_str("cloud").expect("valid control plane"),
            ControlPlaneTarget::Cloud
        );
        assert_eq!(
            AgentRuntime::from_str("edge-function").expect("valid runtime"),
            AgentRuntime::EdgeFunction
        );
        assert_eq!(
            MessageChannel::from_str("github").expect("valid channel"),
            MessageChannel::Github
        );
        assert_eq!(
            MessageDirection::from_str("system").expect("valid direction"),
            MessageDirection::System
        );
        assert_eq!(
            ApprovalStatus::from_str("approved").expect("valid approval status"),
            ApprovalStatus::Approved
        );
        assert_eq!(
            DeliveryStatus::from_str("retrying").expect("valid delivery status"),
            DeliveryStatus::Retrying
        );
        assert_eq!(
            JobStatus::from_str("running").expect("valid job status"),
            JobStatus::Running
        );
        assert_eq!(
            ScheduleStatus::from_str("claimed").expect("valid schedule status"),
            ScheduleStatus::Claimed
        );
        assert_eq!(
            RunnerPresenceStatus::from_str("alive").expect("valid presence status"),
            RunnerPresenceStatus::Alive
        );
        assert_eq!(
            BrowserArtifactKind::from_str("trace").expect("valid artifact kind"),
            BrowserArtifactKind::Trace
        );
        assert_eq!(
            ToolRisk::from_str("medium").expect("valid tool risk"),
            ToolRisk::Medium
        );
    }
}
