use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

mod models;
mod sample;
mod shared;
mod styles;
mod views;

use models::{memory_namespaces, queue_metrics, WorkspacePage};
use shared::{MetricTile, SidebarNavButton};
use styles::APP_STYLES;
use views::{ChatView, MemoryView, OverviewView, SurfacesView, WorkflowStudioView};

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

#[component]
pub fn MissionControlApp(snapshot: MissionControlSnapshot) -> Element {
    let metrics = queue_metrics(&snapshot);
    let namespaces = memory_namespaces(&snapshot);
    let mut page = use_signal(|| WorkspacePage::Overview);

    rsx! {
        style { "{APP_STYLES}" }
        div { class: "app-shell",
            aside { class: "sidebar",
                div { class: "sidebar-brand",
                    div { class: "brand-mark", "C" }
                    div {
                        p { class: "sidebar-eyebrow", "Cadet" }
                        h1 { class: "sidebar-title", "Mission Control" }
                        p { class: "sidebar-copy", "Native operator client for the Spacetime control plane." }
                    }
                }

                div { class: "sidebar-section", "Workspace" }
                nav { class: "sidebar-nav",
                    SidebarNavButton {
                        label: "Overview".to_string(),
                        detail: "Runs, browser work, and approvals".to_string(),
                        count: Some(metrics.active_runs.to_string()),
                        active: page() == WorkspacePage::Overview,
                        onclick: move |_| page.set(WorkspacePage::Overview),
                    }
                    SidebarNavButton {
                        label: "Conversations".to_string(),
                        detail: "Live thread operations and replies".to_string(),
                        count: Some(snapshot.threads.len().to_string()),
                        active: page() == WorkspacePage::Conversations,
                        onclick: move |_| page.set(WorkspacePage::Conversations),
                    }
                    SidebarNavButton {
                        label: "Workflow Studio".to_string(),
                        detail: "Draft stage choreography over live data".to_string(),
                        count: Some(snapshot.workflow_steps.len().to_string()),
                        active: page() == WorkspacePage::Workflow,
                        onclick: move |_| page.set(WorkspacePage::Workflow),
                    }
                    SidebarNavButton {
                        label: "Surfaces".to_string(),
                        detail: "JSON-to-native control surfaces".to_string(),
                        count: Some("UI".to_string()),
                        active: page() == WorkspacePage::Surfaces,
                        onclick: move |_| page.set(WorkspacePage::Surfaces),
                    }
                    SidebarNavButton {
                        label: "Memory".to_string(),
                        detail: "Vectors, documents, and retrieval lineage".to_string(),
                        count: Some(snapshot.memory_embeddings.len().to_string()),
                        active: page() == WorkspacePage::Memory,
                        onclick: move |_| page.set(WorkspacePage::Memory),
                    }
                }

                div { class: "sidebar-section", "Queues" }
                div { class: "sidebar-metrics",
                    MetricTile {
                        label: "Active".to_string(),
                        value: metrics.active_runs.to_string(),
                        detail: "workflow runs".to_string(),
                        tone: "accent".to_string(),
                    }
                    MetricTile {
                        label: "Approvals".to_string(),
                        value: metrics.pending_approvals.to_string(),
                        detail: "pending review".to_string(),
                        tone: "warn".to_string(),
                    }
                    MetricTile {
                        label: "Browser".to_string(),
                        value: metrics.browser_tasks.to_string(),
                        detail: "task queue".to_string(),
                        tone: "neutral".to_string(),
                    }
                }

                div { class: "sidebar-footer",
                    p { class: "sidebar-footnote", "{snapshot.environment}" }
                    p { class: "sidebar-footnote", "Snapshot {snapshot.generated_at}" }
                    if !namespaces.is_empty() {
                        div { class: "sidebar-badges",
                            for namespace in namespaces {
                                span { class: "pill pill-subtle", "{namespace}" }
                            }
                        }
                    }
                }
            }

            section { class: "page-shell",
                header { class: "topbar",
                    div { class: "topbar-copy",
                        p { class: "topbar-eyebrow", "Operator workspace" }
                        h2 { class: "topbar-title", "{page().label()}" }
                        p { class: "topbar-subtitle", "{page().description()}" }
                    }
                    div { class: "topbar-meta",
                        span { class: "pill pill-live", "Streaming" }
                        span { class: "pill", "{metrics.active_runs} active" }
                        span { class: "pill", "{metrics.pending_approvals} approvals" }
                        span { class: "pill", "{metrics.blocked_items} blocked" }
                    }
                }

                main { class: "page-content",
                    match page() {
                        WorkspacePage::Overview => rsx! { OverviewView { snapshot: snapshot.clone() } },
                        WorkspacePage::Conversations => rsx! { ChatView { snapshot: snapshot.clone() } },
                        WorkspacePage::Workflow => rsx! { WorkflowStudioView { snapshot: snapshot.clone() } },
                        WorkspacePage::Surfaces => rsx! { SurfacesView { snapshot: snapshot.clone() } },
                        WorkspacePage::Memory => rsx! { MemoryView { snapshot: snapshot.clone() } },
                    }
                }
            }
        }
    }
}

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
    fn render_preview_contains_primary_views() {
        let html = render_preview(sample_snapshot());

        assert!(html.contains("Mission Control"));
        assert!(html.contains("Overview"));
        assert!(html.contains("Conversations"));
        assert!(html.contains("Workflow Studio"));
        assert!(html.contains("Surfaces"));
        assert!(html.contains("Memory"));
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
}
