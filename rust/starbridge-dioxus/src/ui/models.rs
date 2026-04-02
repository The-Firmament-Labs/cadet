use std::collections::BTreeSet;

use serde::Deserialize;
use starbridge_core::{MissionControlSnapshot, WorkflowStepRecord};

// ── Agent Modes (top-level tabs, like Claude Desktop's Chat/Cowork/Code) ──

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum AgentMode {
    Cadet,   // Chat — direct AI conversation
    Voyager, // Code — task management, code execution
    Saturn,  // Ops — runs, approvals, monitoring
}

impl AgentMode {
    pub fn label(self) -> &'static str {
        match self {
            Self::Cadet => "Cadet",
            Self::Voyager => "Voyager",
            Self::Saturn => "Saturn",
        }
    }

    pub fn subtitle(self) -> &'static str {
        match self {
            Self::Cadet => "Chat",
            Self::Voyager => "Code",
            Self::Saturn => "Ops",
        }
    }

    pub fn all() -> [AgentMode; 3] {
        [Self::Cadet, Self::Voyager, Self::Saturn]
    }
}

// ── Content Views (what's shown in the main area) ──

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum ContentView {
    // Cadet mode
    Chat,

    // Voyager mode
    TaskHome,
    TaskDetail { task_id: String },
    TaskExecution { task_id: String },

    // Saturn mode
    OpsHome,
    RunDetail { run_id: String },
    Approvals,
    Memory,
    Agents,
}

impl ContentView {
    pub fn default_for(mode: AgentMode) -> Self {
        match mode {
            AgentMode::Cadet => Self::Chat,
            AgentMode::Voyager => Self::TaskHome,
            AgentMode::Saturn => Self::OpsHome,
        }
    }
}


// ── Composer types ──

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ComposerMode {
    Chat,         // Agent selector, @-references
    TaskDispatch, // Agent selector, project, model
    Reply,        // Minimal: textarea + send
}

#[derive(Clone, Debug)]
pub struct ComposerSubmission {
    pub text: String,
    pub agent_id: Option<String>,
    pub model: Option<String>,
    pub project: Option<String>,
}

// ── Agent definitions ──

pub const AGENTS: &[(&str, &str)] = &[
    ("voyager", "Voyager"),
    ("saturn", "Saturn"),
    ("apollo", "Apollo"),
    ("mercury", "Mercury"),
    ("atlas", "Atlas"),
    ("titan", "Titan"),
];

pub const MODELS: &[(&str, &str)] = &[
    ("claude-sonnet-4", "Sonnet 4"),
    ("claude-opus-4", "Opus 4"),
    ("claude-haiku-4", "Haiku 4"),
];

// ── Task data (for Voyager mode) ──

#[derive(Clone, PartialEq, Debug)]
pub struct TaskItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub instructions: String,
    pub status: TaskStatus,
    pub agent: String,
    pub created_at_ms: u64,
    pub scheduled_at_ms: Option<u64>,
    pub repeat_schedule: Option<String>,
    pub project: Option<String>,
    pub tool_log: Vec<ToolLogEntry>,
    pub progress: Vec<ProgressItem>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TaskStatus {
    Scheduled,
    Active,
    Complete,
    Failed,
}

impl TaskStatus {
    pub fn label(self) -> &'static str {
        match self {
            Self::Scheduled => "Scheduled",
            Self::Active => "Active",
            Self::Complete => "Complete",
            Self::Failed => "Failed",
        }
    }

}

#[derive(Clone, PartialEq, Debug)]
pub struct ToolLogEntry {
    pub tool_name: String,
    pub summary: String,
    pub status: ToolLogStatus,
    pub timestamp_ms: u64,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ToolLogStatus {
    Running,
    Complete,
    Error,
}

#[derive(Clone, PartialEq, Debug)]
pub struct ProgressItem {
    pub label: String,
    pub done: bool,
}


#[derive(Clone, Copy, PartialEq, Eq)]
pub enum OverviewTab {
    Timeline,
    Browser,
    Approvals,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SurfaceFocus {
    Split,
    Preview,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum UiNodeSpec {
    Section {
        title: String,
        description: Option<String>,
        children: Vec<UiNodeSpec>,
    },
    Metric {
        label: String,
        value: String,
        tone: Option<String>,
    },
    BadgeStrip {
        label: Option<String>,
        items: Vec<String>,
    },
    List {
        title: String,
        items: Vec<String>,
    },
    Callout {
        tone: Option<String>,
        title: String,
        body: String,
    },
    CodeBlock {
        label: String,
        value: String,
    },
}

#[derive(Clone, PartialEq, Eq)]
pub struct QueueMetrics {
    pub active_runs: usize,
    pub pending_approvals: usize,
    pub browser_tasks: usize,
    pub blocked_items: usize,
}

pub fn queue_metrics(snapshot: &MissionControlSnapshot) -> QueueMetrics {
    QueueMetrics {
        active_runs: snapshot
            .workflow_runs
            .iter()
            .filter(|run| matches!(run.status.as_str(), "queued" | "running" | "blocked" | "awaiting-approval"))
            .count(),
        pending_approvals: snapshot
            .approval_requests
            .iter()
            .filter(|approval| approval.status == "pending")
            .count(),
        browser_tasks: snapshot.browser_tasks.len(),
        blocked_items: snapshot
            .workflow_steps
            .iter()
            .filter(|step| matches!(step.status.as_str(), "blocked" | "awaiting-approval" | "failed"))
            .count()
            + snapshot
                .browser_tasks
                .iter()
                .filter(|task| matches!(task.status.as_str(), "blocked" | "failed"))
                .count(),
    }
}

pub fn memory_namespaces(snapshot: &MissionControlSnapshot) -> Vec<String> {
    snapshot
        .memory_documents
        .iter()
        .map(|document| document.namespace.clone())
        .chain(
            snapshot
                .memory_chunks
                .iter()
                .map(|chunk| chunk.namespace.clone()),
        )
        .chain(
            snapshot
                .memory_embeddings
                .iter()
                .map(|embedding| embedding.namespace.clone()),
        )
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

pub fn canonical_stages() -> [&'static str; 7] {
    ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
}

pub fn lane_copy(stage: &str) -> &'static str {
    match stage {
        "route" => "Intent routing",
        "plan" => "Plan assembly",
        "gather" => "Context gathering",
        "act" => "Tool execution",
        "verify" => "Verification",
        "summarize" => "Operator summary",
        "learn" => "Memory compaction",
        _ => "Workflow lane",
    }
}

pub fn move_step_to_stage(
    steps: &[WorkflowStepRecord],
    step_id: &str,
    stage: &str,
) -> Vec<WorkflowStepRecord> {
    let mut next = steps.to_vec();
    if let Some(step) = next.iter_mut().find(|step| step.step_id == step_id) {
        step.stage = stage.to_string();
        step.status = "draft".to_string();
    }
    next
}

pub fn default_agent_ui_spec(snapshot: &MissionControlSnapshot) -> String {
    serde_json::to_string_pretty(&serde_json::json!([
        {
            "type": "section",
            "title": "Operator posture",
            "description": "This surface is generated from the live mission-control snapshot and stays constrained to a typed JSON contract.",
            "children": [
                {
                    "type": "metric",
                    "label": "Active runs",
                    "value": snapshot.workflow_runs.iter().filter(|run| matches!(run.status.as_str(), "queued" | "running")).count().to_string(),
                    "tone": "accent"
                },
                {
                    "type": "metric",
                    "label": "Pending approvals",
                    "value": snapshot.approval_requests.iter().filter(|approval| approval.status == "pending").count().to_string(),
                    "tone": "warn"
                }
            ]
        },
        {
            "type": "badge-strip",
            "label": "Memory namespaces",
            "items": memory_namespaces(snapshot)
        },
        {
            "type": "callout",
            "tone": "tip",
            "title": "Manifest-driven UI",
            "body": "Use constrained JSON nodes to define per-agent operator widgets without hand-authoring every native view."
        },
        {
            "type": "list",
            "title": "Active threads",
            "items": snapshot.threads.iter().map(|thread| format!("{} ({})", thread.title, thread.channel)).collect::<Vec<_>>()
        },
        {
            "type": "code-block",
            "label": "Workflow stage order",
            "value": canonical_stages().join(" -> ")
        }
    ]))
    .unwrap_or_else(|_| "[]".to_string())
}

pub fn parse_ui_spec(source: &str) -> Result<Vec<UiNodeSpec>, String> {
    serde_json::from_str(source).map_err(|error| format!("JSON UI spec is invalid: {error}"))
}
