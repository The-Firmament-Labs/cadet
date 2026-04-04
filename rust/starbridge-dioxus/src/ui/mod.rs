use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

#[allow(dead_code)]
mod icons;
#[allow(dead_code)]
mod models;
mod sample;
#[allow(dead_code)]
mod shared;
mod sidebar;
mod styles;
mod views;

use icons::*;
use models::{
    AgentMode, ContentView, TaskItem, TaskStatus,
    ToolLogEntry, ToolLogStatus, ProgressItem,
    queue_metrics, memory_namespaces,
};
use sidebar::{ChatSidebarContent, VoyagerSidebarContent, SaturnSidebarContent};
use styles::APP_STYLES;
use views::{
    AiChatView, CatalogView, ChatView, MemoryView, OpsHomeView, OverviewView,
    RlDashboardView, TaskDetailView, TaskExecView, TaskHomeView, WorkflowStudioView,
};
use views::chat_types::{ChatMsg, new_thread_id, from_spacetimedb_messages};

use crate::LiveSnapshotOptions;

pub use sample::sample_snapshot;

#[derive(Clone, PartialEq, Eq)]
pub struct OperatorRuntimeContext {
    pub live_options: LiveSnapshotOptions,
}

pub fn render_preview(snapshot: MissionControlSnapshot) -> String {
    dioxus::ssr::render_element(rsx! {
        MissionControlApp { snapshot }
    })
}

/// Menu action signal provided by the desktop binary for cross-component navigation.
#[derive(Clone, Debug)]
pub struct MenuAction(pub Signal<Option<String>>);

// ── Helpers ─────────────────────────────────────────────────────────

fn runs_to_tasks(
    runs: &[starbridge_core::WorkflowRunRecord],
    steps: &[starbridge_core::WorkflowStepRecord],
) -> Vec<TaskItem> {
    runs.iter()
        .map(|run| {
            let status = match run.status.as_str() {
                "queued" | "running" | "blocked" | "awaiting-approval" => TaskStatus::Active,
                "completed" => TaskStatus::Complete,
                "failed" | "cancelled" => TaskStatus::Failed,
                _ => TaskStatus::Scheduled,
            };
            let tool_log: Vec<ToolLogEntry> = steps
                .iter()
                .filter(|s| s.run_id == run.run_id)
                .map(|s| ToolLogEntry {
                    tool_name: format!("{} ({})", s.stage, s.step_id),
                    summary: format!("{} · {}", s.agent_id, s.status),
                    status: match s.status.as_str() {
                        "completed" | "claimed" => ToolLogStatus::Complete,
                        "failed" => ToolLogStatus::Error,
                        _ => ToolLogStatus::Running,
                    },
                    timestamp_ms: 0,
                })
                .collect();
            let stages = ["route", "plan", "gather", "act", "verify", "summarize", "learn"];
            let current_idx = stages.iter().position(|s| *s == run.current_stage.as_str()).unwrap_or(0);
            let progress: Vec<ProgressItem> = stages
                .iter()
                .enumerate()
                .map(|(i, stage)| ProgressItem {
                    label: stage.to_string(),
                    done: i < current_idx || run.status == "completed",
                })
                .collect();
            TaskItem {
                id: run.run_id.clone(),
                title: run.goal.clone(),
                description: run.summary.clone().unwrap_or_default(),
                instructions: String::new(),
                status,
                agent: run.agent_id.clone(),
                created_at_ms: 0,
                scheduled_at_ms: None,
                repeat_schedule: None,
                project: Some(run.trigger_source.clone()),
                tool_log,
                progress,
            }
        })
        .collect()
}

#[cfg(feature = "desktop-ui")]
fn load_web_client() -> Option<crate::web_client::WebClient> {
    crate::web_client::WebClient::from_session().ok()
}

// ── Main App Component ──────────────────────────────────────────────

#[component]
pub fn MissionControlApp(snapshot: MissionControlSnapshot) -> Element {
    // LiveState from context (desktop) or prop (SSR)
    #[cfg(feature = "desktop-ui")]
    let live_snapshot = try_use_context::<crate::LiveState>().map(|ls| ls.to_snapshot());
    #[cfg(not(feature = "desktop-ui"))]
    let live_snapshot: Option<MissionControlSnapshot> = None;
    let snap = live_snapshot.unwrap_or_else(|| snapshot.clone());

    let metrics = queue_metrics(&snap);
    let namespaces = memory_namespaces(&snap);
    let mut mode = use_signal(|| AgentMode::Cadet);
    let mut view = use_signal(|| ContentView::Chat);
    let mut show_command_palette = use_signal(|| false);
    let mut dispatch_error = use_signal(|| None::<String>);

    #[cfg(feature = "desktop-ui")]
    let web_client = use_signal(load_web_client);

    // Chat state — shared between sidebar and chat view
    let chat_messages = use_signal(Vec::<ChatMsg>::new);
    let mut chat_active_thread = use_signal(|| Some(new_thread_id()));

    // Tasks derived from workflow runs
    let tasks = runs_to_tasks(&snap.workflow_runs, &snap.workflow_steps);

    // Connection status
    #[cfg(feature = "desktop-ui")]
    let connection_status = try_use_context::<crate::LiveState>()
        .map(|ls| (ls.connection_status)())
        .unwrap_or(crate::ConnectionStatus::Disconnected);

    #[cfg(feature = "desktop-ui")]
    let dot_class = match connection_status {
        crate::ConnectionStatus::Connected => "connection-dot",
        crate::ConnectionStatus::Error => "connection-dot disconnected",
        _ => "connection-dot connecting",
    };
    #[cfg(not(feature = "desktop-ui"))]
    let dot_class = "connection-dot";

    let env_label = if snap.environment.is_empty() { "Cadet Desktop" } else { &snap.environment };

    // Handle menu actions
    use_effect(move || {
        if let Some(menu_ctx) = try_use_context::<MenuAction>() {
            if let Some(action) = (menu_ctx.0)() {
                let mut signal = menu_ctx.0;
                signal.set(None);
                match action.as_str() {
                    "view-chat" | "view-conversations" => {
                        mode.set(AgentMode::Cadet);
                        view.set(ContentView::Chat);
                    }
                    "view-overview" | "view-ops" => {
                        mode.set(AgentMode::Saturn);
                        view.set(ContentView::OpsHome);
                    }
                    "view-tasks" | "view-workflow" => {
                        mode.set(AgentMode::Voyager);
                        view.set(ContentView::TaskHome);
                    }
                    "view-memory" => {
                        mode.set(AgentMode::Saturn);
                        view.set(ContentView::Memory);
                    }
                    "view-catalog" | "view-agents" => {
                        mode.set(AgentMode::Saturn);
                        view.set(ContentView::Agents);
                    }
                    "view-threads" => {
                        mode.set(AgentMode::Saturn);
                        view.set(ContentView::Threads);
                    }
                    "view-workflow-studio" => {
                        mode.set(AgentMode::Saturn);
                        view.set(ContentView::Workflow);
                    }
                    "view-rl" | "view-rl-dashboard" => {
                        mode.set(AgentMode::Saturn);
                        view.set(ContentView::RlDashboard);
                    }
                    "toggle-palette" => show_command_palette.set(!show_command_palette()),
                    "toggle-sidebar" => {}
                    _ => {}
                }
            }
        }
    });

    rsx! {
        style { "{APP_STYLES}" }

        if show_command_palette() {
            CommandPalette {
                on_navigate: move |target_view: ContentView| {
                    view.set(target_view.clone());
                    match &target_view {
                        ContentView::Chat => mode.set(AgentMode::Cadet),
                        ContentView::TaskHome | ContentView::TaskDetail { .. } | ContentView::TaskExecution { .. } => mode.set(AgentMode::Voyager),
                        _ => mode.set(AgentMode::Saturn),
                    }
                    show_command_palette.set(false);
                },
                on_close: move |_| show_command_palette.set(false),
            }
        }

        div { class: "app-shell",
            // ── Title bar ──
            div { class: "title-bar",
                div { class: "title-bar-left",
                    button {
                        class: "brand-compact",
                        onclick: move |_| show_command_palette.set(true),
                        img {
                            src: "cadet://localhost/icon.png",
                            alt: "Cadet",
                        }
                    }

                    div { class: "mode-tabs",
                        for m in AgentMode::all() {
                            button {
                                class: if mode() == m { "mode-tab mode-tab-active" } else { "mode-tab" },
                                onclick: move |_| {
                                    mode.set(m);
                                    view.set(ContentView::default_for(m));
                                },
                                span { class: "mode-tab-name", "{m.label()}" }
                                span { class: "mode-tab-sub", "{m.subtitle()}" }
                            }
                        }
                    }
                }

                div { class: "title-bar-right",
                    if metrics.pending_approvals > 0 {
                        span { class: "pill pill-warn", "{metrics.pending_approvals} approvals" }
                    }
                    if metrics.active_runs > 0 {
                        span { class: "pill pill-live", "{metrics.active_runs} active" }
                    }
                    button {
                        class: "title-btn",
                        title: "Command palette",
                        onclick: move |_| show_command_palette.set(true),
                        IconCommand { size: 14 }
                    }
                }
            }

            // ── Main body ──
            div { class: "main-body",
                // Adaptive sidebar
                aside { class: "sidebar",
                    // Mode-specific content
                    match mode() {
                        AgentMode::Cadet => rsx! {
                            ChatSidebarContent {
                                messages: {
                                    let mut merged = chat_messages();
                                    merged.extend(from_spacetimedb_messages(&snap.message_events));
                                    merged.sort_by_key(|m| m.timestamp_ms);
                                    merged.dedup_by(|a, b| a.id == b.id);
                                    merged
                                },
                                active_thread: chat_active_thread(),
                                on_select_thread: move |tid: String| {
                                    chat_active_thread.set(Some(tid));
                                },
                                on_new_chat: move |_| {
                                    chat_active_thread.set(Some(new_thread_id()));
                                },
                            }
                        },
                        AgentMode::Voyager => rsx! {
                            VoyagerSidebarContent {
                                tasks: tasks.clone(),
                                on_select_task: {
                                    let tasks_c = tasks.clone();
                                    move |task_id: String| {
                                        let is_active = tasks_c.iter().any(|t| t.id == task_id && t.status == TaskStatus::Active);
                                        if is_active {
                                            view.set(ContentView::TaskExecution { task_id });
                                        } else {
                                            view.set(ContentView::TaskDetail { task_id });
                                        }
                                    }
                                },
                                on_new_task: move |_| {
                                    view.set(ContentView::TaskHome);
                                },
                                current_view: view(),
                            }
                        },
                        AgentMode::Saturn => rsx! {
                            SaturnSidebarContent {
                                active_runs: metrics.active_runs,
                                pending_approvals: metrics.pending_approvals,
                                memory_namespaces: namespaces.len(),
                                recent_learnings: {
                                    let mut learnings: Vec<(String, String)> = snap.memory_documents
                                        .iter()
                                        .filter(|d| d.source_kind == "agent-learning")
                                        .map(|d| (d.agent_id.clone(), d.content.clone()))
                                        .collect();
                                    learnings.reverse();
                                    learnings.truncate(5);
                                    learnings
                                },
                                current_view: view(),
                                on_navigate: move |target: ContentView| {
                                    view.set(target);
                                },
                            }
                        },
                    }

                    // Footer (always visible)
                    div { style: "flex: 1;" }

                    if let Some(err) = dispatch_error() {
                        div { class: "sidebar-error",
                            p { "{err}" }
                            button {
                                class: "sidebar-error-dismiss",
                                onclick: move |_| dispatch_error.set(None),
                                IconX { size: 12 }
                            }
                        }
                    }

                    div { class: "sidebar-footer",
                        div { class: "{dot_class}" }
                        p { class: "sidebar-footnote", "{env_label}" }
                    }
                }

                // Content area
                div { class: "content-area",
                    div { class: "view-content",
                        match view() {
                            ContentView::Chat => rsx! {
                                AiChatView { snapshot: snap.clone() }
                            },
                            ContentView::TaskHome => rsx! {
                                TaskHomeView {
                                    tasks: tasks.clone(),
                                    on_select: move |task_id: String| {
                                        let is_active = tasks.iter().any(|t| t.id == task_id && t.status == TaskStatus::Active);
                                        if is_active {
                                            view.set(ContentView::TaskExecution { task_id });
                                        } else {
                                            view.set(ContentView::TaskDetail { task_id });
                                        }
                                    },
                                    on_new_task: move |description: String| {
                                        #[cfg(feature = "desktop-ui")]
                                        {
                                            let client = web_client();
                                            spawn(async move {
                                                if let Some(client) = client {
                                                    match client.dispatch_agent("voyager", &description).await {
                                                        Ok(_) => dispatch_error.set(None),
                                                        Err(e) => dispatch_error.set(Some(format!("{e}"))),
                                                    }
                                                } else {
                                                    dispatch_error.set(Some("Not logged in".to_string()));
                                                }
                                            });
                                        }
                                    },
                                }
                            },
                            ContentView::TaskDetail { ref task_id } => {
                                let task_id = task_id.clone();
                                if let Some(task) = tasks.iter().find(|t| t.id == task_id).cloned() {
                                    rsx! {
                                        TaskDetailView {
                                            task: task,
                                            on_start: move |run_id: String| {
                                                #[cfg(feature = "desktop-ui")]
                                                {
                                                    let client = web_client();
                                                    spawn(async move {
                                                        if let Some(client) = client {
                                                            let _ = client.retry_run(&run_id).await;
                                                        }
                                                    });
                                                }
                                            },
                                            on_back: move |_| view.set(ContentView::TaskHome),
                                        }
                                    }
                                } else {
                                    rsx! {
                                        div { class: "empty-state view-empty",
                                            h3 { "Task not found" }
                                            p { "The task may have been removed." }
                                        }
                                    }
                                }
                            },
                            ContentView::TaskExecution { ref task_id } => {
                                let task_id = task_id.clone();
                                if let Some(task) = tasks.iter().find(|t| t.id == task_id).cloned() {
                                    rsx! {
                                        TaskExecView {
                                            task: task,
                                            on_reply: move |_text: String| {},
                                            on_back: move |_| view.set(ContentView::TaskHome),
                                        }
                                    }
                                } else {
                                    rsx! {
                                        div { class: "empty-state view-empty",
                                            h3 { "Task not found" }
                                        }
                                    }
                                }
                            },
                            ContentView::OpsHome => rsx! {
                                OpsHomeView { snapshot: snap.clone() }
                            },
                            ContentView::RunDetail { .. } => rsx! {
                                OverviewView { snapshot: snap.clone() }
                            },
                            ContentView::Approvals => rsx! {
                                OverviewView { snapshot: snap.clone() }
                            },
                            ContentView::Memory => rsx! {
                                MemoryView { snapshot: snap.clone() }
                            },
                            ContentView::Agents => rsx! {
                                CatalogView { snapshot: snap.clone() }
                            },
                            ContentView::Threads => rsx! {
                                ChatView { snapshot: snap.clone() }
                            },
                            ContentView::Workflow => rsx! {
                                WorkflowStudioView { snapshot: snap.clone() }
                            },
                            ContentView::RlDashboard => rsx! {
                                RlDashboardView { snapshot: snap.clone() }
                            },
                        }
                    }
                }
            }
        }
    }
}

// ── Command Palette ─────────────────────────────────────────────────

#[component]
fn CommandPalette(
    on_navigate: EventHandler<ContentView>,
    on_close: EventHandler<MouseEvent>,
) -> Element {
    let mut query = use_signal(String::new);
    let nav_items: Vec<(ContentView, &str)> = vec![
        (ContentView::Chat,        "Chat with Cadet"),
        (ContentView::TaskHome,    "Tasks (Voyager)"),
        (ContentView::OpsHome,     "Operations (Saturn)"),
        (ContentView::Agents,      "Agents"),
        (ContentView::Memory,      "Memory"),
        (ContentView::Approvals,   "Approvals"),
        (ContentView::Threads,     "Chat Threads"),
        (ContentView::Workflow,    "Workflow Studio"),
        (ContentView::RlDashboard, "RL Dashboard"),
    ];

    let q = query().to_lowercase();
    let filtered: Vec<_> = nav_items
        .iter()
        .filter(|(_, label)| q.is_empty() || label.to_lowercase().contains(&q))
        .cloned()
        .collect();

    rsx! {
        div {
            class: "command-palette",
            onclick: move |event| on_close.call(event),
            div {
                class: "command-palette-panel",
                onclick: move |event| event.stop_propagation(),
                input {
                    class: "command-palette-input",
                    r#type: "text",
                    placeholder: "Navigate to...",
                    autofocus: true,
                    value: query(),
                    oninput: move |event| query.set(event.value()),
                }
                ul { class: "command-palette-list",
                    for (target_view, label) in filtered.iter().cloned() {
                        li {
                            button {
                                class: "command-palette-item",
                                onclick: {
                                    let target = target_view.clone();
                                    move |_| on_navigate.call(target.clone())
                                },
                                span { "{label}" }
                                span { class: "command-palette-kbd", "Enter" }
                            }
                        }
                    }
                    if filtered.is_empty() {
                        li {
                            div { class: "command-palette-empty", "No matches" }
                        }
                    }
                }
            }
        }
    }
}

// ── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::{models::{default_agent_ui_spec, parse_ui_spec}, render_preview, sample_snapshot};

    #[test]
    fn sample_snapshot_has_expected_operator_data() {
        let snapshot = sample_snapshot();
        assert_eq!(snapshot.workflow_runs.len(), 2);
        assert_eq!(snapshot.workflow_steps.len(), 4);
        assert_eq!(snapshot.browser_tasks.len(), 2);
        assert_eq!(snapshot.memory_documents.len(), 2);
        assert_eq!(snapshot.memory_chunks.len(), 4);
        assert_eq!(snapshot.memory_embeddings.len(), 4);
        assert_eq!(snapshot.retrieval_traces.len(), 1);
        assert_eq!(snapshot.approval_requests.len(), 1);
        assert_eq!(snapshot.threads.len(), 2);
        assert_eq!(snapshot.message_events.len(), 3);
    }

    #[test]
    fn render_preview_contains_mode_tabs() {
        let html = render_preview(sample_snapshot());
        assert!(html.contains("Cadet"));
        assert!(html.contains("Voyager"));
        assert!(html.contains("Saturn"));
    }

    #[test]
    fn render_preview_contains_chat_sidebar() {
        let html = render_preview(sample_snapshot());
        // Default mode is Cadet/Chat, so sidebar should show chat content
        assert!(html.contains("New Chat"));
    }

    #[test]
    fn default_agent_ui_spec_parses_back_into_nodes() {
        let snapshot = sample_snapshot();
        let source = default_agent_ui_spec(&snapshot);
        let nodes = parse_ui_spec(&source).expect("default UI spec should parse");
        assert_eq!(nodes.len(), 5);
    }

    #[test]
    fn parse_ui_spec_rejects_invalid_json() {
        let error = parse_ui_spec("{not-valid").expect_err("invalid JSON must fail");
        assert!(error.contains("JSON UI spec is invalid"));
    }

    #[test]
    fn runs_to_tasks_maps_correctly() {
        let snapshot = sample_snapshot();
        let tasks = super::runs_to_tasks(&snapshot.workflow_runs, &snapshot.workflow_steps);
        assert_eq!(tasks.len(), 2);
        assert!(tasks.iter().all(|t| t.status == super::models::TaskStatus::Active));
        assert!(tasks.iter().all(|t| t.progress.len() == 7));
    }
}
