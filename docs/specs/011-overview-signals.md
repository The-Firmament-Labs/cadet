# Spec 011 — Migrate Overview to Per-Table Signals

**Status:** Not Started
**Effort:** Small
**Depends on:** 001 (Live Data Layer)
**Produces:** Modified `rust/starbridge-dioxus/src/ui/views/overview.rs`

---

## Context

The current `OverviewView` takes a monolithic `MissionControlSnapshot` as a prop. Every time ANY SpacetimeDB table changes (a new chat message, a memory document update, a retrieval trace), the entire snapshot rebuilds and the Overview re-renders — even if the change was in a completely unrelated table.

After spec 001 introduces per-table signals via `LiveState`, the Overview must be migrated to read individual signals (`workflow_runs`, `workflow_steps`, `approval_requests`, `browser_tasks`) instead of destructuring a single snapshot. This eliminates unnecessary re-renders and is a prerequisite for scaling to 12 views without performance degradation.

**Current code problem (overview.rs:17):**
```rust
// BEFORE: Monolithic snapshot causes full re-render on any table change
#[component]
pub fn OverviewView(snapshot: MissionControlSnapshot) -> Element {
    let metrics = queue_metrics(&snapshot);
    let runs = snapshot.workflow_runs.clone();
    let browser_tasks = snapshot.browser_tasks.clone();
    let approvals = snapshot.approval_requests.clone();
    let steps = snapshot.workflow_steps.clone();
    // ...
}
```

**Target:**
```rust
// AFTER: Per-table signals — only re-render when relevant data changes
#[component]
pub fn OverviewView() -> Element {
    let live = use_context::<LiveState>();
    let runs = live.workflow_runs.read();
    let steps = live.workflow_steps.read();
    let approvals = live.approval_requests.read();
    let browser_tasks = live.browser_tasks.read();
    let metrics = queue_metrics_from_signals(&runs, &approvals);
    // ...
}
```

---

## Requirements

### R1 — Remove MissionControlSnapshot prop
- `OverviewView` takes no props (reads from context instead).
- All callers updated to stop passing snapshot.

### R2 — Read from LiveState signals
- Use `use_context::<LiveState>()` to access per-table signals.
- Read only the 4 tables the overview needs: `workflow_runs`, `workflow_steps`, `approval_requests`, `browser_tasks`.
- This means the overview does NOT re-render when `chat_messages`, `memory_documents`, or other unrelated tables change.

### R3 — Update queue_metrics helper
- Current `queue_metrics` takes `&MissionControlSnapshot`.
- New `queue_metrics_from_signals` takes individual slices: `&[WorkflowRunRecord]`, `&[ApprovalRequestRecord]`.
- Keep the old function temporarily for backward compatibility, mark `#[deprecated]`.

### R4 — Update all callers
- `ui/mod.rs` or wherever `OverviewView` is instantiated — remove the `snapshot` prop.
- Ensure `LiveState` is provided as context at the app root.

### R5 — Preserve all existing functionality
- Run queue list, run detail, tab switching (Timeline/Browser/Approvals), approval resolution, metric tiles — all must work identically.
- The only change is the data source (signals instead of snapshot).

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `rust/starbridge-dioxus/src/ui/views/overview.rs` | **Modify** | Remove snapshot prop, read from LiveState signals |
| `rust/starbridge-dioxus/src/ui/models.rs` | **Modify** | Add `queue_metrics_from_signals` function |
| `rust/starbridge-dioxus/src/ui/mod.rs` | **Modify** | Update `OverviewView` invocation (remove snapshot prop) |
| `rust/starbridge-dioxus/src/bin/starbridge_dioxus_ui.rs` | **Modify** | Ensure `LiveState` is provided as context |

---

## Implementation Steps

### Step 1 — Add queue_metrics_from_signals alongside existing function

**Commit:** `refactor(overview): add queue_metrics_from_signals for per-table signal consumption`

```rust
// rust/starbridge-dioxus/src/ui/models.rs

use starbridge_core::{WorkflowRunRecord, ApprovalRequestRecord};

pub struct QueueMetrics {
    pub active_runs: usize,
    pub pending_approvals: usize,
    pub blocked_runs: usize,
    pub completed_today: usize,
}

/// New: compute metrics from individual table slices (for per-table signals).
pub fn queue_metrics_from_signals(
    runs: &[WorkflowRunRecord],
    approvals: &[ApprovalRequestRecord],
) -> QueueMetrics {
    let now_micros = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros() as i64;
    let day_micros: i64 = 86_400_000_000;
    let day_start = now_micros - day_micros;

    QueueMetrics {
        active_runs: runs.iter().filter(|r| r.status == "running").count(),
        pending_approvals: approvals.iter().filter(|a| a.status == "pending").count(),
        blocked_runs: runs.iter().filter(|r| r.status == "blocked").count(),
        completed_today: runs.iter()
            .filter(|r| r.status == "completed" && r.created_at_micros > day_start)
            .count(),
    }
}

#[deprecated(note = "Use queue_metrics_from_signals with LiveState instead")]
pub fn queue_metrics(snapshot: &MissionControlSnapshot) -> QueueMetrics {
    queue_metrics_from_signals(&snapshot.workflow_runs, &snapshot.approval_requests)
}
```

**Test:** `test_queue_metrics_from_signals` with sample runs and approvals. Verify counts for active, pending, blocked, completed_today.

---

### Step 2 — Rewrite OverviewView to use LiveState context

**Commit:** `refactor(overview): migrate from MissionControlSnapshot to per-table signals`

Replace the component signature and data access:

```rust
// rust/starbridge-dioxus/src/ui/views/overview.rs

use dioxus::prelude::*;
use starbridge_core::{ApprovalRequestRecord, WorkflowRunRecord};

use crate::{
    resolve_live_approval,
    ui::{
        models::{queue_metrics_from_signals, OverviewTab},
        shared::{
            status_badge_class, BrowserTaskRow, CalloutBox, EmptyState, InspectorCard,
            MetricTile, RunListItem, WorkflowStepRow, segmented_button_class,
        },
        LiveState, OperatorRuntimeContext,
    },
};

#[component]
pub fn OverviewView() -> Element {
    let live = use_context::<LiveState>();
    let runtime = try_use_context::<OperatorRuntimeContext>();

    // Read only the signals this view needs
    let runs = live.workflow_runs.read();
    let steps = live.workflow_steps.read();
    let approvals = live.approval_requests.read();
    let browser_tasks = live.browser_tasks.read();

    let metrics = queue_metrics_from_signals(&runs, &approvals);

    let mut selected_run_id = use_signal(|| runs.first().map(|run| run.run_id.clone()));
    let mut tab = use_signal(|| OverviewTab::Timeline);
    let mut action_notice = use_signal(|| None::<String>);
    let mut action_error = use_signal(|| None::<String>);

    let active_run_id = selected_run_id()
        .clone()
        .or_else(|| runs.first().map(|run| run.run_id.clone()));
    let selected_run = active_run_id
        .as_ref()
        .and_then(|run_id| runs.iter().find(|run| &run.run_id == run_id))
        .cloned();
    let selected_steps = active_run_id
        .as_ref()
        .map(|run_id| {
            steps
                .iter()
                .filter(|step| &step.run_id == run_id)
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let selected_browser = active_run_id
        .as_ref()
        .map(|run_id| {
            browser_tasks
                .iter()
                .filter(|task| &task.run_id == run_id)
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let selected_approvals = active_run_id
        .as_ref()
        .map(|run_id| {
            approvals
                .iter()
                .filter(|approval| &approval.run_id == run_id)
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    // ... rest of the rsx! is UNCHANGED from the current implementation
    // The only difference is data source: signals instead of snapshot destructuring
    rsx! {
        div { class: "page-grid page-grid-overview",
            // Left panel: run queue (identical to current)
            section { class: "panel",
                div { class: "panel-head",
                    p { class: "section-eyebrow", "Run queue" }
                    h3 { class: "card-title", "Live runs" }
                    p { class: "row-copy", "{runs.len()} tracked workflows." }
                }
                div { class: "panel-body list-stack",
                    if runs.is_empty() {
                        EmptyState {
                            title: "No workflow runs".to_string(),
                            body: "Publish a run into SpacetimeDB to populate the operator queue.".to_string(),
                        }
                    } else {
                        for run in runs.iter() {
                            RunListItem {
                                run: run.clone(),
                                active: active_run_id.as_ref().map(|v| v == &run.run_id).unwrap_or(false),
                                onclick: {
                                    let run_id = run.run_id.clone();
                                    move |_| selected_run_id.set(Some(run_id.clone()))
                                }
                            }
                        }
                    }
                }
            }

            // Center + right panels: identical to current, using local vars instead of snapshot fields
            // ... (omitted for brevity — the rsx structure is unchanged)
        }
    }
}
```

**Test:** `cargo build --features desktop-ui` succeeds. Launch app, verify Overview page shows run queue, metrics, and detail panel identically to before.

---

### Step 3 — Update callers to remove snapshot prop

**Commit:** `refactor(overview): update callers to use propless OverviewView`

In `ui/mod.rs` (or wherever the page router lives), change:

```rust
// BEFORE
WorkspacePage::Overview => rsx! {
    OverviewView { snapshot: snapshot.clone() }
}

// AFTER
WorkspacePage::Overview => rsx! {
    OverviewView {}
}
```

Also update any test harnesses or storybook-style renderers that pass snapshot to OverviewView.

**Test:** Build and run. Navigate between all pages. Verify Overview renders correctly without any props.

---

### Step 4 — Remove deprecated queue_metrics usages

**Commit:** `refactor(overview): remove deprecated queue_metrics calls`

Search the codebase for any remaining calls to the old `queue_metrics(&snapshot)` and replace with `queue_metrics_from_signals`. If no other callers exist, remove the deprecated function entirely.

```rust
// Remove from models.rs if no callers remain:
// #[deprecated]
// pub fn queue_metrics(snapshot: &MissionControlSnapshot) -> QueueMetrics { ... }
```

**Test:** `cargo build --features desktop-ui` succeeds with no deprecation warnings from this module.

---

## Regression Tests

| # | Test | Validates |
|---|------|-----------|
| 1 | `test_queue_metrics_active_runs` | 3 running + 2 completed = active_runs: 3 |
| 2 | `test_queue_metrics_pending_approvals` | 2 pending + 1 resolved = pending_approvals: 2 |
| 3 | `test_queue_metrics_blocked_runs` | 1 blocked run counted |
| 4 | `test_queue_metrics_completed_today` | Runs from today counted, yesterday excluded |
| 5 | `test_queue_metrics_empty` | Empty slices produce all-zero metrics |
| 6 | `test_overview_no_snapshot_prop` | `OverviewView` compiles without any props |
| 7 | `cargo build --features desktop-ui` | Full app compiles |
| 8 | Manual: navigate to Overview | Run queue, detail, tabs all render |
| 9 | Manual: insert a run via SpacetimeDB | Overview updates without full page re-render |
| 10 | Manual: insert a chat_message | Overview does NOT re-render (different signal) |

---

## Definition of Done

- [ ] `OverviewView` takes no props — reads from `LiveState` context
- [ ] Only `workflow_runs`, `workflow_steps`, `approval_requests`, `browser_tasks` signals read
- [ ] `queue_metrics_from_signals` replaces `queue_metrics` everywhere
- [ ] All callers updated (no snapshot prop passed)
- [ ] Run queue list renders identically to before
- [ ] Run detail with Timeline/Browser/Approvals tabs works
- [ ] Approval resolution works (approve/reject buttons)
- [ ] Metric tiles show correct counts
- [ ] No re-render when unrelated tables change (chat_messages, memory_documents)
- [ ] All 7 automated regression tests pass
- [ ] `cargo build --features desktop-ui` succeeds

---

## PR Template

```markdown
## Summary
- Migrated OverviewView from monolithic MissionControlSnapshot to per-table signals
- Eliminated unnecessary re-renders when unrelated SpacetimeDB tables change
- Added queue_metrics_from_signals to compute metrics from individual table slices
- Removed deprecated queue_metrics function

## Test plan
- [ ] Navigate to Overview, verify run queue list renders
- [ ] Select a run, verify detail panel shows timeline/browser/approvals
- [ ] Approve a request, verify status updates
- [ ] Verify metric tiles show correct active/pending/blocked/completed counts
- [ ] Insert a chat message via another client — verify Overview does NOT re-render
- [ ] Run `cargo test` — all 7 tests pass
- [ ] Run `cargo build --features desktop-ui` — builds clean
```
