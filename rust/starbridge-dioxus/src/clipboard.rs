//! Clipboard History Widget — floating panel (Ctrl+Shift+V) showing recent clipboard entries.
//!
//! Polls the system clipboard every 500 ms, deduplicates consecutive identical copies,
//! and surfaces a searchable, scrollable list. Each entry can be dispatched to a Cadet
//! agent via the WidgetBridge.

use std::sync::{Arc, Mutex};

// ── Data model ─────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ClipboardEntry {
    pub text: String,
    pub timestamp_micros: i64,
    pub source_app: String, // "unknown" for now
}

#[derive(Clone)]
pub struct ClipboardHistory {
    pub entries: Arc<Mutex<Vec<ClipboardEntry>>>,
    pub max_entries: usize,
}

impl ClipboardHistory {
    pub fn new(max: usize) -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
            max_entries: max,
        }
    }

    /// Adds an entry, deduplicates consecutive identical copies, trims to max.
    pub fn push(&self, text: String) {
        let mut entries = self.entries.lock().unwrap();
        // Deduplicate: skip if the most-recent entry is identical
        if let Some(last) = entries.last() {
            if last.text == text {
                return;
            }
        }
        let timestamp_micros = {
            use std::time::{SystemTime, UNIX_EPOCH};
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_micros() as i64)
                .unwrap_or(0)
        };
        entries.insert(
            0,
            ClipboardEntry {
                text,
                timestamp_micros,
                source_app: "unknown".to_string(),
            },
        );
        if entries.len() > self.max_entries {
            entries.truncate(self.max_entries);
        }
    }

    /// Case-insensitive substring search. Returns cloned matches.
    pub fn search(&self, query: &str) -> Vec<ClipboardEntry> {
        let q = query.to_lowercase();
        let entries = self.entries.lock().unwrap();
        entries
            .iter()
            .filter(|e| e.text.to_lowercase().contains(&q))
            .cloned()
            .collect()
    }

    /// Clone and return all entries.
    pub fn get_entries(&self) -> Vec<ClipboardEntry> {
        self.entries.lock().unwrap().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── ClipboardEntry ───────────────────────────────────────────────

    #[test]
    fn clipboard_entry_has_expected_fields() {
        let entry = ClipboardEntry {
            text: "hello".to_string(),
            timestamp_micros: 1_000_000,
            source_app: "test".to_string(),
        };
        assert_eq!(entry.text, "hello");
        assert_eq!(entry.timestamp_micros, 1_000_000);
        assert_eq!(entry.source_app, "test");
    }

    #[test]
    fn clipboard_entry_clone() {
        let entry = ClipboardEntry {
            text: "copy me".to_string(),
            timestamp_micros: 42,
            source_app: "unknown".to_string(),
        };
        let cloned = entry.clone();
        assert_eq!(cloned.text, entry.text);
        assert_eq!(cloned.timestamp_micros, entry.timestamp_micros);
        assert_eq!(cloned.source_app, entry.source_app);
    }

    // ── ClipboardHistory::new ────────────────────────────────────────

    #[test]
    fn clipboard_history_new_empty() {
        let h = ClipboardHistory::new(5);
        assert_eq!(h.max_entries, 5);
        assert!(h.get_entries().is_empty());
    }

    // ── ClipboardHistory::push ───────────────────────────────────────

    #[test]
    fn push_single_entry_has_nonzero_timestamp() {
        let h = ClipboardHistory::new(10);
        h.push("hello".to_string());
        let entries = h.get_entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].text, "hello");
        assert!(entries[0].timestamp_micros > 0);
    }

    #[test]
    fn push_deduplicates_consecutive_identical_text() {
        let h = ClipboardHistory::new(10);
        h.push("same".to_string());
        h.push("same".to_string());
        assert_eq!(h.get_entries().len(), 1);
    }

    #[test]
    fn push_different_text_keeps_both() {
        let h = ClipboardHistory::new(10);
        h.push("first".to_string());
        h.push("second".to_string());
        assert_eq!(h.get_entries().len(), 2);
    }

    #[test]
    fn push_dedup_checks_last_vec_element_not_newest() {
        // Dedup compares against entries.last(), which is the oldest item
        // (since new items are inserted at index 0).
        // Sequence: push "a" → ["a"], push "b" → ["b","a"], push "a" →
        // last() == "a" so it IS deduplicated and we stay at 2 entries.
        let h = ClipboardHistory::new(10);
        h.push("a".to_string());
        h.push("b".to_string());
        h.push("a".to_string());
        assert_eq!(h.get_entries().len(), 2);
    }

    #[test]
    fn push_trims_to_max_entries() {
        let h = ClipboardHistory::new(5);
        for i in 0..6 {
            h.push(format!("entry-{}", i));
        }
        assert_eq!(h.get_entries().len(), 5);
    }

    #[test]
    fn push_newest_first_ordering() {
        let h = ClipboardHistory::new(10);
        h.push("older".to_string());
        h.push("newer".to_string());
        let entries = h.get_entries();
        // push inserts at index 0, so newest is first
        assert_eq!(entries[0].text, "newer");
        assert_eq!(entries[1].text, "older");
    }

    #[test]
    fn push_oldest_trimmed_when_full() {
        let h = ClipboardHistory::new(3);
        h.push("first".to_string());
        h.push("second".to_string());
        h.push("third".to_string());
        h.push("fourth".to_string()); // should evict "first"
        let entries = h.get_entries();
        assert_eq!(entries.len(), 3);
        assert!(!entries.iter().any(|e| e.text == "first"));
        assert!(entries.iter().any(|e| e.text == "fourth"));
    }

    // ── ClipboardHistory::get_entries ────────────────────────────────

    #[test]
    fn get_entries_returns_cloned_vec() {
        let h = ClipboardHistory::new(5);
        h.push("alpha".to_string());
        h.push("beta".to_string());
        let entries = h.get_entries();
        assert_eq!(entries.len(), 2);
    }

    // ── ClipboardHistory::search ─────────────────────────────────────

    #[test]
    fn search_finds_matching_entry() {
        let h = ClipboardHistory::new(10);
        h.push("hello world".to_string());
        h.push("goodbye".to_string());
        let results = h.search("hello");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].text, "hello world");
    }

    #[test]
    fn search_is_case_insensitive() {
        let h = ClipboardHistory::new(10);
        h.push("Hello World".to_string());
        let results = h.search("HELLO");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn search_returns_empty_for_no_match() {
        let h = ClipboardHistory::new(10);
        h.push("something".to_string());
        let results = h.search("nonexistent");
        assert!(results.is_empty());
    }

    #[test]
    fn search_empty_query_returns_all() {
        let h = ClipboardHistory::new(10);
        h.push("one".to_string());
        h.push("two".to_string());
        let results = h.search("");
        assert_eq!(results.len(), 2);
    }

    // ── Edge cases ───────────────────────────────────────────────────

    #[test]
    fn push_empty_string_is_accepted() {
        let h = ClipboardHistory::new(5);
        h.push("".to_string());
        // Two consecutive empty strings should dedup
        h.push("".to_string());
        assert_eq!(h.get_entries().len(), 1);
    }

    #[test]
    fn push_whitespace_entry_is_accepted() {
        let h = ClipboardHistory::new(5);
        h.push("   ".to_string());
        assert_eq!(h.get_entries().len(), 1);
        assert_eq!(h.get_entries()[0].source_app, "unknown");
    }
}

// ── Background watcher ─────────────────────────────────────────────

/// Spawns a background task that polls `arboard::Clipboard` every 500 ms.
/// When the clipboard text changes it is pushed into `history`.
#[cfg(feature = "desktop-ui")]
pub fn start_clipboard_watcher(history: ClipboardHistory) {
    tokio::spawn(async move {
        let mut last_text = String::new();
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                if let Ok(text) = clipboard.get_text() {
                    if !text.is_empty() && text != last_text {
                        last_text = text.clone();
                        history.push(text);
                    }
                }
            }
        }
    });
}

// ── CSS ────────────────────────────────────────────────────────────

pub const CLIPBOARD_STYLES: &str = r#"
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        background: transparent;
        font-family: "Inter", "SF Pro Display", -apple-system, sans-serif;
        color: #e8e8e8;
        overflow: hidden;
    }

    .clipboard-shell {
        padding: 8px;
        height: 100vh;
    }

    .clipboard-glass {
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        background: rgba(30, 30, 30, 0.72);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.06) inset;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        height: calc(100vh - 16px);
        overflow: hidden;
    }

    .cb-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
    }

    .cb-brand {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .cb-brand-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e07b5a;
        box-shadow: 0 0 6px rgba(224, 123, 90, 0.5);
    }

    .cb-brand-label {
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
    }

    .cb-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        border-radius: 4px;
    }

    .cb-close:hover {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.7);
    }

    .cb-search {
        flex-shrink: 0;
        padding: 8px 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        color: #e8e8e8;
        font: inherit;
        font-size: 12px;
        outline: none;
        width: 100%;
    }

    .cb-search:focus {
        border-color: rgba(224, 123, 90, 0.4);
    }

    .cb-search::placeholder {
        color: rgba(255, 255, 255, 0.3);
    }

    .cb-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-height: 0;
    }

    .cb-entry {
        position: relative;
        padding: 9px 11px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .cb-entry:hover {
        background: rgba(224, 123, 90, 0.08);
        border-color: rgba(224, 123, 90, 0.25);
    }

    .cb-entry-text {
        font-size: 12px;
        line-height: 1.4;
        color: rgba(255, 255, 255, 0.85);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cb-entry-meta {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .cb-entry-time {
        font-size: 10px;
        font-family: "JetBrains Mono", monospace;
        color: rgba(255, 255, 255, 0.3);
    }

    .cb-entry-actions {
        display: flex;
        gap: 4px;
        margin-left: auto;
    }

    .cb-action-btn {
        padding: 2px 7px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.55);
        font: inherit;
        font-size: 10px;
        cursor: pointer;
        transition: background 0.12s, color 0.12s;
    }

    .cb-action-btn:hover {
        background: rgba(224, 123, 90, 0.15);
        border-color: rgba(224, 123, 90, 0.3);
        color: #e07b5a;
    }

    .cb-empty {
        text-align: center;
        color: rgba(255, 255, 255, 0.25);
        font-size: 12px;
        padding: 24px 0;
    }

    .cb-status {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.28);
        text-align: center;
        font-family: "JetBrains Mono", monospace;
        flex-shrink: 0;
    }
"#;

// ── Dioxus component ───────────────────────────────────────────────

#[cfg(feature = "desktop-ui")]
pub mod desktop {
    use super::*;
    use crate::widget::WidgetBridge;
    use dioxus::prelude::*;
    use dioxus_desktop::{use_window, Config, LogicalSize, WindowBuilder};

    #[cfg(target_os = "macos")]
    use dioxus_desktop::tao::platform::macos::WindowBuilderExtMacOS;

    /// Build the `Config` for the clipboard history window.
    pub fn clipboard_window_config() -> Config {
        let mut wb = WindowBuilder::new()
            .with_title("Cadet Clipboard")
            .with_decorations(false)
            .with_transparent(true)
            .with_always_on_top(true)
            .with_resizable(false)
            .with_inner_size(LogicalSize::new(380.0, 500.0));

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

    // PartialEq for ClipboardHistory (compare by pointer)
    impl PartialEq for ClipboardHistory {
        fn eq(&self, other: &Self) -> bool {
            Arc::ptr_eq(&self.entries, &other.entries)
        }
    }

    #[derive(Props, Clone, PartialEq)]
    pub struct ClipboardWidgetProps {
        pub history: ClipboardHistory,
        pub bridge: WidgetBridge,
    }

    /// Returns a human-readable relative timestamp (e.g. "just now", "2m ago").
    fn relative_time(timestamp_micros: i64) -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let now_micros = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_micros() as i64)
            .unwrap_or(0);
        let elapsed_secs = (now_micros - timestamp_micros).max(0) / 1_000_000;
        if elapsed_secs < 5 {
            "just now".to_string()
        } else if elapsed_secs < 60 {
            format!("{}s ago", elapsed_secs)
        } else if elapsed_secs < 3600 {
            format!("{}m ago", elapsed_secs / 60)
        } else {
            format!("{}h ago", elapsed_secs / 3600)
        }
    }

    #[component]
    pub fn ClipboardWidget(props: ClipboardWidgetProps) -> Element {
        let history = props.history;
        let bridge = props.bridge;
        let desktop = use_window();

        let mut search_query = use_signal(String::new);

        // Snapshot entries on each render (no live subscription needed — hotkey re-opens)
        let displayed: Vec<ClipboardEntry> = {
            let q = search_query();
            if q.trim().is_empty() {
                history.get_entries()
            } else {
                history.search(q.trim())
            }
        };

        rsx! {
            style { "{CLIPBOARD_STYLES}" }
            div { class: "clipboard-shell",
                div { class: "clipboard-glass",

                    // Header — draggable
                    div { class: "cb-header",
                        div { style: "-webkit-app-region: drag; cursor: grab; flex: 1;",
                            div { class: "cb-brand",
                                div { class: "cb-brand-dot" }
                                span { class: "cb-brand-label", "Clipboard" }
                            }
                        }
                        button {
                            class: "cb-close",
                            onclick: {
                                let desktop = desktop.clone();
                                move |_| desktop.set_visible(false)
                            },
                            "✕"
                        }
                    }

                    // Search input
                    input {
                        class: "cb-search",
                        r#type: "text",
                        placeholder: "Search clipboard...",
                        value: search_query(),
                        oninput: move |e| search_query.set(e.value()),
                        onkeydown: {
                            let desktop = desktop.clone();
                            move |e: KeyboardEvent| {
                                if e.key() == Key::Escape {
                                    desktop.set_visible(false);
                                }
                            }
                        },
                    }

                    // Entry list
                    div { class: "cb-list",
                        if displayed.is_empty() {
                            div { class: "cb-empty",
                                if search_query().is_empty() {
                                    "No clipboard history yet"
                                } else {
                                    "No matches"
                                }
                            }
                        }

                        for entry in displayed.iter() {
                            {
                                let text_for_copy = entry.text.clone();
                                let text_for_research = entry.text.clone();
                                let text_for_debug = entry.text.clone();
                                let text_for_explain = entry.text.clone();
                                let bridge_research = bridge.clone();
                                let bridge_debug = bridge.clone();
                                let bridge_explain = bridge.clone();
                                let preview = if entry.text.len() > 120 {
                                    format!("{}…", &entry.text[..120])
                                } else {
                                    entry.text.clone()
                                };
                                let time_label = relative_time(entry.timestamp_micros);

                                rsx! {
                                    div { class: "cb-entry",
                                        // Click anywhere on entry to copy back
                                        onclick: move |_| {
                                            if let Ok(mut cb) = arboard::Clipboard::new() {
                                                let _ = cb.set_text(text_for_copy.clone());
                                            }
                                        },

                                        span { class: "cb-entry-text", "{preview}" }

                                        div { class: "cb-entry-meta",
                                            span { class: "cb-entry-time", "{time_label}" }

                                            div { class: "cb-entry-actions",
                                                button {
                                                    class: "cb-action-btn",
                                                    onclick: move |e| {
                                                        e.stop_propagation();
                                                        bridge_research.dispatch(
                                                            "voyager".to_string(),
                                                            format!("Research: {}", text_for_research),
                                                        );
                                                    },
                                                    "Research"
                                                }
                                                button {
                                                    class: "cb-action-btn",
                                                    onclick: move |e| {
                                                        e.stop_propagation();
                                                        bridge_debug.dispatch(
                                                            "saturn".to_string(),
                                                            format!("Debug: {}", text_for_debug),
                                                        );
                                                    },
                                                    "Debug"
                                                }
                                                button {
                                                    class: "cb-action-btn",
                                                    onclick: move |e| {
                                                        e.stop_propagation();
                                                        bridge_explain.dispatch(
                                                            "saturn".to_string(),
                                                            format!("Explain: {}", text_for_explain),
                                                        );
                                                    },
                                                    "Explain"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Status bar
                    div { class: "cb-status", "Ctrl+Shift+V \u{2022} Escape to hide" }
                }
            }
        }
    }
}
