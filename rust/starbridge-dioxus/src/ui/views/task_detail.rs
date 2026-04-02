use dioxus::prelude::*;

use crate::ui::models::{TaskItem, TaskStatus, ToolLogStatus};

/// Task detail view — shows description, instructions, history panels.
/// Displayed when clicking a scheduled or completed task.
#[component]
pub fn TaskDetailView(
    task: TaskItem,
    on_start: EventHandler<String>,
    on_back: EventHandler<()>,
) -> Element {
    rsx! {
        div { class: "task-detail",
            // Header
            div { class: "task-detail-header",
                div {
                    h2 { class: "task-detail-title", "{task.title}" }
                    p { class: "task-detail-agent",
                        span { class: "task-card-agent", "{task.agent}" }
                        " · {task.status.label()}"
                    }
                }
                div { style: "display: flex; gap: 8px;",
                    button { class: "secondary-button", onclick: move |_| on_back.call(()), "Back" }
                    if task.status == TaskStatus::Scheduled {
                        button {
                            class: "primary-button",
                            onclick: {
                                let id = task.id.clone();
                                move |_| on_start.call(id.clone())
                            },
                            "Run Now"
                        }
                    }
                }
            }

            // Body: main + aside
            div { class: "task-detail-body",
                div { class: "task-detail-main",
                    // Description
                    div { class: "detail-section",
                        p { class: "detail-section-title", "Description" }
                        div { class: "detail-section-content",
                            for line in task.description.lines() {
                                if line.is_empty() {
                                    br {}
                                } else {
                                    p { "{line}" }
                                }
                            }
                        }
                    }

                    // Instructions
                    if !task.instructions.is_empty() {
                        div { class: "detail-section",
                            p { class: "detail-section-title", "Instructions" }
                            div { class: "detail-section-content",
                                for line in task.instructions.lines() {
                                    if line.is_empty() {
                                        br {}
                                    } else {
                                        p { "{line}" }
                                    }
                                }
                            }
                        }
                    }
                }

                div { class: "task-detail-aside",
                    // Properties
                    div { class: "detail-section",
                        p { class: "detail-section-title", "Properties" }
                        if let Some(project) = &task.project {
                            div { class: "detail-kv",
                                span { class: "detail-kv-label", "Project" }
                                span { class: "detail-kv-value", "{project}" }
                            }
                        }
                        if let Some(schedule) = &task.repeat_schedule {
                            div { class: "detail-kv",
                                span { class: "detail-kv-label", "Repeats" }
                                span { class: "detail-kv-value", "{schedule}" }
                            }
                        }
                        div { class: "detail-kv",
                            span { class: "detail-kv-label", "Agent" }
                            span { class: "detail-kv-value", "{task.agent}" }
                        }
                        div { class: "detail-kv",
                            span { class: "detail-kv-label", "Status" }
                            span { class: "detail-kv-value", "{task.status.label()}" }
                        }
                    }

                    // History (if tool_log present)
                    if !task.tool_log.is_empty() {
                        div { class: "detail-section",
                            p { class: "detail-section-title", "History" }
                            div { class: "history-list",
                                for entry in task.tool_log.iter() {
                                    div { class: "history-item",
                                        span { class: "history-time",
                                            {format_relative_ms(entry.timestamp_ms)}
                                        }
                                        span { class: "history-text", "{entry.tool_name}: {entry.summary}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Task execution view — shows tool log, progress checklist, reply composer.
/// Displayed when a task is actively running.
#[component]
pub fn TaskExecView(
    task: TaskItem,
    on_reply: EventHandler<String>,
    on_back: EventHandler<()>,
) -> Element {
    let mut reply_text = use_signal(String::new);

    rsx! {
        div { class: "task-exec",
            // Tool log (left)
            div { class: "task-exec-log",
                // Header
                div { style: "display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;",
                    div { style: "display: flex; align-items: center; gap: 8px;",
                        button { class: "secondary-button", onclick: move |_| on_back.call(()), "Back" }
                        h3 { class: "card-title", "{task.title}" }
                    }
                    span { class: "pill pill-live", "Running" }
                }

                if task.tool_log.is_empty() {
                    div { class: "empty-state",
                        h3 { "Waiting for activity..." }
                        p { "Voyager is analyzing the task." }
                    }
                }

                for entry in task.tool_log.iter() {
                    div { class: "tool-entry",
                        div {
                            class: match entry.status {
                                ToolLogStatus::Complete => "tool-entry-icon tool-entry-icon-success",
                                ToolLogStatus::Error => "tool-entry-icon tool-entry-icon-error",
                                ToolLogStatus::Running => "tool-entry-icon tool-entry-icon-running",
                            },
                            match entry.status {
                                ToolLogStatus::Complete => "o",
                                ToolLogStatus::Error => "x",
                                ToolLogStatus::Running => "*",
                            }
                        }
                        div { class: "tool-entry-body",
                            p { class: "tool-entry-name", "{entry.tool_name}" }
                            p { class: "tool-entry-summary", "{entry.summary}" }
                        }
                        span { class: "tool-entry-time",
                            {format_relative_ms(entry.timestamp_ms)}
                        }
                    }
                }
            }

            // Sidebar (right)
            div { class: "task-exec-sidebar",
                // Progress checklist
                div { class: "detail-section",
                    p { class: "detail-section-title", "Progress" }
                    if task.progress.is_empty() {
                        p { class: "row-copy", "No checklist yet" }
                    }
                    div { class: "progress-list",
                        for item in task.progress.iter() {
                            div { class: if item.done { "progress-item progress-item-done" } else { "progress-item" },
                                span {
                                    class: if item.done { "progress-check progress-check-done" } else { "progress-check progress-check-pending" },
                                    if item.done { "+" } else { "-" }
                                }
                                "{item.label}"
                            }
                        }
                    }
                }

                // Context
                div { class: "detail-section",
                    p { class: "detail-section-title", "Context" }
                    if let Some(project) = &task.project {
                        div { class: "context-list",
                            p { class: "context-file", "{project}" }
                        }
                    }
                }

                // Agent
                div { class: "detail-section",
                    p { class: "detail-section-title", "Agent" }
                    span { class: "task-card-agent", "{task.agent}" }
                }
            }

            // Reply composer (bottom left)
            div { class: "task-exec-composer",
                div { style: "display: flex; gap: 8px;",
                    textarea {
                        style: "flex: 1; min-height: 40px; max-height: 120px;",
                        value: reply_text(),
                        placeholder: "Reply to Voyager...",
                        oninput: move |e| reply_text.set(e.value()),
                        onkeydown: move |e| {
                            if e.key() == Key::Enter && !e.modifiers().shift() && !reply_text().trim().is_empty() {
                                e.prevent_default();
                                let text = reply_text();
                                reply_text.set(String::new());
                                on_reply.call(text);
                            }
                        },
                    }
                    button {
                        class: "primary-button",
                        disabled: reply_text().trim().is_empty(),
                        onclick: {
                            move |_| {
                                let text = reply_text();
                                if !text.trim().is_empty() {
                                    reply_text.set(String::new());
                                    on_reply.call(text);
                                }
                            }
                        },
                        "Send"
                    }
                }
            }
        }
    }
}

fn format_relative_ms(timestamp_ms: u64) -> String {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let age_secs = now_ms.saturating_sub(timestamp_ms) / 1000;
    match age_secs {
        0..=59 => format!("{}s", age_secs),
        60..=3599 => format!("{}m", age_secs / 60),
        3600..=86399 => format!("{}h", age_secs / 3600),
        _ => format!("{}d", age_secs / 86400),
    }
}
