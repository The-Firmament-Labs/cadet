# Spec 012 -- Agents View + Builder Form

**Status:** Draft
**Scope:** Rename `catalog.rs` to agents, add agent builder form, wire dispatch/test buttons
**Files:** `catalog.rs`, `models.rs`, `mod.rs`, `styles.rs`

---

## Context

The current `CatalogView` in `rust/starbridge-dioxus/src/ui/views/catalog.rs` renders a flat list of `CatalogItem` structs mixing agents and tools. The desktop spec (DESKTOP_SPEC.md section 4.4) defines a two-column layout with an agent registry on the left and a detail/builder panel on the right, plus dispatch and test actions. The `CatalogItem` struct already carries agent-relevant fields (`model`, `runtime`, `deployment`, `stages`, `tool_permissions`) but they are not surfaced in the UI, and there is no builder form or dispatch dialog.

### Current state

```rust
// catalog.rs:4-12
pub enum CatalogItemKind { Agent, Tool }

pub struct CatalogItem {
    pub id: String,
    pub name: String,
    pub kind: CatalogItemKind,
    pub description: String,
    pub model: Option<String>,
    pub runtime: Option<String>,
    // ... 8 more fields
}
```

The sidebar already labels this page "Agents" and the `WorkspacePage::Catalog` variant maps to `label() => "Agents"` in `models.rs:23`.

---

## Requirements

1. **Rename file** -- `catalog.rs` renamed to `agents.rs`; all imports updated.
2. **Two-column layout** -- Left: agent list with search + status badges. Right: detail panel or builder form.
3. **Agent detail panel** -- Name, model, runtime, capabilities, system prompt (expandable), recent runs, handoff rules.
4. **Dispatch button** -- Opens a modal dialog with goal textarea + autonomy level selector (Supervised / Semi-auto / Full auto).
5. **Test button** -- Quick-dispatch with a canned goal ("Echo test: confirm agent is reachable").
6. **Builder form** -- Fields: name, display name, model selector, spawn command, install command, capabilities checkboxes, API key (password input), repo URL, branch defaults. Save writes to SpacetimeDB `user_agent_config`.
7. **Filter bar** -- Filter agent list by capability, status (available/running/offline), and kind (cloud/coding/user).

---

## Files Changed

| File | Action |
|------|--------|
| `rust/starbridge-dioxus/src/ui/views/catalog.rs` | Rename to `agents.rs`, rewrite |
| `rust/starbridge-dioxus/src/ui/views/mod.rs` | Update `mod catalog` to `mod agents` |
| `rust/starbridge-dioxus/src/ui/mod.rs` | Update import path, update `CatalogView` to `AgentsView` |
| `rust/starbridge-dioxus/src/ui/models.rs` | Add `AgentBuilderState`, `DispatchDialogState`, `AutonomyLevel` |
| `rust/starbridge-dioxus/src/ui/styles.rs` | Add `.agents-*` CSS classes |
| `rust/starbridge-dioxus/src/ui/shared.rs` | Add `ModalDialog` reusable component |

---

## Implementation Steps

### Step 1 -- Add data models and autonomy enum

Add to `models.rs`:

```rust
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum AutonomyLevel {
    Supervised,
    SemiAuto,
    FullAuto,
}

impl AutonomyLevel {
    pub fn label(self) -> &'static str {
        match self {
            AutonomyLevel::Supervised => "Supervised",
            AutonomyLevel::SemiAuto => "Semi-auto",
            AutonomyLevel::FullAuto => "Full auto",
        }
    }
    pub fn description(self) -> &'static str {
        match self {
            AutonomyLevel::Supervised => "Shows plan, waits for approval at each step",
            AutonomyLevel::SemiAuto => "Executes plan, pauses at approval gates only",
            AutonomyLevel::FullAuto => "Executes everything, reports results when done",
        }
    }
}

#[derive(Clone, Default)]
pub struct AgentBuilderState {
    pub name: String,
    pub display_name: String,
    pub model: String,
    pub spawn_command: String,
    pub install_command: String,
    pub capabilities: Vec<String>,
    pub api_key: String,
    pub repo_url: String,
    pub branch: String,
}

#[derive(Clone)]
pub struct DispatchDialogState {
    pub agent_id: String,
    pub goal: String,
    pub autonomy: AutonomyLevel,
}
```

**Commit:** `feat(desktop): add AutonomyLevel, AgentBuilderState, DispatchDialogState to models`

### Step 2 -- Rename catalog.rs to agents.rs and update imports

Rename the file. Update `views/mod.rs` from `pub mod catalog;` to `pub mod agents;`. Update `ui/mod.rs` to import `AgentsView` instead of `CatalogView`. Update the `match` arm for `WorkspacePage::Catalog`:

```rust
WorkspacePage::Catalog => rsx! { AgentsView { snapshot: snapshot.clone() } },
```

**Commit:** `refactor(desktop): rename catalog view to agents`

### Step 3 -- Build two-column layout with agent list

Rewrite `agents.rs` with a two-column grid. Left column: search input + scrollable agent list. Each list item shows name, model badge, status dot (green/yellow/gray), and kind badge.

```rust
#[component]
pub fn AgentsView(snapshot: MissionControlSnapshot) -> Element {
    let mut selected_agent = use_signal(|| None::<String>);
    let mut show_builder = use_signal(|| false);
    let mut search_query = use_signal(String::new);

    let agents = build_agent_list(&snapshot);
    let q = search_query().to_lowercase();
    let filtered: Vec<_> = agents
        .iter()
        .filter(|a| q.is_empty() || a.name.to_lowercase().contains(&q))
        .collect();

    rsx! {
        div { class: "page-grid page-grid-agents",
            section { class: "panel agents-list-panel",
                div { class: "panel-head",
                    input {
                        class: "search-input",
                        placeholder: "Filter agents...",
                        value: search_query(),
                        oninput: move |e| search_query.set(e.value()),
                    }
                    button {
                        class: "primary-button",
                        onclick: move |_| show_builder.set(true),
                        "+ New Agent"
                    }
                }
                // ... agent list items
            }
            section { class: "panel agents-detail-panel",
                // detail or builder form based on state
            }
        }
    }
}
```

**Commit:** `feat(desktop): agents two-column layout with search and list`

### Step 4 -- Agent detail panel with dispatch and test buttons

When an agent is selected and builder is not active, render the detail panel showing all agent fields. Add "Dispatch" and "Test" buttons at the top:

```rust
div { class: "agents-detail-header",
    h3 { "{agent.name}" }
    div { class: "agents-detail-actions",
        button {
            class: "primary-button",
            onclick: move |_| show_dispatch.set(true),
            "Dispatch"
        }
        button {
            class: "secondary-button",
            onclick: move |_| { /* dispatch with canned goal */ },
            "Test"
        }
    }
}
```

Display model, runtime, deployment, capabilities as badge strips, stages as a pipeline row, and tool permissions as a checklist.

**Commit:** `feat(desktop): agent detail panel with dispatch and test buttons`

### Step 5 -- Dispatch dialog modal

Add a `DispatchDialog` component rendered as an overlay. Contains a goal textarea, an autonomy level radio group (three options with labels and descriptions), and Dispatch/Cancel buttons. On dispatch, call `WebClient::dispatch_agent(agent_id, goal)`.

```rust
#[component]
fn DispatchDialog(
    agent_id: String,
    on_dispatch: EventHandler<DispatchDialogState>,
    on_close: EventHandler<()>,
) -> Element {
    let mut goal = use_signal(String::new);
    let mut autonomy = use_signal(|| AutonomyLevel::SemiAuto);

    rsx! {
        div { class: "modal-overlay",
            div { class: "modal-panel",
                h3 { "Dispatch Agent" }
                textarea {
                    class: "dispatch-goal-input",
                    placeholder: "Describe the goal...",
                    value: goal(),
                    oninput: move |e| goal.set(e.value()),
                }
                fieldset { class: "autonomy-selector",
                    // radio buttons for each AutonomyLevel variant
                }
                div { class: "modal-actions",
                    button { class: "primary-button", onclick: move |_| {
                        on_dispatch.call(DispatchDialogState {
                            agent_id: agent_id.clone(),
                            goal: goal(),
                            autonomy: autonomy(),
                        });
                    }, "Dispatch" }
                    button { class: "secondary-button",
                        onclick: move |_| on_close.call(()),
                        "Cancel"
                    }
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): dispatch dialog with goal input and autonomy selector`

### Step 6 -- Agent builder form

When "New Agent" is clicked, the right panel switches to a builder form. Fields: name (text), display name (text), model selector (dropdown populated from provider-routing catalog), spawn command (text), install command (text), capabilities (checkbox group: `code`, `browser`, `search`, `shell`, `memory`, `file_system`), API key (password input), repo URL (text), branch (text with "main" default). Save button writes to SpacetimeDB via `WebClient`.

```rust
#[component]
fn AgentBuilderForm(
    on_save: EventHandler<AgentBuilderState>,
    on_cancel: EventHandler<()>,
) -> Element {
    let mut state = use_signal(AgentBuilderState::default);
    // ... form fields bound to state signal
    rsx! {
        form { class: "agent-builder-form",
            // name, display_name, model selector, spawn_command,
            // install_command, capabilities checkboxes, api_key,
            // repo_url, branch
            div { class: "form-actions",
                button { class: "primary-button", r#type: "submit", "Save Agent" }
                button { class: "secondary-button",
                    onclick: move |_| on_cancel.call(()),
                    "Cancel"
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): agent builder form with all fields`

### Step 7 -- Styles and polish

Add CSS to `styles.rs` for all agents-view classes:

```css
.page-grid-agents {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    height: 100%;
}
.agents-list-panel { overflow-y: auto; }
.agents-detail-actions { display: flex; gap: 8px; }
.agent-builder-form { display: flex; flex-direction: column; gap: 12px; }
.modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
}
.modal-panel {
    background: var(--surface);
    padding: 24px; width: 480px; max-height: 80vh;
    overflow-y: auto; box-shadow: var(--shadow);
}
.dispatch-goal-input {
    width: 100%; min-height: 120px; resize: vertical;
    font-family: var(--sans); font-size: 13px;
    padding: 8px; border: 1px solid var(--outline-variant);
    background: var(--surface-container-lowest);
}
.autonomy-selector { border: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
```

**Commit:** `style(desktop): agents view and dispatch dialog CSS`

---

## Regression Tests

- [ ] Agent list renders all agents from snapshot (cloud personas + coding agents).
- [ ] Search input filters the list correctly (case-insensitive substring match).
- [ ] Selecting an agent shows the detail panel with correct fields.
- [ ] "Dispatch" button opens the modal; "Cancel" closes it without side effects.
- [ ] "Test" button dispatches with the canned goal string.
- [ ] Builder form validates required fields (name, model) before save.
- [ ] Builder "Cancel" returns to the detail/list view without persisting state.
- [ ] Sidebar still shows "Agents" label and correct count badge.
- [ ] `WorkspacePage::Catalog` routing still works after rename.

---

## Definition of Done

- `catalog.rs` no longer exists; `agents.rs` is the sole view file.
- Two-column layout matches DESKTOP_SPEC.md section 4.4.
- Dispatch dialog sends goal + autonomy level to `WebClient::dispatch_agent`.
- Builder form creates a new agent config in SpacetimeDB.
- All existing tests pass; no regressions in sidebar navigation.

---

## PR Template

```
## Summary
- Rename catalog view to agents with two-column layout
- Add agent detail panel with dispatch and test buttons
- Add dispatch dialog with goal input and autonomy level selector
- Add agent builder form with full field set
- Add reusable modal dialog component

## Test plan
- [ ] Navigate to Agents view via sidebar and command palette
- [ ] Select an agent, verify detail panel populates
- [ ] Open dispatch dialog, set goal and autonomy, dispatch
- [ ] Open builder form, fill all fields, save
- [ ] Search filters agent list correctly
- [ ] Test button dispatches with canned goal
```
