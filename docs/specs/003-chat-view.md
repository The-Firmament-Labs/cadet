# Spec 003 — Chat View (Claude Desktop Quality)

**Status:** Not Started
**Effort:** Large
**Depends on:** 001 (Live Data Layer), 002 (Web Client)
**Produces:** `rust/starbridge-dioxus/src/ui/views/ai_chat.rs` (rewrite)

---

## Context

The current `ai_chat.rs` is a minimal proof-of-concept: a single-column message list with a textarea, no conversation sidebar, no streaming display, no tool call rendering, no agent handoff cards, and no @ references. Messages are stored only in a local `Signal<Vec<ChatMessage>>` and lost on page switch.

The target is Claude Desktop / ChatGPT Desktop quality: a conversation sidebar with date-grouped history persisted in SpacetimeDB, token-by-token streaming with a pulsing cursor, collapsible tool-call cards, agent handoff indicators with "View Run" links, agent result cards with PR URLs, an @ reference autocomplete system, and a model selector dropdown.

**Reference UX (from research doc):**
- Claude Desktop: Two-column layout, markdown + syntax highlighting, tool calls as collapsible sections, pulsing streaming cursor, artifacts panel.
- ChatGPT Desktop: Date-grouped sidebar, reasoning traces, source citation cards.

**Data flow:**
- Chat history: SpacetimeDB `chat_message` table via `LiveState::chat_messages` signal (from spec 001).
- AI responses: HTTP POST to `http://localhost:3001/api/chat` via `WebClient` (from spec 002), returns Server-Sent Events.
- Agent dispatches: Tool call `handoff_to_agent` in the SSE stream triggers a run card.
- Conversation list: Derived from `chat_message` records grouped by `thread_id`.

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ app-shell                                                            │
├────────┬──────────┬──────────────────────────────────┬──────────────┤
│sidebar │ convos   │  chat area                       │  inspector   │
│ 48/200 │  280px   │  fluid                           │  320px (opt) │
│        │          │                                  │              │
│ [Chat] │ Search   │  ┌──────────────────────────┐    │  Run Detail  │
│  Ovw   │          │  │ You: fix the login bug   │    │  or          │
│  Runs  │ Today    │  └──────────────────────────┘    │  Tool Output │
│  Agts  │  > auth  │                                  │  or          │
│  Mem   │  > deploy│  ┌──────────────────────────┐    │  Hidden      │
│  Term  │          │  │ Cadet: Delegating to     │    │              │
│  ...   │ Yester.  │  │ Voyager...               │    │              │
│        │  > refctr│  │ ┌─ handoff_to_agent ───┐ │    │              │
│        │          │  │ │ Agent: voyager        │ │    │              │
│        │          │  │ │ Run: run_abc  [View→] │ │    │              │
│        │          │  │ └──────────────────────┘ │    │              │
│        │          │  └──────────────────────────┘    │              │
│        │          │                                  │              │
│        │          │  ┌─ Agent Result ───────────┐    │              │
│        │          │  │ OK Voyager: Fixed email   │    │              │
│        │          │  │ PR: org/repo/pull/42     │    │              │
│        │          │  └──────────────────────────┘    │              │
│        │          │                                  │              │
│        │          │  ┌──────────────────────────┐    │              │
│        │          │  │ Ask Cadet...  (Enter)    │    │              │
│        │          │  │ @run @agent   Model: v   │    │              │
│        │          │  └──────────────────────────┘    │              │
├────────┴──────────┴──────────────────────────────────┴──────────────┤
```

---

## Requirements

### R1 — Conversation Sidebar (280px left panel)
- Search input at top, filters `chat_message` by content substring.
- Conversations grouped by date: Today, Yesterday, Previous 7 Days, Older.
- Each item shows title (first user message, truncated to 40 chars) and timestamp.
- Click to load conversation into chat area.
- "New Chat" button (Cmd+N) creates a new thread_id.
- Active conversation highlighted with `--primary` background.

### R2 — Message Rendering
- User messages: right-aligned bubble with "You" label.
- Assistant messages: left-aligned with "Cadet" avatar label.
- Markdown rendering: bold, italic, code spans, code blocks with language label and copy button.
- Syntax highlighting via a simple keyword-based colorizer (no external crate — keep it lightweight).
- Long messages have a "Show more" / "Show less" toggle at 500 chars.

### R3 — Tool Call Display
- Tool calls rendered as collapsible cards between message paragraphs.
- Card header: tool name pill + status badge (running/complete/error).
- Collapsed: single-line summary.
- Expanded: input JSON (truncated) + output JSON (truncated).
- Special handling for `handoff_to_agent`: show agent name, goal, run_id, "View Run" link that navigates to Overview.

### R4 — Agent Result Cards
- When a delegated agent completes, render a result card.
- Green border for success, red for failure.
- Shows: agent name, summary, PR URL (if present), branch name, duration.
- "View Run" button navigates to the Overview page with that run selected.

### R5 — Streaming Display
- Parse SSE stream token-by-token from `WebClient::chat_stream()`.
- Append tokens to the current assistant message signal in real-time.
- Show a pulsing cursor (`pulse-text` class) at the end of the streaming message.
- Tool call events in the stream insert tool-call cards in real-time.

### R6 — Composer
- Multi-line textarea, Enter to send, Shift+Enter for newline.
- Disabled when not authenticated or while streaming.
- Character count indicator when > 2000 chars.
- "Send" primary button + "Clear" secondary button.
- Model selector dropdown in the composer footer bar (reads available models from web client).

### R7 — @ Reference Autocomplete
- Typing `@` in the composer opens a floating autocomplete popup.
- Namespaces: `@run:`, `@agent:`, `@memory:`, `@skill:`, `@file:`.
- Popup lists matching items from SpacetimeDB signals (runs, agents, memory docs).
- Arrow keys to navigate, Enter to select, Escape to dismiss.
- Selected reference inserted as `@run:run_abc123` text, sent as context to the API.

### R8 — Conversation Persistence
- On send, write message to SpacetimeDB via `ingest_message` reducer.
- On load, populate from `LiveState::chat_messages` signal filtered by `thread_id`.
- New conversations get a UUID thread_id.
- Conversation list derived from distinct thread_ids in `chat_messages`.

### R9 — Keyboard Shortcuts
- `Cmd+J`: Focus composer textarea.
- `Cmd+N`: New conversation.
- `Cmd+Enter`: Send message (when composer focused).
- `Escape`: Dismiss autocomplete popup, or unfocus composer.

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `rust/starbridge-dioxus/src/ui/views/ai_chat.rs` | **Rewrite** | Full chat view with all 9 requirements |
| `rust/starbridge-dioxus/src/ui/views/chat_types.rs` | **Create** | `ChatMessage`, `Conversation`, `ToolCallCard`, `AtReference` types |
| `rust/starbridge-dioxus/src/ui/views/chat_composer.rs` | **Create** | Composer component with @ autocomplete |
| `rust/starbridge-dioxus/src/ui/views/chat_sidebar.rs` | **Create** | Conversation sidebar component |
| `rust/starbridge-dioxus/src/ui/views/mod.rs` | **Modify** | Add `mod chat_types; mod chat_composer; mod chat_sidebar;` |
| `rust/starbridge-dioxus/src/ui/styles.rs` | **Modify** | Add chat-specific CSS (conversation list, message bubbles, tool cards, composer) |

---

## Implementation Steps

### Step 1 — Chat type definitions and conversation model

**Commit:** `feat(chat): add ChatMessage, Conversation, and ToolCallCard types`

Create `chat_types.rs` with all data structures the chat view needs.

```rust
// rust/starbridge-dioxus/src/ui/views/chat_types.rs

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ToolCallStatus {
    Running,
    Complete,
    Error,
}

#[derive(Clone, Debug)]
pub struct ToolCallCard {
    pub tool_name: String,
    pub status: ToolCallStatus,
    pub input_summary: String,
    pub output_summary: String,
    /// For handoff_to_agent: the dispatched run_id
    pub run_id: Option<String>,
    /// For handoff_to_agent: the agent name
    pub agent_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ChatMsg {
    pub id: String,
    pub thread_id: String,
    pub role: MessageRole,
    pub content: String,
    pub tool_calls: Vec<ToolCallCard>,
    pub timestamp_ms: u64,
}

#[derive(Clone, Debug)]
pub struct Conversation {
    pub thread_id: String,
    pub title: String,
    pub last_message_at: u64,
    pub message_count: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub enum AtRefKind {
    Run,
    Agent,
    Memory,
    Skill,
    File,
}

#[derive(Clone, Debug)]
pub struct AtReference {
    pub kind: AtRefKind,
    pub id: String,
    pub display: String,
}

/// Derive a conversation list from a flat list of chat messages.
pub fn derive_conversations(messages: &[ChatMsg]) -> Vec<Conversation> {
    use std::collections::HashMap;
    let mut map: HashMap<String, Conversation> = HashMap::new();
    for msg in messages {
        let entry = map.entry(msg.thread_id.clone()).or_insert_with(|| Conversation {
            thread_id: msg.thread_id.clone(),
            title: String::new(),
            last_message_at: 0,
            message_count: 0,
        });
        entry.message_count += 1;
        if msg.timestamp_ms > entry.last_message_at {
            entry.last_message_at = msg.timestamp_ms;
        }
        // Title = first user message, truncated
        if entry.title.is_empty() && msg.role == MessageRole::User {
            entry.title = if msg.content.len() > 40 {
                format!("{}...", &msg.content[..37])
            } else {
                msg.content.clone()
            };
        }
    }
    let mut convos: Vec<Conversation> = map.into_values().collect();
    convos.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    convos
}
```

**Test:** Unit test `derive_conversations` with 3 threads, verify grouping, sorting, title truncation.

---

### Step 2 — Conversation sidebar component

**Commit:** `feat(chat): add conversation sidebar with search and date grouping`

Create `chat_sidebar.rs` — a self-contained component that takes conversations as a prop and emits selection events.

```rust
// rust/starbridge-dioxus/src/ui/views/chat_sidebar.rs

use dioxus::prelude::*;
use super::chat_types::Conversation;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum DateGroup {
    Today,
    Yesterday,
    Previous7,
    Older,
}

impl DateGroup {
    pub fn label(self) -> &'static str {
        match self {
            DateGroup::Today => "Today",
            DateGroup::Yesterday => "Yesterday",
            DateGroup::Previous7 => "Previous 7 Days",
            DateGroup::Older => "Older",
        }
    }
}

pub fn classify_date(timestamp_ms: u64) -> DateGroup {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let age_ms = now_ms.saturating_sub(timestamp_ms);
    let day_ms: u64 = 86_400_000;
    if age_ms < day_ms { DateGroup::Today }
    else if age_ms < 2 * day_ms { DateGroup::Yesterday }
    else if age_ms < 7 * day_ms { DateGroup::Previous7 }
    else { DateGroup::Older }
}

#[component]
pub fn ConversationSidebar(
    conversations: Vec<Conversation>,
    active_thread: Option<String>,
    on_select: EventHandler<String>,
    on_new: EventHandler<()>,
) -> Element {
    let mut search = use_signal(String::new);
    let filtered: Vec<&Conversation> = conversations.iter()
        .filter(|c| search().is_empty() || c.title.to_lowercase().contains(&search().to_lowercase()))
        .collect();

    rsx! {
        div { class: "chat-sidebar",
            div { class: "chat-sidebar-head",
                button { class: "primary-button", onclick: move |_| on_new.call(()), "+ New Chat" }
                input {
                    class: "search-input",
                    placeholder: "Search conversations...",
                    value: search(),
                    oninput: move |e| search.set(e.value()),
                }
            }
            div { class: "chat-sidebar-list",
                // Group and render by date...
                for convo in filtered.iter() {
                    div {
                        class: if active_thread.as_ref() == Some(&convo.thread_id) {
                            "convo-item convo-item-active"
                        } else {
                            "convo-item"
                        },
                        onclick: {
                            let tid = convo.thread_id.clone();
                            move |_| on_select.call(tid.clone())
                        },
                        span { class: "convo-title", "{convo.title}" }
                    }
                }
            }
        }
    }
}
```

**Test:** Render with 5 conversations, verify search filtering reduces the list, verify active state class.

---

### Step 3 — Composer component with model selector

**Commit:** `feat(chat): add composer with Enter-to-send and model selector`

Create `chat_composer.rs` with the textarea, send/clear buttons, and model dropdown.

```rust
// rust/starbridge-dioxus/src/ui/views/chat_composer.rs

use dioxus::prelude::*;

#[component]
pub fn ChatComposer(
    on_send: EventHandler<String>,
    disabled: bool,
    models: Vec<String>,
    selected_model: String,
    on_model_change: EventHandler<String>,
) -> Element {
    let mut input = use_signal(String::new);

    let send = move || {
        let text = input();
        if text.trim().is_empty() { return; }
        on_send.call(text.clone());
        input.set(String::new());
    };

    rsx! {
        div { class: "composer",
            textarea {
                class: "composer-input",
                value: input(),
                disabled: disabled,
                placeholder: "Ask Cadet anything... (Enter to send, Shift+Enter for newline)",
                oninput: move |e| input.set(e.value()),
                onkeydown: move |e| {
                    if e.key() == Key::Enter && !e.modifiers().shift() {
                        e.prevent_default();
                        send();
                    }
                },
            }
            div { class: "composer-actions",
                div { class: "chip-row",
                    button {
                        class: "secondary-button",
                        onclick: move |_| input.set(String::new()),
                        "Clear"
                    }
                    button {
                        class: "primary-button",
                        disabled: input().trim().is_empty() || disabled,
                        onclick: move |_| send(),
                        "Send"
                    }
                }
                select {
                    class: "model-selector",
                    value: selected_model.clone(),
                    onchange: move |e| on_model_change.call(e.value()),
                    for model in models.iter() {
                        option { value: model.clone(), "{model}" }
                    }
                }
            }
        }
    }
}
```

**Test:** Render composer, simulate Enter keydown, verify `on_send` called with correct text and input cleared.

---

### Step 4 — SSE stream parser for chat responses

**Commit:** `feat(chat): add SSE stream parser for token-by-token and tool-call events`

Add a `parse_sse_event` function and streaming integration to `web_client.rs` (from spec 002). This step adds the Rust-side parser only.

```rust
// Addition to web_client.rs or new file: chat_stream.rs

use super::chat_types::{ToolCallCard, ToolCallStatus};

#[derive(Debug, Clone)]
pub enum SseEvent {
    TextDelta(String),
    ToolCallStart { tool_name: String, call_id: String },
    ToolCallResult { call_id: String, output: String },
    Done,
    Error(String),
}

/// Parse a single SSE data line (after stripping "d:" prefix).
pub fn parse_sse_line(data: &str) -> Option<SseEvent> {
    let json: serde_json::Value = serde_json::from_str(data.trim()).ok()?;
    match json.get("type")?.as_str()? {
        "text" => {
            let value = json.get("value")?.as_str()?.to_string();
            Some(SseEvent::TextDelta(value))
        }
        "tool-call" => {
            let name = json.get("toolName")?.as_str()?.to_string();
            let id = json.get("toolCallId")?.as_str()?.to_string();
            Some(SseEvent::ToolCallStart { tool_name: name, call_id: id })
        }
        "tool-result" => {
            let id = json.get("toolCallId")?.as_str()?.to_string();
            let output = json.get("result").map(|v| v.to_string()).unwrap_or_default();
            Some(SseEvent::ToolCallResult { call_id: id, output })
        }
        "finish" | "done" => Some(SseEvent::Done),
        "error" => {
            let msg = json.get("message")?.as_str()?.to_string();
            Some(SseEvent::Error(msg))
        }
        _ => None,
    }
}
```

**Test:** Unit test `parse_sse_line` with text, tool-call, tool-result, done, and error JSON payloads.

---

### Step 5 — Rewrite ai_chat.rs with full layout

**Commit:** `feat(chat): rewrite AiChatView with 3-column layout, streaming, and tool cards`

Replace the contents of `ai_chat.rs` with the full implementation that composes `ConversationSidebar`, message list, tool call cards, and `ChatComposer`. Wire streaming via `WebClient`.

```rust
// Skeleton of the rewritten AiChatView — key structural elements

#[component]
pub fn AiChatView() -> Element {
    // Signals
    let live = use_context::<LiveState>();
    let web = use_context::<WebClient>();
    let mut active_thread = use_signal(|| None::<String>);
    let mut streaming_text = use_signal(String::new);
    let mut is_streaming = use_signal(|| false);
    let mut selected_model = use_signal(|| "sonnet".to_string());

    // Derive conversations from SpacetimeDB chat_messages
    let all_messages = live.chat_messages.read();
    let conversations = derive_conversations(&all_messages);
    let thread_messages: Vec<&ChatMsg> = all_messages.iter()
        .filter(|m| active_thread().as_ref() == Some(&m.thread_id))
        .collect();

    rsx! {
        div { class: "page-grid page-grid-chat",
            // Column 1: Conversation sidebar
            ConversationSidebar {
                conversations: conversations,
                active_thread: active_thread(),
                on_select: move |tid| active_thread.set(Some(tid)),
                on_new: move |_| {
                    let tid = uuid::Uuid::new_v4().to_string();
                    active_thread.set(Some(tid));
                },
            }

            // Column 2: Chat area
            section { class: "chat-main",
                div { class: "message-stream",
                    for msg in thread_messages.iter() {
                        ChatBubble { msg: (*msg).clone() }
                    }
                    if is_streaming() {
                        div { class: "message message-inbound",
                            p { class: "pulse-text", "{streaming_text}" }
                        }
                    }
                }
                ChatComposer {
                    on_send: move |text: String| {
                        // 1. Write user message to SpacetimeDB
                        // 2. Start streaming from WebClient
                        // 3. Update streaming_text on each TextDelta
                        // 4. Finalize on Done
                    },
                    disabled: is_streaming(),
                    models: vec!["sonnet".into(), "opus".into(), "haiku".into()],
                    selected_model: selected_model(),
                    on_model_change: move |m| selected_model.set(m),
                }
            }
        }
    }
}
```

**Test:** Build the app (`cargo build --features desktop-ui`). Launch, verify 3-column layout renders, empty state shows, new chat button works.

---

### Step 6 — @ reference autocomplete popup

**Commit:** `feat(chat): add @ reference autocomplete for runs, agents, and memory`

Add autocomplete detection to `ChatComposer`. When the user types `@`, show a floating `div` with matching items from LiveState signals.

```rust
#[component]
fn AtAutocomplete(
    query: String,
    kind: AtRefKind,
    items: Vec<AtReference>,
    on_select: EventHandler<AtReference>,
    on_dismiss: EventHandler<()>,
) -> Element {
    let filtered: Vec<&AtReference> = items.iter()
        .filter(|r| r.kind == kind && r.display.to_lowercase().contains(&query.to_lowercase()))
        .take(8)
        .collect();

    rsx! {
        div { class: "at-autocomplete",
            for item in filtered {
                div {
                    class: "at-autocomplete-item",
                    onclick: {
                        let item = item.clone();
                        move |_| on_select.call(item.clone())
                    },
                    span { class: "pill pill-subtle", "{item.kind:?}" }
                    span { "{item.display}" }
                }
            }
        }
    }
}
```

**Test:** Type `@run:` in composer, verify autocomplete popup appears with run IDs from LiveState. Select one, verify text inserted.

---

### Step 7 — Chat CSS additions

**Commit:** `style(chat): add conversation sidebar, message bubble, tool card, and composer styles`

Append to `styles.rs`:

```css
/* Chat-specific layout */
.page-grid-chat {
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 0;
}
.chat-sidebar {
    background: var(--surface-container-low);
    border-right: 1px solid var(--outline-variant);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.chat-sidebar-head {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.chat-sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px;
}
.convo-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    color: var(--on-surface-variant);
}
.convo-item:hover { background: var(--surface-container); }
.convo-item-active {
    background: var(--primary);
    color: var(--on-primary);
}
.convo-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
}

/* Messages */
.chat-main {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.message-stream {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
}
.message { margin-bottom: 16px; animation: fade-in 150ms ease; }
.message-outbound { text-align: right; }
.message-inbound .message-body {
    background: var(--surface-container);
    padding: 10px 14px;
    display: inline-block;
    max-width: 80%;
}

/* Tool call cards */
.tool-card {
    border: 1px solid var(--outline-variant);
    padding: 8px 12px;
    margin: 8px 0;
    font-size: 12px;
    font-family: var(--mono);
}
.tool-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}
.tool-card-body { padding-top: 8px; display: none; }
.tool-card.expanded .tool-card-body { display: block; }

/* Agent result card */
.agent-result {
    border-left: 3px solid var(--tertiary-container);
    padding: 10px 14px;
    margin: 8px 0;
    background: var(--surface-container-low);
}
.agent-result.success { border-color: #4a7; }
.agent-result.failure { border-color: var(--primary); }

/* @ Autocomplete */
.at-autocomplete {
    position: absolute;
    bottom: 100%;
    left: 12px;
    background: var(--surface-container-lowest);
    border: 1px solid var(--outline-variant);
    box-shadow: var(--shadow);
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    min-width: 240px;
}
.at-autocomplete-item {
    padding: 6px 10px;
    cursor: pointer;
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 12px;
}
.at-autocomplete-item:hover { background: var(--surface-container); }

/* Model selector */
.model-selector {
    background: var(--surface-container);
    border: 1px solid var(--outline-variant);
    color: var(--on-surface);
    font-size: 11px;
    padding: 4px 8px;
    font-family: var(--mono);
}
```

**Test:** Build the app, visually verify all chat elements render with correct colors, spacing, and typography.

---

## Regression Tests

| # | Test | Validates |
|---|------|-----------|
| 1 | `test_derive_conversations_grouping` | 3 threads produce 3 conversations sorted by most recent |
| 2 | `test_derive_conversations_title_truncation` | Title > 40 chars truncated with "..." |
| 3 | `test_parse_sse_text_delta` | `{"type":"text","value":"hello"}` produces `TextDelta("hello")` |
| 4 | `test_parse_sse_tool_call` | `{"type":"tool-call",...}` produces `ToolCallStart` |
| 5 | `test_parse_sse_done` | `{"type":"finish"}` produces `Done` |
| 6 | `test_parse_sse_malformed` | Garbage input returns `None` |
| 7 | `test_classify_date_today` | Timestamp 1 second ago = `Today` |
| 8 | `test_classify_date_yesterday` | Timestamp 30 hours ago = `Yesterday` |
| 9 | `test_at_reference_filtering` | Filter `@run:abc` matches run with id containing "abc" |
| 10 | `cargo build --features desktop-ui` | Full app compiles with no errors |

---

## Definition of Done

- [ ] Conversation sidebar renders with date-grouped history from SpacetimeDB
- [ ] Search input filters conversations by title substring
- [ ] New Chat button creates a new thread_id and focuses the composer
- [ ] Messages display with user/assistant styling and markdown code blocks
- [ ] Tool call cards render as collapsible sections with status badges
- [ ] Agent handoff cards show agent name, run_id, and "View Run" link
- [ ] Agent result cards show success/failure with PR URL
- [ ] Streaming displays tokens incrementally with pulsing cursor
- [ ] Composer sends on Enter, newlines on Shift+Enter
- [ ] Model selector dropdown changes the selected model
- [ ] @ reference autocomplete appears on `@` keystroke with matching items
- [ ] Messages persist to SpacetimeDB and survive page navigation
- [ ] Cmd+J focuses composer, Cmd+N creates new conversation
- [ ] All 10 regression tests pass
- [ ] `cargo build --features desktop-ui` succeeds

---

## PR Template

```markdown
## Summary
- Rewrote `ai_chat.rs` from minimal POC to Claude Desktop quality chat view
- Added conversation sidebar with search and date grouping (SpacetimeDB-backed)
- Implemented token-by-token SSE streaming with pulsing cursor
- Added tool call cards, agent handoff indicators, and agent result cards
- Built @ reference autocomplete for runs, agents, memory, skills, files
- Added model selector dropdown in composer

## Test plan
- [ ] Type "hello" in chat, verify Cadet responds via streaming
- [ ] Type "fix the login bug" to trigger agent handoff card
- [ ] Click "View Run" on handoff card, verify navigation to Overview
- [ ] Create 3 conversations, verify sidebar groups by date
- [ ] Search "auth" in sidebar, verify filtering
- [ ] Type `@run:` in composer, verify autocomplete popup
- [ ] Switch pages and return to Chat, verify messages persist
- [ ] Run `cargo test` — all 10 tests pass
- [ ] Run `cargo build --features desktop-ui` — builds clean
```
