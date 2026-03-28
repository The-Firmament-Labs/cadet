use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

// ── data model ────────────────────────────────────────────────────────────────

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum CatalogItemKind {
    Agent,
    Tool,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct CatalogItem {
    pub id: String,
    pub name: String,
    pub kind: CatalogItemKind,
    pub description: String,
    // agent-only
    pub model: Option<String>,
    pub runtime: Option<String>,
    pub deployment: Option<String>,
    pub stages: Vec<String>,
    pub tool_permissions: Vec<String>,
    pub schedule: Option<String>,
    // tool-only
    pub category: Option<String>,
    pub command: Option<String>,
    pub params: Vec<String>,
    pub requires_approval: bool,
}

/// Hard-coded tool catalogue derived from known Cadet tool categories.
fn builtin_tools() -> Vec<CatalogItem> {
    vec![
        CatalogItem {
            id: "tool-browser-open".to_string(),
            name: "browser open".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Open a URL in the headless browser worker and begin a monitor or read task.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Browser".to_string()),
            command: Some("agent-browser open <url>".to_string()),
            params: vec!["url".to_string(), "mode (monitor|read)".to_string()],
            requires_approval: true,
        },
        CatalogItem {
            id: "tool-browser-screenshot".to_string(),
            name: "browser screenshot".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Capture a screenshot of the current browser state and annotate interactive regions.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Browser".to_string()),
            command: Some("agent-browser screenshot --annotate".to_string()),
            params: vec!["--annotate (optional)".to_string(), "output_path (optional)".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-browser-eval".to_string(),
            name: "browser eval".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Evaluate a JavaScript expression in the current browser page context and return the result.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Browser".to_string()),
            command: Some("agent-browser eval '<expression>'".to_string()),
            params: vec!["expression: string".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-memory-write".to_string(),
            name: "memory write".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Write a document into the agent's durable memory namespace via SpacetimeDB.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Memory".to_string()),
            command: Some("starbridge memory write".to_string()),
            params: vec!["namespace: string".to_string(), "title: string".to_string(), "content: string".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-memory-search".to_string(),
            name: "memory search".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Retrieve relevant memory chunks for a query using cosine similarity ranking.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Memory".to_string()),
            command: Some("starbridge memory search".to_string()),
            params: vec!["query: string".to_string(), "namespace: string".to_string(), "top_k: usize".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-approval-resolve".to_string(),
            name: "approval resolve".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Resolve a pending operator approval request with an approved or rejected decision.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Governance".to_string()),
            command: Some("starbridge approval resolve".to_string()),
            params: vec!["approval_id: string".to_string(), "decision: approved|rejected".to_string()],
            requires_approval: true,
        },
        CatalogItem {
            id: "tool-workflow-dispatch".to_string(),
            name: "workflow dispatch".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Publish a new workflow run into the SpacetimeDB job queue with a goal and priority.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Workflow".to_string()),
            command: Some("starbridge workflow dispatch".to_string()),
            params: vec!["agent_id: string".to_string(), "goal: string".to_string(), "priority: high|normal|low".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-workflow-step-move".to_string(),
            name: "workflow step move".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Move a workflow step to a different stage, resetting its status to draft.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Workflow".to_string()),
            command: Some("starbridge workflow step move".to_string()),
            params: vec!["step_id: string".to_string(), "stage: route|plan|gather|act|verify|summarize|learn".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-himalaya-send".to_string(),
            name: "himalaya send".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Send an email from the operator mailbox using the himalaya CLI integration.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Comms".to_string()),
            command: Some("himalaya send".to_string()),
            params: vec!["to: string".to_string(), "subject: string".to_string(), "body: string".to_string()],
            requires_approval: true,
        },
        CatalogItem {
            id: "tool-spotify-play".to_string(),
            name: "spotify play".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Start or resume Spotify playback for a given track URI via the Spotify Web API.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Ambient".to_string()),
            command: Some("spotify play <uri>".to_string()),
            params: vec!["uri: string".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-chat-send".to_string(),
            name: "chat send".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Post a message to a channel thread via the Chat SDK message bus.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Comms".to_string()),
            command: Some("starbridge chat send".to_string()),
            params: vec!["thread_id: string".to_string(), "content: string".to_string(), "channel: string".to_string()],
            requires_approval: false,
        },
        CatalogItem {
            id: "tool-snapshot-fetch".to_string(),
            name: "snapshot fetch".to_string(),
            kind: CatalogItemKind::Tool,
            description: "Pull the current MissionControlSnapshot from SpacetimeDB for operator inspection.".to_string(),
            model: None,
            runtime: None,
            deployment: None,
            stages: vec![],
            tool_permissions: vec![],
            schedule: None,
            category: Some("Observability".to_string()),
            command: Some("starbridge snapshot fetch".to_string()),
            params: vec![],
            requires_approval: false,
        },
    ]
}

/// Derive agent catalog entries from the snapshot's workflow runs.
fn agents_from_snapshot(snapshot: &MissionControlSnapshot) -> Vec<CatalogItem> {
    use std::collections::BTreeMap;

    // Collect unique agents from workflow runs, merging their stage coverage.
    let mut agents: BTreeMap<String, CatalogItem> = BTreeMap::new();

    for run in &snapshot.workflow_runs {
        let entry = agents.entry(run.agent_id.clone()).or_insert_with(|| CatalogItem {
            id: format!("agent-{}", run.agent_id),
            name: run.agent_id.clone(),
            kind: CatalogItemKind::Agent,
            description: format!(
                "Operator agent running in the {} pipeline. Trigger: {}.",
                run.current_stage, run.trigger_source
            ),
            model: Some("claude-sonnet-4".to_string()),
            runtime: Some("Vercel edge + SpacetimeDB".to_string()),
            deployment: Some("vercel-edge".to_string()),
            stages: vec![],
            tool_permissions: vec![
                "browser".to_string(),
                "memory".to_string(),
                "workflow".to_string(),
            ],
            schedule: Some("on-demand".to_string()),
            category: None,
            command: None,
            params: vec![],
            requires_approval: false,
        });

        // Collect stages from the run's workflow steps.
        if !entry.stages.contains(&run.current_stage) {
            entry.stages.push(run.current_stage.clone());
        }
    }

    // Enrich with step data.
    for step in &snapshot.workflow_steps {
        if let Some(agent) = agents.get_mut(&step.agent_id) {
            if !agent.stages.contains(&step.stage) {
                agent.stages.push(step.stage.clone());
            }
        }
    }

    agents.into_values().collect()
}

// ── filter state ──────────────────────────────────────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum CatalogFilter {
    All,
    Agents,
    Tools,
}

// ── component ─────────────────────────────────────────────────────────────────

#[component]
pub fn CatalogView(snapshot: MissionControlSnapshot) -> Element {
    let agents = agents_from_snapshot(&snapshot);
    let tools = builtin_tools();

    let mut search = use_signal(String::new);
    let mut filter = use_signal(|| CatalogFilter::All);
    let mut selected_id = use_signal(|| {
        agents
            .first()
            .map(|a| a.id.clone())
            .or_else(|| tools.first().map(|t| t.id.clone()))
    });

    let agent_count = agents.len();
    let tool_count = tools.len();

    // Merge all items into one browsable list.
    let all_items: Vec<CatalogItem> = agents
        .iter()
        .cloned()
        .chain(tools.iter().cloned())
        .collect();

    let q = search().to_lowercase();
    let visible: Vec<CatalogItem> = all_items
        .iter()
        .filter(|item| {
            let kind_ok = match filter() {
                CatalogFilter::All => true,
                CatalogFilter::Agents => item.kind == CatalogItemKind::Agent,
                CatalogFilter::Tools => item.kind == CatalogItemKind::Tool,
            };
            let text_ok = q.is_empty()
                || item.name.to_lowercase().contains(&q)
                || item.description.to_lowercase().contains(&q);
            kind_ok && text_ok
        })
        .cloned()
        .collect();

    let selected = selected_id()
        .as_ref()
        .and_then(|id| all_items.iter().find(|i| &i.id == id))
        .cloned();

    rsx! {
        div { class: "page-grid page-grid-catalog",

            // ── Left panel ────────────────────────────────────────────────────
            section { class: "panel",
                div { class: "panel-head",
                    p { class: "section-eyebrow", "Agent + Tool registry" }
                    h3 { class: "card-title", "Catalog" }
                    p { class: "row-copy", "Browse agents, tools, and integrations." }
                }

                // Search
                div { style: "padding: 0 0 0 0;",
                    input {
                        class: "catalog-search",
                        r#type: "text",
                        placeholder: "Search catalog…",
                        value: search(),
                        oninput: move |e| search.set(e.value()),
                    }
                }

                // Filter chips
                div { class: "catalog-filters", style: "padding: 8px 12px;",
                    button {
                        class: if filter() == CatalogFilter::All {
                            "catalog-filter-chip catalog-filter-chip-active"
                        } else {
                            "catalog-filter-chip"
                        },
                        onclick: move |_| filter.set(CatalogFilter::All),
                        "All ({agent_count + tool_count})"
                    }
                    button {
                        class: if filter() == CatalogFilter::Agents {
                            "catalog-filter-chip catalog-filter-chip-active"
                        } else {
                            "catalog-filter-chip"
                        },
                        onclick: move |_| filter.set(CatalogFilter::Agents),
                        "Agents ({agent_count})"
                    }
                    button {
                        class: if filter() == CatalogFilter::Tools {
                            "catalog-filter-chip catalog-filter-chip-active"
                        } else {
                            "catalog-filter-chip"
                        },
                        onclick: move |_| filter.set(CatalogFilter::Tools),
                        "Tools ({tool_count})"
                    }
                }

                // List
                div { class: "panel-body list-stack", style: "overflow-y: auto; padding: 0;",
                    if visible.is_empty() {
                        div { class: "empty-state",
                            h3 { "No matches" }
                            p { "Adjust the search or filter to find agents and tools." }
                        }
                    } else {
                        for item in visible.iter().cloned() {
                            {
                                let item_id = item.id.clone();
                                let is_active = selected_id()
                                    .as_ref()
                                    .map(|id| id == &item_id)
                                    .unwrap_or(false);
                                let kind_label = match item.kind {
                                    CatalogItemKind::Agent => "Agent",
                                    CatalogItemKind::Tool => "Tool",
                                };
                                rsx! {
                                    button {
                                        class: if is_active {
                                            "catalog-item catalog-item-active"
                                        } else {
                                            "catalog-item"
                                        },
                                        onclick: move |_| selected_id.set(Some(item_id.clone())),
                                        div { style: "display: flex; align-items: center; gap: 8px;",
                                            span { class: "catalog-item-name", "{item.name}" }
                                            span { class: "catalog-item-type", "{kind_label}" }
                                        }
                                        p { class: "catalog-item-desc", "{item.description}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ── Right panel ───────────────────────────────────────────────────
            section { class: "panel",
                if let Some(item) = selected {
                    CatalogDetail { item }
                } else {
                    div { class: "panel-body",
                        div { class: "empty-state",
                            h3 { "Nothing selected" }
                            p { "Pick an agent or tool from the list to view its details." }
                        }
                    }
                }
            }
        }
    }
}

// ── Detail panel ──────────────────────────────────────────────────────────────

#[component]
fn CatalogDetail(item: CatalogItem) -> Element {
    let kind_label = match item.kind {
        CatalogItemKind::Agent => "Agent",
        CatalogItemKind::Tool => "Tool",
    };

    rsx! {
        div { class: "catalog-detail",
            // Title row
            div { style: "display: flex; align-items: baseline; gap: 0; flex-wrap: wrap; margin-bottom: 4px;",
                h2 { class: "catalog-detail-title", "{item.name}" }
                span { class: "catalog-detail-badge", "{kind_label}" }
                if let Some(cat) = item.category.as_ref() {
                    span { class: "catalog-detail-badge", style: "margin-left: 4px; background: var(--secondary); color: var(--on-primary);", "{cat}" }
                }
            }

            // Description
            p { class: "catalog-detail-desc", "{item.description}" }

            // Agent-specific detail
            if item.kind == CatalogItemKind::Agent {
                div { class: "catalog-detail-section",
                    p { class: "catalog-detail-section-title", "Runtime" }
                    ul { class: "catalog-kv-list",
                        if let Some(model) = item.model.as_ref() {
                            li { span { "Model" } strong { "{model}" } }
                        }
                        if let Some(runtime) = item.runtime.as_ref() {
                            li { span { "Runtime" } strong { "{runtime}" } }
                        }
                        if let Some(deployment) = item.deployment.as_ref() {
                            li { span { "Deployment" } strong { "{deployment}" } }
                        }
                        if let Some(schedule) = item.schedule.as_ref() {
                            li { span { "Schedule" } strong { "{schedule}" } }
                        }
                    }
                }

                if !item.stages.is_empty() {
                    div { class: "catalog-detail-section",
                        p { class: "catalog-detail-section-title", "Workflow stages" }
                        div { class: "catalog-code-block",
                            "{item.stages.join(\" -> \")}"
                        }
                    }
                }

                if !item.tool_permissions.is_empty() {
                    div { class: "catalog-detail-section",
                        p { class: "catalog-detail-section-title", "Tool permissions" }
                        div { style: "display: flex; gap: 6px; flex-wrap: wrap;",
                            for perm in item.tool_permissions.iter() {
                                span { class: "catalog-item-type", "{perm}" }
                            }
                        }
                    }
                }

                div { style: "margin-top: 20px;",
                    button { class: "primary-button", "Dispatch" }
                }
            }

            // Tool-specific detail
            if item.kind == CatalogItemKind::Tool {
                if let Some(cmd) = item.command.as_ref() {
                    div { class: "catalog-detail-section",
                        p { class: "catalog-detail-section-title", "CLI command" }
                        div { class: "catalog-code-block", "{cmd}" }
                    }
                }

                if !item.params.is_empty() {
                    div { class: "catalog-detail-section",
                        p { class: "catalog-detail-section-title", "Parameters" }
                        ul { class: "catalog-kv-list",
                            for param in item.params.iter() {
                                li {
                                    span { "{param}" }
                                }
                            }
                        }
                    }
                }

                div { class: "catalog-detail-section",
                    p { class: "catalog-detail-section-title", "Governance" }
                    ul { class: "catalog-kv-list",
                        li {
                            span { "Requires approval" }
                            strong {
                                if item.requires_approval { "Yes" } else { "No" }
                            }
                        }
                    }
                }

                div { style: "margin-top: 20px;",
                    button { class: "secondary-button", "Test" }
                }
            }
        }
    }
}
