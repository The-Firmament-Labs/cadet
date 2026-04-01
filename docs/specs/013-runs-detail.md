# Spec 013 -- Runs Detail View

**Status:** Draft
**Scope:** Rename `workflow.rs` to runs, add 7-stage pipeline visualization, step timeline, tool call log
**Files:** `workflow.rs`, `models.rs`, `mod.rs`, `styles.rs`

---

## Context

The current `WorkflowStudioView` in `rust/starbridge-dioxus/src/ui/views/workflow.rs` renders a Kanban-style drag-and-drop board of workflow steps across the 7 canonical stages. The desktop spec (DESKTOP_SPEC.md section 4.3) defines a richer two-column layout with a run list on the left, and a detailed run inspector on the right featuring a pipeline visualization, step timeline, tool call log, output viewer, and learnings display.

### Current state

```rust
// workflow.rs:10-11
#[component]
pub fn WorkflowStudioView(snapshot: MissionControlSnapshot) -> Element {
```

The view uses `canonical_stages()` from `models.rs:141` which returns the 7-stage array: `["route", "plan", "gather", "act", "verify", "summarize", "learn"]`. The sidebar already labels this "Runs" (`WorkspacePage::Workflow` maps to `label() => "Runs"` in `models.rs:22`).

### Data available

- `snapshot.workflow_runs` -- `Vec<WorkflowRunRecord>` with `run_id`, `agent_id`, `status`, `goal`, timestamps
- `snapshot.workflow_steps` -- `Vec<WorkflowStepRecord>` with `step_id`, `run_id`, `stage`, `status`, `agent_id`, `duration_ms`
- `snapshot.tool_call_records` -- tool invocations tied to runs (not yet surfaced)
- `snapshot.chat_messages` -- can be filtered by `run_id` for learnings

---

## Requirements

1. **Rename file** -- `workflow.rs` renamed to `runs.rs`; all imports updated.
2. **Two-column layout** -- Left: run list with status/agent/date filters. Right: run detail.
3. **7-stage pipeline bar** -- Horizontal bar showing Route -> Plan -> Gather -> Act -> Verify -> Summarize -> Learn. Active stage highlighted with accent color, completed stages dimmed green, pending stages gray.
4. **Step timeline** -- Vertical list of steps for the selected run. Each step is an expandable card showing agent, stage, duration, status, and input/output when expanded.
5. **Tool call log** -- Collapsible section listing every tool invocation for the run with tool name, truncated input, output, and duration.
6. **Output viewer** -- The agent's final response or error message, rendered as markdown.
7. **Learnings display** -- Extracted learnings from the `learn` stage, shown as a callout box.

---

## Files Changed

| File | Action |
|------|--------|
| `rust/starbridge-dioxus/src/ui/views/workflow.rs` | Rename to `runs.rs`, rewrite |
| `rust/starbridge-dioxus/src/ui/views/mod.rs` | Update `mod workflow` to `mod runs` |
| `rust/starbridge-dioxus/src/ui/mod.rs` | Update import path, `WorkflowStudioView` to `RunsView` |
| `rust/starbridge-dioxus/src/ui/models.rs` | Add `RunDetailTab` enum |
| `rust/starbridge-dioxus/src/ui/styles.rs` | Add `.runs-*`, `.pipeline-*` CSS classes |

---

## Implementation Steps

### Step 1 -- Add RunDetailTab enum and helper functions

Add to `models.rs`:

```rust
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RunDetailTab {
    Timeline,
    ToolCalls,
    Output,
    Learnings,
}

impl RunDetailTab {
    pub fn label(self) -> &'static str {
        match self {
            RunDetailTab::Timeline => "Timeline",
            RunDetailTab::ToolCalls => "Tool Calls",
            RunDetailTab::Output => "Output",
            RunDetailTab::Learnings => "Learnings",
        }
    }
}
```

Add a helper to determine the active stage for a run:

```rust
pub fn active_stage(steps: &[WorkflowStepRecord], run_id: &str) -> Option<&'static str> {
    let run_steps: Vec<_> = steps.iter().filter(|s| s.run_id == run_id).collect();
    for stage in canonical_stages() {
        let stage_steps: Vec<_> = run_steps.iter().filter(|s| s.stage == stage).collect();
        if stage_steps.iter().any(|s| s.status == "running") {
            return Some(stage);
        }
        if stage_steps.iter().all(|s| s.status != "completed") {
            return Some(stage);
        }
    }
    None
}
```

**Commit:** `feat(desktop): add RunDetailTab enum and active_stage helper`

### Step 2 -- Rename workflow.rs to runs.rs and update imports

Rename the file. Update `views/mod.rs` from `pub mod workflow` to `pub mod runs`. Update `ui/mod.rs` to import `RunsView` instead of `WorkflowStudioView`. Update the match arm:

```rust
WorkspacePage::Workflow => rsx! { RunsView { snapshot: snapshot.clone() } },
```

**Commit:** `refactor(desktop): rename workflow view to runs`

### Step 3 -- Build two-column layout with run list and pipeline bar

Rewrite `runs.rs` with a two-column grid. Left column: filter bar (status dropdown, agent dropdown, date range) + scrollable run list. Each run item shows agent name, goal truncated to 60 chars, status badge, and relative timestamp. Right column: pipeline bar + tabbed detail.

```rust
#[component]
pub fn RunsView(snapshot: MissionControlSnapshot) -> Element {
    let mut selected_run = use_signal(|| None::<String>);
    let mut active_tab = use_signal(|| RunDetailTab::Timeline);
    let mut status_filter = use_signal(|| "all".to_string());

    rsx! {
        div { class: "page-grid page-grid-runs",
            section { class: "panel runs-list-panel",
                div { class: "panel-head",
                    select {
                        class: "filter-select",
                        value: status_filter(),
                        onchange: move |e| status_filter.set(e.value()),
                        option { value: "all", "All statuses" }
                        option { value: "running", "Running" }
                        option { value: "completed", "Completed" }
                        option { value: "failed", "Failed" }
                        option { value: "blocked", "Blocked" }
                    }
                }
                ul { class: "runs-list",
                    // filtered run items
                }
            }
            section { class: "panel runs-detail-panel",
                if let Some(run_id) = selected_run() {
                    // pipeline bar + tabs + content
                }
            }
        }
    }
}
```

The pipeline bar is a horizontal flexbox of 7 stage nodes connected by lines:

```rust
fn PipelineBar(active_stage: Option<&str>, steps: &[WorkflowStepRecord], run_id: &str) -> Element {
    rsx! {
        div { class: "pipeline-bar",
            for (i, stage) in canonical_stages().iter().enumerate() {
                div {
                    class: format_args!("pipeline-node {}",
                        if Some(*stage) == active_stage { "pipeline-node-active" }
                        else if is_stage_completed(steps, run_id, stage) { "pipeline-node-done" }
                        else { "pipeline-node-pending" }
                    ),
                    span { class: "pipeline-node-label", "{lane_copy(stage)}" }
                }
                if i < 6 {
                    div { class: "pipeline-connector" }
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): runs two-column layout with pipeline visualization`

### Step 4 -- Step timeline with expandable cards

Under the Timeline tab, render a vertical list of steps for the selected run. Each step is a card that can be expanded to show input/output:

```rust
fn StepTimelineCard(step: WorkflowStepRecord, expanded: bool, on_toggle: EventHandler<()>) -> Element {
    rsx! {
        div { class: "step-card",
            onclick: move |_| on_toggle.call(()),
            div { class: "step-card-header",
                span { class: "step-stage-badge", "{step.stage}" }
                span { class: "step-agent", "{step.agent_id}" }
                span { class: "step-duration", "{step.duration_ms}ms" }
                span { class: format_args!("status-dot status-{}", step.status) }
            }
            if expanded {
                div { class: "step-card-body",
                    pre { class: "step-output", "{step.output}" }
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): step timeline with expandable cards`

### Step 5 -- Tool call log and output viewer

Add the ToolCalls tab: a collapsible list of tool invocations showing tool name, truncated input (first 80 chars), output preview, and duration. Add the Output tab: render the run's final `output` field as formatted text. Add the Learnings tab: filter steps where `stage == "learn"` and render their output in a `CalloutBox` (already available in `shared.rs`).

```rust
// Tool call log entry
div { class: "tool-call-entry",
    div { class: "tool-call-header",
        span { class: "tool-call-name mono", "{tool_call.tool_name}" }
        span { class: "tool-call-duration", "{tool_call.duration_ms}ms" }
    }
    if expanded {
        div { class: "tool-call-body",
            div { class: "tool-call-section",
                label { "Input" }
                pre { class: "mono", "{tool_call.input}" }
            }
            div { class: "tool-call-section",
                label { "Output" }
                pre { class: "mono", "{tool_call.output}" }
            }
        }
    }
}
```

**Commit:** `feat(desktop): tool call log, output viewer, and learnings display`

### Step 6 -- Styles for runs view

Add CSS to `styles.rs`:

```css
.page-grid-runs {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 16px;
    height: 100%;
}
.runs-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; }
.runs-list li { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--outline-variant); }
.runs-list li:hover { background: var(--surface-container-low); }
.runs-list li.selected { background: var(--surface-container); }

/* Pipeline bar */
.pipeline-bar { display: flex; align-items: center; gap: 0; padding: 16px 0; }
.pipeline-node {
    display: flex; flex-direction: column; align-items: center;
    padding: 6px 10px; font-size: 11px; font-weight: 500;
    border: 1px solid var(--outline-variant); background: var(--surface-container-lowest);
}
.pipeline-node-active {
    background: var(--primary); color: var(--on-primary);
    border-color: var(--primary); animation: stage-progress 1.5s ease infinite;
}
.pipeline-node-done { background: var(--tertiary-container); color: var(--tertiary); border-color: var(--tertiary); }
.pipeline-node-pending { opacity: 0.4; }
.pipeline-connector { width: 24px; height: 2px; background: var(--outline-variant); flex-shrink: 0; }

/* Step cards */
.step-card { border: 1px solid var(--outline-variant); margin-bottom: 8px; cursor: pointer; }
.step-card-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; font-size: 12px; }
.step-card-body { padding: 0 12px 12px; border-top: 1px solid var(--outline-variant); }

/* Tool calls */
.tool-call-entry { border-bottom: 1px solid var(--outline-variant); padding: 8px 0; }
.tool-call-header { display: flex; justify-content: space-between; font-size: 12px; }
.tool-call-body { padding: 8px 0; font-size: 11px; }
.tool-call-section { margin-bottom: 8px; }
.tool-call-section label { font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
```

**Commit:** `style(desktop): runs view, pipeline bar, and step card CSS`

---

## Regression Tests

- [ ] Run list renders all runs from snapshot, sorted by timestamp descending.
- [ ] Status filter correctly narrows the run list.
- [ ] Selecting a run shows the pipeline bar with the correct active stage highlighted.
- [ ] Pipeline stages transition correctly: completed (green), active (accent), pending (gray).
- [ ] Step timeline shows all steps for the selected run in chronological order.
- [ ] Expanding a step card reveals input/output content.
- [ ] Tool call log shows all tool invocations for the selected run.
- [ ] Output tab renders the final agent response.
- [ ] Learnings tab shows `learn`-stage outputs in a callout box.
- [ ] Sidebar still shows "Runs" label and step count badge.
- [ ] `WorkspacePage::Workflow` routing still works after rename.

---

## Definition of Done

- `workflow.rs` no longer exists; `runs.rs` is the sole view file.
- Two-column layout matches DESKTOP_SPEC.md section 4.3.
- Pipeline visualization accurately reflects run stage progression.
- All four tabs (Timeline, Tool Calls, Output, Learnings) render content.
- No regressions in existing Kanban-style step manipulation (drag logic removed cleanly).

---

## PR Template

```
## Summary
- Rename workflow view to runs with two-column layout
- Add 7-stage pipeline visualization bar
- Add step timeline with expandable cards
- Add tool call log, output viewer, and learnings display tabs

## Test plan
- [ ] Navigate to Runs view via sidebar and command palette
- [ ] Select a run, verify pipeline bar highlights correct stage
- [ ] Expand step cards, verify input/output renders
- [ ] Switch between Timeline, Tool Calls, Output, Learnings tabs
- [ ] Filter runs by status
- [ ] Verify no regressions in sidebar navigation
```
