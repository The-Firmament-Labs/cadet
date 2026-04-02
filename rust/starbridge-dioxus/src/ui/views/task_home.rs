use dioxus::prelude::*;

use crate::ui::models::{TaskItem, TaskStatus};

#[component]
pub fn TaskHomeView(
    tasks: Vec<TaskItem>,
    on_select: EventHandler<String>,
    on_new_task: EventHandler<String>,
) -> Element {
    let mut composer_text = use_signal(String::new);

    let active_tasks: Vec<&TaskItem> = tasks.iter().filter(|t| t.status == TaskStatus::Active).collect();
    let scheduled_tasks: Vec<&TaskItem> = tasks.iter().filter(|t| t.status == TaskStatus::Scheduled).collect();
    let has_tasks = !tasks.is_empty();

    rsx! {
        div { class: "task-view",
            // Scrollable content area
            div { class: "task-view-body",
                if !has_tasks {
                    // Empty state: centered greeting + suggestions
                    div { class: "task-empty",
                        h2 { class: "task-empty-title", "What should we work on?" }
                        p { class: "task-empty-sub", "Describe a task for Voyager to execute." }
                        div { class: "task-empty-suggestions",
                            for s in ["Fix the login bug", "Refactor the auth module", "Write tests for the API", "Deploy to production", "Review open PRs", "Audit dependencies"] {
                                button {
                                    class: "suggestion-chip",
                                    onclick: {
                                        let text = s.to_string();
                                        move |_| composer_text.set(text.clone())
                                    },
                                    "{s}"
                                }
                            }
                        }
                    }
                }

                // Active Tasks
                if !active_tasks.is_empty() {
                    div { class: "task-section",
                        div { class: "task-section-head",
                            p { class: "task-section-title", "Active Tasks" }
                            span { class: "task-section-count", "{active_tasks.len()}" }
                        }
                        for task in active_tasks.iter() {
                            {
                                let task_id = task.id.clone();
                                let title = task.title.clone();
                                let desc = task.description.clone();
                                let agent = task.agent.clone();
                                rsx! {
                                    button {
                                        class: "task-card",
                                        onclick: move |_| on_select.call(task_id.clone()),
                                        div { class: "status-dot status-dot-active" }
                                        div { class: "task-card-body",
                                            p { class: "task-card-title", "{title}" }
                                            if !desc.is_empty() {
                                                p { class: "task-card-meta", "{desc}" }
                                            }
                                        }
                                        span { class: "task-card-agent", "{agent}" }
                                    }
                                }
                            }
                        }
                    }
                }

                // Scheduled Tasks
                if !scheduled_tasks.is_empty() {
                    div { class: "task-section",
                        div { class: "task-section-head",
                            p { class: "task-section-title", "Scheduled" }
                            span { class: "task-section-count", "{scheduled_tasks.len()}" }
                        }
                        for task in scheduled_tasks.iter() {
                            {
                                let task_id = task.id.clone();
                                let title = task.title.clone();
                                let agent = task.agent.clone();
                                let schedule = task.repeat_schedule.clone();
                                rsx! {
                                    button {
                                        class: "task-card",
                                        onclick: move |_| on_select.call(task_id.clone()),
                                        div { class: "status-dot status-dot-scheduled" }
                                        div { class: "task-card-body",
                                            p { class: "task-card-title", "{title}" }
                                            if let Some(sched) = &schedule {
                                                p { class: "task-card-meta", "Repeats: {sched}" }
                                            }
                                        }
                                        span { class: "task-card-agent", "{agent}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Composer (anchored at bottom)
            div { class: "task-composer",
                textarea {
                    class: "task-composer-input",
                    value: composer_text(),
                    placeholder: "Describe what you need done...",
                    oninput: move |e| composer_text.set(e.value()),
                    onkeydown: move |e| {
                        if e.key() == Key::Enter && !e.modifiers().shift() && !composer_text().trim().is_empty() {
                            e.prevent_default();
                            let text = composer_text();
                            composer_text.set(String::new());
                            on_new_task.call(text);
                        }
                    },
                }
                div { class: "task-composer-bar",
                    div { class: "task-composer-left",
                        span { class: "chat-composer-hint", "Enter to dispatch · Shift+Enter for newline" }
                    }
                    button {
                        class: "primary-button",
                        disabled: composer_text().trim().is_empty(),
                        onclick: move |_| {
                            let text = composer_text();
                            if !text.trim().is_empty() {
                                composer_text.set(String::new());
                                on_new_task.call(text);
                            }
                        },
                        "Dispatch"
                    }
                }
            }
        }
    }
}
