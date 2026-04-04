# 016 — Trajectory Scoring & Delight Filtering

**Status:** Not Started
**Depends On:** 001 (Live Data Layer), 013 (Runs Detail)
**Effort:** Medium-Large
**PR Branch:** `feat/016-trajectory-scoring`

---

## Context

The trajectory pipeline is 60% complete. Every agent action is recorded in SpacetimeDB's `TrajectoryLog` table with TOON-encoded context. The `learnStep` extracts text learnings via Haiku. What's missing is a **quality signal** beyond the boolean `success` field, and critically, a **selectivity gate** that prevents mode collapse.

### Core Insight: Delight = Loss x Surprise

Continuous RL causes mode collapse. Human memory works the same way — you remember 1-2 striking moments from a day, not everything. Kids learn fast because everything is new; adults filter most information that isn't novel.

Models must do the same. Only the **top ~3% most delightful trajectories** enter the training buffer. Delight is the product of two signals:

- **Loss**: How wrong was the model? High loss = the model's prediction diverged significantly from the actual outcome or the verifiable reward.
- **Surprise**: How novel is this situation? High surprise = the trajectory's embedding is far from its cluster centroid — the model hasn't seen this kind of task before.

Training on routine, expected trajectories (even correct ones) is waste. Training on surprising failures is gold.

### Architecture: Real-Time Filtering, Batch Training

```
REAL-TIME (streaming, per-trajectory):
  trajectory lands in SpacetimeDB
    → pushed to scoring daemon via subscription
    → RLVR: did tests pass? did code compile? did deploy succeed?
    → LLM judge scores quality (~3.6s on Qwen3-4B)
    → compute SURPRISE via embedding distance from cluster centroid
    → delight = loss × surprise
    → if top 3%: append to training buffer
    → all scores visible to all clients instantly

BATCH (periodic, when buffer threshold reached):
  training buffer hits N high-delight trajectories
    → GRPO: group by task cluster, compute relative rewards
    → LoRA weight update
    → hot-swap adapter
    → next agent run uses improved weights
```

### Why GRPO/RLVR, Not DPO

- **DPO** requires explicit preference pairs (chosen vs rejected). Pair construction is fragile, requires embedding similarity grouping, and the signal is binary.
- **GRPO** (Group Relative Policy Optimization) works on groups of trajectories for the same task type, computing relative rewards within the group. No explicit pairing needed — the group IS the comparison.
- **RLVR** (RL with Verifiable Rewards) uses deterministic, checkable outcomes as rewards. Agent tasks often have verifiable outcomes: tests pass, code compiles, deploy succeeds, user thumbs-up. These are gold-standard signals with zero judge ambiguity.

Reference: https://arxiv.org/abs/2603.20526

### Resource Profile Behavior

| Profile | Scoring Mode | RLVR | Delight Filter |
|---------|-------------|------|----------------|
| Lightweight | Cloud (Haiku), on request only | Always (free) | Off (no training) |
| Balanced | Local (Qwen3-4B), when idle | Always | Top 3%, manual train |
| Power | Local (continuous) | Always | Top 3%, weekly auto-train |
| Team | Remote (cadet-inference-server) | Always | Top 3%, scheduled train |

---

## Requirements

### 1. SpacetimeDB Tables

**`trajectory_score`** — quality scores from judge or RLVR:
- `score_id` (PK), `trajectory_id` (btree index), `run_id` (btree index)
- Quality dimensions: `correctness` (f32), `efficiency` (f32), `tool_use_quality` (f32), `adherence` (f32)
- `composite` (f32) — weighted average of dimensions
- `loss` (f32) — how wrong the model was (1.0 - composite for judge scores; binary for RLVR)
- `surprise` (f32) — embedding distance from cluster centroid (0.0-1.0 normalized)
- `delight` (f32) — loss × surprise, the selectivity signal
- `source` — "rlvr" | "llm-judge" | "operator-feedback"
- `judge_model`, `judge_reasoning`, `rlvr_signals_json`
- `created_at_micros` (i64)

**`training_buffer`** — high-delight trajectories awaiting GRPO:
- `buffer_id` (PK), `trajectory_id`, `score_id`
- `delight` (f32) — cached for sort
- `task_cluster` — embedding-derived cluster label for GRPO grouping
- `consumed` (bool) — true after training run consumes it
- `created_at_micros` (i64)

**`training_run`** — training job records:
- `training_id` (PK), `base_model`, `adapter_path`
- `method` — "grpo" | "rlvr" | "sft" (no more "dpo")
- `trajectory_count`, `group_count`, `epochs`, `final_loss`
- `delight_threshold` (f32) — the cutoff used for this batch
- `duration_seconds`, `status` ("running" | "completed" | "failed")
- `created_at_micros` (i64)

### 2. RLVR Signals (Real-Time, Zero-Cost)

Verifiable rewards are computed instantly from task outcomes:

| Signal | Source | Reward |
|--------|--------|--------|
| Tests pass | `verify` step exit code | 1.0 pass, 0.0 fail |
| Code compiles | Build step result | 1.0 success, 0.0 error |
| Deploy succeeds | Vercel deploy status | 1.0 live, 0.0 failed |
| User thumbs-up | Chat UI button | 1.0 up, 0.0 down |
| User sentiment | Chat message keywords | 0.0-1.0 confidence |
| Task completed | Workflow final status | 1.0 completed, 0.0 abandoned |

RLVR signals are stored in `rlvr_signals_json` as a JSON object. The `composite` for RLVR-sourced scores is the average of all available signals. These are always collected regardless of resource profile — they're free.

### 3. LLM-as-Judge Scoring (3-Mode)

For richer quality signal beyond RLVR binary rewards:

- **Local**: Qwen3-4B via `llama-cpp-2` with Metal (behind `local-ml` feature flag)
- **Remote**: POST to `{remote_url}/v1/score` on cadet-inference-server
- **Cloud**: Haiku via AI Gateway

Judge evaluates on 4 dimensions (correctness, efficiency, tool_use_quality, adherence) and returns scores 0.0-1.0 with reasoning.

### 4. Surprise Computation

Surprise measures how novel a trajectory is relative to what the model has seen:

1. Embed the trajectory instruction + output using the configured embedding provider
2. Find the nearest cluster centroid in the trajectory embedding index
3. `surprise = normalized_distance(embedding, centroid)`
4. Trajectories far from any centroid are high-surprise (novel situations)
5. Trajectories near a centroid are low-surprise (routine, seen before)

Cluster centroids are updated incrementally as new trajectories arrive. Initial cold-start: all trajectories have surprise = 1.0 (everything is new — like a kid).

### 5. Delight Gate

```
delight = loss × surprise

Where:
  loss = 1.0 - composite_score  (high when model was wrong)
  surprise = cluster_distance   (high when situation is novel)
```

- `delight > threshold` → trajectory enters `training_buffer`
- Threshold is adaptive: percentile-based on recent scores (target: top 3%)
- If buffer is empty for too long, threshold relaxes slightly (floor: top 10%)
- If buffer fills too fast, threshold tightens (ceiling: top 1%)

### 6. Background Scoring Daemon

A Tokio task that:
- Receives new `TrajectoryLog` entries via SpacetimeDB subscription
- Collects RLVR signals from the trajectory's workflow run status
- Calls LLM judge (per resource profile)
- Computes surprise via embedding distance
- Computes delight = loss × surprise
- Writes `trajectory_score` via reducer
- If delight exceeds threshold, writes to `training_buffer`
- Idle-only mode: pauses when CPU > 60%
- Exposes `pause()` / `resume()` / `is_running()`

### 7. Human Feedback

- Thumbs up/down on agent messages in chat view
- Maps to `trajectory_score` with `source: "operator-feedback"`, `composite: 1.0` or `0.0`
- Operator feedback gets `surprise: 1.0` always (human judgment is always novel signal)
- So thumbs-down → `delight = 1.0 × 1.0 = 1.0` → always enters training buffer
- Thumbs-up → `delight = 0.0 × 1.0 = 0.0` → doesn't enter buffer (model was right, nothing to learn)
- This is correct: you don't train on what already works, you train on what surprised you

### 8. Desktop UI

- **Quality gauge**: Run detail view, composite score (red < 0.4, yellow 0.4-0.7, green > 0.7)
- **Delight indicator**: Star/spark icon on trajectories that passed the delight gate
- **Trend sparkline**: Overview dashboard, average composite over last 50 runs
- **Training buffer count**: Badge showing how many trajectories await GRPO
- **Sub-scores on hover**: Tooltip with all 4 dimensions + RLVR signals + surprise

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `spacetimedb/src/lib.rs` | MODIFY | Add `TrajectoryScore`, `TrainingBuffer`, `TrainingRun` tables + reducers |
| `rust/starbridge-core/src/scoring.rs` | NEW | 3-mode scoring engine + RLVR signal collector |
| `rust/starbridge-core/src/scoring_daemon.rs` | NEW | Background Tokio task with delight filtering |
| `rust/starbridge-core/src/scoring_prompt.rs` | NEW | Judge prompt template |
| `rust/starbridge-core/src/delight.rs` | NEW | Surprise computation, delight gate, adaptive threshold |
| `rust/starbridge-dioxus/src/ui/views/runs.rs` | MODIFY | Quality gauge + delight indicator |
| `rust/starbridge-dioxus/src/ui/views/ai_chat.rs` | MODIFY | Thumbs up/down buttons |
| `rust/starbridge-dioxus/src/ui/views/overview.rs` | MODIFY | Trend sparkline + training buffer badge |
| `rust/starbridge-dioxus/src/live.rs` | MODIFY | Subscribe to `trajectory_score` + `training_buffer` |
| `rust/starbridge-core/Cargo.toml` | MODIFY | Add `llama-cpp-2` optional dep behind `local-ml` |
| `apps/web/lib/durable-agent.ts` | MODIFY | Emit RLVR signals from verify/act steps |

---

## Implementation Steps

### Step 1: SpacetimeDB tables + reducers

Add `TrajectoryScore`, `TrainingBuffer`, `TrainingRun` tables. Add reducers: `record_trajectory_score` (validates all fields 0.0-1.0, computes delight, conditionally inserts to training_buffer), `consume_training_buffer` (marks entries consumed after GRPO run), `record_training_run`.

**Commit:** `feat(stdb): add trajectory scoring, training buffer, and training run tables`

### Step 2: RLVR signal collection

Modify `durable-agent.ts` to emit verifiable reward signals. After `verifyStep`, record whether tests passed, code compiled, etc. Store as structured data on the trajectory. Add a `collect_rlvr_signals(run_id)` function in `scoring.rs` that reads workflow run status and step outcomes from SpacetimeDB to construct the RLVR signal vector.

**Commit:** `feat(scoring): RLVR signal collection from workflow outcomes`

### Step 3: Judge prompt + scoring engine

Create `scoring_prompt.rs` with the judge prompt. Create `scoring.rs` with `ScoreMode` enum (Local, Remote, Cloud) and `score_trajectory()`. Cloud calls Haiku via AI Gateway. Remote POSTs to `/v1/score`. Local stubs error without `local-ml`.

**Commit:** `feat(scoring): judge prompt and 3-mode scoring engine`

### Step 4: Surprise computation + delight gate

Create `delight.rs` with:
- `compute_surprise()`: embed trajectory, find nearest centroid, return normalized distance
- `compute_delight(loss, surprise)`: multiply them
- `DelightGate`: adaptive threshold targeting top 3%, with floor/ceiling bounds
- Cold-start behavior: surprise = 1.0 when no centroids exist yet

**Commit:** `feat(scoring): surprise computation and adaptive delight gate`

### Step 5: Background scoring daemon

Create `scoring_daemon.rs`:
- Subscribe to `trajectory_log` via SpacetimeDB
- Collect RLVR signals
- Call judge (per profile)
- Compute surprise + delight
- Write score + conditionally buffer
- CPU idle detection, pause/resume

**Commit:** `feat(scoring): background scoring daemon with delight filtering`

### Step 6: Thumbs up/down on chat messages

Add thumb buttons on agent messages in `ai_chat.rs`. Thumbs-down always enters training buffer (delight = 1.0). Thumbs-up records positive score but doesn't enter buffer.

**Commit:** `feat(chat): thumbs up/down feedback with delight-aware buffering`

### Step 7: Desktop UI — gauge, sparkline, buffer badge

Quality gauge in run detail. Delight spark icon on filtered trajectories. Trend sparkline on overview. Training buffer count badge.

**Commit:** `feat(desktop): quality gauge, delight indicators, and training buffer UI`

### Step 8: RLVR signal emission from workflow

Wire `verifyStep` and `actStep` in `durable-agent.ts` to emit structured RLVR signals: test results, build status, deploy status. Store on trajectory metadata for the scoring daemon to consume.

**Commit:** `feat(workflow): emit RLVR signals from verify and act steps`

---

## Regression Tests

- [ ] `trajectory_score` accepts inserts, rejects scores outside 0.0-1.0
- [ ] `delight` is correctly computed as `loss × surprise`
- [ ] Training buffer only receives trajectories above delight threshold
- [ ] Adaptive threshold converges to ~3% acceptance rate over 100 trajectories
- [ ] Cold-start: first 20 trajectories all have surprise = 1.0
- [ ] Thumbs-down always enters training buffer (delight = 1.0)
- [ ] Thumbs-up never enters training buffer (delight = 0.0)
- [ ] RLVR signals correctly reflect workflow step outcomes
- [ ] Scoring daemon pauses at CPU > 60%, resumes when CPU drops
- [ ] Quality gauge renders correct colors (red < 0.4, yellow 0.4-0.7, green > 0.7)
- [ ] Delight indicator appears only on buffered trajectories
- [ ] Trend sparkline renders with 0, 1, and 50+ data points
- [ ] App builds without `local-ml` (local scoring returns error)
- [ ] App builds with `local-ml` enabled

---

## Definition of Done

- [ ] `trajectory_score`, `training_buffer`, `training_run` tables exist in SpacetimeDB
- [ ] RLVR signals collected from workflow outcomes (tests, compile, deploy)
- [ ] LLM judge scoring works in all 3 modes (local, remote, cloud)
- [ ] Surprise computed via embedding distance from cluster centroid
- [ ] Delight = loss × surprise computed for every scored trajectory
- [ ] Adaptive threshold gates top ~3% into training buffer
- [ ] Human feedback (thumbs down) always enters buffer
- [ ] Background daemon scores per resource profile
- [ ] Desktop shows quality gauge, delight indicators, trend sparkline, buffer count
- [ ] Zero behavior change for Lightweight profile (no automatic scoring)
- [ ] All regression tests pass
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui` succeeds
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui,local-ml` succeeds

---

## PR Template

```
## 016 — Trajectory Scoring & Delight Filtering

### Summary
- Add `trajectory_score`, `training_buffer`, `training_run` SpacetimeDB tables
- RLVR signal collection from verifiable workflow outcomes (tests, compile, deploy)
- 3-mode LLM-as-judge scoring engine (local Qwen3-4B, remote, cloud Haiku)
- Delight = loss × surprise filtering — only top 3% enter training buffer
- Adaptive threshold prevents mode collapse from over-training on routine data
- Thumbs up/down on chat messages; thumbs-down always enters buffer
- Desktop UI: quality gauge, delight indicators, trend sparkline, buffer count

### Architecture
- Real-time: scoring + filtering happens per-trajectory as they arrive
- Batch: GRPO training consumes buffer periodically (separate spec)
- RLVR provides zero-cost verifiable rewards; judge adds richer signal
- Surprise = embedding distance from cluster centroid (novel vs routine)

### Test plan
- [ ] Dispatch agent run, verify RLVR signals captured (test pass/fail)
- [ ] Verify trajectory scored automatically (Balanced/Power profile)
- [ ] Check delight computed correctly (loss × surprise)
- [ ] Verify only high-delight trajectories appear in training buffer
- [ ] Click thumbs-down, verify it enters training buffer (delight = 1.0)
- [ ] Click thumbs-up, verify it does NOT enter buffer
- [ ] Check quality gauge shows correct color in run detail
- [ ] Verify delight spark icon on buffered trajectories only
- [ ] Check trend sparkline on overview dashboard
- [ ] Switch to Lightweight profile, verify no automatic scoring
- [ ] Build without local-ml feature, verify clean compile
- [ ] Pause daemon from settings, verify scoring stops
```
