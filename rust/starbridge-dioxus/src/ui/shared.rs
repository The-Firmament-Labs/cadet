use dioxus::prelude::*;
use starbridge_core::{
    BrowserTaskRecord, ChatThreadRecord, MessageEventRecord, RetrievalTraceRecord,
    WorkflowRunRecord, WorkflowStepRecord,
};

use crate::ui::models::UiNodeSpec;

/// Format a microsecond Unix timestamp as a human-readable relative or absolute time.
pub fn format_timestamp_micros(micros: i64) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now_micros = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_micros() as i64)
        .unwrap_or(micros);
    let delta_secs = (now_micros - micros) / 1_000_000;
    if delta_secs < 0 {
        return "just now".to_string();
    }
    match delta_secs {
        0..=59 => format!("{}s ago", delta_secs),
        60..=3599 => format!("{}m ago", delta_secs / 60),
        3600..=86399 => format!("{}h ago", delta_secs / 3600),
        _ => {
            // Absolute UTC: "Mar 28 10:30"
            let total_secs = micros / 1_000_000;
            let days_since_epoch = total_secs / 86400;
            let time_of_day = total_secs % 86400;
            let hours = time_of_day / 3600;
            let minutes = (time_of_day % 3600) / 60;

            // Approximate month/day from days since epoch
            let (_year, month, day) = days_to_ymd(days_since_epoch);
            let month_name = match month {
                1 => "Jan", 2 => "Feb", 3 => "Mar", 4 => "Apr",
                5 => "May", 6 => "Jun", 7 => "Jul", 8 => "Aug",
                9 => "Sep", 10 => "Oct", 11 => "Nov", _ => "Dec",
            };
            format!("{} {} {:02}:{:02}", month_name, day, hours, minutes)
        }
    }
}

fn days_to_ymd(days_since_epoch: i64) -> (i64, u32, u32) {
    // Civil calendar conversion from days since 1970-01-01
    let z = days_since_epoch + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year, m, d)
}

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
            p { class: "list-item-copy", "{format_timestamp_micros(thread.latest_message_at_micros)}" }
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
            div { class: "chip-row", style: "margin-top: 8px;",
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

// ════════════════════════════════════════════════════════════════════
// NEW SHARED COMPONENTS
// ════════════════════════════════════════════════════════════════════

/// Dismissible error banner with coral accent.
#[component]
pub fn ErrorBanner(message: String, on_dismiss: EventHandler<()>) -> Element {
    rsx! {
        div { class: "error-banner",
            p { class: "error-banner-text", "{message}" }
            button {
                class: "error-banner-dismiss",
                onclick: move |_| on_dismiss.call(()),
                "Dismiss"
            }
        }
    }
}

/// Small colored dot indicating status.
#[component]
pub fn StatusDot(
    #[props(default = "active".to_string())] status: String,
) -> Element {
    let class = match status.as_str() {
        "active" | "running" => "status-dot status-dot-active",
        "scheduled" | "queued" => "status-dot status-dot-scheduled",
        "complete" | "completed" => "status-dot status-dot-complete",
        "failed" | "error" => "status-dot status-dot-failed",
        _ => "status-dot",
    };
    rsx! { span { class: "{class}" } }
}

/// Styled agent name badge.
#[component]
pub fn AgentBadge(agent: String) -> Element {
    rsx! {
        span { class: "agent-badge", "{agent}" }
    }
}

/// Horizontal 7-stage pipeline visualization.
#[component]
pub fn StagePipeline(current_stage: String, is_complete: bool) -> Element {
    let stages = ["route", "plan", "gather", "act", "verify", "summarize", "learn"];
    let current_idx = stages.iter().position(|s| *s == current_stage.as_str()).unwrap_or(0);

    rsx! {
        div { class: "stage-pipeline",
            for (i, stage) in stages.iter().enumerate() {
                {
                    let class = if is_complete || i < current_idx {
                        "stage-pip stage-pip-done"
                    } else if i == current_idx && !is_complete {
                        "stage-pip stage-pip-active"
                    } else {
                        "stage-pip"
                    };
                    rsx! {
                        div { class: "{class}",
                            span { class: "stage-pip-label", "{stage}" }
                        }
                    }
                }
            }
        }
    }
}

/// Compact run display card.
#[component]
pub fn RunCard(
    run: WorkflowRunRecord,
    #[props(default = false)] active: bool,
    onclick: EventHandler<MouseEvent>,
) -> Element {
    let status_class = match run.status.as_str() {
        "running" | "queued" => "active",
        "completed" => "complete",
        "failed" | "cancelled" => "failed",
        _ => "scheduled",
    };
    let platform_prefix = run.trigger_source.split(':').next().unwrap_or(&run.trigger_source).to_string();
    rsx! {
        button {
            class: if active { "run-card run-card-active" } else { "run-card" },
            onclick: move |e| onclick.call(e),
            StatusDot { status: status_class.to_string() }
            div { class: "run-card-body",
                p { class: "run-card-goal", "{run.goal}" }
                p { class: "run-card-meta",
                    "{run.agent_id} · {run.trigger_source}"
                    if run.trigger_source.contains("slack") || run.trigger_source.contains("discord") || run.trigger_source.contains("telegram") {
                        span { class: "rl-platform-badge", "{platform_prefix}" }
                    }
                }
            }
            div { class: "run-card-right",
                span { class: "run-card-stage", "{run.current_stage}" }
            }
        }
    }
}

/// Inline approval card with approve/reject buttons.
#[component]
pub fn ApprovalCard(
    approval_id: String,
    title: String,
    detail: String,
    status: String,
    run_id: String,
    step_id: String,
    on_approve: EventHandler<String>,
    on_reject: EventHandler<String>,
) -> Element {
    let is_pending = status == "pending";
    rsx! {
        div { class: "approval-card",
            div { class: "approval-card-head",
                span { class: "approval-card-title", "{title}" }
                span { class: status_badge_class(&status), "{status}" }
            }
            p { class: "approval-card-meta", "Run {run_id} · Step {step_id}" }
            if !detail.is_empty() {
                p { class: "approval-card-detail", "{detail}" }
            }
            if is_pending {
                div { class: "approval-card-actions",
                    button {
                        class: "primary-button",
                        onclick: {
                            let aid = approval_id.clone();
                            move |_| on_approve.call(aid.clone())
                        },
                        "Approve"
                    }
                    button {
                        class: "danger-button",
                        onclick: {
                            let aid = approval_id.clone();
                            move |_| on_reject.call(aid.clone())
                        },
                        "Reject"
                    }
                }
            }
        }
    }
}

/// Collapsible tool call card.
#[component]
pub fn ToolCallCard(
    tool_name: String,
    status: String,
    summary: String,
) -> Element {
    let mut expanded = use_signal(|| false);
    let status_class = match status.as_str() {
        "running" => "pill pill-live",
        "complete" | "done" => "pill pill-success",
        "error" | "failed" => "pill pill-danger",
        _ => "pill pill-subtle",
    };
    rsx! {
        div { class: "tool-call-card",
            button {
                class: "tool-call-card-head",
                onclick: move |_| expanded.set(!expanded()),
                span { class: "tool-call-card-name", "{tool_name}" }
                span { class: "{status_class}", "{status}" }
                span { class: "tool-call-card-chevron", if expanded() { "v" } else { ">" } }
            }
            if expanded() && !summary.is_empty() {
                div { class: "tool-call-card-body",
                    p { class: "tool-call-card-output", "{summary}" }
                }
            }
        }
    }
}

/// Simple markdown renderer. Converts basic markdown to RSX.
/// Handles paragraphs, headings, bold, code blocks, inline code, lists.
pub fn render_markdown(content: &str) -> Element {
    use pulldown_cmark::{Parser, Event, Tag, TagEnd};

    let parser = Parser::new(content);
    let mut html = String::new();
    let mut in_code_block = false;

    for event in parser {
        match event {
            Event::Start(tag) => match tag {
                Tag::Paragraph => html.push_str("<p class=\"md-p\">"),
                Tag::Heading { level, .. } => {
                    let tag = match level {
                        pulldown_cmark::HeadingLevel::H1 => "h1",
                        pulldown_cmark::HeadingLevel::H2 => "h2",
                        pulldown_cmark::HeadingLevel::H3 => "h3",
                        _ => "h4",
                    };
                    html.push_str(&format!("<{} class=\"md-heading\">", tag));
                }
                Tag::CodeBlock(_) => {
                    in_code_block = true;
                    html.push_str("<pre class=\"md-code-block\"><code>");
                }
                Tag::List(Some(_)) => html.push_str("<ol class=\"md-list\">"),
                Tag::List(None) => html.push_str("<ul class=\"md-list\">"),
                Tag::Item => html.push_str("<li>"),
                Tag::Strong => html.push_str("<strong>"),
                Tag::Emphasis => html.push_str("<em>"),
                Tag::BlockQuote(_) => html.push_str("<blockquote class=\"md-blockquote\">"),
                _ => {}
            },
            Event::End(tag) => match tag {
                TagEnd::Paragraph => html.push_str("</p>"),
                TagEnd::Heading(level) => {
                    let tag = match level {
                        pulldown_cmark::HeadingLevel::H1 => "h1",
                        pulldown_cmark::HeadingLevel::H2 => "h2",
                        pulldown_cmark::HeadingLevel::H3 => "h3",
                        _ => "h4",
                    };
                    html.push_str(&format!("</{}>", tag));
                }
                TagEnd::CodeBlock => {
                    in_code_block = false;
                    html.push_str("</code></pre>");
                }
                TagEnd::List(true) => html.push_str("</ol>"),
                TagEnd::List(false) => html.push_str("</ul>"),
                TagEnd::Item => html.push_str("</li>"),
                TagEnd::Strong => html.push_str("</strong>"),
                TagEnd::Emphasis => html.push_str("</em>"),
                TagEnd::BlockQuote(_) => html.push_str("</blockquote>"),
                _ => {}
            },
            Event::Text(text) => {
                if in_code_block {
                    html.push_str(&html_escape(&text));
                } else {
                    html.push_str(&html_escape(&text));
                }
            }
            Event::Code(code) => {
                html.push_str(&format!("<code class=\"md-inline-code\">{}</code>", html_escape(&code)));
            }
            Event::SoftBreak | Event::HardBreak => html.push_str("<br>"),
            _ => {}
        }
    }

    rsx! {
        div {
            class: "markdown-body",
            dangerous_inner_html: "{html}",
        }
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

// ── RL Pipeline Components ─────────────────────────────────────────

/// Quality gauge bar — colored by composite score.
/// Red (<0.4), Yellow (0.4-0.7), Green (>0.7).
#[component]
pub fn QualityGauge(
    composite: f32,
    correctness: f32,
    efficiency: f32,
    tool_use_quality: f32,
    adherence: f32,
    delight: f32,
    source: String,
) -> Element {
    let pct = (composite * 100.0).clamp(0.0, 100.0);
    let color = if composite < 0.4 {
        "var(--error)"
    } else if composite < 0.7 {
        "var(--warning)"
    } else {
        "var(--success)"
    };
    let bg = if composite < 0.4 {
        "var(--error-container)"
    } else if composite < 0.7 {
        "var(--secondary-container)"
    } else {
        "var(--success-container)"
    };

    let delight_display = format!("{:.2}", delight);
    let tooltip = format!(
        "Correctness: {:.0}%  Efficiency: {:.0}%  Tool Use: {:.0}%  Adherence: {:.0}%\nDelight: {}  Source: {}",
        correctness * 100.0, efficiency * 100.0, tool_use_quality * 100.0, adherence * 100.0,
        delight_display, source
    );

    rsx! {
        div {
            class: "quality-gauge",
            title: "{tooltip}",
            div { class: "quality-gauge-label",
                span { class: "quality-gauge-score", "{pct:.0}%" }
                if delight > 0.1 {
                    span { class: "quality-gauge-delight", "delight {delight_display}" }
                }
            }
            div {
                class: "quality-gauge-track",
                style: "background: {bg};",
                div {
                    class: "quality-gauge-fill",
                    style: "width: {pct}%; background: {color};",
                }
            }
        }
    }
}

/// SVG sparkline showing a trend of values over time.
/// Renders as a compact inline SVG.
#[component]
pub fn Sparkline(values: Vec<f32>, width: f32, height: f32) -> Element {
    if values.is_empty() {
        return rsx! {
            span { class: "sparkline-empty", "—" }
        };
    }

    let min_val = values.iter().copied().fold(f32::INFINITY, f32::min);
    let max_val = values.iter().copied().fold(f32::NEG_INFINITY, f32::max);
    let range = (max_val - min_val).max(0.01);

    let points: String = values
        .iter()
        .enumerate()
        .map(|(i, v)| {
            let x = if values.len() > 1 {
                (i as f32 / (values.len() - 1) as f32) * width
            } else {
                width / 2.0
            };
            let y = height - ((v - min_val) / range) * height;
            format!("{x:.1},{y:.1}")
        })
        .collect::<Vec<_>>()
        .join(" ");

    // Color based on trend (last value vs first value)
    let trend_color = if values.len() >= 2 {
        let first = values[0];
        let last = values[values.len() - 1];
        if last > first + 0.05 { "var(--success)" }
        else if last < first - 0.05 { "var(--error)" }
        else { "var(--secondary)" }
    } else {
        "var(--secondary)"
    };

    let svg = format!(
        r#"<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"><polyline points="{points}" fill="none" stroke="{trend_color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>"#,
    );

    rsx! {
        span {
            class: "sparkline",
            dangerous_inner_html: "{svg}",
        }
    }
}

/// Thumbs up/down feedback buttons for agent messages.
#[component]
pub fn FeedbackButtons(
    message_id: String,
    current_feedback: Option<bool>,
    on_feedback: EventHandler<(String, bool)>,
) -> Element {
    let msg_id_up = message_id.clone();
    let msg_id_down = message_id.clone();

    rsx! {
        div { class: "feedback-buttons",
            button {
                class: if current_feedback == Some(true) { "feedback-btn feedback-btn-active" } else { "feedback-btn" },
                title: "Good response",
                onclick: move |_| on_feedback.call((msg_id_up.clone(), true)),
                "▲"
            }
            button {
                class: if current_feedback == Some(false) { "feedback-btn feedback-btn-active feedback-btn-down" } else { "feedback-btn" },
                title: "Poor response",
                onclick: move |_| on_feedback.call((msg_id_down.clone(), false)),
                "▼"
            }
        }
    }
}

/// Training buffer badge — shows count of high-delight trajectories awaiting GRPO.
#[component]
pub fn TrainingBufferBadge(count: usize) -> Element {
    if count == 0 {
        return rsx! {};
    }
    rsx! {
        span {
            class: "training-buffer-badge",
            title: "{count} high-delight trajectories awaiting training",
            "{count}"
        }
    }
}
