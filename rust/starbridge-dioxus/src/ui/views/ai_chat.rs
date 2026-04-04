use std::collections::HashMap;
use dioxus::prelude::*;

use crate::web_client::{WebClient, ChatMessage, ChatPart};
use crate::ui::shared::FeedbackButtons;

use super::chat_types::{
    ChatMsg, MessageRole, ToolCallStatus,
    new_message_id, new_thread_id, from_spacetimedb_messages,
};
use starbridge_core::MissionControlSnapshot;

fn load_web_client() -> Option<WebClient> {
    WebClient::from_session().ok()
}

/// Single-column chat view. Merges local messages with SpacetimeDB
/// message events from all platforms (Slack, Discord, Telegram, GitHub, web).
/// Thread switching is handled by the global sidebar's ChatSidebarContent.
#[component]
pub fn AiChatView(snapshot: MissionControlSnapshot) -> Element {
    let mut local_messages = use_signal(Vec::<ChatMsg>::new);
    let active_thread = use_signal(|| Some(new_thread_id()));
    let mut input_text = use_signal(String::new);
    let mut is_streaming = use_signal(|| false);
    let mut error = use_signal(|| None::<String>);
    let web_client = use_signal(load_web_client);
    let mut feedback_state = use_signal(HashMap::<String, bool>::new);

    let has_client = web_client().is_some();

    // Merge local messages with SpacetimeDB messages from all channels
    let stdb_messages = from_spacetimedb_messages(&snapshot.message_events);
    let mut all_messages = local_messages();
    all_messages.extend(stdb_messages);
    all_messages.sort_by_key(|m| m.timestamp_ms);
    all_messages.dedup_by(|a, b| a.id == b.id);

    let current_thread = active_thread();

    let thread_messages: Vec<ChatMsg> = current_thread
        .as_ref()
        .map(|tid| all_messages.iter().filter(|m| &m.thread_id == tid).cloned().collect())
        .unwrap_or_default();

    rsx! {
        div { class: "chat-view",
            // Messages area
            div { class: "chat-messages",
                if thread_messages.is_empty() && !is_streaming() {
                    div { class: "chat-empty",
                        p { class: "chat-empty-title", "Start a conversation" }
                        p { class: "chat-empty-sub", "Ask Cadet to fix bugs, deploy code, search memory, manage agents." }
                        div { class: "chat-suggestions",
                            for s in ["Fix the login bug", "Deploy to production", "Summarize today's runs", "Search memory for auth"] {
                                button {
                                    class: "chat-suggestion",
                                    onclick: {
                                        let text = s.to_string();
                                        move |_| input_text.set(text.clone())
                                    },
                                    "{s}"
                                }
                            }
                        }
                    }
                }

                for msg in thread_messages.iter() {
                    {
                        let actor_name = if msg.role == MessageRole::User {
                            if msg.actor.is_empty() || msg.actor == "operator" { "You".to_string() } else { msg.actor.clone() }
                        } else if msg.actor.is_empty() {
                            "Cadet".to_string()
                        } else {
                            msg.actor.clone()
                        };
                        let show_channel = msg.channel != "web" && !msg.channel.is_empty();
                        let channel_badge_class = format!("chat-channel-badge channel-{}", msg.channel);
                        let show_user_id = !msg.user_id.is_empty() && msg.user_id != "operator" && msg.user_id != "cadet";
                        rsx! {
                    div {
                        class: if msg.role == MessageRole::User { "chat-msg chat-msg-user" } else { "chat-msg chat-msg-assistant" },
                        div { class: "chat-msg-head",
                            span { class: "chat-actor", "{actor_name}" }
                            if show_channel {
                                span { class: "{channel_badge_class}", "{msg.channel}" }
                            }
                            if show_user_id {
                                span { class: "chat-user-id", "{msg.user_id}" }
                            }
                        }
                        div { class: "chat-msg-body",
                            for line in msg.content.lines() {
                                if line.is_empty() {
                                    br {}
                                } else {
                                    p { class: "chat-text", "{line}" }
                                }
                            }
                        }
                        // Tool calls
                        for tc in msg.tool_calls.iter() {
                            div { class: "chat-tool-card",
                                span { class: "pill", "{tc.tool_name}" }
                                span {
                                    class: match tc.status {
                                        ToolCallStatus::Running => "pill pill-live",
                                        ToolCallStatus::Complete => "pill pill-success",
                                        ToolCallStatus::Error => "pill pill-danger",
                                    },
                                    match tc.status {
                                        ToolCallStatus::Running => "running",
                                        ToolCallStatus::Complete => "done",
                                        ToolCallStatus::Error => "error",
                                    }
                                }
                                if !tc.output_summary.is_empty() {
                                    p { class: "chat-tool-output", "{tc.output_summary}" }
                                }
                            }
                        }
                        // Feedback buttons on assistant messages
                        if msg.role == MessageRole::Assistant {
                            FeedbackButtons {
                                message_id: msg.id.clone(),
                                current_feedback: feedback_state().get(&msg.id).copied(),
                                on_feedback: move |(msg_id, is_positive): (String, bool)| {
                                    feedback_state.write().insert(msg_id.clone(), is_positive);
                                    if let Some(client) = web_client() {
                                        let mid = msg_id.clone();
                                        spawn(async move {
                                            let _ = client.submit_feedback(&mid, is_positive).await;
                                        });
                                    }
                                },
                            }
                        }
                    } // close rsx! div for this message
                        } // close rsx! macro
                    } // close block
                } // close for loop

                if is_streaming() {
                    div { class: "chat-msg chat-msg-assistant",
                        div { class: "chat-msg-head",
                            span { class: "chat-msg-actor", "Cadet" }
                        }
                        div { class: "chat-msg-body",
                            span { class: "pulse-text", "Thinking..." }
                        }
                    }
                }
            }

            // Error banner
            if let Some(err) = error() {
                div { class: "chat-error",
                    p { class: "chat-error-text", "{err}" }
                    button {
                        class: "chat-error-dismiss",
                        onclick: move |_| error.set(None),
                        "Dismiss"
                    }
                }
            }

            // Composer (anchored at bottom)
            div { class: "chat-composer",
                textarea {
                    class: "chat-composer-input",
                    value: input_text(),
                    disabled: is_streaming() || !has_client,
                    placeholder: if has_client { "Message Cadet... (Enter to send)" } else { "Sign in to chat" },
                    oninput: move |e| input_text.set(e.value()),
                    onkeydown: move |e| {
                        if e.key() == Key::Enter && !e.modifiers().shift() {
                            e.prevent_default();
                            do_send(&web_client, &mut local_messages, &active_thread, &mut input_text, &mut is_streaming, &mut error);
                        }
                    },
                }
                div { class: "chat-composer-bar",
                    div { class: "chat-composer-left",
                        span { class: "chat-composer-hint", "Enter to send · Shift+Enter for newline" }
                    }
                    button {
                        class: "primary-button",
                        disabled: input_text().trim().is_empty() || is_streaming() || !has_client,
                        onclick: move |_| {
                            do_send(&web_client, &mut local_messages, &active_thread, &mut input_text, &mut is_streaming, &mut error);
                        },
                        if is_streaming() { "Sending..." } else { "Send" }
                    }
                }
            }
        }
    }
}

fn do_send(
    web_client: &Signal<Option<WebClient>>,
    messages: &mut Signal<Vec<ChatMsg>>,
    active_thread: &Signal<Option<String>>,
    input_text: &mut Signal<String>,
    is_streaming: &mut Signal<bool>,
    error: &mut Signal<Option<String>>,
) {
    let content = input_text();
    if content.trim().is_empty() { return; }
    let Some(client) = web_client() else { return; };
    let thread_id = active_thread().unwrap_or_else(new_thread_id);

    let user_msg = ChatMsg {
        id: new_message_id(),
        thread_id: thread_id.clone(),
        role: MessageRole::User,
        content: content.clone(),
        tool_calls: Vec::new(),
        timestamp_ms: now_ms(),
        channel: "web".to_string(),
        user_id: "operator".to_string(),
        actor: String::new(),
    };
    messages.write().push(user_msg);
    input_text.set(String::new());
    is_streaming.set(true);
    error.set(None);

    let all = messages();
    let request_msgs: Vec<ChatMessage> = all
        .iter()
        .filter(|m| m.thread_id == thread_id)
        .map(|m| ChatMessage {
            id: m.id.clone(),
            role: match m.role { MessageRole::User => "user", MessageRole::Assistant => "assistant", MessageRole::System => "system" }.to_string(),
            content: m.content.clone(),
            parts: vec![ChatPart { r#type: "text".to_string(), text: Some(m.content.clone()) }],
        })
        .collect();

    let mut messages = messages.clone();
    let mut is_streaming = is_streaming.clone();
    let mut error = error.clone();

    spawn(async move {
        match client.chat(request_msgs).await {
            Ok(text) => {
                messages.write().push(ChatMsg {
                    id: new_message_id(),
                    thread_id,
                    role: MessageRole::Assistant,
                    content: text,
                    tool_calls: Vec::new(),
                    timestamp_ms: now_ms(),
                    channel: "web".to_string(),
                    user_id: "cadet".to_string(),
                    actor: "Cadet".to_string(),
                });
            }
            Err(e) => error.set(Some(format!("{e}"))),
        }
        is_streaming.set(false);
    });
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
