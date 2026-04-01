# 009 — Unified Event Stream (Logs View)

**Status:** Not Started
**Effort:** Medium
**Depends on:** [001 Live Data Layer](001-live-data-layer.md)
**Target file:** `rust/starbridge-dioxus/src/ui/views/logs.rs`

---

## Context

All agent interactions are stored in SpacetimeDB's `chat_message` table with structured metadata. The message taxonomy (`apps/web/lib/agent-runtime/message-taxonomy.ts`) defines 7 message kinds:

```
MessageKind:
  "user_prompt"       — What the user asked for
  "agent_response"    — Agent's final answer
  "agent_thinking"    — Internal reasoning (not shown to user normally)
  "agent_tool_call"   — Tool invocation + result
  "a2a_handoff"       — Agent delegating to another agent
  "a2a_result"        — Result coming back from a delegated agent
  "system_event"      — Platform events (run started, completed, failed)
```

Each `StructuredMessage` contains: `messageId`, `operatorId`, `runId?`, `kind`, `actor`, `content`, `metadata: Record<string, unknown>`, `createdAt`.

The Logs view subscribes to `chat_message` and `message_event` tables via SpacetimeDB signals (spec 001) and renders a filterable, reverse-chronological event stream. Unlike the Chat view which shows conversations, Logs shows every event across all agents and runs as a flat audit trail.

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Logs                                                    [Pause ⏸]  │
├──────────────────────────────────────────────────────────────────────┤
│ Kind: [All ▾]  Agent: [All ▾]  Run: [All ▾]  [🔍 keyword search__] │
│ Time: [Last 1h ▾]                              842 events  [Clear]  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 09:14:23.412  system_event   system    Run run_x7k started           │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:23.891  a2a_handoff    cadet     Handoff to voyager: fix       │
│                                         auth.ts login validation     │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:25.002  agent_thinking voyager   Analyzing auth.ts...          │
│               ▸ (click to expand full reasoning)                     │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:26.334  agent_tool_call voyager  Tool: read_file               │
│               ▸ Input: { "path": "src/auth.ts" }                    │
│               ▸ Output: (247 chars) "import { verify..."             │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:28.771  agent_tool_call voyager  Tool: edit_file               │
│               ▸ Input: { "path": "src/auth.ts", ... }               │
│               ▸ Output: "OK"                                         │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:30.102  agent_response voyager   Fixed email validation in     │
│                                         auth.ts. Added regex check.  │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:30.455  a2a_result     voyager   PR: github.com/.../pull/42    │
│               ▸ Branch: fix/auth-validation                          │
│               ▸ Files: src/auth.ts                                   │
│ ──────────────────────────────────────────────────────────────────── │
│ 09:14:30.801  system_event   system    Run run_x7k completed         │
│                                                                      │
│ ─── Expanded Entry ──────────────────────────────────────────────── │
│ │ Message ID: msg_lx2k_a9f                                        │ │
│ │ Run ID:     run_x7k                                             │ │
│ │ Kind:       agent_tool_call                                     │ │
│ │ Actor:      voyager                                             │ │
│ │ Timestamp:  2026-03-31T09:14:26.334Z                           │ │
│ │ Metadata:                                                       │ │
│ │   { "toolName": "read_file",                                   │ │
│ │     "input": { "path": "src/auth.ts" },                        │ │
│ │     "output": "import { verify..." }                            │ │
│ ─────────────────────────────────────────────────────────────────── │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Requirements

1. **Filter bar** — dropdowns for: message kind (7 kinds + "All"), agent/actor, run ID, time range (Last 1h / 6h / 24h / 7d / All); keyword search input
2. **Event stream** — reverse-chronological list from SpacetimeDB signals; each entry shows timestamp (HH:MM:SS.ms), kind badge (color-coded), actor, content preview (single line, truncated)
3. **Kind badges** — color-coded per type:
   - `user_prompt` — white on dark
   - `agent_response` — coral (#AA3618)
   - `agent_thinking` — muted gray (#5F5E5E)
   - `agent_tool_call` — sage (#526258)
   - `a2a_handoff` — mint (#D4E8D9 text)
   - `a2a_result` — bright coral (#EF6745)
   - `system_event` — outline only
4. **Expandable entries** — click a row to expand full content + metadata JSON below; tool calls show input/output; handoffs show from/to/goal; results show PR URL, branch, files changed
5. **Live streaming** — new events push to the top in real-time via SpacetimeDB `on_insert` callbacks; optional pause button to freeze the stream for reading
6. **Virtualized scroll** — only render visible rows + buffer; the log can grow to thousands of entries
7. **Event count** — show total matching events in the filter bar
8. **Clear filters** — single button to reset all filters to defaults
9. **Run linking** — clicking a run ID in any entry navigates to the Runs view (spec 013) for that run
10. **Copy** — right-click or button to copy a log entry's content or full metadata JSON

---

## Files

| Action | Path |
|--------|------|
| CREATE | `rust/starbridge-dioxus/src/ui/views/logs.rs` |
| MODIFY | `rust/starbridge-dioxus/src/ui/views/mod.rs` — add `mod logs; pub use logs::LogsView;` |
| MODIFY | `rust/starbridge-dioxus/src/ui/models.rs` — add `Logs` variant to `WorkspacePage` |
| MODIFY | `rust/starbridge-dioxus/src/ui/styles.rs` — add logs-specific CSS (kind badge colors, row layout) |
| MODIFY | `rust/starbridge-dioxus/src/live.rs` — ensure `chat_message` signal subscription is active when Logs view mounts |

---

## Steps (each = one commit)

### Step 1: Rust types for structured messages

Define the Rust equivalents of the TypeScript message taxonomy.

```rust
// In a shared types module or within logs.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MessageKind {
    UserPrompt,
    AgentResponse,
    AgentThinking,
    AgentToolCall,
    A2aHandoff,
    A2aResult,
    SystemEvent,
}

impl MessageKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::UserPrompt => "user_prompt",
            Self::AgentResponse => "agent_response",
            Self::AgentThinking => "agent_thinking",
            Self::AgentToolCall => "agent_tool_call",
            Self::A2aHandoff => "a2a_handoff",
            Self::A2aResult => "a2a_result",
            Self::SystemEvent => "system_event",
        }
    }

    pub fn display(self) -> &'static str {
        match self {
            Self::UserPrompt => "User Prompt",
            Self::AgentResponse => "Agent Response",
            Self::AgentThinking => "Thinking",
            Self::AgentToolCall => "Tool Call",
            Self::A2aHandoff => "Handoff",
            Self::A2aResult => "Result",
            Self::SystemEvent => "System",
        }
    }

    pub fn css_class(self) -> &'static str {
        match self {
            Self::UserPrompt => "kind-user-prompt",
            Self::AgentResponse => "kind-agent-response",
            Self::AgentThinking => "kind-agent-thinking",
            Self::AgentToolCall => "kind-agent-tool-call",
            Self::A2aHandoff => "kind-a2a-handoff",
            Self::A2aResult => "kind-a2a-result",
            Self::SystemEvent => "kind-system-event",
        }
    }

    pub fn all() -> &'static [MessageKind] {
        &[
            Self::UserPrompt,
            Self::AgentResponse,
            Self::AgentThinking,
            Self::AgentToolCall,
            Self::A2aHandoff,
            Self::A2aResult,
            Self::SystemEvent,
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub message_id: String,
    pub operator_id: String,
    pub run_id: Option<String>,
    pub kind: MessageKind,
    pub actor: String,
    pub content: String,
    pub metadata: HashMap<String, serde_json::Value>,
    pub created_at: f64, // epoch millis
}
```

**Commit:** `feat(desktop): add MessageKind enum and LogEntry types for logs view`

### Step 2: Logs view scaffold with filter bar

Create `logs.rs` with filter state, filter bar UI, and empty event list.

```rust
// rust/starbridge-dioxus/src/ui/views/logs.rs

use dioxus::prelude::*;

#[derive(Clone, PartialEq)]
struct LogFilters {
    kind: Option<MessageKind>,
    actor: Option<String>,
    run_id: Option<String>,
    time_range: TimeRange,
    keyword: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum TimeRange {
    Last1h,
    Last6h,
    Last24h,
    Last7d,
    All,
}

impl TimeRange {
    fn label(self) -> &'static str {
        match self {
            Self::Last1h => "Last 1h",
            Self::Last6h => "Last 6h",
            Self::Last24h => "Last 24h",
            Self::Last7d => "Last 7d",
            Self::All => "All time",
        }
    }

    fn cutoff_ms(self) -> Option<f64> {
        let now = js_sys::Date::now(); // or std::time equivalent
        match self {
            Self::Last1h => Some(now - 3_600_000.0),
            Self::Last6h => Some(now - 21_600_000.0),
            Self::Last24h => Some(now - 86_400_000.0),
            Self::Last7d => Some(now - 604_800_000.0),
            Self::All => None,
        }
    }
}

#[component]
pub fn LogsView() -> Element {
    let mut filters = use_signal(|| LogFilters {
        kind: None,
        actor: None,
        run_id: None,
        time_range: TimeRange::Last1h,
        keyword: String::new(),
    });
    let mut paused = use_signal(|| false);
    let mut expanded = use_signal(|| None::<String>);

    // Read from LiveState chat_messages signal
    let live = use_context::<Signal<LiveState>>();
    let messages = live.read().chat_messages.read();

    // Apply filters
    let filtered = apply_filters(&messages, &filters.read());
    let count = filtered.len();

    rsx! {
        div { class: "logs-view",
            // ... filter bar and event list
        }
    }
}
```

**Commit:** `feat(desktop): logs view scaffold with filter bar and state`

### Step 3: Event stream rendering with kind badges

Implement the log entry rows with timestamp, colored kind badge, actor, and truncated content.

```rust
#[component]
fn LogEntryRow(
    entry: LogEntry,
    is_expanded: bool,
    on_toggle: EventHandler<String>,
) -> Element {
    let ts = format_timestamp(entry.created_at);
    let preview = if entry.content.len() > 120 {
        format!("{}...", &entry.content[..120])
    } else {
        entry.content.clone()
    };

    rsx! {
        div {
            class: "log-entry",
            onclick: move |_| on_toggle.call(entry.message_id.clone()),

            span { class: "log-ts mono", "{ts}" }
            span {
                class: "log-kind-badge {entry.kind.css_class()}",
                "{entry.kind.display()}"
            }
            span { class: "log-actor mono", "{entry.actor}" }
            span { class: "log-content", "{preview}" }
        }

        if is_expanded {
            LogEntryDetail { entry: entry.clone() }
        }
    }
}

#[component]
fn LogEntryDetail(entry: LogEntry) -> Element {
    let metadata_json = serde_json::to_string_pretty(&entry.metadata)
        .unwrap_or_default();

    rsx! {
        div { class: "log-entry-detail",
            div { class: "detail-row",
                span { class: "detail-label", "Message ID:" }
                span { class: "detail-value mono", "{entry.message_id}" }
            }
            if let Some(ref run_id) = entry.run_id {
                div { class: "detail-row",
                    span { class: "detail-label", "Run ID:" }
                    a {
                        class: "detail-link",
                        onclick: move |_| { /* navigate to Runs view */ },
                        "{run_id}"
                    }
                }
            }
            div { class: "detail-row",
                span { class: "detail-label", "Metadata:" }
                pre { class: "detail-json mono", "{metadata_json}" }
            }
        }
    }
}
```

**Commit:** `feat(desktop): log entry rows with kind badges and expandable detail`

### Step 4: Live streaming and pause

Wire the SpacetimeDB `on_insert` callback to push new entries to the top of the list. Add the pause/resume toggle that freezes the display (entries still accumulate in the signal, but the view stops re-rendering).

**Commit:** `feat(desktop): live log streaming from SpacetimeDB with pause toggle`

### Step 5: Virtualized scrolling

Implement a virtual scroll container that only renders visible rows plus a buffer (e.g., 50 rows above/below viewport). This prevents DOM bloat when the log grows to thousands of entries.

```rust
/// Simple virtual scroll: track scroll offset, compute visible range,
/// render only those rows with absolute positioning.

#[component]
fn VirtualLogList(
    entries: Vec<LogEntry>,
    expanded: Signal<Option<String>>,
) -> Element {
    let row_height = 40.0_f64; // base row height in px
    let mut scroll_top = use_signal(|| 0.0_f64);
    let container_height = 600.0; // will be measured from DOM
    let buffer = 20;

    let total_height = entries.len() as f64 * row_height;
    let start = ((scroll_top() / row_height) as usize).saturating_sub(buffer);
    let visible_count = (container_height / row_height) as usize + buffer * 2;
    let end = (start + visible_count).min(entries.len());

    rsx! {
        div {
            class: "virtual-scroll-container",
            onscroll: move |e| {
                // update scroll_top from event
            },
            div {
                style: "height: {total_height}px; position: relative;",
                for (i, entry) in entries[start..end].iter().enumerate() {
                    div {
                        style: "position: absolute; top: {(start + i) as f64 * row_height}px; width: 100%;",
                        LogEntryRow {
                            entry: entry.clone(),
                            is_expanded: expanded.read().as_ref() == Some(&entry.message_id),
                            on_toggle: move |id| { /* toggle */ },
                        }
                    }
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): virtualized scroll for log entries`

### Step 6: CSS and navigation registration

Add all logs CSS (kind badge colors, row layout, detail panel, virtual scroll) to `styles.rs`. Register `Logs` in `WorkspacePage` enum with `Cmd+0` shortcut (or appropriate slot).

```css
/* Added to styles.rs APP_STYLES */

.logs-view { display: flex; flex-direction: column; height: 100%; }
.logs-filter-bar { display: flex; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--outline-variant); }
.log-entry { display: flex; gap: 12px; padding: 6px 12px; cursor: pointer; align-items: baseline; }
.log-entry:hover { background: var(--surface-container-low); }
.log-ts { font-size: 11px; color: var(--on-surface-variant); min-width: 96px; }
.log-actor { font-size: 11px; min-width: 72px; color: var(--on-surface-variant); }
.log-content { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.log-kind-badge { font-size: 10px; padding: 1px 6px; font-weight: 600; min-width: 90px; text-align: center; }
.kind-user-prompt { background: var(--on-surface); color: var(--surface); }
.kind-agent-response { background: var(--primary); color: var(--on-primary); }
.kind-agent-thinking { background: var(--secondary); color: var(--surface); }
.kind-agent-tool-call { background: var(--tertiary); color: var(--surface); }
.kind-a2a-handoff { background: var(--tertiary-container); color: var(--on-surface); }
.kind-a2a-result { background: var(--primary-container); color: var(--on-primary); }
.kind-system-event { background: transparent; border: 1px solid var(--outline-variant); color: var(--on-surface-variant); }

.log-entry-detail { padding: 8px 12px 8px 108px; background: var(--surface-container-low); font-size: 12px; }
.detail-json { font-size: 11px; max-height: 200px; overflow: auto; background: var(--surface-container); padding: 8px; }
```

**Commit:** `feat(desktop): logs view CSS and navigation registration`

---

## Regression Tests

Run after every step:

```bash
# Must compile
cargo build --bin starbridge-dioxus-ui --features desktop-ui

# Unit tests
cargo test --bin starbridge-dioxus-ui --features desktop-ui

# Manual verification:
# - Navigate to Logs view
# - Events load from SpacetimeDB (check that entries appear)
# - Filter by kind: select "agent_tool_call" -> only tool calls shown
# - Filter by agent: select "voyager" -> only voyager entries
# - Filter by time: "Last 1h" -> older entries hidden
# - Keyword search: type "auth" -> only matching entries
# - Click entry -> expands to show metadata JSON
# - Click run ID link -> navigates to Runs view
# - Trigger an agent run -> new log entries stream in at top
# - Click Pause -> stream freezes, new entries don't appear until Resume
# - Scroll through 500+ entries -> no lag (virtualized)
# - Clear filters button resets all to defaults
# - Kind badges have correct colors per type
```

---

## Definition of Done

- [ ] Single-column layout with filter bar and event stream renders
- [ ] All 7 message kinds display with correct color-coded badges
- [ ] Filter by kind, agent, run ID, time range, and keyword all work
- [ ] Entries are reverse-chronological (newest first)
- [ ] Click to expand shows full content + metadata JSON
- [ ] Live streaming pushes new events to the top in real-time
- [ ] Pause/Resume toggle freezes/unfreezes the display
- [ ] Virtualized scroll handles 1000+ entries without lag
- [ ] Run ID links navigate to the Runs view
- [ ] Event count updates as filters change
- [ ] Clear button resets all filters
- [ ] `cargo build` passes with no warnings
- [ ] View registered in `WorkspacePage` enum and sidebar

---

## PR Template

```markdown
## Summary
- Add unified Logs view with filterable event stream from SpacetimeDB
- 7 message kinds (user_prompt, agent_response, agent_thinking, agent_tool_call, a2a_handoff, a2a_result, system_event) with color-coded badges
- Live streaming via SpacetimeDB signals with pause/resume
- Virtualized scroll for large event volumes

## Test plan
- [ ] Build passes: `cargo build --bin starbridge-dioxus-ui --features desktop-ui`
- [ ] Navigate to Logs, verify events render
- [ ] Filter by each kind — only matching entries shown
- [ ] Filter by agent — correct isolation
- [ ] Search keyword — matching entries only
- [ ] Click entry to expand — metadata JSON shown
- [ ] Trigger agent run — events stream in at top
- [ ] Pause — stream stops; Resume — catches up
- [ ] Scroll 500+ entries — no jank
- [ ] Click run ID — navigates to Runs view

Closes #XXX
```
