# Spec 014 -- Navigation, Command Palette, and Shortcuts

**Status:** Draft
**Scope:** Expand WorkspacePage to 12 variants, restructure sidebar, overhaul command palette with action groups, wire all keyboard shortcuts, update menu bar
**Files:** `models.rs`, `mod.rs`, `styles.rs`

---

## Context

The current `WorkspacePage` enum in `models.rs:7-14` has 6 variants: `Chat`, `Overview`, `Conversations`, `Workflow`, `Catalog`, `Memory`. The desktop spec (DESKTOP_SPEC.md section 2.1) defines 12 pages. The sidebar in `mod.rs:106-157` renders 6 nav buttons in a flat list. The command palette in `mod.rs:208-265` only supports navigation to those 6 pages with a simple text filter.

### Target navigation structure (from DESKTOP_SPEC.md)

```
Workspace section:  Chat, Overview, Runs, Agents, Memory
Tools section:      Terminal, Skills, Journal, Database, Logs, Heartbeat
Config section:     Settings
```

### Current keyboard handling

Menu actions in `mod.rs:43-58` handle 7 string-matched actions. The spec defines 12 keyboard shortcuts (section 5.3).

---

## Requirements

1. **12 WorkspacePage variants** -- Chat, Overview, Conversations (Threads), Workflow (Runs), Catalog (Agents), Memory, Terminal, Skills, Journal, Database, Logs, Heartbeat, Settings.
2. **Sidebar sections** -- Three labeled groups: Workspace (5 items), Tools (6 items), Config (1 item). Each section has a header label.
3. **Command palette action groups** -- Four groups: Navigate (12 pages), Dispatch (quick agent dispatch), Search (conversations, runs, memory), SQL (ad-hoc query shortcut).
4. **Keyboard shortcuts** -- `Cmd+1` through `Cmd+9` for first 9 pages, `Cmd+0` for Settings, `Cmd+J` focus chat, `Cmd+T` open terminal, `Cmd+K` command palette.
5. **Menu bar** -- Update `MenuAction` handler to support all 12 view navigation actions plus palette, sidebar toggle.
6. **Connection status** -- Sidebar footer shows live connection dot (green/yellow/red) and environment label.

---

## Files Changed

| File | Action |
|------|--------|
| `rust/starbridge-dioxus/src/ui/models.rs` | Expand `WorkspacePage` to 13 variants, add labels/descriptions |
| `rust/starbridge-dioxus/src/ui/mod.rs` | Rebuild sidebar with sections, overhaul command palette, add keyboard handler |
| `rust/starbridge-dioxus/src/ui/styles.rs` | Add sidebar section styles, command palette action group styles |
| `rust/starbridge-dioxus/src/main.rs` | Update desktop menu bar items (if applicable) |

---

## Implementation Steps

### Step 1 -- Expand WorkspacePage enum to 13 variants

Update `models.rs`:

```rust
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum WorkspacePage {
    Chat,
    Overview,
    Conversations,
    Workflow,
    Catalog,
    Memory,
    Terminal,
    Skills,
    Journal,
    Database,
    Logs,
    Heartbeat,
    Settings,
}

impl WorkspacePage {
    pub fn label(self) -> &'static str {
        match self {
            WorkspacePage::Chat => "Chat",
            WorkspacePage::Overview => "Overview",
            WorkspacePage::Conversations => "Threads",
            WorkspacePage::Workflow => "Runs",
            WorkspacePage::Catalog => "Agents",
            WorkspacePage::Memory => "Memory",
            WorkspacePage::Terminal => "Terminal",
            WorkspacePage::Skills => "Skills",
            WorkspacePage::Journal => "Journal",
            WorkspacePage::Database => "Database",
            WorkspacePage::Logs => "Logs",
            WorkspacePage::Heartbeat => "Heartbeat",
            WorkspacePage::Settings => "Settings",
        }
    }

    pub fn description(self) -> &'static str {
        match self {
            WorkspacePage::Chat => "Talk to Cadet AI. Dispatch tasks, search memory, manage agents.",
            WorkspacePage::Overview => "Live run queue, browser work, and approval state.",
            WorkspacePage::Conversations => "Channel threads and message history.",
            WorkspacePage::Workflow => "Run stages, step timeline, and tool call logs.",
            WorkspacePage::Catalog => "Agent registry, builder, and dispatch.",
            WorkspacePage::Memory => "Memory documents, embeddings, and retrieval traces.",
            WorkspacePage::Terminal => "Embedded terminal with agent quick-launch.",
            WorkspacePage::Skills => "Skill directory and creator.",
            WorkspacePage::Journal => "Mission Journal: flight plan, standing orders, ship's log.",
            WorkspacePage::Database => "Live SpacetimeDB table browser and SQL console.",
            WorkspacePage::Logs => "Unified event stream with taxonomy filters.",
            WorkspacePage::Heartbeat => "Cron jobs, schedules, and health monitoring.",
            WorkspacePage::Settings => "Auth providers, model routing, and configuration.",
        }
    }

    pub fn icon(self) -> &'static str {
        match self {
            WorkspacePage::Chat => "◉",
            WorkspacePage::Overview => "⊞",
            WorkspacePage::Conversations => "💬",
            WorkspacePage::Workflow => "▶",
            WorkspacePage::Catalog => "⊞",
            WorkspacePage::Memory => "🧠",
            WorkspacePage::Terminal => "⚡",
            WorkspacePage::Skills => "📋",
            WorkspacePage::Journal => "📓",
            WorkspacePage::Database => "🗄",
            WorkspacePage::Logs => "📊",
            WorkspacePage::Heartbeat => "♥",
            WorkspacePage::Settings => "⚙",
        }
    }

    /// Keyboard shortcut index (1-based). Returns None for pages beyond 9 and Settings (0).
    pub fn shortcut_key(self) -> Option<&'static str> {
        match self {
            WorkspacePage::Chat => Some("1"),
            WorkspacePage::Overview => Some("2"),
            WorkspacePage::Conversations => Some("3"),
            WorkspacePage::Workflow => Some("4"),
            WorkspacePage::Catalog => Some("5"),
            WorkspacePage::Memory => Some("6"),
            WorkspacePage::Terminal => Some("7"),
            WorkspacePage::Skills => Some("8"),
            WorkspacePage::Journal => Some("9"),
            WorkspacePage::Settings => Some("0"),
            _ => None,
        }
    }

    pub fn section(self) -> &'static str {
        match self {
            WorkspacePage::Chat
            | WorkspacePage::Overview
            | WorkspacePage::Conversations
            | WorkspacePage::Workflow
            | WorkspacePage::Catalog
            | WorkspacePage::Memory => "Workspace",
            WorkspacePage::Terminal
            | WorkspacePage::Skills
            | WorkspacePage::Journal
            | WorkspacePage::Database
            | WorkspacePage::Logs
            | WorkspacePage::Heartbeat => "Tools",
            WorkspacePage::Settings => "Config",
        }
    }
}

pub const WORKSPACE_PAGES: [WorkspacePage; 13] = [
    WorkspacePage::Chat,
    WorkspacePage::Overview,
    WorkspacePage::Conversations,
    WorkspacePage::Workflow,
    WorkspacePage::Catalog,
    WorkspacePage::Memory,
    WorkspacePage::Terminal,
    WorkspacePage::Skills,
    WorkspacePage::Journal,
    WorkspacePage::Database,
    WorkspacePage::Logs,
    WorkspacePage::Heartbeat,
    WorkspacePage::Settings,
];
```

**Commit:** `feat(desktop): expand WorkspacePage to 13 variants with icons, shortcuts, sections`

### Step 2 -- Rebuild sidebar with three sections

Restructure the sidebar nav in `mod.rs` to group pages by section. Each section gets a header label:

```rust
aside { class: "{sidebar_class}",
    div { class: "sidebar-brand",
        // ... existing brand mark
    }

    for section_name in ["Workspace", "Tools", "Config"] {
        div { class: "sidebar-section", "{section_name}" }
        nav { class: "sidebar-nav",
            for page_variant in WORKSPACE_PAGES.iter().filter(|p| p.section() == section_name) {
                SidebarNavButton {
                    icon: page_variant.icon().to_string(),
                    label: page_variant.label().to_string(),
                    count: sidebar_count(&snapshot, *page_variant),
                    active: page() == *page_variant,
                    shortcut: page_variant.shortcut_key().map(String::from),
                    onclick: {
                        let target = *page_variant;
                        move |_| page.set(target)
                    },
                }
            }
        }
    }

    div { class: "sidebar-footer",
        div {
            class: "connection-dot",
            title: match connection_status() {
                ConnectionStatus::Connected => "Connected",
                ConnectionStatus::Reconnecting => "Reconnecting...",
                ConnectionStatus::Disconnected => "Disconnected",
            },
        }
        p { class: "sidebar-footnote", "{snapshot.environment}" }
    }
}
```

Add a `sidebar_count` helper that returns the appropriate badge count per page (e.g., active runs for Overview, step count for Workflow, agent count for Catalog, etc.).

**Commit:** `feat(desktop): sidebar with three sections (Workspace, Tools, Config)`

### Step 3 -- Overhaul command palette with action groups

Rebuild the `CommandPalette` component with four action groups:

```rust
#[derive(Clone)]
enum PaletteAction {
    Navigate(WorkspacePage),
    Dispatch { agent_name: String, agent_id: String },
    Search { scope: String },
    Sql,
}

impl PaletteAction {
    fn group(&self) -> &'static str {
        match self {
            PaletteAction::Navigate(_) => "Navigate",
            PaletteAction::Dispatch { .. } => "Dispatch",
            PaletteAction::Search { .. } => "Search",
            PaletteAction::Sql => "SQL",
        }
    }
    fn label(&self) -> String {
        match self {
            PaletteAction::Navigate(p) => format!("{} {}", p.icon(), p.label()),
            PaletteAction::Dispatch { agent_name, .. } => format!("Run {} on...", agent_name),
            PaletteAction::Search { scope } => format!("Search {}", scope),
            PaletteAction::Sql => "SQL Console".to_string(),
        }
    }
}
```

Build the action list from all 13 pages, plus known agents (from snapshot), plus search scopes ("conversations", "runs", "memory"), plus SQL shortcut. Filter by query text. Render grouped with section headers:

```rust
ul { class: "command-palette-list",
    for (group_name, group_actions) in grouped_actions {
        li { class: "command-palette-group-header", "{group_name}" }
        for action in group_actions {
            li {
                button {
                    class: "command-palette-item",
                    onclick: move |_| execute_action(action.clone()),
                    span { "{action.label()}" }
                    if let Some(kbd) = action.shortcut() {
                        span { class: "command-palette-kbd", "{kbd}" }
                    }
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): command palette with Navigate, Dispatch, Search, SQL groups`

### Step 4 -- Wire all keyboard shortcuts

Add a global `onkeydown` handler at the app shell level in `mod.rs`:

```rust
div {
    class: "{shell_class}",
    tabindex: 0,
    onkeydown: move |event| {
        let key = event.key();
        let meta = event.modifiers().contains(Modifiers::META);

        if meta {
            match key {
                Key::Character(ref c) if c == "k" => {
                    event.prevent_default();
                    show_command_palette.set(!show_command_palette());
                }
                Key::Character(ref c) if c == "j" => {
                    event.prevent_default();
                    page.set(WorkspacePage::Chat);
                    // focus composer signal
                }
                Key::Character(ref c) if c == "t" => {
                    event.prevent_default();
                    page.set(WorkspacePage::Terminal);
                }
                Key::Character(ref c) if c == "\\" => {
                    event.prevent_default();
                    sidebar_expanded.set(!sidebar_expanded());
                }
                Key::Character(ref c) if c == "0" => {
                    event.prevent_default();
                    page.set(WorkspacePage::Settings);
                }
                Key::Character(ref c) if c.len() == 1 => {
                    if let Some(digit) = c.chars().next().and_then(|ch| ch.to_digit(10)) {
                        if digit >= 1 && digit <= 9 {
                            event.prevent_default();
                            if let Some(target) = WORKSPACE_PAGES.get((digit - 1) as usize) {
                                page.set(*target);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    },
    // ... rest of app shell
}
```

Full shortcut table:

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `Cmd+1` through `Cmd+9` | Navigate to page 1-9 | Index into `WORKSPACE_PAGES` |
| `Cmd+0` | Settings | Direct set |
| `Cmd+K` | Toggle command palette | Toggle signal |
| `Cmd+J` | Focus chat composer | Navigate to Chat + set focus signal |
| `Cmd+T` | Open terminal | Navigate to Terminal |
| `Cmd+\` | Toggle sidebar | Toggle signal |
| `Cmd+N` | New chat conversation | Navigate to Chat + new conversation signal |
| `Cmd+Enter` | Send chat message | Handled by chat view |
| `Cmd+.` | Cancel running agent | Call cancel endpoint |
| `Cmd+,` | Settings | Same as `Cmd+0` |

**Commit:** `feat(desktop): wire all keyboard shortcuts (Cmd+1-9, Cmd+0, Cmd+K/J/T)`

### Step 5 -- Update menu bar and match handler

Expand the `MenuAction` match in `mod.rs:43-58` to handle all 13 views:

```rust
match action.as_str() {
    "view-chat" => page.set(WorkspacePage::Chat),
    "view-overview" => page.set(WorkspacePage::Overview),
    "view-threads" => page.set(WorkspacePage::Conversations),
    "view-runs" => page.set(WorkspacePage::Workflow),
    "view-agents" => page.set(WorkspacePage::Catalog),
    "view-memory" => page.set(WorkspacePage::Memory),
    "view-terminal" => page.set(WorkspacePage::Terminal),
    "view-skills" => page.set(WorkspacePage::Skills),
    "view-journal" => page.set(WorkspacePage::Journal),
    "view-database" => page.set(WorkspacePage::Database),
    "view-logs" => page.set(WorkspacePage::Logs),
    "view-heartbeat" => page.set(WorkspacePage::Heartbeat),
    "view-settings" => page.set(WorkspacePage::Settings),
    "toggle-sidebar" => sidebar_expanded.set(!sidebar_expanded()),
    "toggle-palette" => show_command_palette.set(!show_command_palette()),
    _ => {}
}
```

Update the `match page()` render block to include placeholder views for the new pages:

```rust
match page() {
    // ... existing views ...
    WorkspacePage::Terminal => rsx! { PlaceholderView { name: "Terminal" } },
    WorkspacePage::Skills => rsx! { PlaceholderView { name: "Skills" } },
    WorkspacePage::Journal => rsx! { PlaceholderView { name: "Journal" } },
    WorkspacePage::Database => rsx! { PlaceholderView { name: "Database" } },
    WorkspacePage::Logs => rsx! { PlaceholderView { name: "Logs" } },
    WorkspacePage::Heartbeat => rsx! { PlaceholderView { name: "Heartbeat" } },
    WorkspacePage::Settings => rsx! { PlaceholderView { name: "Settings" } },
}
```

**Commit:** `feat(desktop): menu bar actions and placeholder views for all 13 pages`

---

## Regression Tests

- [ ] All 13 sidebar buttons render and navigate to the correct view.
- [ ] Sidebar sections display correct headers: Workspace, Tools, Config.
- [ ] `Cmd+1` through `Cmd+9` navigate to the correct pages.
- [ ] `Cmd+0` navigates to Settings.
- [ ] `Cmd+K` toggles the command palette open/closed.
- [ ] `Cmd+J` focuses the chat composer (navigates to Chat if on another page).
- [ ] `Cmd+T` navigates to Terminal.
- [ ] `Cmd+\` toggles sidebar collapsed/expanded.
- [ ] Command palette filters across all action groups.
- [ ] Command palette Navigate group lists all 13 pages.
- [ ] Command palette Dispatch group lists agents from snapshot.
- [ ] Selecting a command palette action closes the palette.
- [ ] Escape key closes the command palette.
- [ ] Menu bar actions work for all 13 views.
- [ ] Placeholder views render for unimplemented pages (no crash).

---

## Definition of Done

- `WorkspacePage` has 13 variants with labels, descriptions, icons, shortcuts, and section assignments.
- Sidebar renders three labeled sections with all 13 nav buttons.
- Command palette supports Navigate, Dispatch, Search, and SQL action groups.
- All keyboard shortcuts from DESKTOP_SPEC.md section 5.3 are wired.
- Menu bar handles all view navigation actions.
- New pages render placeholder views until their own specs are implemented.

---

## PR Template

```
## Summary
- Expand WorkspacePage enum from 6 to 13 variants
- Restructure sidebar into Workspace, Tools, Config sections
- Overhaul command palette with Navigate, Dispatch, Search, SQL groups
- Wire all keyboard shortcuts (Cmd+1-9, Cmd+0, Cmd+K/J/T/\)
- Add placeholder views for unimplemented pages

## Test plan
- [ ] Verify all 13 sidebar buttons navigate correctly
- [ ] Test Cmd+1 through Cmd+9 and Cmd+0 keyboard shortcuts
- [ ] Open command palette with Cmd+K, filter actions, select
- [ ] Toggle sidebar with Cmd+\
- [ ] Cmd+J focuses chat, Cmd+T opens terminal
- [ ] Verify no existing functionality regressed
```
