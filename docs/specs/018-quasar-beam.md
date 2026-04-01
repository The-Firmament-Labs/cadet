# 018 — Quasar Beam (Live Workflow Visualization)

**Status:** Not Started
**Depends On:** 001 (Live Data Layer), 013 (Runs Detail)
**Effort:** Medium
**PR Branch:** `feat/018-quasar-beam`

---

## Context

Quasar Beam is THE key SpacetimeDB differentiator. Every competitor shows a progress bar or a static step list. Cadet shows a **live x-ray** of the 7-stage workflow as it executes: the gather step populating context, the act step streaming tool calls, the verify step running tests — all updating in real-time via push subscriptions. No polling. No loading spinners.

SpacetimeDB makes this possible because every reducer mutation to `workflow_step` and `tool_call_record` automatically pushes to every matching subscription. The desktop receives step transitions and tool call completions the instant they happen. The client-side cache means the data is already in RAM when the view renders — zero network reads.

### The 7-Stage Pipeline

```
Route → Plan → Gather → Act → Verify → Summarize → Learn
```

Each stage transitions through: `pending → active → completed | failed | skipped`. The desktop renders this as a horizontal pipeline with the active stage highlighted and pulsing.

### What Competitors Show vs. What Cadet Shows

| Competitor | Visibility | Latency |
|-----------|-----------|---------|
| Devin | Progress bar + step list (polling) | 1-5s refresh |
| Cursor | Thinking indicator + tool call list | Real-time (local) |
| Factory | "Working on it..." + final result | Minutes |
| **Cadet** | **Live pipeline + streaming tool cards + stage transitions** | **< 100ms push** |

---

## Requirements

1. **Subscribe to `workflow_step` filtered by `run_id`:** When a run is selected in the runs view, subscribe to all steps for that run. Each step has `stage`, `status`, `started_at_micros`, `completed_at_micros`, `output_summary`. Steps update in-place as the stage progresses.
2. **Subscribe to `tool_call_record` filtered by `run_id`:** Each tool call has `tool_name`, `input_summary`, `output_summary`, `status`, `duration_ms`, `step_id`. Tool calls appear as cards within the active stage as they happen.
3. **7-stage pipeline visualization:** A horizontal bar with 7 segments, one per stage. Each segment shows: stage name, status icon (pending/active/completed/failed), duration when completed. The active stage pulses with a CSS animation. Completed stages show a green checkmark. Failed stages show a red X.
4. **LIVE status transitions:** When SpacetimeDB pushes a step update (e.g., `gather: pending → active`), the pipeline visualization updates immediately. No manual refresh. The transition should animate (150ms fade).
5. **Tool call cards:** Below the pipeline bar, tool call cards appear in real-time as the agent invokes tools. Each card shows: tool name, status badge (running/success/error), input (collapsed by default), output (collapsed by default), duration. Cards stream in as they happen — the user sees the agent working live.
6. **Streaming progress indicators:** While a stage is active, show a pulsing dot animation. While a tool call is running, show an animated spinner on its card. When streaming LLM output during Act stage, show a token counter or output preview.

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `rust/starbridge-dioxus/src/live.rs` | MODIFY | Add filtered subscription for `workflow_step` and `tool_call_record` by `run_id` |
| `rust/starbridge-dioxus/src/ui/views/runs.rs` | MODIFY | Replace static pipeline with live Quasar Beam visualization |
| `rust/starbridge-dioxus/src/ui/components/pipeline.rs` | NEW | 7-stage pipeline bar component with animation states |
| `rust/starbridge-dioxus/src/ui/components/tool_card.rs` | NEW | Real-time tool call card component with expand/collapse |
| `rust/starbridge-dioxus/src/ui/components/mod.rs` | MODIFY | Export new pipeline and tool_card components |
| `rust/starbridge-dioxus/src/ui/styles.rs` | MODIFY | Add pipeline animation CSS (pulse, fade, spinner) |

---

## Implementation Steps

### Step 1: Filtered subscriptions for workflow_step + tool_call_record

In `live.rs`, add a method `subscribe_to_run(run_id: &str)` that creates filtered SpacetimeDB subscriptions for `workflow_step WHERE run_id = :id` and `tool_call_record WHERE run_id = :id`. Maintain per-run signals: `Signal<Vec<WorkflowStepRecord>>` and `Signal<Vec<ToolCallRecord>>`. When the selected run changes, unsubscribe from the previous run and subscribe to the new one. Verify that step updates push to the signal in real-time.

**Commit:** `feat(live): filtered SpacetimeDB subscriptions for workflow steps and tool calls by run_id`

### Step 2: 7-stage pipeline bar component

Create `pipeline.rs` with a `PipelineBar` component that accepts `Vec<WorkflowStepRecord>` as a prop. Render 7 segments in a horizontal flex row: Route, Plan, Gather, Act, Verify, Summarize, Learn. Each segment shows: stage name (small caps), status icon, and duration (if completed). Map step status to visual state: pending (gray, dim), active (brand coral, pulsing), completed (green check), failed (red X), skipped (gray, strikethrough). Add CSS keyframe animation for the active-stage pulse.

**Commit:** `feat(ui): 7-stage pipeline bar component with status-driven styling`

### Step 3: Tool call cards with streaming appearance

Create `tool_card.rs` with a `ToolCallCard` component. Each card renders: tool name (bold), status badge (running = spinner, success = green, error = red), duration, and collapsible input/output sections. In the runs detail view, render tool cards below the pipeline bar, filtered to the active stage's `step_id`. New cards animate in with a 150ms `translateY(4px) → 0` fade. Cards are ordered by timestamp. Running cards sort to the top.

**Commit:** `feat(ui): streaming tool call cards with expand/collapse and live appearance animation`

### Step 4: Wire pipeline + cards into runs view with live transitions

Replace the existing static step list in `runs.rs` with the `PipelineBar` and `ToolCallCard` components. Connect both to the per-run signals from `live.rs`. When a `workflow_step` update arrives (e.g., stage transitions from `active` to `completed`), the pipeline bar updates immediately — no user action required. When a new `tool_call_record` is inserted, a new card appears below the pipeline. Add a "stage duration" counter that ticks while a stage is active (updates every second via a Tokio interval, not polling SpacetimeDB).

**Commit:** `feat(runs): wire Quasar Beam pipeline and tool cards with live SpacetimeDB push updates`

### Step 5: Polish — animations, empty states, error handling

Add CSS transitions for stage status changes (150ms color fade). Add empty state text when no steps exist yet ("Waiting for workflow to start..."). Handle edge cases: run with no tool calls, run that fails at Route stage, run that skips stages. Add a "Live" badge with a pulsing green dot when the run is active and receiving push updates. Remove the badge when the run completes.

**Commit:** `feat(runs): Quasar Beam polish — transitions, empty states, live indicator`

---

## Regression Tests

- [ ] `subscribe_to_run()` creates filtered subscriptions and populates step/tool signals
- [ ] Changing selected run unsubscribes from previous and subscribes to new
- [ ] Pipeline bar renders 7 segments with correct stage names
- [ ] Pending stages render gray, active stages render coral with pulse, completed render green
- [ ] Failed stages render red X, skipped stages render gray strikethrough
- [ ] Stage transition updates pipeline bar without manual refresh
- [ ] Tool call cards appear in real-time as `tool_call_record` rows are inserted
- [ ] Tool card expand/collapse toggles input/output visibility
- [ ] Running tool cards show spinner, completed show duration
- [ ] Empty run shows "Waiting for workflow to start..." message
- [ ] "Live" badge appears for active runs, disappears for completed
- [ ] Pipeline renders correctly for all edge cases (fail at Route, skip stages, zero tool calls)
- [ ] No subscription leaks — switching between runs does not accumulate subscriptions

---

## Definition of Done

- [ ] Filtered subscriptions for `workflow_step` and `tool_call_record` by `run_id` work
- [ ] Pipeline bar renders all 7 stages with correct visual states
- [ ] Active stage pulses with CSS animation
- [ ] Stage transitions update the pipeline bar in real-time via SpacetimeDB push
- [ ] Tool call cards appear as they happen (no refresh needed)
- [ ] Cards show tool name, status, duration, collapsible input/output
- [ ] New cards animate in with fade-up transition
- [ ] Active stage duration counter ticks live
- [ ] "Live" indicator badge visible for active runs
- [ ] Empty states and error cases handled gracefully
- [ ] Subscription cleanup works correctly when switching runs
- [ ] All regression tests pass
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui` succeeds

---

## PR Template

```
## 018 — Quasar Beam (Live Workflow Visualization)

### Summary
- Subscribe to workflow_step + tool_call_record filtered by run_id via SpacetimeDB
- 7-stage pipeline bar with LIVE status transitions (pending → active → completed)
- Streaming tool call cards that appear as agents invoke tools
- Active stage pulsing animation + live duration counter
- This is the core SpacetimeDB differentiator — zero-polling, push-based workflow visibility

### Test plan
- [ ] Select an active run — verify pipeline bar shows correct stage states
- [ ] Watch an agent execute — verify stages transition in real-time without refresh
- [ ] Verify tool call cards appear as agent invokes tools (no manual reload)
- [ ] Expand a tool card — verify input/output are shown
- [ ] Switch between two active runs — verify subscriptions update correctly
- [ ] Select a completed run — verify all stages show final state, no "Live" badge
- [ ] Select a failed run — verify failed stage shows red X
- [ ] Verify no subscription leaks (check SpacetimeDB client subscription count)
```
