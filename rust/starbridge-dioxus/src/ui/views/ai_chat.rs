use dioxus::prelude::*;
use serde::{Deserialize, Serialize};

use crate::ui::shared::{CalloutBox, EmptyState};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ChatMessage {
    id: String,
    role: String,
    content: String,
    #[serde(default)]
    tools_used: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ChatRequest {
    messages: Vec<ChatRequestMessage>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ChatRequestMessage {
    id: String,
    role: String,
    content: String,
    parts: Vec<ChatPart>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
struct ChatPart {
    r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
}

/// Read the session token from ~/.cadet/session.json
fn read_session_token() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let path = format!("{}/.cadet/session.json", home);
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("token").and_then(|v| v.as_str()).map(|s| s.to_string())
}

/// Send a message to the Cadet AI chat and get the response
async fn send_chat_message(
    messages: Vec<ChatMessage>,
    session_token: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_messages: Vec<ChatRequestMessage> = messages
        .iter()
        .map(|m| ChatRequestMessage {
            id: m.id.clone(),
            role: m.role.clone(),
            content: m.content.clone(),
            parts: vec![ChatPart {
                r#type: "text".to_string(),
                text: Some(m.content.clone()),
            }],
        })
        .collect();

    let body = ChatRequest {
        messages: request_messages,
    };

    let response = client
        .post("http://localhost:3001/api/chat")
        .header("Content-Type", "application/json")
        .header("Cookie", format!("cadet_session={}", session_token))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Chat API returned {}", response.status()));
    }

    // Read the SSE stream and extract text content
    let body_text = response.text().await.map_err(|e| format!("Read failed: {e}"))?;

    // Parse SSE lines — extract text from data lines
    let mut result = String::new();
    for line in body_text.lines() {
        if let Some(data) = line.strip_prefix("d:") {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data.trim()) {
                if json.get("type").and_then(|t| t.as_str()) == Some("text") {
                    if let Some(text) = json.get("value").and_then(|v| v.as_str()) {
                        result.push_str(text);
                    }
                }
            }
        }
    }

    if result.is_empty() {
        // Fallback: try to read as plain text
        result = body_text.lines()
            .filter(|l| !l.starts_with("d:") && !l.starts_with("e:") && !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n");
    }

    Ok(if result.is_empty() { "(No response)".to_string() } else { result })
}

#[component]
pub fn AiChatView() -> Element {
    let mut messages = use_signal(Vec::<ChatMessage>::new);
    let mut input_text = use_signal(String::new);
    let mut is_loading = use_signal(|| false);
    let mut error = use_signal(|| None::<String>);
    let session_token = use_signal(|| read_session_token());

    let has_token = session_token().is_some();

    rsx! {
        div { class: "page-grid page-grid-chat",
            // Main chat area (full width)
            section { class: "panel", style: "grid-column: 1 / -1;",
                // Header
                div { class: "panel-head",
                    p { class: "section-eyebrow", "CADET.AI" }
                    h3 { class: "card-title", "Mission Control Chat" }
                    p { class: "row-copy",
                        if has_token {
                            "Connected to Cadet AI. Type a message to begin."
                        } else {
                            "Not authenticated. Log in from the splash screen first."
                        }
                    }
                }

                if let Some(err) = error() {
                    div { class: "panel-body", style: "padding-bottom: 0;",
                        CalloutBox {
                            tone: "danger".to_string(),
                            title: "Error".to_string(),
                            body: err,
                        }
                    }
                }

                // Messages
                div { class: "chat-body",
                    div { class: "message-stream",
                        if messages().is_empty() && !is_loading() {
                            EmptyState {
                                title: "Start a conversation".to_string(),
                                body: "Ask Cadet anything — fix bugs, deploy code, search memory, manage agents.".to_string(),
                            }
                        }

                        for msg in messages().iter() {
                            div {
                                class: if msg.role == "user" { "message message-outbound" } else { "message message-inbound" },
                                div { class: "message-head",
                                    span { class: "message-actor",
                                        if msg.role == "user" { "You" } else { "Cadet" }
                                    }
                                }
                                div { class: "message-body",
                                    p { "{msg.content}" }
                                }
                                if !msg.tools_used.is_empty() {
                                    div { class: "chip-row", style: "margin-top: 6px;",
                                        for tool in msg.tools_used.iter() {
                                            span { class: "pill pill-subtle", "{tool}" }
                                        }
                                    }
                                }
                            }
                        }

                        if is_loading() {
                            div { class: "message message-inbound",
                                div { class: "message-head",
                                    span { class: "message-actor", "Cadet" }
                                }
                                div { class: "message-body",
                                    p { class: "pulse-text", "Thinking..." }
                                }
                            }
                        }
                    }

                    // Composer
                    div { class: "composer",
                        textarea {
                            class: "composer-input",
                            value: input_text(),
                            disabled: is_loading() || !has_token,
                            oninput: move |event| input_text.set(event.value()),
                            onkeydown: move |event| {
                                if event.key() == Key::Enter && !event.modifiers().shift() {
                                    event.prevent_default();
                                    // Trigger send
                                    let content = input_text();
                                    if content.trim().is_empty() || is_loading() { return; }
                                    if let Some(token) = session_token() {
                                        let msg_id = format!("msg_{}", js_sys_now());
                                        let user_msg = ChatMessage {
                                            id: msg_id,
                                            role: "user".to_string(),
                                            content: content.clone(),
                                            tools_used: vec![],
                                        };
                                        messages.write().push(user_msg);
                                        input_text.set(String::new());
                                        is_loading.set(true);
                                        error.set(None);

                                        let all_messages = messages();
                                        spawn(async move {
                                            match send_chat_message(all_messages, &token).await {
                                                Ok(response) => {
                                                    let assistant_msg = ChatMessage {
                                                        id: format!("msg_{}", js_sys_now()),
                                                        role: "assistant".to_string(),
                                                        content: response,
                                                        tools_used: vec![],
                                                    };
                                                    messages.write().push(assistant_msg);
                                                }
                                                Err(err) => {
                                                    error.set(Some(err));
                                                }
                                            }
                                            is_loading.set(false);
                                        });
                                    }
                                }
                            },
                            placeholder: if has_token {
                                "Ask Cadet anything... (Enter to send, Shift+Enter for newline)"
                            } else {
                                "Log in first to chat with Cadet"
                            }
                        }
                        div { class: "composer-actions",
                            div { class: "chip-row",
                                button {
                                    class: "secondary-button",
                                    onclick: move |_| {
                                        messages.write().clear();
                                        error.set(None);
                                    },
                                    "Clear"
                                }
                                button {
                                    class: "primary-button",
                                    disabled: input_text().trim().is_empty() || is_loading() || !has_token,
                                    onclick: move |_| {
                                        let content = input_text();
                                        if content.trim().is_empty() || is_loading() { return; }
                                        if let Some(token) = session_token() {
                                            let msg_id = format!("msg_{}", js_sys_now());
                                            let user_msg = ChatMessage {
                                                id: msg_id,
                                                role: "user".to_string(),
                                                content: content.clone(),
                                                tools_used: vec![],
                                            };
                                            messages.write().push(user_msg);
                                            input_text.set(String::new());
                                            is_loading.set(true);
                                            error.set(None);

                                            let all_messages = messages();
                                            spawn(async move {
                                                match send_chat_message(all_messages, &token).await {
                                                    Ok(response) => {
                                                        let assistant_msg = ChatMessage {
                                                            id: format!("msg_{}", js_sys_now()),
                                                            role: "assistant".to_string(),
                                                            content: response,
                                                            tools_used: vec![],
                                                        };
                                                        messages.write().push(assistant_msg);
                                                    }
                                                    Err(err) => {
                                                        error.set(Some(err));
                                                    }
                                                }
                                                is_loading.set(false);
                                            });
                                        }
                                    },
                                    if is_loading() { "Sending..." } else { "Send" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn js_sys_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
