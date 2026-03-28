//! Floating context widget — system-wide "Send to Cadet" via global hotkey.
//!
//! When Ctrl+Shift+Space is pressed, the widget reads the clipboard, shows a
//! glassmorphic floating panel with the selected text, quick action buttons,
//! and a mini AI chat input. Actions dispatch jobs to Cadet agents.
//!
//! Configuration lives in `.cadet/config.toml`.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

// ── Config ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CadetConfig {
    pub widget: WidgetConfig,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WidgetConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_agent")]
    pub default_agent: String,
    #[serde(default = "default_research_agent")]
    pub research_agent: String,
    #[serde(default = "default_style")]
    pub style: String,
    #[serde(default)]
    pub auto_dismiss_seconds: u32,
    #[serde(default = "default_actions")]
    pub actions: Vec<QuickAction>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QuickAction {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_agent")]
    pub agent: String,
}

fn default_true() -> bool { true }
fn default_agent() -> String { "saturn".to_string() }
fn default_research_agent() -> String { "voyager".to_string() }
fn default_style() -> String { "glass".to_string() }

fn default_actions() -> Vec<QuickAction> {
    vec![
        QuickAction { id: "research".into(), label: "Research".into(), icon: "🔍".into(), description: "Deep dive into this topic".into(), agent: "voyager".into() },
        QuickAction { id: "followup".into(), label: "Follow Up".into(), icon: "💬".into(), description: "Ask a follow-up question".into(), agent: "saturn".into() },
        QuickAction { id: "enhance".into(), label: "Enhance Prompt".into(), icon: "✨".into(), description: "Improve and expand this text".into(), agent: "voyager".into() },
        QuickAction { id: "summarize".into(), label: "Summarize".into(), icon: "📋".into(), description: "Condense into key points".into(), agent: "saturn".into() },
    ]
}

impl CadetConfig {
    /// Load from `.cadet/config.toml` relative to the current directory, or use defaults.
    pub fn load() -> Self {
        Self::load_from(PathBuf::from(".cadet/config.toml"))
    }

    pub fn load_from(path: PathBuf) -> Self {
        #[cfg(feature = "desktop-ui")]
        {
            match std::fs::read_to_string(&path) {
                Ok(content) => toml::from_str(&content).unwrap_or_else(|_| Self::default()),
                Err(_) => Self::default(),
            }
        }
        #[cfg(not(feature = "desktop-ui"))]
        {
            let _ = path;
            Self::default()
        }
    }
}

impl Default for CadetConfig {
    fn default() -> Self {
        Self {
            widget: WidgetConfig {
                enabled: true,
                default_agent: default_agent(),
                research_agent: default_research_agent(),
                style: default_style(),
                auto_dismiss_seconds: 0,
                actions: default_actions(),
            },
        }
    }
}

// ── Shared State ───────────────────────────────────────────────────

/// Shared state between the main app and the floating widget.
#[derive(Clone)]
pub struct WidgetBridge {
    /// The text that triggered the widget (from clipboard).
    pub context_text: Arc<Mutex<Option<String>>>,
    /// Chat messages in the widget session.
    pub chat_messages: Arc<Mutex<Vec<ChatMessage>>>,
    /// Action dispatched (agent_id, goal) — main app picks this up.
    pub dispatched_action: Arc<Mutex<Option<(String, String)>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant"
    pub content: String,
}

impl WidgetBridge {
    pub fn new() -> Self {
        Self {
            context_text: Arc::new(Mutex::new(None)),
            chat_messages: Arc::new(Mutex::new(Vec::new())),
            dispatched_action: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_context(&self, text: String) {
        *self.context_text.lock().unwrap() = Some(text);
        self.chat_messages.lock().unwrap().clear();
    }

    pub fn dispatch(&self, agent_id: String, goal: String) {
        *self.dispatched_action.lock().unwrap() = Some((agent_id, goal));
    }

    pub fn take_dispatch(&self) -> Option<(String, String)> {
        self.dispatched_action.lock().unwrap().take()
    }
}

// ── Widget Styles ──────────────────────────────────────────────────

pub const WIDGET_STYLES: &str = r#"
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        background: transparent;
        font-family: "Inter", "SF Pro Display", -apple-system, sans-serif;
        color: #e8e8e8;
        overflow: hidden;
    }

    .widget-shell {
        padding: 8px;
        height: 100vh;
    }

    .widget-glass {
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        background: rgba(30, 30, 30, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: calc(100vh - 16px);
        overflow: hidden;
    }

    .widget-solid {
        background: #2a2a2a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: calc(100vh - 16px);
        overflow: hidden;
    }

    .widget-minimal {
        background: rgba(20, 20, 20, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: calc(100vh - 16px);
        overflow: hidden;
    }

    .widget-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .widget-brand {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .widget-brand-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e07b5a;
        box-shadow: 0 0 6px rgba(224, 123, 90, 0.5);
    }

    .widget-brand-label {
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
    }

    .widget-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        border-radius: 4px;
    }

    .widget-close:hover {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.7);
    }

    .widget-context {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 12px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.8);
        max-height: 80px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .widget-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .widget-action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        color: #e8e8e8;
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }

    .widget-action-btn:hover {
        background: rgba(224, 123, 90, 0.12);
        border-color: rgba(224, 123, 90, 0.3);
    }

    .widget-action-icon {
        font-size: 14px;
    }

    .widget-action-label {
        font-weight: 500;
    }

    .widget-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.06);
    }

    .widget-chat {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    .widget-chat-messages {
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
    }

    .widget-msg {
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.5;
        max-width: 85%;
        word-break: break-word;
    }

    .widget-msg-user {
        background: rgba(224, 123, 90, 0.15);
        border: 1px solid rgba(224, 123, 90, 0.2);
        align-self: flex-end;
        color: #f0d0c0;
    }

    .widget-msg-assistant {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.06);
        align-self: flex-start;
        color: rgba(255, 255, 255, 0.85);
    }

    .widget-input-row {
        display: flex;
        gap: 6px;
    }

    .widget-input {
        flex: 1;
        padding: 8px 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        color: #e8e8e8;
        font: inherit;
        font-size: 12px;
        outline: none;
    }

    .widget-input:focus {
        border-color: rgba(224, 123, 90, 0.4);
    }

    .widget-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
    }

    .widget-send {
        padding: 8px 14px;
        border: 1px solid rgba(224, 123, 90, 0.3);
        border-radius: 8px;
        background: rgba(224, 123, 90, 0.15);
        color: #e07b5a;
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
    }

    .widget-send:hover {
        background: rgba(224, 123, 90, 0.25);
    }

    .widget-send:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .widget-status {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.35);
        text-align: center;
        font-family: "JetBrains Mono", monospace;
    }
"#;

// ── Dioxus Widget Component ────────────────────────────────────────

#[cfg(feature = "desktop-ui")]
pub mod desktop {
    use super::*;
    use dioxus::prelude::*;
    use dioxus_desktop::{use_window, Config, LogicalSize, WindowBuilder};

    #[cfg(target_os = "macos")]
    use dioxus_desktop::tao::platform::macos::WindowBuilderExtMacOS;

    /// Build the Config for the floating widget window.
    pub fn widget_window_config() -> Config {
        let mut wb = WindowBuilder::new()
            .with_title("Cadet Widget")
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top(true)
            .with_resizable(true)
            .with_inner_size(LogicalSize::new(380.0, 480.0));

        #[cfg(target_os = "macos")]
        {
            wb = wb
                .with_titlebar_hidden(true)
                .with_fullsize_content_view(true)
                .with_has_shadow(false);
        }

        Config::new()
            .with_window(wb)
            .with_background_color((0, 0, 0, 0))
    }

    #[derive(Props, Clone, PartialEq)]
    pub struct FloatingWidgetProps {
        pub bridge: WidgetBridge,
        pub config: WidgetConfig,
    }

    // PartialEq for props
    impl PartialEq for WidgetBridge {
        fn eq(&self, other: &Self) -> bool {
            Arc::ptr_eq(&self.context_text, &other.context_text)
        }
    }

    #[component]
    pub fn FloatingWidget(props: FloatingWidgetProps) -> Element {
        let bridge = props.bridge;
        let config = props.config;
        let desktop = use_window();

        let context_text = bridge.context_text.lock().unwrap().clone().unwrap_or_default();
        let mut chat_input = use_signal(String::new);
        let mut local_messages = use_signal(Vec::<ChatMessage>::new);

        let widget_class = match config.style.as_str() {
            "solid" => "widget-solid",
            "minimal" => "widget-minimal",
            _ => "widget-glass",
        };

        // Truncate context for display
        let display_text = if context_text.len() > 300 {
            format!("{}...", &context_text[..300])
        } else {
            context_text.clone()
        };

        rsx! {
            style { "{WIDGET_STYLES}" }
            div { class: "widget-shell",
                div { class: "{widget_class}",
                    // Header
                    div { class: "widget-header",
                        div { class: "widget-brand",
                            div { class: "widget-brand-dot" }
                            span { class: "widget-brand-label", "CADET" }
                        }
                        button {
                            class: "widget-close",
                            onclick: {
                                let desktop = desktop.clone();
                                move |_| desktop.set_visible(false)
                            },
                            "✕"
                        }
                    }

                    // Context text
                    if !context_text.is_empty() {
                        div { class: "widget-context", "{display_text}" }
                    }

                    // Quick actions
                    div { class: "widget-actions",
                        for action in config.actions.iter() {
                            {
                                let bridge = bridge.clone();
                                let agent = action.agent.clone();
                                let action_label = action.label.clone();
                                let context = context_text.clone();
                                let icon = action.icon.clone();
                                let label = action.label.clone();
                                rsx! {
                                    button {
                                        class: "widget-action-btn",
                                        onclick: move |_| {
                                            let goal = format!("{}: {}", action_label, context);
                                            bridge.dispatch(agent.clone(), goal);
                                            local_messages.write().push(ChatMessage {
                                                role: "user".into(),
                                                content: format!("[{}] Dispatched to agent", action_label),
                                            });
                                            local_messages.write().push(ChatMessage {
                                                role: "assistant".into(),
                                                content: format!("Job dispatched to {}. Check the dashboard for results.", agent),
                                            });
                                        },
                                        span { class: "widget-action-icon", "{icon}" }
                                        span { class: "widget-action-label", "{label}" }
                                    }
                                }
                            }
                        }
                    }

                    div { class: "widget-divider" }

                    // Chat area
                    div { class: "widget-chat",
                        div { class: "widget-chat-messages",
                            for msg in local_messages().iter() {
                                {
                                    let class = if msg.role == "user" {
                                        "widget-msg widget-msg-user"
                                    } else {
                                        "widget-msg widget-msg-assistant"
                                    };
                                    rsx! {
                                        div { class: "{class}", "{msg.content}" }
                                    }
                                }
                            }
                        }

                        div { class: "widget-input-row",
                            input {
                                class: "widget-input",
                                r#type: "text",
                                placeholder: "Ask about this...",
                                value: chat_input(),
                                oninput: move |e| chat_input.set(e.value()),
                                onkeydown: {
                                    let bridge = bridge.clone();
                                    let context = context_text.clone();
                                    let config_agent = config.default_agent.clone();
                                    move |e: KeyboardEvent| {
                                        if e.key() == Key::Enter && !chat_input().trim().is_empty() {
                                            let user_msg = chat_input().trim().to_string();
                                            local_messages.write().push(ChatMessage {
                                                role: "user".into(),
                                                content: user_msg.clone(),
                                            });
                                            let goal = if context.is_empty() {
                                                user_msg.clone()
                                            } else {
                                                format!("{}\n\nContext: {}", user_msg, context)
                                            };
                                            bridge.dispatch(config_agent.clone(), goal);
                                            local_messages.write().push(ChatMessage {
                                                role: "assistant".into(),
                                                content: format!("Dispatched to {}. Check dashboard.", config_agent),
                                            });
                                            chat_input.set(String::new());
                                        } else if e.key() == Key::Escape {
                                            desktop.set_visible(false);
                                        }
                                    }
                                },
                            }
                            button {
                                class: "widget-send",
                                disabled: chat_input().trim().is_empty(),
                                onclick: {
                                    let bridge = bridge.clone();
                                    let context = context_text.clone();
                                    let config_agent = config.default_agent.clone();
                                    move |_| {
                                        if !chat_input().trim().is_empty() {
                                            let user_msg = chat_input().trim().to_string();
                                            local_messages.write().push(ChatMessage {
                                                role: "user".into(),
                                                content: user_msg.clone(),
                                            });
                                            let goal = if context.is_empty() {
                                                user_msg.clone()
                                            } else {
                                                format!("{}\n\nContext: {}", user_msg, context)
                                            };
                                            bridge.dispatch(config_agent.clone(), goal);
                                            local_messages.write().push(ChatMessage {
                                                role: "assistant".into(),
                                                content: format!("Dispatched to {}. Check dashboard.", config_agent),
                                            });
                                            chat_input.set(String::new());
                                        }
                                    }
                                },
                                "Send"
                            }
                        }
                    }

                    // Status bar
                    div { class: "widget-status", "Ctrl+Shift+Space \u{2022} Escape to hide" }
                }
            }
        }
    }
}
