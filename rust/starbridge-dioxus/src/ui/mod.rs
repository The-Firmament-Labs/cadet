use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

mod models;
mod sample;
mod shared;
mod styles;
mod views;

use models::{memory_namespaces, queue_metrics, WorkspacePage};
use shared::SidebarNavButton;
use styles::APP_STYLES;
use views::{CatalogView, ChatView, MemoryView, OverviewView, SurfacesView, WorkflowStudioView};

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

#[component]
pub fn MissionControlApp(snapshot: MissionControlSnapshot) -> Element {
    let metrics = queue_metrics(&snapshot);
    let namespaces = memory_namespaces(&snapshot);
    let mut page = use_signal(|| WorkspacePage::Overview);
    let mut sidebar_expanded = use_signal(|| false);
    let mut show_command_palette = use_signal(|| false);

    // Consume menu actions from the desktop shell (if running as desktop app)
    if let Some(menu_ctx) = try_use_context::<MenuAction>() {
        if let Some(action) = (menu_ctx.0)() {
            let mut signal = menu_ctx.0;
            signal.set(None);
            match action.as_str() {
                "view-overview" => page.set(WorkspacePage::Overview),
                "view-conversations" => page.set(WorkspacePage::Conversations),
                "view-workflow" => page.set(WorkspacePage::Workflow),
                "view-catalog" => page.set(WorkspacePage::Catalog),
                "view-memory" => page.set(WorkspacePage::Memory),
                "toggle-sidebar" => sidebar_expanded.set(!sidebar_expanded()),
                "toggle-palette" => show_command_palette.set(!show_command_palette()),
                _ => {}
            }
        }
    }

    let sidebar_class = if sidebar_expanded() {
        "sidebar sidebar-expanded"
    } else {
        "sidebar"
    };

    rsx! {
        style { "{APP_STYLES}" }

        // Command palette overlay
        if show_command_palette() {
            CommandPalette {
                current_page: page(),
                on_navigate: move |target_page| {
                    page.set(target_page);
                    show_command_palette.set(false);
                },
                on_close: move |_| show_command_palette.set(false),
                show: show_command_palette,
            }
        }

        div { class: "app-shell",
            aside { class: "{sidebar_class}",
                // Brand mark
                div { class: "sidebar-brand",
                    button {
                        class: "brand-mark",
                        title: if sidebar_expanded() { "Collapse sidebar" } else { "Expand sidebar" },
                        onclick: move |_| sidebar_expanded.set(!sidebar_expanded()),
                        "C"
                    }
                    h1 { class: "sidebar-title", "Mission Control" }
                }

                div { class: "sidebar-section", "Workspace" }
                nav { class: "sidebar-nav",
                    SidebarNavButton {
                        icon: "⊞".to_string(),
                        label: "Overview".to_string(),
                        count: Some(metrics.active_runs.to_string()),
                        active: page() == WorkspacePage::Overview,
                        onclick: move |_| page.set(WorkspacePage::Overview),
                    }
                    SidebarNavButton {
                        icon: "💬".to_string(),
                        label: "Conversations".to_string(),
                        count: Some(snapshot.threads.len().to_string()),
                        active: page() == WorkspacePage::Conversations,
                        onclick: move |_| page.set(WorkspacePage::Conversations),
                    }
                    SidebarNavButton {
                        icon: "▶".to_string(),
                        label: "Workflow Studio".to_string(),
                        count: Some(snapshot.workflow_steps.len().to_string()),
                        active: page() == WorkspacePage::Workflow,
                        onclick: move |_| page.set(WorkspacePage::Workflow),
                    }
                    SidebarNavButton {
                        icon: "⊞".to_string(),
                        label: "Catalog".to_string(),
                        count: Some({
                            let agent_count = snapshot.workflow_runs
                                .iter()
                                .map(|r| r.agent_id.clone())
                                .collect::<std::collections::BTreeSet<_>>()
                                .len();
                            (agent_count + 12).to_string()
                        }),
                        active: page() == WorkspacePage::Catalog,
                        onclick: move |_| page.set(WorkspacePage::Catalog),
                    }
                    SidebarNavButton {
                        icon: "🧠".to_string(),
                        label: "Memory".to_string(),
                        count: Some(snapshot.memory_embeddings.len().to_string()),
                        active: page() == WorkspacePage::Memory,
                        onclick: move |_| page.set(WorkspacePage::Memory),
                    }
                }

                div { class: "sidebar-footer",
                    // Connection status dot
                    div { class: "connection-dot", title: "Connected" }
                    p { class: "sidebar-footnote", "{snapshot.environment}" }
                    if !namespaces.is_empty() {
                        p {
                            class: "sidebar-footnote",
                            "{namespaces.len()} namespaces"
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
                        button {
                            class: "secondary-button",
                            title: "Open command palette",
                            onclick: move |_| show_command_palette.set(true),
                            "⌘K"
                        }
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
                        WorkspacePage::Catalog => rsx! { CatalogView { snapshot: snapshot.clone() } },
                        WorkspacePage::Memory => rsx! { MemoryView { snapshot: snapshot.clone() } },
                    }
                }
            }
        }
    }
}

#[component]
fn CommandPalette(
    current_page: WorkspacePage,
    on_navigate: EventHandler<WorkspacePage>,
    on_close: EventHandler<MouseEvent>,
    mut show: Signal<bool>,
) -> Element {
    let mut query = use_signal(String::new);
    let nav_items: Vec<(WorkspacePage, &str, &str)> = vec![
        (WorkspacePage::Overview,      "⊞", "Overview"),
        (WorkspacePage::Conversations, "💬", "Conversations"),
        (WorkspacePage::Workflow,      "▶", "Workflow Studio"),
        (WorkspacePage::Catalog,       "⊞", "Catalog"),
        (WorkspacePage::Memory,        "🧠", "Memory"),
    ];

    let q = query().to_lowercase();
    let filtered: Vec<_> = nav_items
        .iter()
        .filter(|(_, _, label)| q.is_empty() || label.to_lowercase().contains(&q))
        .cloned()
        .collect();

    rsx! {
        div {
            class: "command-palette",
            onclick: move |event| on_close.call(event),
            onkeydown: move |event| {
                if event.key() == Key::Escape {
                    show.set(false);
                }
            },
            div {
                class: "command-palette-panel",
                onclick: move |event| event.stop_propagation(),
                input {
                    class: "command-palette-input",
                    r#type: "text",
                    placeholder: "Navigate to…",
                    autofocus: true,
                    value: query(),
                    oninput: move |event| query.set(event.value()),
                }
                ul { class: "command-palette-list",
                    for (target_page, icon, label) in filtered.iter().cloned() {
                        li {
                            button {
                                class: if current_page == target_page {
                                    "command-palette-item command-palette-item-active"
                                } else {
                                    "command-palette-item"
                                },
                                onclick: {
                                    let target = target_page;
                                    move |_| on_navigate.call(target)
                                },
                                span { "{icon} {label}" }
                                span { class: "command-palette-kbd", "↵" }
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
        assert!(html.contains("Catalog"));
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
