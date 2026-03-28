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
    /// Per-widget visibility toggles keyed by widget id.
    pub widget_toggles: Arc<Mutex<std::collections::HashMap<String, bool>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "user" | "assistant"
    pub content: String,
}

impl WidgetBridge {
    pub fn new() -> Self {
        let mut default_toggles = std::collections::HashMap::new();
        for id in &["context-chat", "agent-hud", "quick-dispatch", "clipboard", "mascot"] {
            default_toggles.insert(id.to_string(), false);
        }
        Self {
            context_text: Arc::new(Mutex::new(None)),
            chat_messages: Arc::new(Mutex::new(Vec::new())),
            dispatched_action: Arc::new(Mutex::new(None)),
            metrics: Arc::new(Mutex::new(HudMetrics::default())),
            recent_dispatches: Arc::new(Mutex::new(Vec::new())),
            toasts: Arc::new(Mutex::new(Vec::new())),
            widget_toggles: Arc::new(Mutex::new(default_toggles)),
        }
    }

    /// Get the visibility state of a widget by id.
    pub fn widget_visible(&self, id: &str) -> bool {
        self.widget_toggles.lock().unwrap().get(id).copied().unwrap_or(false)
    }

    /// Set the visibility state of a widget by id.
    pub fn set_widget_visible(&self, id: &str, visible: bool) {
        let mut toggles = self.widget_toggles.lock().unwrap();
        toggles.insert(id.to_string(), visible);
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
        backdrop-filter: blur(40px) saturate(180%);
        -webkit-backdrop-filter: blur(40px) saturate(180%);
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 20px;
        box-shadow:
            0 8px 32px rgba(31, 38, 135, 0.2),
            inset 0 2px 16px rgba(255, 255, 255, 0.15),
            inset 0 -1px 4px rgba(0, 0, 0, 0.1);
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

    .widget-drag-handle {
        cursor: grab;
        flex: 1;
        min-height: 24px;
        -webkit-app-region: drag;
    }

    .widget-drag-handle:active {
        cursor: grabbing;
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
        cursor: grab;
        user-select: none;
        -webkit-app-region: drag;
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

    /* ── CommandCenter ───────────────────────────────────────────── */

    .command-center {
        backdrop-filter: blur(28px) saturate(1.5);
        -webkit-backdrop-filter: blur(28px) saturate(1.5);
        background: rgba(22, 22, 22, 0.90);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 18px;
        box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: calc(100vh - 16px);
        overflow: hidden;
    }

    .cc-tabs {
        display: flex;
        gap: 4px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 3px;
    }

    .cc-tab {
        flex: 1;
        padding: 6px 10px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: rgba(255, 255, 255, 0.45);
        font: inherit;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        letter-spacing: 0.03em;
    }

    .cc-tab:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.7);
    }

    .cc-tab-active {
        background: rgba(224, 123, 90, 0.18);
        color: #e07b5a;
        border: 1px solid rgba(224, 123, 90, 0.25);
    }

    .cc-tab-active:hover {
        background: rgba(224, 123, 90, 0.24);
        color: #e07b5a;
    }

    .cc-section-title {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.35);
        font-family: "JetBrains Mono", monospace;
        margin-bottom: 4px;
    }

    .cc-widget-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        overflow-y: auto;
    }

    .cc-widget-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        transition: background 0.12s;
    }

    .cc-widget-row:hover {
        background: rgba(255, 255, 255, 0.06);
    }

    .cc-widget-icon {
        font-size: 16px;
        width: 22px;
        text-align: center;
        flex-shrink: 0;
    }

    .cc-widget-name {
        flex: 1;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.80);
        font-weight: 500;
    }

    .cc-widget-hotkey {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.30);
        font-family: "JetBrains Mono", monospace;
        flex-shrink: 0;
    }

    .cc-toggle {
        position: relative;
        width: 32px;
        height: 18px;
        border-radius: 9px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.10);
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.2s, border-color 0.2s;
        display: flex;
        align-items: center;
        padding: 2px;
    }

    .cc-toggle::after {
        content: "";
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.45);
        transition: transform 0.2s, background 0.2s;
    }

    .cc-toggle-active {
        background: rgba(224, 123, 90, 0.35);
        border-color: rgba(224, 123, 90, 0.45);
    }

    .cc-toggle-active::after {
        transform: translateX(14px);
        background: #e07b5a;
    }

    .cc-provider-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        overflow-y: auto;
    }

    .cc-provider-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
    }

    .cc-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .cc-status-dot-discovered {
        background: #4caf78;
        box-shadow: 0 0 5px rgba(76, 175, 120, 0.45);
    }

    .cc-status-dot-configured {
        background: #e0a85a;
        box-shadow: 0 0 5px rgba(224, 168, 90, 0.45);
    }

    .cc-status-dot-missing {
        background: rgba(255, 255, 255, 0.18);
    }

    .cc-provider-name {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.80);
        font-weight: 500;
        min-width: 110px;
        flex-shrink: 0;
    }

    .cc-provider-source {
        flex: 1;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        font-family: "JetBrains Mono", monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .cc-add-btn {
        padding: 4px 10px;
        border: 1px solid rgba(224, 123, 90, 0.3);
        border-radius: 6px;
        background: rgba(224, 123, 90, 0.10);
        color: #e07b5a;
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .cc-add-btn:hover {
        background: rgba(224, 123, 90, 0.20);
    }

    .cc-key-input {
        flex: 1;
        padding: 5px 10px;
        border: 1px solid rgba(224, 123, 90, 0.35);
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        color: #e8e8e8;
        font: inherit;
        font-size: 11px;
        font-family: "JetBrains Mono", monospace;
        outline: none;
    }

    .cc-key-input:focus {
        border-color: rgba(224, 123, 90, 0.55);
        background: rgba(255, 255, 255, 0.07);
    }

    .cc-key-input::placeholder {
        color: rgba(255, 255, 255, 0.25);
    }

    .cc-config-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
    }

    .cc-config-label {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.65);
    }

    .cc-config-value {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.45);
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
                    // Header — drag handle covers the brand area
                    div { class: "widget-header",
                        div {
                            class: "widget-drag-handle",
                            onmousedown: {
                                let d = desktop.clone();
                                move |_| { d.drag(); }
                            },
                            div { class: "widget-brand",
                                div { class: "widget-brand-dot" }
                                span { class: "widget-brand-label", "CADET" }
                            }
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
        let desktop = use_window();

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
                    onmousedown: {
                        let d = desktop.clone();
                        move |_| { d.drag(); }
                    },
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

                    // Header — draggable
                    div { class: "dispatch-header",
                        div {
                            class: "widget-drag-handle",
                            onmousedown: {
                                let d = desktop.clone();
                                move |_| { d.drag(); }
                            },
                            span { class: "dispatch-title", "Dispatch Agent" }
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

    // ── CommandCenter ─────────────────────────────────────────────────

    /// Build the Config for the Command Center window (centered, larger).
    pub fn widget_window_config_command_center() -> Config {
        let mut wb = WindowBuilder::new()
            .with_title("Cadet Command Center")
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top(true)
            .with_resizable(true)
            .with_inner_size(LogicalSize::new(520.0, 640.0));

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
    pub struct CommandCenterProps {
        pub bridge: WidgetBridge,
        pub config: WidgetConfig,
        pub auth: crate::auth_provider::AuthProviderRegistry,
    }

    /// The unified Command Center — replaces auto-spawn widget behavior.
    /// Three tabs: Widgets, Providers, Config.
    /// Hotkey: Ctrl+Shift+Space (registered in the binary).
    #[component]
    pub fn CommandCenter(props: CommandCenterProps) -> Element {
        let bridge = props.bridge;
        let config = props.config;
        let desktop = use_window();

        // Tab state: 0 = Widgets, 1 = Providers, 2 = Config
        let mut active_tab = use_signal(|| 0usize);

        // Widget definitions: (id, icon, name, hotkey)
        let widget_defs: &[(&str, &str, &str, &str)] = &[
            ("context-chat",  "🔍", "Context Chat",    "Ctrl+Shift+Space"),
            ("agent-hud",     "📊", "Agent HUD",       "Ctrl+Shift+H"),
            ("quick-dispatch","⚡", "Quick Dispatch",   "Ctrl+Shift+D"),
            ("clipboard",     "📋", "Clipboard",        "Ctrl+Shift+V"),
            ("mascot",        "🤖", "3D Mascot",        "Ctrl+Shift+M"),
        ];

        // Auth providers snapshot (clone so we can mutate later via set_manual)
        let mut auth_reg = use_signal(|| props.auth.clone());

        // Per-provider "add key" input open state and value
        let mut adding_provider = use_signal(|| None::<String>);
        let mut key_input = use_signal(String::new);

        // Widget toggle states (read from bridge)
        let mut toggle_version = use_signal(|| 0u32);

        let tab_btn = |idx: usize, label: &str| {
            let current = active_tab();
            let cls = if current == idx { "cc-tab cc-tab-active" } else { "cc-tab" };
            rsx! {
                button {
                    class: "{cls}",
                    onclick: move |_| active_tab.set(idx),
                    "{label}"
                }
            }
        };

        rsx! {
            style { "{WIDGET_STYLES}" }
            div {
                style: "padding: 8px; height: 100vh; box-sizing: border-box;",
                div { class: "command-center",

                    // Header row — draggable
                    div {
                        style: "display:flex; align-items:center; justify-content:space-between;",
                        div {
                            class: "widget-drag-handle",
                            onmousedown: {
                                let d = desktop.clone();
                                move |_| { d.drag(); }
                            },
                            div { class: "widget-brand",
                                div { class: "widget-brand-dot" }
                                span { class: "widget-brand-label", "CADET COMMAND CENTER" }
                            }
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

                    // Tab bar
                    div { class: "cc-tabs",
                        {tab_btn(0, "Widgets")}
                        {tab_btn(1, "Providers")}
                        {tab_btn(2, "Config")}
                    }

                    // ── Widgets Tab ─────────────────────────────────────
                    if active_tab() == 0 {
                        div {
                            style: "display:flex; flex-direction:column; gap:8px; flex:1; min-height:0;",
                            div { class: "cc-section-title", "WIDGETS" }
                            div { class: "cc-widget-list",
                                for (id, icon, name, hotkey) in widget_defs.iter() {
                                    {
                                        let widget_id = id.to_string();
                                        let bridge_ref = bridge.clone();
                                        // Force re-read on toggle_version change
                                        let _ = toggle_version();
                                        let is_on = bridge_ref.widget_visible(&widget_id);
                                        let toggle_cls = if is_on { "cc-toggle cc-toggle-active" } else { "cc-toggle" };
                                        rsx! {
                                            div { class: "cc-widget-row",
                                                span { class: "cc-widget-icon", "{icon}" }
                                                span { class: "cc-widget-name", "{name}" }
                                                span { class: "cc-widget-hotkey", "{hotkey}" }
                                                div {
                                                    class: "{toggle_cls}",
                                                    onclick: {
                                                        let id = widget_id.clone();
                                                        let b = bridge_ref.clone();
                                                        move |_| {
                                                            let current = b.widget_visible(&id);
                                                            b.set_widget_visible(&id, !current);
                                                            // Signal a UI refresh
                                                            toggle_version.set(toggle_version() + 1);
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

                    // ── Providers Tab ───────────────────────────────────
                    if active_tab() == 1 {
                        div {
                            style: "display:flex; flex-direction:column; gap:8px; flex:1; min-height:0;",
                            div { class: "cc-section-title", "AUTH PROVIDERS" }
                            div { class: "cc-provider-list",
                                for provider in auth_reg().providers.iter() {
                                    {
                                        use crate::auth_provider::ProviderStatus;
                                        let pid = provider.provider_id.clone();
                                        let name = provider.display_name.clone();
                                        let source = if provider.source.is_empty() {
                                            "Not found".to_string()
                                        } else {
                                            provider.source.clone()
                                        };
                                        let dot_cls = match provider.status {
                                            ProviderStatus::Discovered => "cc-status-dot cc-status-dot-discovered",
                                            ProviderStatus::Configured => "cc-status-dot cc-status-dot-configured",
                                            ProviderStatus::Missing    => "cc-status-dot cc-status-dot-missing",
                                        };
                                        let is_missing = provider.status == ProviderStatus::Missing;
                                        let is_adding = adding_provider().as_deref() == Some(&pid);

                                        rsx! {
                                            div { class: "cc-provider-row",
                                                div { class: "{dot_cls}" }
                                                span { class: "cc-provider-name", "{name}" }

                                                if is_adding {
                                                    input {
                                                        class: "cc-key-input",
                                                        r#type: "password",
                                                        placeholder: "Paste API key...",
                                                        autofocus: true,
                                                        value: key_input(),
                                                        oninput: move |e| key_input.set(e.value()),
                                                        onkeydown: {
                                                            let pid2 = pid.clone();
                                                            move |e: KeyboardEvent| {
                                                                if e.key() == Key::Enter {
                                                                    let key = key_input().trim().to_string();
                                                                    if !key.is_empty() {
                                                                        auth_reg.write().set_manual(&pid2, key);
                                                                    }
                                                                    adding_provider.set(None);
                                                                    key_input.set(String::new());
                                                                } else if e.key() == Key::Escape {
                                                                    adding_provider.set(None);
                                                                    key_input.set(String::new());
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    span { class: "cc-provider-source", "{source}" }
                                                    if is_missing {
                                                        button {
                                                            class: "cc-add-btn",
                                                            onclick: {
                                                                let pid3 = pid.clone();
                                                                move |_| {
                                                                    adding_provider.set(Some(pid3.clone()));
                                                                    key_input.set(String::new());
                                                                }
                                                            },
                                                            "Add Key"
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

                    // ── Config Tab ──────────────────────────────────────
                    if active_tab() == 2 {
                        div {
                            style: "display:flex; flex-direction:column; gap:8px; flex:1; min-height:0;",
                            div { class: "cc-section-title", "CONFIGURATION" }
                            div { class: "cc-config-row",
                                span { class: "cc-config-label", "Default Agent" }
                                span { class: "cc-config-value", "{config.default_agent}" }
                            }
                            div { class: "cc-config-row",
                                span { class: "cc-config-label", "Research Agent" }
                                span { class: "cc-config-value", "{config.research_agent}" }
                            }
                            div { class: "cc-config-row",
                                span { class: "cc-config-label", "Widget Style" }
                                span { class: "cc-config-value", "{config.style}" }
                            }
                            div { class: "cc-config-row",
                                span { class: "cc-config-label", "Auto Dismiss" }
                                span { class: "cc-config-value",
                                    if config.auto_dismiss_seconds == 0 {
                                        "Off"
                                    } else {
                                        "{config.auto_dismiss_seconds}s"
                                    }
                                }
                            }
                            div { class: "cc-config-row",
                                span { class: "cc-config-label", "Quick Actions" }
                                span { class: "cc-config-value", "{config.actions.len()} configured" }
                            }
                            div {
                                style: "margin-top: 8px; font-size:11px; color:rgba(255,255,255,0.25); text-align:center;",
                                "Edit .cadet/config.toml to change settings"
                            }
                        }
                    }

                    // Footer status
                    div { class: "widget-status", "Ctrl+Shift+Space \u{2022} Escape to hide" }
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

#[cfg(test)]
mod tests {
    use super::*;

    // ── CadetConfig ─────────────────────────────────────────────────

    #[test]
    fn cadet_config_default_widget_enabled() {
        let cfg = CadetConfig::default();
        assert!(cfg.widget.enabled);
    }

    #[test]
    fn cadet_config_default_has_four_actions() {
        let cfg = CadetConfig::default();
        assert_eq!(cfg.widget.actions.len(), 4);
    }

    #[test]
    fn cadet_config_default_action_ids() {
        let cfg = CadetConfig::default();
        let ids: Vec<&str> = cfg.widget.actions.iter().map(|a| a.id.as_str()).collect();
        assert!(ids.contains(&"research"));
        assert!(ids.contains(&"followup"));
        assert!(ids.contains(&"enhance"));
        assert!(ids.contains(&"summarize"));
    }

    #[test]
    fn cadet_config_default_agents() {
        let cfg = CadetConfig::default();
        assert_eq!(cfg.widget.default_agent, "saturn");
        assert_eq!(cfg.widget.research_agent, "voyager");
    }

    #[test]
    fn cadet_config_default_style() {
        let cfg = CadetConfig::default();
        assert_eq!(cfg.widget.style, "glass");
    }

    #[test]
    fn cadet_config_load_from_nonexistent_returns_default() {
        use std::path::PathBuf;
        let cfg = CadetConfig::load_from(PathBuf::from("/nonexistent/path/config.toml"));
        // Should silently fall back to default values.
        assert!(cfg.widget.enabled);
        assert_eq!(cfg.widget.default_agent, "saturn");
        assert_eq!(cfg.widget.actions.len(), 4);
    }

    #[cfg(feature = "desktop-ui")]
    #[test]
    fn cadet_config_deserialize_toml_custom_values() {
        let toml_str = r#"
[widget]
enabled = false
default_agent = "atlas"
research_agent = "titan"
style = "solid"
auto_dismiss_seconds = 10
"#;
        let cfg: CadetConfig = toml::from_str(toml_str).expect("valid toml");
        assert!(!cfg.widget.enabled);
        assert_eq!(cfg.widget.default_agent, "atlas");
        assert_eq!(cfg.widget.research_agent, "titan");
        assert_eq!(cfg.widget.style, "solid");
        assert_eq!(cfg.widget.auto_dismiss_seconds, 10);
    }

    // ── WidgetBridge ────────────────────────────────────────────────

    #[test]
    fn widget_bridge_new_fields_empty() {
        let bridge = WidgetBridge::new();
        assert!(bridge.context_text.lock().unwrap().is_none());
        assert!(bridge.chat_messages.lock().unwrap().is_empty());
        assert!(bridge.dispatched_action.lock().unwrap().is_none());
        assert!(bridge.recent_dispatches.lock().unwrap().is_empty());
        assert!(bridge.toasts.lock().unwrap().is_empty());
    }

    #[test]
    fn widget_bridge_set_context_stores_text() {
        let bridge = WidgetBridge::new();
        bridge.set_context("hello".to_string());
        let ctx = bridge.context_text.lock().unwrap();
        assert_eq!(ctx.as_deref(), Some("hello"));
    }

    #[test]
    fn widget_bridge_set_context_clears_chat_messages() {
        let bridge = WidgetBridge::new();
        bridge.chat_messages.lock().unwrap().push(ChatMessage {
            role: "user".to_string(),
            content: "old message".to_string(),
        });
        bridge.set_context("new context".to_string());
        assert!(bridge.chat_messages.lock().unwrap().is_empty());
    }

    #[test]
    fn widget_bridge_dispatch_stores_action() {
        let bridge = WidgetBridge::new();
        bridge.dispatch("saturn".to_string(), "solve the world".to_string());
        let action = bridge.dispatched_action.lock().unwrap();
        assert_eq!(action.as_ref().map(|(a, _)| a.as_str()), Some("saturn"));
        assert_eq!(action.as_ref().map(|(_, g)| g.as_str()), Some("solve the world"));
    }

    #[test]
    fn widget_bridge_take_dispatch_returns_and_clears() {
        let bridge = WidgetBridge::new();
        bridge.dispatch("voyager".to_string(), "research goal".to_string());
        let taken = bridge.take_dispatch();
        assert_eq!(taken, Some(("voyager".to_string(), "research goal".to_string())));
        // Second take should be None
        assert!(bridge.take_dispatch().is_none());
    }

    #[test]
    fn widget_bridge_take_dispatch_empty_returns_none() {
        let bridge = WidgetBridge::new();
        assert!(bridge.take_dispatch().is_none());
    }

    #[test]
    fn widget_bridge_push_toast_adds_entry() {
        let bridge = WidgetBridge::new();
        bridge.push_toast("Title", "Body text", "success");
        let toasts = bridge.toasts.lock().unwrap();
        assert_eq!(toasts.len(), 1);
    }

    #[test]
    fn widget_bridge_push_toast_multiple_accumulate() {
        let bridge = WidgetBridge::new();
        bridge.push_toast("Alert 1", "Body 1", "info");
        bridge.push_toast("Alert 2", "Body 2", "warning");
        bridge.push_toast("Alert 3", "Body 3", "danger");
        let toasts = bridge.toasts.lock().unwrap();
        assert_eq!(toasts.len(), 3);
    }

    #[test]
    fn widget_bridge_push_toast_fields_correct() {
        let bridge = WidgetBridge::new();
        bridge.push_toast("My Title", "My Body", "success");
        let toasts = bridge.toasts.lock().unwrap();
        let t = &toasts[0];
        assert!(!t.id.is_empty(), "toast id should not be empty");
        assert_eq!(t.tone, "success");
        assert_eq!(t.title, "My Title");
        assert_eq!(t.body, "My Body");
        assert!(!t.dismissed);
    }

    // ── HudMetrics ──────────────────────────────────────────────────

    #[test]
    fn hud_metrics_default_all_zeros() {
        let m = HudMetrics::default();
        assert_eq!(m.active_runs, 0);
        assert_eq!(m.pending_approvals, 0);
        assert_eq!(m.blocked_items, 0);
        assert!(m.agents.is_empty());
    }

    // ── ChatMessage / RecentDispatch / Toast — derive coverage ──────

    #[test]
    fn chat_message_clone_roundtrip() {
        let msg = ChatMessage {
            role: "user".to_string(),
            content: "hello world".to_string(),
        };
        let cloned = msg.clone();
        assert_eq!(cloned.role, msg.role);
        assert_eq!(cloned.content, msg.content);
    }

    #[test]
    fn chat_message_serde_roundtrip() {
        let msg = ChatMessage {
            role: "assistant".to_string(),
            content: "I can help with that".to_string(),
        };
        let json = serde_json::to_string(&msg).expect("serialize");
        let back: ChatMessage = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.role, msg.role);
        assert_eq!(back.content, msg.content);
    }

    #[test]
    fn recent_dispatch_clone_and_serde() {
        let rd = RecentDispatch {
            agent_id: "saturn".to_string(),
            goal: "summarize docs".to_string(),
            status: "running".to_string(),
            timestamp: "2026-03-28T00:00:00Z".to_string(),
        };
        let cloned = rd.clone();
        let json = serde_json::to_string(&cloned).expect("serialize");
        let back: RecentDispatch = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.agent_id, "saturn");
        assert_eq!(back.goal, "summarize docs");
        assert_eq!(back.status, "running");
    }

    #[test]
    fn toast_clone_and_serde() {
        let toast = Toast {
            id: "toast-12345".to_string(),
            tone: "info".to_string(),
            title: "Done".to_string(),
            body: "Task completed".to_string(),
            timestamp_ms: 1711584000000,
            dismissed: false,
        };
        let cloned = toast.clone();
        let json = serde_json::to_string(&cloned).expect("serialize");
        let back: Toast = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.id, "toast-12345");
        assert_eq!(back.tone, "info");
        assert!(!back.dismissed);
    }
}
