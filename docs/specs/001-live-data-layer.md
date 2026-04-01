# SPEC 001: Live Data Layer — Per-Table Dioxus Signals

## Status: Ready to Execute
## Priority: P0
## Depends on: None (foundation for all desktop views)
## Estimated effort: 2-3 days

## Context

`live.rs` currently rebuilds an entire `MissionControlSnapshot` struct (10 tables, ~400 lines of mapping code) on **every single row change** across any table. When a chat message arrives, the workflow runs, memory documents, browser tasks, and every other table get re-collected, re-sorted, and re-cloned. The `MissionControlApp` component receives this monolithic snapshot as a prop, meaning the entire UI tree re-renders on any change to any table.

This is the single biggest performance bottleneck in the desktop app. A per-table signal architecture lets Dioxus skip re-rendering views that don't depend on the changed table.

**Current flow (broken):**
```
row change in ANY table
  -> publish_snapshot()
    -> snapshot_from_context() iterates ALL 10 tables
      -> MissionControlApp re-renders EVERYTHING
```

**Target flow:**
```
row change in workflow_run table
  -> update workflow_runs signal ONLY
    -> Overview and Runs views re-render
    -> Chat, Memory, etc. untouched
```

## Requirements

1. Replace `MissionControlSnapshot` prop-passing with a `LiveState` struct containing individual `Signal<Vec<T>>` per table
2. Provide `LiveState` as Dioxus context so any view can read only the signals it needs
3. Rewrite `watch_table!` / `watch_table_updates!` / `watch_table_deletes!` macros to update individual signals instead of rebuilding the full snapshot
4. Rewrite `snapshot_from_context` to populate individual signals on initial subscription apply
5. Keep `subscribe_to_all_tables()` for now (targeted per-view subscriptions are a future spec)
6. Add a `connection_status: Signal<ConnectionStatus>` for the UI to show connection state
7. Existing views must continue working during migration (they can read from `LiveState` context)

## Files to Create/Modify

- `rust/starbridge-dioxus/src/live.rs` — Major rewrite: `LiveState` struct, per-signal callbacks, context provider setup
- `rust/starbridge-dioxus/src/ui/mod.rs` — Remove `snapshot` prop from `MissionControlApp`, consume `LiveState` from context
- `rust/starbridge-dioxus/src/ui/views/overview.rs` — Read from `use_context::<LiveState>()` instead of snapshot prop
- `rust/starbridge-dioxus/src/ui/views/ai_chat.rs` — Read from context
- `rust/starbridge-dioxus/src/ui/views/catalog.rs` — Read from context
- `rust/starbridge-dioxus/src/ui/views/memory.rs` — Read from context
- `rust/starbridge-dioxus/src/ui/views/workflow.rs` — Read from context
- `rust/starbridge-core/src/lib.rs` — No changes (record types stay as-is)

## Implementation Steps

### Step 1: Define LiveState and ConnectionStatus

Add the `LiveState` struct with one `Signal<Vec<T>>` per SpacetimeDB table and a connection status signal. This is a new public struct in `live.rs`.

```rust
use dioxus::prelude::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connecting,
    Connected,
    Disconnected,
    Error(/* we'll store the message separately */),
}

#[derive(Clone, Copy)]
pub struct LiveState {
    pub workflow_runs: Signal<Vec<WorkflowRunRecord>>,
    pub workflow_steps: Signal<Vec<WorkflowStepRecord>>,
    pub browser_tasks: Signal<Vec<BrowserTaskRecord>>,
    pub memory_documents: Signal<Vec<MemoryDocumentRecord>>,
    pub memory_chunks: Signal<Vec<MemoryChunkRecord>>,
    pub memory_embeddings: Signal<Vec<MemoryEmbeddingRecord>>,
    pub retrieval_traces: Signal<Vec<RetrievalTraceRecord>>,
    pub approval_requests: Signal<Vec<ApprovalRequestRecord>>,
    pub threads: Signal<Vec<ChatThreadRecord>>,
    pub message_events: Signal<Vec<MessageEventRecord>>,
    pub connection_status: Signal<ConnectionStatus>,
    pub connection_error: Signal<Option<String>>,
}

impl LiveState {
    pub fn new() -> Self {
        Self {
            workflow_runs: Signal::new(Vec::new()),
            workflow_steps: Signal::new(Vec::new()),
            browser_tasks: Signal::new(Vec::new()),
            memory_documents: Signal::new(Vec::new()),
            memory_chunks: Signal::new(Vec::new()),
            memory_embeddings: Signal::new(Vec::new()),
            retrieval_traces: Signal::new(Vec::new()),
            approval_requests: Signal::new(Vec::new()),
            threads: Signal::new(Vec::new()),
            message_events: Signal::new(Vec::new()),
            connection_status: Signal::new(ConnectionStatus::Connecting),
            connection_error: Signal::new(None),
        }
    }

    /// Convenience: build a MissionControlSnapshot from current signal values.
    /// Used during migration so views that still expect the old struct can work.
    pub fn to_snapshot(&self) -> MissionControlSnapshot {
        MissionControlSnapshot {
            environment: String::new(),
            generated_at: String::new(),
            workflow_runs: (self.workflow_runs)(),
            workflow_steps: (self.workflow_steps)(),
            browser_tasks: (self.browser_tasks)(),
            memory_documents: (self.memory_documents)(),
            memory_chunks: (self.memory_chunks)(),
            memory_embeddings: (self.memory_embeddings)(),
            retrieval_traces: (self.retrieval_traces)(),
            approval_requests: (self.approval_requests)(),
            threads: (self.threads)(),
            message_events: (self.message_events)(),
        }
    }
}
```

**Commit:** `feat(desktop): define LiveState struct with per-table signals`
**Test:** Compiles. `LiveState::new()` creates empty signals. `to_snapshot()` returns an empty snapshot.

### Step 2: Rewrite snapshot_from_context to populate individual signals

Replace the current `snapshot_from_context` (which returns a `MissionControlSnapshot`) with `populate_signals_from_context` that writes into each signal individually. This runs once on `on_applied` (initial subscription).

```rust
fn populate_signals_from_context(
    ctx: &impl RemoteDbContext,
    state: &LiveState,
) {
    // Workflow runs
    let mut runs: Vec<WorkflowRunRecord> = ctx.db().workflow_run().iter()
        .map(|run| WorkflowRunRecord {
            run_id: run.run_id,
            thread_id: run.thread_id,
            agent_id: run.agent_id,
            goal: run.goal,
            priority: run.priority,
            trigger_source: run.trigger_source,
            requested_by: run.requested_by,
            current_stage: run.current_stage,
            status: run.status,
            summary: run.summary,
        })
        .collect();
    runs.sort_by(|a, b| a.run_id.cmp(&b.run_id));
    state.workflow_runs.set(runs);

    // ... same pattern for each of the 9 remaining tables ...
    // Each table writes to its own signal only.

    state.connection_status.set(ConnectionStatus::Connected);
}
```

**Commit:** `feat(desktop): populate individual signals on subscription apply`
**Test:** Connect to SpacetimeDB, verify each signal contains the expected rows after `on_applied` fires.

### Step 3: Rewrite watch_table! macros for per-signal updates

Replace the three macros (`watch_table!`, `watch_table_updates!`, `watch_table_deletes!`) with a single `register_signal_watchers` function that uses a new macro updating only the relevant signal.

```rust
fn register_signal_watchers(connection: &DbConnection, state: &LiveState) {
    macro_rules! watch_signal {
        ($table:ident, $signal:ident, $record_type:ident, $map_fn:expr) => {{
            // on_insert: add the new row
            let signal = state.$signal;
            connection.db.$table().on_insert(move |_ctx, row| {
                let record = $map_fn(row);
                let mut current = (signal)();
                current.push(record);
                signal.set(current);
            });

            // on_delete: remove the row (by matching primary key)
            let signal = state.$signal;
            connection.db.$table().on_delete(move |_ctx, row| {
                let record = $map_fn(row);
                let mut current = (signal)();
                current.retain(|r| r != &record);
                signal.set(current);
            });

            // on_update: replace the old row with the new one
            let signal = state.$signal;
            connection.db.$table().on_update(move |_ctx, _old, new_row| {
                let record = $map_fn(new_row);
                let mut current = (signal)();
                // Find and replace by primary key, or push if not found
                if let Some(pos) = current.iter().position(|r| r == &record) {
                    current[pos] = record;
                } else {
                    current.push(record);
                }
                signal.set(current);
            });
        }};
    }

    watch_signal!(workflow_run, workflow_runs, WorkflowRunRecord, |run: &_| {
        WorkflowRunRecord {
            run_id: run.run_id.clone(),
            thread_id: run.thread_id.clone(),
            // ... map all fields
        }
    });

    // Repeat for all 10 tables.
}
```

Note: The record types already derive `PartialEq` in `starbridge-core`, so `retain` and position-matching work directly. For tables with a clear primary key (e.g., `run_id`, `step_id`, `task_id`), prefer matching on the primary key field for correctness:

```rust
current.retain(|r| r.run_id != record.run_id);
```

**Commit:** `feat(desktop): per-signal row callbacks replace full snapshot rebuild`
**Test:** Insert a row into `workflow_run` via SpacetimeDB CLI. Verify only `workflow_runs` signal updates. Other signals unchanged.

### Step 4: Provide LiveState as Dioxus context and update MissionControlApp

In the app shell (`ui/mod.rs`), remove the `snapshot: MissionControlSnapshot` prop. Instead, create `LiveState` with `use_context_provider` and spawn the SpacetimeDB connection in a `use_effect`.

```rust
// ui/mod.rs
#[component]
pub fn MissionControlApp() -> Element {
    // Provide LiveState to all child views
    let state = use_context_provider(|| LiveState::new());

    // Spawn SpacetimeDB connection (runs once)
    use_effect(move || {
        let options = LiveSnapshotOptions::from_env();
        spawn(async move {
            if let Err(e) = connect_and_subscribe(options, state).await {
                state.connection_status.set(ConnectionStatus::Error);
                state.connection_error.set(Some(e));
            }
        });
    });

    // Migration bridge: build snapshot from signals for views not yet ported
    let snapshot = state.to_snapshot();
    let metrics = queue_metrics(&snapshot);
    let namespaces = memory_namespaces(&snapshot);
    let connection_status = (state.connection_status)();

    // ... rest of the UI unchanged, but views that are ported
    // read directly from use_context::<LiveState>()
}
```

**Commit:** `feat(desktop): provide LiveState via Dioxus context, remove snapshot prop`
**Test:** App launches. All views still render. Connection status shows "Connected" after SpacetimeDB connects.

### Step 5: Port views to consume signals directly

Migrate each view one at a time. Each view replaces its snapshot parameter access with `use_context::<LiveState>()`. Example for Overview:

```rust
// ui/views/overview.rs
#[component]
pub fn OverviewView() -> Element {
    let state = use_context::<LiveState>();
    let runs = (state.workflow_runs)();
    let steps = (state.workflow_steps)();
    let approvals = (state.approval_requests)();
    let tasks = (state.browser_tasks)();

    // Compute metrics from the signal data
    let active_runs = runs.iter().filter(|r| r.status == "running").count();
    let pending_approvals = approvals.iter().filter(|a| a.status == "pending").count();

    rsx! {
        div { class: "overview-grid",
            MetricTile { label: "Active Runs", value: "{active_runs}" }
            MetricTile { label: "Pending Approvals", value: "{pending_approvals}" }
            // ... rest of overview
        }
    }
}
```

Port order (by dependency/usage):
1. `overview.rs` — reads `workflow_runs`, `workflow_steps`, `approval_requests`, `browser_tasks`
2. `workflow.rs` — reads `workflow_runs`, `workflow_steps`
3. `catalog.rs` — reads `workflow_runs` (for agent status)
4. `memory.rs` — reads `memory_documents`, `memory_chunks`, `memory_embeddings`
5. `ai_chat.rs` — reads `threads`, `message_events`

Each view is a separate commit so we can bisect regressions.

**Commit:** `refactor(desktop): port {view_name} to LiveState signals`
**Test:** For each view: navigate to the view, verify data displays. Change a row in SpacetimeDB, verify only that view re-renders.

### Step 6: Remove legacy snapshot code

Once all views are ported:
- Remove `MissionControlSnapshot` prop pathway from `MissionControlApp`
- Remove `to_snapshot()` bridge method from `LiveState`
- Remove old `snapshot_from_context()`, `publish_snapshot()`, `subscribe_live_snapshots()` functions
- Remove `SnapshotCallback` / `ErrorCallback` type aliases
- Remove the `load_live_snapshot()` and `render_live_preview()` functions (or keep behind a feature flag for CLI usage)
- Clean up unused imports

**Commit:** `refactor(desktop): remove legacy MissionControlSnapshot rebuild pathway`
**Test:** Full app smoke test. All views work. No references to `MissionControlSnapshot` in UI code (grep). CLI binary still compiles if it uses the snapshot pathway behind a feature flag.

## Regression Tests

- **All 6 views render correctly** after migration (Overview, Workflow, Catalog, Memory, Chat, Conversations)
- **Real-time updates work**: insert a row via SpacetimeDB CLI, verify the relevant view updates within 1 second
- **Isolation holds**: insert a `memory_document` row, verify that the Overview view does NOT re-render (use Dioxus devtools or debug logging)
- **Connection lifecycle**: disconnect SpacetimeDB, verify `connection_status` signal shows `Disconnected`. Reconnect, verify `Connected`.
- **Empty state**: fresh database with no rows, verify all views render empty states without panics
- **Large dataset**: load 1000+ rows into `message_events`, verify the app doesn't freeze on initial `on_applied`

## Definition of Done

- [ ] `LiveState` struct defined with `Signal<Vec<T>>` for all 10 tables
- [ ] `ConnectionStatus` signal reflects real connection state
- [ ] `on_insert` / `on_update` / `on_delete` callbacks update only the affected signal
- [ ] `LiveState` provided via `use_context_provider` in the app root
- [ ] All existing views ported to read from `use_context::<LiveState>()`
- [ ] No full-snapshot rebuild on individual row changes
- [ ] `to_snapshot()` bridge works during migration (can be removed after all views ported)
- [ ] Legacy snapshot code removed (or feature-gated for CLI)
- [ ] Manual smoke test passes on all views

## PR

**Title:** feat(desktop): per-table Dioxus signals replace monolithic snapshot
**Labels:** desktop, foundation
