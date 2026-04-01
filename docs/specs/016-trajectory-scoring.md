# 016 — Trajectory Scoring (LLM-as-Judge)

**Status:** Not Started
**Depends On:** 001 (Live Data Layer), 013 (Runs Detail)
**Effort:** Medium
**PR Branch:** `feat/016-trajectory-scoring`

---

## Context

The trajectory pipeline is 60% complete. Every agent action is already recorded in SpacetimeDB's `TrajectoryLog` table with TOON-encoded context (`context_engine.rs:128-180`). The `learnStep` in the 7-stage workflow extracts text learnings via Haiku. What is missing is a **quality signal** beyond the boolean `success` field. Without numeric scores, we cannot construct DPO preference pairs, rank trajectories, or show quality trends in the desktop.

This spec adds a `trajectory_score` table to SpacetimeDB, a 3-mode scoring daemon (local / remote / cloud), and desktop UI for viewing scores and providing human feedback. Scoring is the prerequisite for Phase 2 (DPO pair construction) and Phase 4 (LoRA fine-tuning) of the self-improvement architecture.

### Resource Profile Behavior

| Profile | Scoring Mode | Trigger |
|---------|-------------|---------|
| Lightweight | Cloud (Haiku) | On explicit request only |
| Balanced | Local (Qwen3-4B via llama-cpp-2) | When idle, pauses at CPU > 60% |
| Power | Local (continuous) | Every trajectory as it arrives |
| Team | Remote (cadet-inference-server) | Every trajectory via push |

---

## Requirements

1. **SpacetimeDB table:** `trajectory_score` with fields: `score_id`, `trajectory_id`, `correctness` (f32), `efficiency` (f32), `tool_use_quality` (f32), `adherence` (f32), `composite` (f32), `judge_model`, `judge_reasoning`, `source` ("llm-judge" | "operator-feedback"), `created_at_micros` (i64). Primary key on `score_id`, btree index on `trajectory_id`.
2. **3-mode scoring:** Local via `llama-cpp-2` with Metal feature (behind `local-ml` feature flag), remote via `cadet-inference-server` `/v1/score` endpoint, cloud via Haiku through the existing AI Gateway.
3. **Background daemon:** A Tokio task that receives new trajectories via SpacetimeDB subscription, scores them, and writes results back via reducer. Idle-only mode: pauses when system CPU exceeds 60%. Pausable from Settings.
4. **Human feedback:** Thumbs up/down buttons on every agent message in the chat view. Maps to `TrajectoryScore` with `source: "operator-feedback"`, `composite: 1.0` (thumbs up) or `composite: 0.0` (thumbs down).
5. **Quality gauge:** In the run detail view (spec 013), display a composite score gauge (0.0-1.0) with colored segments (red < 0.4, yellow 0.4-0.7, green > 0.7). Show sub-scores on hover.
6. **Trend line:** In the overview dashboard, a sparkline showing average composite score over the last 50 runs.

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `rust/starbridge-stdb/src/lib.rs` | MODIFY | Add `TrajectoryScore` table and `record_trajectory_score` reducer |
| `rust/starbridge-core/src/scoring.rs` | NEW | 3-mode scoring engine: local, remote, cloud |
| `rust/starbridge-core/src/scoring_daemon.rs` | NEW | Background Tokio task with idle detection and pause control |
| `rust/starbridge-core/src/scoring_prompt.rs` | NEW | Judge prompt template for LLM-as-judge scoring |
| `rust/starbridge-dioxus/src/ui/views/runs.rs` | MODIFY | Add quality gauge to run detail panel |
| `rust/starbridge-dioxus/src/ui/views/ai_chat.rs` | MODIFY | Add thumbs up/down buttons on agent messages |
| `rust/starbridge-dioxus/src/ui/views/overview.rs` | MODIFY | Add quality trend sparkline |
| `rust/starbridge-dioxus/src/live.rs` | MODIFY | Subscribe to `trajectory_score` table, add signal |
| `rust/starbridge-core/Cargo.toml` | MODIFY | Add `llama-cpp-2` optional dependency behind `local-ml` |

---

## Implementation Steps

### Step 1: SpacetimeDB table + reducer

Add the `TrajectoryScore` struct and `record_trajectory_score` reducer to the SpacetimeDB module. The reducer accepts all score fields and inserts a row. Add a btree index on `trajectory_id` for efficient lookup. Publish the module and verify the table appears in the database inspector.

**Commit:** `feat(stdb): add trajectory_score table and scoring reducer`

### Step 2: Judge prompt + scoring engine

Create `scoring_prompt.rs` with the judge prompt template. The prompt instructs the LLM to evaluate a TOON-encoded trajectory on four dimensions (correctness, efficiency, tool_use_quality, adherence) and return a JSON object with scores 0.0-1.0 and reasoning. Create `scoring.rs` with a `ScoreMode` enum (Local, Remote, Cloud) and a `score_trajectory()` function that dispatches to the appropriate backend. For Cloud mode, call Haiku via the existing AI Gateway HTTP client. For Remote mode, POST to `{remote_url}/v1/score`. Local mode is a stub that returns an error if `local-ml` feature is not enabled.

**Commit:** `feat(scoring): judge prompt template and 3-mode scoring engine`

### Step 3: Background scoring daemon

Create `scoring_daemon.rs` with a `ScoringDaemon` struct that:
- Receives new `TrajectoryEntry` items via a `tokio::sync::mpsc` channel
- Checks system CPU via `sysinfo` crate (skip scoring if > 60% in idle-only mode)
- Calls `score_trajectory()` for each entry
- Writes the result back to SpacetimeDB via the `record_trajectory_score` reducer
- Exposes `pause()` / `resume()` / `is_running()` methods
- Respects the user's resource profile setting

**Commit:** `feat(scoring): background scoring daemon with idle detection`

### Step 4: Thumbs up/down on chat messages

In `ai_chat.rs`, add a thumbs-up and thumbs-down icon button pair on every agent message bubble. On click, call the `record_trajectory_score` reducer with `source: "operator-feedback"` and the appropriate composite score. Highlight the selected thumb. Store the mapping from `chat_message_id` to `trajectory_id` via the `run_id` field on the message.

**Commit:** `feat(chat): thumbs up/down feedback buttons on agent messages`

### Step 5: Quality gauge in run detail + subscription

In `live.rs`, subscribe to the `trajectory_score` table and maintain a `Signal<Vec<TrajectoryScoreRecord>>`. In the runs detail view, render a horizontal gauge bar showing the composite score for the selected run's trajectory. Color-code: red (< 0.4), yellow (0.4-0.7), green (> 0.7). On hover, show a tooltip with the four sub-scores and judge reasoning.

**Commit:** `feat(runs): quality gauge with sub-score tooltip in run detail`

### Step 6: Trend sparkline on overview

In the overview dashboard, add a sparkline component showing the average composite score across the last 50 scored runs. Use the `trajectory_score` signal data, grouped by `trajectory_id`, averaged by `composite`. Render as a simple SVG polyline within a 120x32px box.

**Commit:** `feat(overview): quality trend sparkline from trajectory scores`

---

## Regression Tests

- [ ] `trajectory_score` table accepts inserts via reducer and rejects duplicate `score_id`
- [ ] Scoring engine returns valid scores (all fields 0.0-1.0) for each mode
- [ ] Scoring daemon pauses when CPU > 60% and resumes when CPU drops
- [ ] Scoring daemon respects pause/resume commands
- [ ] Thumbs up records `composite: 1.0, source: "operator-feedback"`
- [ ] Thumbs down records `composite: 0.0, source: "operator-feedback"`
- [ ] Quality gauge renders correct color for score ranges (0.2 = red, 0.5 = yellow, 0.9 = green)
- [ ] Trend sparkline renders with 0, 1, and 50+ data points without panic
- [ ] App builds and runs without `local-ml` feature (local scoring returns graceful error)
- [ ] App builds with `local-ml` feature enabled

---

## Definition of Done

- [ ] `trajectory_score` table exists in SpacetimeDB with btree index on `trajectory_id`
- [ ] `record_trajectory_score` reducer validates and inserts scores
- [ ] Cloud scoring via Haiku produces valid 4-dimension scores
- [ ] Remote scoring via `/v1/score` endpoint works when server is configured
- [ ] Local scoring compiles only when `local-ml` feature is enabled
- [ ] Background daemon scores trajectories automatically per resource profile
- [ ] Daemon pauses at CPU > 60% in idle-only mode
- [ ] Thumbs up/down buttons visible on agent messages in chat view
- [ ] Human feedback stored as `TrajectoryScore` with `source: "operator-feedback"`
- [ ] Quality gauge visible in run detail view with correct color coding
- [ ] Sub-scores visible on hover tooltip
- [ ] Trend sparkline visible on overview dashboard
- [ ] Zero behavior change for Lightweight profile (no automatic scoring)
- [ ] All regression tests pass
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui` succeeds
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui,local-ml` succeeds

---

## PR Template

```
## 016 — Trajectory Scoring (LLM-as-Judge)

### Summary
- Add `trajectory_score` SpacetimeDB table with 4-dimension quality scores
- 3-mode scoring engine: local (llama-cpp-2), remote (inference server), cloud (Haiku)
- Background scoring daemon with idle-only mode and pause control
- Thumbs up/down buttons on chat messages as human reward signal
- Quality gauge in run detail view, trend sparkline on overview

### Test plan
- [ ] Dispatch an agent run, verify trajectory is scored automatically (Balanced/Power profile)
- [ ] Click thumbs up on an agent message, verify score appears in database inspector
- [ ] Click thumbs down, verify composite = 0.0 in trajectory_score table
- [ ] Open run detail, verify quality gauge shows correct color for the score
- [ ] Hover gauge, verify sub-scores and reasoning tooltip appears
- [ ] Check overview dashboard for quality trend sparkline
- [ ] Switch to Lightweight profile, verify no automatic scoring occurs
- [ ] Build without local-ml feature, verify no compile errors
- [ ] Pause scoring daemon from settings, verify scoring stops
```
