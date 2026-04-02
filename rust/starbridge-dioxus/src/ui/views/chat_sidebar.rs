use dioxus::prelude::*;
use super::chat_types::{Conversation, DateGroup, classify_date};

#[component]
pub fn ConversationSidebar(
    conversations: Vec<Conversation>,
    active_thread: Option<String>,
    on_select: EventHandler<String>,
    on_new: EventHandler<()>,
) -> Element {
    let mut search = use_signal(String::new);
    let q = search().to_lowercase();
    let filtered: Vec<&Conversation> = conversations
        .iter()
        .filter(|c| q.is_empty() || c.title.to_lowercase().contains(&q))
        .collect();

    // Group by date
    let groups: Vec<(DateGroup, Vec<&&Conversation>)> = {
        let mut today = Vec::new();
        let mut yesterday = Vec::new();
        let mut week = Vec::new();
        let mut older = Vec::new();
        for c in &filtered {
            match classify_date(c.last_message_at) {
                DateGroup::Today => today.push(c),
                DateGroup::Yesterday => yesterday.push(c),
                DateGroup::Previous7 => week.push(c),
                DateGroup::Older => older.push(c),
            }
        }
        let mut groups = Vec::new();
        if !today.is_empty() { groups.push((DateGroup::Today, today)); }
        if !yesterday.is_empty() { groups.push((DateGroup::Yesterday, yesterday)); }
        if !week.is_empty() { groups.push((DateGroup::Previous7, week)); }
        if !older.is_empty() { groups.push((DateGroup::Older, older)); }
        groups
    };

    rsx! {
        div { class: "chat-sidebar",
            div { class: "chat-sidebar-head",
                button {
                    class: "primary-button",
                    style: "width: 100%; margin-bottom: 8px;",
                    onclick: move |_| on_new.call(()),
                    "+ New Chat"
                }
                input {
                    class: "search-input",
                    r#type: "text",
                    placeholder: "Search conversations...",
                    value: search(),
                    oninput: move |e| search.set(e.value()),
                }
            }

            div { class: "chat-sidebar-list",
                if filtered.is_empty() {
                    p { class: "row-copy", style: "padding: 16px; text-align: center;",
                        "No conversations yet"
                    }
                }

                for (group, convos) in groups {
                    div { class: "chat-sidebar-group",
                        p { class: "chat-sidebar-date", "{group.label()}" }
                        for convo in convos {
                            {
                                let tid = convo.thread_id.clone();
                                let is_active = active_thread.as_ref().map(|a| a == &convo.thread_id).unwrap_or(false);
                                rsx! {
                                    button {
                                        class: if is_active { "chat-sidebar-item chat-sidebar-item-active" } else { "chat-sidebar-item" },
                                        onclick: {
                                            let thread_id = tid.clone();
                                            move |_| on_select.call(thread_id.clone())
                                        },
                                        {
                                            let t = if convo.title.is_empty() { "New conversation" } else { &convo.title };
                                            rsx! { span { class: "chat-sidebar-title", "{t}" } }
                                        }
                                        span { class: "chat-sidebar-meta", "{convo.message_count} msgs" }
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
