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

/// Live HUD metrics shown in the LiveAgentHud strip.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HudMetrics {
    pub active_runs: u32,
    pub pending_approvals: u32,
    pub blocked_items: u32,
    /// Per-agent status: (agent_id, current_stage)
    pub agents: Vec<(String, String)>,
}

impl Default for HudMetrics {
    fn default() -> Self {
        Self {
            active_runs: 0,
            pending_approvals: 0,
            blocked_items: 0,
            agents: Vec::new(),
        }
    }
}

/// A recently-dispatched agent job shown in the QuickDispatchPalette history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentDispatch {
    pub agent_id: String,
    pub goal: String,
    pub status: String,
    pub timestamp: String,
}

/// A transient notification toast shown in ToastOverlay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Toast {
    pub id: String,
    /// "success" | "warning" | "danger" | "info"
    pub tone: String,
    pub title: String,
    pub body: String,
    pub timestamp_ms: u64,
    pub dismissed: bool,
}

/// Shared state between the main app and the floating widget.
#[derive(Clone)]
pub struct WidgetBridge {
    /// The text that triggered the widget (from clipboard).
    pub context_text: Arc<Mutex<Option<String>>>,
    /// Chat messages in the widget session.
    pub chat_messages: Arc<Mutex<Vec<ChatMessage>>>,
    /// Action dispatched (agent_id, goal) — main app picks this up.
    pub dispatched_action: Arc<Mutex<Option<(String, String)>>>,
    /// Live HUD metrics for the LiveAgentHud strip.
    pub metrics: Arc<Mutex<HudMetrics>>,
    /// History of recently-dispatched jobs for QuickDispatchPalette.
    pub recent_dispatches: Arc<Mutex<Vec<RecentDispatch>>>,
    /// Active notification toasts for ToastOverlay.
    pub toasts: Arc<Mutex<Vec<Toast>>>,
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
            metrics: Arc::new(Mutex::new(HudMetrics::default())),
            recent_dispatches: Arc::new(Mutex::new(Vec::new())),
            toasts: Arc::new(Mutex::new(Vec::new())),
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

    /// Push a toast notification. `tone` should be "success", "warning", "danger", or "info".
    pub fn push_toast(&self, title: impl Into<String>, body: impl Into<String>, tone: impl Into<String>) {
        use std::time::{SystemTime, UNIX_EPOCH};
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let id = format!("toast-{}", ts);
        self.toasts.lock().unwrap().push(Toast {
            id,
            tone: tone.into(),
            title: title.into(),
            body: body.into(),
            timestamp_ms: ts,
            dismissed: false,
        });
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

    /* ── LiveAgentHud ─────────────────────────────────────────── */

    .hud-strip {
        backdrop-filter: blur(20px) saturate(1.3);
        -webkit-backdrop-filter: blur(20px) saturate(1.3);
        background: rgba(24, 24, 24, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 28px;
        box-shadow:
            0 4px 16px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        padding: 0 14px;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        overflow: hidden;
        cursor: pointer;
        user-select: none;
    }

    .hud-strip:hover {
        background: rgba(32, 32, 32, 0.85);
        border-color: rgba(255, 255, 255, 0.15);
    }

    .hud-row {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .hud-metric {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: "JetBrains Mono", monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.75);
        white-space: nowrap;
    }

    .hud-metric-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #5a8a5a;
        box-shadow: 0 0 4px rgba(90, 138, 90, 0.5);
        flex-shrink: 0;
    }

    .hud-metric-blocked .hud-metric-dot {
        background: #c94a4a;
        box-shadow: 0 0 4px rgba(201, 74, 74, 0.5);
    }

    .hud-agents {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .hud-agent-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 1px 8px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        font-family: "JetBrains Mono", monospace;
        white-space: nowrap;
    }

    /* ── QuickDispatchPalette ─────────────────────────────────── */

    .dispatch-palette {
        backdrop-filter: blur(28px) saturate(1.5);
        -webkit-backdrop-filter: blur(28px) saturate(1.5);
        background: rgba(26, 26, 26, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow:
            0 16px 48px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        height: 100%;
        overflow: hidden;
    }

    .dispatch-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .dispatch-title {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
        font-family: "JetBrains Mono", monospace;
    }

    .dispatch-goal-input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        color: #e8e8e8;
        font: inherit;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
    }

    .dispatch-goal-input:focus {
        border-color: rgba(224, 123, 90, 0.45);
        background: rgba(255, 255, 255, 0.07);
    }

    .dispatch-goal-input::placeholder {
        color: rgba(255, 255, 255, 0.28);
    }

    .dispatch-agents {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .dispatch-agent-label {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
        margin-right: 4px;
    }

    .dispatch-agent-radio {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.65);
        font: inherit;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s;
    }

    .dispatch-agent-radio:hover {
        background: rgba(255, 255, 255, 0.07);
        border-color: rgba(255, 255, 255, 0.14);
    }

    .dispatch-agent-radio.selected {
        background: rgba(224, 123, 90, 0.14);
        border-color: rgba(224, 123, 90, 0.35);
        color: #e07b5a;
    }

    .dispatch-btn {
        padding: 10px 20px;
        border: 1px solid rgba(224, 123, 90, 0.35);
        border-radius: 10px;
        background: rgba(224, 123, 90, 0.18);
        color: #e07b5a;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
        width: 100%;
    }

    .dispatch-btn:hover {
        background: rgba(224, 123, 90, 0.28);
    }

    .dispatch-btn:disabled {
        opacity: 0.38;
        cursor: default;
    }

    .dispatch-recent {
        display: flex;
        flex-direction: column;
        gap: 5px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
    }

    .dispatch-recent-title {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-family: "JetBrains Mono", monospace;
        margin-bottom: 2px;
    }

    .dispatch-recent-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .dispatch-recent-agent {
        font-size: 10px;
        color: rgba(224, 123, 90, 0.75);
        font-family: "JetBrains Mono", monospace;
        flex-shrink: 0;
        min-width: 52px;
    }

    .dispatch-recent-goal {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dispatch-recent-status {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.3);
        font-family: "JetBrains Mono", monospace;
        flex-shrink: 0;
    }

    /* ── ToastOverlay ─────────────────────────────────────────── */

    .toast-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        z-index: 9999;
        pointer-events: none;
    }

    .toast-card {
        backdrop-filter: blur(20px) saturate(1.4);
        -webkit-backdrop-filter: blur(20px) saturate(1.4);
        background: rgba(28, 28, 28, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 12px;
        box-shadow:
            0 6px 24px rgba(0, 0, 0, 0.45),
            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
        padding: 10px 14px;
        min-width: 240px;
        max-width: 320px;
        pointer-events: all;
        cursor: pointer;
        animation: toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .toast-card:hover {
        background: rgba(36, 36, 36, 0.92);
    }

    .toast-title {
        font-size: 12px;
        font-weight: 600;
        color: #e8e8e8;
        margin-bottom: 3px;
    }

    .toast-body {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.45;
    }

    .toast-accent {
        width: 3px;
        border-radius: 2px;
        align-self: stretch;
        flex-shrink: 0;
        margin-right: 10px;
    }

    .toast-inner {
        display: flex;
        align-items: flex-start;
    }

    .toast-content {
        flex: 1;
    }

    /* Tone accent colors */
    .toast-card-success .toast-accent { background: #4caf78; box-shadow: 0 0 6px rgba(76, 175, 120, 0.4); }
    .toast-card-warning .toast-accent { background: #e0a85a; box-shadow: 0 0 6px rgba(224, 168, 90, 0.4); }
    .toast-card-danger  .toast-accent { background: #c94a4a; box-shadow: 0 0 6px rgba(201, 74, 74, 0.4); }
    .toast-card-info    .toast-accent { background: #5a8ae0; box-shadow: 0 0 6px rgba(90, 138, 224, 0.4); }

    .toast-card-success { border-color: rgba(76, 175, 120, 0.18); }
    .toast-card-warning { border-color: rgba(224, 168, 90, 0.18); }
    .toast-card-danger  { border-color: rgba(201, 74, 74, 0.18); }
    .toast-card-info    { border-color: rgba(90, 138, 224, 0.18); }

    @keyframes toast-in {
        from {
            opacity: 0;
            transform: translateX(32px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
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

    // PartialEq for WidgetBridge — identity comparison via Arc pointer equality
    impl PartialEq for WidgetBridge {
        fn eq(&self, other: &Self) -> bool {
            Arc::ptr_eq(&self.context_text, &other.context_text)
        }
    }

    #[derive(Props, Clone, PartialEq)]
    pub struct FloatingWidgetProps {
        pub bridge: WidgetBridge,
        pub config: WidgetConfig,
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

    // ── LiveAgentHud ───────────────────────────────────────────────────

    /// Build the Config for the LiveAgentHud strip window.
    /// 400×56 px, borderless, transparent, always-on-top.
    pub fn widget_window_config_hud() -> Config {
        let mut wb = WindowBuilder::new()
            .with_title("Cadet HUD")
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top(true)
            .with_resizable(false)
            .with_inner_size(LogicalSize::new(400.0, 56.0));

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
    pub struct LiveAgentHudProps {
        pub bridge: WidgetBridge,
    }

    /// A tiny always-on-top strip showing live agent metrics.
    /// Hotkey: Ctrl+Shift+H (registered in the binary).
    /// Click anywhere dispatches "show-dashboard" via WidgetBridge.
    #[component]
    pub fn LiveAgentHud(props: LiveAgentHudProps) -> Element {
        let bridge = props.bridge;

        let metrics = bridge.metrics.lock().unwrap().clone();

        let active = metrics.active_runs;
        let pending = metrics.pending_approvals;
        let blocked = metrics.blocked_items;
        let agents = metrics.agents.clone();

        rsx! {
            style { "{WIDGET_STYLES}" }
            div {
                style: "width: 100%; height: 100%; padding: 4px 6px; box-sizing: border-box;",
                div {
                    class: "hud-strip",
                    onclick: {
                        let bridge = bridge.clone();
                        move |_| {
                            bridge.dispatch("__system__".into(), "show-dashboard".into());
                        }
                    },

                    // Row 1: metric pills
                    div { class: "hud-row",
                        span { class: "hud-metric",
                            span { class: "hud-metric-dot" }
                            "{active} active"
                        }
                        span { class: "hud-metric",
                            "⏳ {pending} approvals"
                        }
                        span { class: "hud-metric hud-metric-blocked",
                            span { class: "hud-metric-dot" }
                            "{blocked} blocked"
                        }
                    }

                    // Row 2: per-agent status pills
                    if !agents.is_empty() {
                        div { class: "hud-agents",
                            for (agent_id, stage) in agents.iter() {
                                span { class: "hud-agent-pill",
                                    "{agent_id}: {stage}"
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── QuickDispatchPalette ───────────────────────────────────────────

    /// Build the Config for the QuickDispatchPalette window.
    /// 500×340 px, borderless, transparent, always-on-top.
    pub fn widget_window_config_dispatch() -> Config {
        let mut wb = WindowBuilder::new()
            .with_title("Cadet Dispatch")
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top(true)
            .with_resizable(false)
            .with_inner_size(LogicalSize::new(500.0, 340.0));

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
    pub struct QuickDispatchPaletteProps {
        pub bridge: WidgetBridge,
        pub config: WidgetConfig,
    }

    /// Spotlight-style floating palette for quick agent dispatch.
    /// Hotkey: Ctrl+Shift+D (registered in the binary).
    /// Enter to dispatch, Escape to hide.
    #[component]
    pub fn QuickDispatchPalette(props: QuickDispatchPaletteProps) -> Element {
        let bridge = props.bridge;
        let config = props.config;
        let desktop = use_window();

        let mut goal_input = use_signal(String::new);
        // Default to the first non-empty agent from config
        let first_agent = config.default_agent.clone();
        let mut selected_agent = use_signal(move || first_agent.clone());

        let recent = bridge.recent_dispatches.lock().unwrap().clone();

        // Build agent list from config (default + research)
        let agents: Vec<String> = {
            let mut v = vec![config.default_agent.clone()];
            if !config.research_agent.is_empty() && config.research_agent != config.default_agent {
                v.push(config.research_agent.clone());
            }
            v
        };

        rsx! {
            style { "{WIDGET_STYLES}" }
            div {
                style: "width: 100%; height: 100%; padding: 8px; box-sizing: border-box;",
                div { class: "dispatch-palette",

                    // Header
                    div { class: "dispatch-header",
                        span { class: "dispatch-title", "Dispatch Agent" }
                        button {
                            class: "widget-close",
                            onclick: {
                                let desktop = desktop.clone();
                                move |_| desktop.set_visible(false)
                            },
                            "✕"
                        }
                    }

                    // Goal input (autofocus via JS trick — we set value focus on mount)
                    input {
                        class: "dispatch-goal-input",
                        r#type: "text",
                        placeholder: "What should the agent do?",
                        autofocus: true,
                        value: goal_input(),
                        oninput: move |e| goal_input.set(e.value()),
                        onkeydown: {
                            let bridge = bridge.clone();
                            let desktop = desktop.clone();
                            move |e: KeyboardEvent| {
                                if e.key() == Key::Enter && !goal_input().trim().is_empty() {
                                    let agent = selected_agent().clone();
                                    let goal = goal_input().trim().to_string();
                                    bridge.dispatch(agent.clone(), goal.clone());
                                    bridge.recent_dispatches.lock().unwrap().insert(0, RecentDispatch {
                                        agent_id: agent,
                                        goal,
                                        status: "queued".into(),
                                        timestamp: "just now".into(),
                                    });
                                    goal_input.set(String::new());
                                    desktop.set_visible(false);
                                } else if e.key() == Key::Escape {
                                    desktop.set_visible(false);
                                }
                            }
                        },
                    }

                    // Agent selector
                    div { class: "dispatch-agents",
                        span { class: "dispatch-agent-label", "Agent:" }
                        for agent_id in agents.iter() {
                            {
                                let agent_id = agent_id.clone();
                                let is_selected = selected_agent() == agent_id;
                                let cls = if is_selected {
                                    "dispatch-agent-radio selected"
                                } else {
                                    "dispatch-agent-radio"
                                };
                                rsx! {
                                    button {
                                        class: "{cls}",
                                        onclick: {
                                            let agent_id = agent_id.clone();
                                            move |_| selected_agent.set(agent_id.clone())
                                        },
                                        "{agent_id}"
                                    }
                                }
                            }
                        }
                    }

                    // Dispatch button
                    button {
                        class: "dispatch-btn",
                        disabled: goal_input().trim().is_empty(),
                        onclick: {
                            let bridge = bridge.clone();
                            let desktop = desktop.clone();
                            move |_| {
                                if !goal_input().trim().is_empty() {
                                    let agent = selected_agent().clone();
                                    let goal = goal_input().trim().to_string();
                                    bridge.dispatch(agent.clone(), goal.clone());
                                    bridge.recent_dispatches.lock().unwrap().insert(0, RecentDispatch {
                                        agent_id: agent,
                                        goal,
                                        status: "queued".into(),
                                        timestamp: "just now".into(),
                                    });
                                    goal_input.set(String::new());
                                    desktop.set_visible(false);
                                }
                            }
                        },
                        "Dispatch  ↵"
                    }

                    // Recent dispatches
                    div { class: "dispatch-recent",
                        div { class: "dispatch-recent-title", "Recent" }
                        if recent.is_empty() {
                            div {
                                style: "font-size: 11px; color: rgba(255,255,255,0.25); text-align: center; padding: 10px 0;",
                                "No recent dispatches"
                            }
                        }
                        for entry in recent.iter().take(5) {
                            div { class: "dispatch-recent-row",
                                span { class: "dispatch-recent-agent", "{entry.agent_id}" }
                                span { class: "dispatch-recent-goal", "{entry.goal}" }
                                span { class: "dispatch-recent-status", "{entry.status}" }
                            }
                        }
                    }
                }
            }
        }
    }

    // ── ToastOverlay ───────────────────────────────────────────────────

    #[derive(Props, Clone, PartialEq)]
    pub struct ToastOverlayProps {
        pub bridge: WidgetBridge,
    }

    /// Overlay component rendered inside the main app window.
    /// Shows glassmorphic toast notifications from WidgetBridge.toasts.
    /// Each toast auto-dismisses after 5 s; click dismisses immediately.
    #[component]
    pub fn ToastOverlay(props: ToastOverlayProps) -> Element {
        let bridge = props.bridge;

        // Snapshot current visible toasts (not dismissed)
        let toasts = {
            let locked = bridge.toasts.lock().unwrap();
            locked.iter().filter(|t| !t.dismissed).cloned().collect::<Vec<_>>()
        };

        if toasts.is_empty() {
            return rsx! { style { "{WIDGET_STYLES}" } };
        }

        rsx! {
            style { "{WIDGET_STYLES}" }
            div { class: "toast-overlay",
                for toast in toasts.iter() {
                    {
                        let toast_id = toast.id.clone();
                        let bridge_dismiss = bridge.clone();
                        let tone_class = format!("toast-card toast-card-{}", toast.tone);
                        let title = toast.title.clone();
                        let body = toast.body.clone();
                        rsx! {
                            div {
                                class: "{tone_class}",
                                onclick: {
                                    let tid = toast_id.clone();
                                    let b = bridge_dismiss.clone();
                                    move |_| {
                                        let mut toasts = b.toasts.lock().unwrap();
                                        if let Some(t) = toasts.iter_mut().find(|t| t.id == tid) {
                                            t.dismissed = true;
                                        }
                                    }
                                },
                                div { class: "toast-inner",
                                    div { class: "toast-accent" }
                                    div { class: "toast-content",
                                        div { class: "toast-title", "{title}" }
                                        div { class: "toast-body", "{body}" }
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
