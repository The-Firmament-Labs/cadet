use dioxus::prelude::*;
use starbridge_core::{
    BrowserTaskRecord, ChatThreadRecord, MessageEventRecord, RetrievalTraceRecord,
    WorkflowRunRecord, WorkflowStepRecord,
};

use crate::ui::models::UiNodeSpec;

#[component]
pub fn SidebarNavButton(
    icon: String,
    label: String,
    active: bool,
    count: Option<String>,
    onclick: EventHandler<MouseEvent>,
) -> Element {
    rsx! {
        button {
            class: nav_button_class(active),
            title: "{label}",
            onclick: move |event| onclick.call(event),
            span { class: "nav-icon", "{icon}" }
            strong { class: "nav-label", "{label}" }
            if let Some(count) = count {
                span { class: "nav-count", "{count}" }
            }
        }
    }
}

#[component]
pub fn MetricTile(label: String, value: String, detail: String, tone: String) -> Element {
    rsx! {
        article { class: "metric-tile",
            div { class: "metric-tile-top",
                span { class: tone_pill_class(tone.as_str()), "{label}" }
                strong { class: "metric-value", "{value}" }
            }
            p { class: "metric-detail", "{detail}" }
        }
    }
}

#[component]
pub fn InspectorCard(eyebrow: String, title: String, children: Element) -> Element {
    rsx! {
        section { class: "inspector-card",
            p { class: "section-eyebrow", "{eyebrow}" }
            h3 { class: "card-title", "{title}" }
            {children}
        }
    }
}

#[component]
pub fn CalloutBox(tone: String, title: String, body: String) -> Element {
    rsx! {
        div { class: callout_class(tone.as_str()),
            strong { "{title}" }
            p { "{body}" }
        }
    }
}

#[component]
pub fn EmptyState(title: String, body: String) -> Element {
    rsx! {
        div { class: "empty-state",
            h3 { "{title}" }
            p { "{body}" }
        }
    }
}

#[component]
pub fn RunListItem(run: WorkflowRunRecord, active: bool, onclick: EventHandler<MouseEvent>) -> Element {
    let summary = run
        .summary
        .clone()
        .unwrap_or_else(|| "Waiting for the next stage summary.".to_string());

    rsx! {
        button {
            class: list_item_class(active),
            onclick: move |event| onclick.call(event),
            div { class: "list-item-head",
                strong { class: "list-item-title", "{run.goal}" }
                span { class: status_badge_class(run.status.as_str()), "{run.status}" }
            }
            p { class: "list-item-meta", "{run.agent_id} · {run.current_stage} · {run.trigger_source}" }
            p { class: "list-item-copy", "{summary}" }
        }
    }
}

#[component]
pub fn ThreadListItem(
    thread: ChatThreadRecord,
    active: bool,
    onclick: EventHandler<MouseEvent>,
) -> Element {
    rsx! {
        button {
            class: list_item_class(active),
            onclick: move |event| onclick.call(event),
            div { class: "list-item-head",
                strong { class: "list-item-title", "{thread.title}" }
                span { class: "pill pill-subtle", "{thread.channel}" }
            }
            p { class: "list-item-meta", "{thread.channel_thread_id}" }
            p { class: "list-item-copy", "Latest message micros {thread.latest_message_at_micros}" }
        }
    }
}

#[component]
pub fn WorkflowStepRow(step: WorkflowStepRecord) -> Element {
    let depends_on = step
        .depends_on_step_id
        .clone()
        .unwrap_or_else(|| "none".to_string());
    let runner = step
        .runner_id
        .clone()
        .unwrap_or_else(|| "unclaimed".to_string());

    rsx! {
        article { class: "row-card",
            div { class: "row-top",
                div {
                    p { class: "section-eyebrow", "{step.stage}" }
                    h3 { class: "card-title", "{step.step_id}" }
                    p { class: "row-copy", "{step.agent_id} · {step.owner_execution}" }
                }
                div { class: "chip-row",
                    span { class: status_badge_class(step.status.as_str()), "{step.status}" }
                    span { class: "pill pill-subtle", "retry {step.retry_count}" }
                }
            }
            ul { class: "key-value-list",
                li { span { "Run" } strong { "{step.run_id}" } }
                li { span { "Depends on" } strong { "{depends_on}" } }
                li { span { "Runner" } strong { "{runner}" } }
            }
        }
    }
}

#[component]
pub fn BrowserTaskRow(task: BrowserTaskRecord) -> Element {
    rsx! {
        article { class: "row-card",
            div { class: "row-top",
                div {
                    p { class: "section-eyebrow", "{task.mode}" }
                    h3 { class: "card-title", "{task.url}" }
                    p { class: "row-copy", "Task {task.task_id} · Step {task.step_id}" }
                }
                div { class: "chip-row",
                    span { class: status_badge_class(task.status.as_str()), "{task.status}" }
                    span { class: risk_badge_class(task.risk.as_str()), "{task.risk}" }
                }
            }
            ul { class: "key-value-list",
                li { span { "Owner" } strong { "{task.owner_execution}" } }
                li { span { "Run" } strong { "{task.run_id}" } }
                li { span { "Agent" } strong { "{task.agent_id}" } }
            }
        }
    }
}

#[component]
pub fn RetrievalTraceRow(trace: RetrievalTraceRecord) -> Element {
    rsx! {
        article { class: "row-card",
            p { class: "section-eyebrow", "Retrieval trace" }
            h3 { class: "card-title", "{trace.query_text}" }
            p { class: "row-copy", "Run {trace.run_id} · Step {trace.step_id}" }
            div { class: "chip-row", style: "margin-top: 0.8rem;",
                for chunk_id in trace.chunk_ids {
                    span { class: "pill pill-subtle", "{chunk_id}" }
                }
            }
        }
    }
}

#[component]
pub fn MessageBubble(message: MessageEventRecord) -> Element {
    rsx! {
        article { class: message_class(message.direction.as_str()),
            div { class: "message-head",
                strong { "{message.actor}" }
                span { class: "message-channel", "{message.channel}" }
            }
            p { class: "message-body", "{message.content}" }
            if let Some(run_id) = message.run_id.clone() {
                p { class: "message-meta", "Run {run_id}" }
            }
        }
    }
}

#[component]
pub fn DynamicUiNode(node: UiNodeSpec) -> Element {
    match node {
        UiNodeSpec::Section {
            title,
            description,
            children,
        } => rsx! {
            article { class: "surface-node surface-node-section",
                h3 { class: "card-title", "{title}" }
                if let Some(description) = description {
                    p { class: "row-copy", "{description}" }
                }
                div { class: "surface-node-stack",
                    for child in children {
                        DynamicUiNode { node: child }
                    }
                }
            }
        },
        UiNodeSpec::Metric { label, value, tone } => {
            let tone = tone.unwrap_or_else(|| "neutral".to_string());
            rsx! {
                article { class: "surface-node surface-node-metric",
                    div { class: "surface-node-head",
                        p { class: "section-eyebrow", "{label}" }
                        span { class: tone_pill_class(tone.as_str()), "{tone}" }
                    }
                    strong { class: "surface-node-value", "{value}" }
                }
            }
        }
        UiNodeSpec::BadgeStrip { label, items } => rsx! {
            article { class: "surface-node",
                if let Some(label) = label {
                    p { class: "section-eyebrow", "{label}" }
                }
                div { class: "chip-row",
                    for item in items {
                        span { class: "pill pill-subtle", "{item}" }
                    }
                }
            }
        },
        UiNodeSpec::List { title, items } => rsx! {
            article { class: "surface-node surface-node-list",
                h3 { class: "card-title", "{title}" }
                ul { class: "simple-list",
                    for item in items {
                        li { "{item}" }
                    }
                }
            }
        },
        UiNodeSpec::Callout { tone, title, body } => rsx! {
            CalloutBox {
                tone: tone.unwrap_or_else(|| "info".to_string()),
                title,
                body,
            }
        },
        UiNodeSpec::CodeBlock { label, value } => rsx! {
            article { class: "surface-node",
                p { class: "section-eyebrow", "{label}" }
                pre { class: "code-block", "{value}" }
            }
        },
    }
}

pub fn nav_button_class(active: bool) -> &'static str {
    if active {
        "nav-button nav-button-active"
    } else {
        "nav-button"
    }
}

pub fn list_item_class(active: bool) -> &'static str {
    if active {
        "list-item list-item-active"
    } else {
        "list-item"
    }
}

pub fn segmented_button_class(active: bool) -> &'static str {
    if active {
        "segmented-button segmented-button-active"
    } else {
        "segmented-button"
    }
}

pub fn workflow_lane_class(active: bool) -> &'static str {
    if active {
        "workflow-lane workflow-lane-active"
    } else {
        "workflow-lane"
    }
}

pub fn status_badge_class(status: &str) -> &'static str {
    match status {
        "completed" | "running" | "claimed" | "approved" => "pill pill-success",
        "failed" | "cancelled" | "rejected" => "pill pill-danger",
        "blocked" | "awaiting-approval" | "pending" => "pill pill-warn",
        _ => "pill pill-subtle",
    }
}

pub fn risk_badge_class(risk: &str) -> &'static str {
    match risk {
        "high" => "pill pill-danger",
        "medium" => "pill pill-warn",
        _ => "pill pill-success",
    }
}

pub fn tone_pill_class(tone: &str) -> &'static str {
    match tone {
        "accent" => "pill pill-accent",
        "warn" => "pill pill-warn",
        "danger" => "pill pill-danger",
        "success" => "pill pill-success",
        _ => "pill pill-subtle",
    }
}

pub fn callout_class(tone: &str) -> &'static str {
    match tone {
        "danger" => "callout callout-danger",
        "warn" => "callout callout-warn",
        "tip" => "callout callout-tip",
        _ => "callout callout-info",
    }
}

pub fn message_class(direction: &str) -> &'static str {
    match direction {
        "outbound" => "message-bubble message-bubble-outbound",
        _ => "message-bubble message-bubble-inbound",
    }
}
