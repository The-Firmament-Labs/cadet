//! Per-mode sidebar content components.
//! The global sidebar shell (dark background, brand, footer) lives in mod.rs.
//! These components render the mode-specific content inside it.

use dioxus::prelude::*;

use super::icons::*;
use super::models::{ContentView, TaskItem, TaskStatus};
use super::views::chat_types::{ChatMsg, Conversation, derive_conversations, classify_date, DateGroup};

// ── Chat Sidebar (Cadet mode) ───────────────────────────────────────

#[component]
pub fn ChatSidebarContent(
    messages: Vec<ChatMsg>,
    active_thread: Option<String>,
    on_select_thread: EventHandler<String>,
    on_new_chat: EventHandler<()>,
) -> Element {
    let mut search = use_signal(String::new);
    let q = search().to_lowercase();
    let conversations = derive_conversations(&messages);
    let filtered: Vec<&Conversation> = conversations
        .iter()
        .filter(|c| q.is_empty() || c.title.to_lowercase().contains(&q))
        .collect();

    // Group by date
    let mut today = Vec::new();
    let mut yesterday = Vec::new();
    let mut week = Vec::new();
    let mut older = Vec::new();
    for c in &filtered {
        match classify_date(c.last_message_at) {
            DateGroup::Today => today.push(*c),
            DateGroup::Yesterday => yesterday.push(*c),
            DateGroup::Previous7 => week.push(*c),
            DateGroup::Older => older.push(*c),
        }
    }

    rsx! {
        // New Chat button
        div { class: "sidebar-actions",
            button {
                class: "sidebar-btn sidebar-btn-primary",
                onclick: move |_| on_new_chat.call(()),
                IconPlus { size: 14 }
                "New Chat"
            }
        }

        // Search (only show when there are conversations)
        if !conversations.is_empty() {
            div { class: "sidebar-search-wrap",
                input {
                    class: "sidebar-search",
                    r#type: "text",
                    placeholder: "Search...",
                    value: search(),
                    oninput: move |e| search.set(e.value()),
                }
            }
        }

        // Thread list
        div { class: "sidebar-scroll",
            if filtered.is_empty() && conversations.is_empty() {
                div { class: "sidebar-empty",
                    p { "No conversations yet" }
                }
            }

            if filtered.is_empty() && !conversations.is_empty() {
                div { class: "sidebar-empty",
                    p { "No matches" }
                }
            }

            for (label, group) in [("Today", &today), ("Yesterday", &yesterday), ("Previous 7 Days", &week), ("Older", &older)] {
                if !group.is_empty() {
                    div { class: "sidebar-group",
                        p { class: "sidebar-group-label", "{label}" }
                        for convo in group.iter() {
                            {
                                let tid = convo.thread_id.clone();
                                let is_active = active_thread.as_ref().map(|a| a == &convo.thread_id).unwrap_or(false);
                                let title = if convo.title.is_empty() { "New conversation".to_string() } else { convo.title.clone() };
                                rsx! {
                                    button {
                                        class: if is_active { "sidebar-item sidebar-item-active" } else { "sidebar-item" },
                                        onclick: move |_| on_select_thread.call(tid.clone()),
                                        span { class: "sidebar-item-text", "{title}" }
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

// ── Voyager Sidebar (Code mode) ─────────────────────────────────────

#[component]
pub fn VoyagerSidebarContent(
    tasks: Vec<TaskItem>,
    on_select_task: EventHandler<String>,
    on_new_task: EventHandler<()>,
    current_view: ContentView,
) -> Element {
    let active: Vec<&TaskItem> = tasks.iter().filter(|t| t.status == TaskStatus::Active).collect();
    let scheduled: Vec<&TaskItem> = tasks.iter().filter(|t| t.status == TaskStatus::Scheduled).collect();
    let completed: Vec<&TaskItem> = tasks.iter().filter(|t| t.status == TaskStatus::Complete).collect();

    rsx! {
        div { class: "sidebar-actions",
            button {
                class: "sidebar-btn sidebar-btn-primary",
                onclick: move |_| on_new_task.call(()),
                IconPlus { size: 14 }
                "New Task"
            }
        }

        div { class: "sidebar-scroll",
            // Active tasks
            if !active.is_empty() {
                div { class: "sidebar-group",
                    p { class: "sidebar-group-label", "Active" }
                    for task in active.iter() {
                        {
                            let tid = task.id.clone();
                            let title = task.title.clone();
                            let agent = task.agent.clone();
                            rsx! {
                                button {
                                    class: "sidebar-item",
                                    onclick: move |_| on_select_task.call(tid.clone()),
                                    span { class: "status-dot status-dot-active" }
                                    div { class: "sidebar-item-body",
                                        span { class: "sidebar-item-text", "{title}" }
                                        span { class: "sidebar-item-sub", "{agent}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Scheduled tasks
            if !scheduled.is_empty() {
                div { class: "sidebar-group",
                    p { class: "sidebar-group-label", "Scheduled" }
                    for task in scheduled.iter() {
                        {
                            let tid = task.id.clone();
                            let title = task.title.clone();
                            rsx! {
                                button {
                                    class: "sidebar-item",
                                    onclick: move |_| on_select_task.call(tid.clone()),
                                    span { class: "status-dot status-dot-scheduled" }
                                    span { class: "sidebar-item-text", "{title}" }
                                }
                            }
                        }
                    }
                }
            }

            // Completed (collapsed header)
            if !completed.is_empty() {
                div { class: "sidebar-group",
                    p { class: "sidebar-group-label", "Completed ({completed.len()})" }
                    for task in completed.iter().take(5) {
                        {
                            let tid = task.id.clone();
                            let title = task.title.clone();
                            rsx! {
                                button {
                                    class: "sidebar-item sidebar-item-dim",
                                    onclick: move |_| on_select_task.call(tid.clone()),
                                    span { class: "status-dot status-dot-complete" }
                                    span { class: "sidebar-item-text", "{title}" }
                                }
                            }
                        }
                    }
                }
            }

            // Empty state
            if tasks.is_empty() {
                div { class: "sidebar-empty",
                    p { "No tasks yet" }
                    p { class: "sidebar-empty-hint", "Create a task to get started" }
                }
            }
        }
    }
}

// ── Saturn Sidebar (Ops mode) ───────────────────────────────────────

#[component]
pub fn SaturnSidebarContent(
    active_runs: usize,
    pending_approvals: usize,
    memory_namespaces: usize,
    current_view: ContentView,
    on_navigate: EventHandler<ContentView>,
) -> Element {
    rsx! {
        div { class: "sidebar-scroll",
            div { class: "sidebar-nav-section",
                button {
                    class: if matches!(current_view, ContentView::OpsHome) { "sidebar-nav-btn sidebar-nav-btn-active" } else { "sidebar-nav-btn" },
                    onclick: move |_| on_navigate.call(ContentView::OpsHome),
                    IconPlay { size: 14 }
                    span { class: "sidebar-nav-label", "Overview" }
                }

                button {
                    class: if matches!(current_view, ContentView::RunDetail { .. }) { "sidebar-nav-btn sidebar-nav-btn-active" } else { "sidebar-nav-btn" },
                    onclick: move |_| on_navigate.call(ContentView::OpsHome),
                    IconRocket { size: 14 }
                    span { class: "sidebar-nav-label", "Runs" }
                    if active_runs > 0 {
                        span { class: "sidebar-badge", "{active_runs}" }
                    }
                }

                button {
                    class: if matches!(current_view, ContentView::Approvals) { "sidebar-nav-btn sidebar-nav-btn-active" } else { "sidebar-nav-btn" },
                    onclick: move |_| on_navigate.call(ContentView::Approvals),
                    IconShield { size: 14 }
                    span { class: "sidebar-nav-label", "Approvals" }
                    if pending_approvals > 0 {
                        span { class: "sidebar-badge sidebar-badge-warn", "{pending_approvals}" }
                    }
                }

                button {
                    class: if matches!(current_view, ContentView::Agents) { "sidebar-nav-btn sidebar-nav-btn-active" } else { "sidebar-nav-btn" },
                    onclick: move |_| on_navigate.call(ContentView::Agents),
                    IconUsers { size: 14 }
                    span { class: "sidebar-nav-label", "Agents" }
                }

                button {
                    class: if matches!(current_view, ContentView::Memory) { "sidebar-nav-btn sidebar-nav-btn-active" } else { "sidebar-nav-btn" },
                    onclick: move |_| on_navigate.call(ContentView::Memory),
                    IconBrain { size: 14 }
                    span { class: "sidebar-nav-label", "Memory" }
                    if memory_namespaces > 0 {
                        span { class: "sidebar-badge", "{memory_namespaces}" }
                    }
                }
            }
        }
    }
}
