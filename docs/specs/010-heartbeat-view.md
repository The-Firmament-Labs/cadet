# 010 — Heartbeat / Cron Monitor

**Status:** Not Started
**Effort:** Small
**Depends on:** [001 Live Data Layer](001-live-data-layer.md)
**Target file:** `rust/starbridge-dioxus/src/ui/views/heartbeat.rs`

---

## Context

Cadet supports scheduled agent operations via the SpacetimeDB `schedule_record` table and web server cron endpoints. The Heartbeat view provides a single-screen health dashboard showing every scheduled job, its current status, execution history, and controls to trigger/pause/edit schedules.

The data comes from SpacetimeDB signals (spec 001) for the `schedule_record` table. Manual trigger, pause, and edit actions route through the web server API. The view uses the Vercel cron dashboard and Uptime Robot as design references.

**SpacetimeDB table shape** (inferred from spec section 4.11):

```
schedule_record {
  schedule_id: String,
  name: String,
  cron_expression: String,   // e.g. "*/5 * * * *"
  last_run_at: Option<u64>,  // epoch ms
  next_run_at: Option<u64>,  // epoch ms
  status: String,            // "active" | "paused" | "failed"
  last_result: Option<String>, // "success" | "error" | error message
  run_count: u32,
  fail_count: u32,
  created_at: u64,
}
```

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Heartbeat                                      System health: ● OK  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Name            Schedule     Last Run       Next Run   Status  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Memory Cleanup  */30 * * * * 09:00 (14m ago) 09:30      ● OK  │  │
│  │ ●●●●●●●●●●  10/10 ok                     [▶ Run] [⏸ Pause]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Agent Health    */5 * * * *  09:10 (4m ago)  09:15      ● OK  │  │
│  │ ●●●●●●●●●○  9/10 ok, 1 fail              [▶ Run] [⏸ Pause]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Log Rotation    0 */6 * * *  06:00 (3h ago)  12:00      ● OK  │  │
│  │ ●●●●●●●●●●  10/10 ok                     [▶ Run] [⏸ Pause]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ DB Backup       0 2 * * *    02:00 (7h ago)  02:00+1d ● OK    │  │
│  │ ●●●●●●●●●●  10/10 ok                     [▶ Run] [⏸ Pause]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Stale Run Sweep */15 * * * * 09:00 (14m ago) 09:15    ⚠ LATE  │  │
│  │ ●●●●●●●●○○  8/10 ok, 2 fail              [▶ Run] [⏸ Pause]  │  │
│  ├────────────────────────────────────────────────────────────────┤  │
│  │ Token Audit     0 0 * * 1   Mon 00:00       Mon 00:00  ⏸ OFF  │  │
│  │ (paused)                                  [▶ Run] [▶ Resume]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ── Expanded: Agent Health ──────────────────────────────────────── │
│  │                                                                │  │
│  │ Schedule:     */5 * * * * (every 5 minutes)                   │  │
│  │ Total runs:   2,847                                            │  │
│  │ Failures:     12 (0.4%)                                        │  │
│  │ Created:      2026-03-27 14:00                                │  │
│  │                                                                │  │
│  │ Last 10 executions:                                            │  │
│  │ 09:10 ● ok    09:05 ● ok    09:00 ○ fail   08:55 ● ok        │  │
│  │ 08:50 ● ok    08:45 ● ok    08:40 ● ok     08:35 ● ok        │  │
│  │ 08:30 ● ok    08:25 ● ok                                      │  │
│  │                                                                │  │
│  │ Last failure (09:00):                                          │  │
│  │   "Timeout: agent health check exceeded 30s"                   │  │
│  │                                                                │  │
│  │ [Edit Schedule]                                                │  │
│  ──────────────────────────────────────────────────────────────── │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Requirements

1. **Single-column list** — each scheduled job as a row showing: name, cron expression, last run (with relative time), next run, status indicator
2. **Status indicators** — three states:
   - `● OK` (green / `--tertiary-container`) — healthy, last run succeeded
   - `⚠ LATE` (yellow / `--primary-container`) — next_run_at is past AND more than 1 minute overdue
   - `● FAIL` (red / `--primary`) — last_result was an error
   - `⏸ OFF` (gray / `--secondary`) — paused
3. **Sparkline** — last 10 execution results as a row of colored dots: green (success), red (failure), gray (not yet run)
4. **System health summary** — top-right badge showing overall status: "OK" (all green), "Degraded" (any late/failed), with connection dot
5. **Manual trigger** — `[Run]` button per job; calls `WebClient::trigger_schedule(id)`; show spinner while running
6. **Pause / Resume** — toggle button per job; calls `WebClient::pause_schedule(id)` or `resume_schedule(id)`
7. **Expandable detail** — click a row to expand: full cron expression with human-readable description, total run/fail counts, last 10 execution timestamps with results, last failure message, edit button
8. **Edit schedule** — inline form or modal to change cron expression and name; calls `WebClient::update_schedule`
9. **Live updates** — SpacetimeDB signal updates `last_run_at`, `next_run_at`, `status`, `last_result` in real-time; status indicators transition without page reload
10. **Relative timestamps** — "14m ago", "3h ago", etc. refresh every 30 seconds
11. **Empty state** — when no schedules exist, show "No scheduled jobs" with a brief explanation

---

## Files

| Action | Path |
|--------|------|
| CREATE | `rust/starbridge-dioxus/src/ui/views/heartbeat.rs` |
| MODIFY | `rust/starbridge-dioxus/src/ui/views/mod.rs` — add `mod heartbeat; pub use heartbeat::HeartbeatView;` |
| MODIFY | `rust/starbridge-dioxus/src/ui/models.rs` — add `Heartbeat` variant to `WorkspacePage` |
| MODIFY | `rust/starbridge-dioxus/src/ui/styles.rs` — add heartbeat-specific CSS (status colors, sparkline dots) |
| MODIFY | `rust/starbridge-dioxus/src/live.rs` — ensure `schedule_record` table signal subscription |
| MODIFY | `rust/starbridge-dioxus/src/web_client.rs` — add `trigger_schedule`, `pause_schedule`, `resume_schedule`, `update_schedule` |

---

## Steps (each = one commit)

### Step 1: Schedule types and WebClient methods

Add the Rust types for schedule records and the API methods.

```rust
// In web_client.rs or models/schedule.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRecord {
    pub schedule_id: String,
    pub name: String,
    pub cron_expression: String,
    pub last_run_at: Option<u64>,
    pub next_run_at: Option<u64>,
    pub status: ScheduleStatus,
    pub last_result: Option<String>,
    pub run_count: u32,
    pub fail_count: u32,
    pub created_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScheduleStatus {
    Active,
    Paused,
    Failed,
}

/// Derived display status (computed client-side, not stored)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthIndicator {
    Ok,
    Late,
    Failed,
    Paused,
}

impl ScheduleRecord {
    pub fn health(&self, now_ms: u64) -> HealthIndicator {
        if self.status == ScheduleStatus::Paused {
            return HealthIndicator::Paused;
        }
        if self.last_result.as_deref().is_some_and(|r| r != "success") {
            return HealthIndicator::Failed;
        }
        if let Some(next) = self.next_run_at {
            if now_ms > next + 60_000 {
                return HealthIndicator::Late;
            }
        }
        HealthIndicator::Ok
    }
}

impl WebClient {
    pub async fn trigger_schedule(&self, id: &str) -> Result<()> {
        self.client
            .post(format!("{}/api/schedules/{id}/trigger", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(())
    }

    pub async fn pause_schedule(&self, id: &str) -> Result<()> {
        self.client
            .post(format!("{}/api/schedules/{id}/pause", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(())
    }

    pub async fn resume_schedule(&self, id: &str) -> Result<()> {
        self.client
            .post(format!("{}/api/schedules/{id}/resume", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(())
    }

    pub async fn update_schedule(&self, id: &str, name: &str, cron: &str) -> Result<()> {
        self.client
            .put(format!("{}/api/schedules/{id}", self.base_url))
            .bearer_auth(&self.session_token)
            .json(&serde_json::json!({ "name": name, "cron_expression": cron }))
            .send()
            .await?;
        Ok(())
    }
}
```

**Commit:** `feat(desktop): add ScheduleRecord types and WebClient schedule methods`

### Step 2: Heartbeat view scaffold with schedule list

Create `heartbeat.rs` with the single-column layout, schedule rows, status indicators, and system health badge.

```rust
// rust/starbridge-dioxus/src/ui/views/heartbeat.rs

use dioxus::prelude::*;

#[component]
pub fn HeartbeatView() -> Element {
    let live = use_context::<Signal<LiveState>>();
    let schedules = live.read().schedule_records.read();
    let mut expanded = use_signal(|| None::<String>);
    let now_ms = use_signal(|| current_time_ms());

    // Refresh relative timestamps every 30s
    use_effect(move || {
        let interval = set_interval(|| now_ms.set(current_time_ms()), 30_000);
        move || clear_interval(interval);
    });

    let overall_health = compute_overall_health(&schedules, now_ms());

    rsx! {
        div { class: "heartbeat-view",
            div { class: "heartbeat-header",
                h2 { "Heartbeat" }
                span {
                    class: "system-health-badge {overall_health.css_class()}",
                    "System health: {overall_health.label()}"
                }
            }
            div { class: "schedule-list",
                if schedules.is_empty() {
                    div { class: "empty-state",
                        p { "No scheduled jobs configured." }
                        p { class: "muted", "Schedules are created via the web server API or CLAUDE.md configuration." }
                    }
                }
                for schedule in schedules.iter() {
                    ScheduleRow {
                        schedule: schedule.clone(),
                        now_ms: now_ms(),
                        is_expanded: expanded.read().as_ref() == Some(&schedule.schedule_id),
                        on_toggle: move |id: String| {
                            let current = expanded.read().clone();
                            expanded.set(if current.as_ref() == Some(&id) { None } else { Some(id) });
                        },
                    }
                }
            }
        }
    }
}

fn compute_overall_health(schedules: &[ScheduleRecord], now_ms: u64) -> HealthIndicator {
    if schedules.is_empty() {
        return HealthIndicator::Ok;
    }
    let any_failed = schedules.iter().any(|s| s.health(now_ms) == HealthIndicator::Failed);
    let any_late = schedules.iter().any(|s| s.health(now_ms) == HealthIndicator::Late);
    if any_failed { HealthIndicator::Failed }
    else if any_late { HealthIndicator::Late }
    else { HealthIndicator::Ok }
}
```

**Commit:** `feat(desktop): heartbeat view scaffold with schedule list and health badge`

### Step 3: Schedule row with sparkline and actions

Implement each row with name, cron, timestamps, status badge, sparkline dots, and Run/Pause/Resume buttons.

```rust
#[component]
fn ScheduleRow(
    schedule: ScheduleRecord,
    now_ms: u64,
    is_expanded: bool,
    on_toggle: EventHandler<String>,
) -> Element {
    let health = schedule.health(now_ms);
    let mut triggering = use_signal(|| false);

    let last_run_text = schedule.last_run_at
        .map(|t| format_relative(now_ms, t))
        .unwrap_or_else(|| "never".to_string());

    let next_run_text = schedule.next_run_at
        .map(|t| format_time_short(t))
        .unwrap_or_else(|| "—".to_string());

    rsx! {
        div {
            class: "schedule-row",
            onclick: move |_| on_toggle.call(schedule.schedule_id.clone()),

            div { class: "schedule-row-main",
                span { class: "schedule-name", "{schedule.name}" }
                span { class: "schedule-cron mono", "{schedule.cron_expression}" }
                span { class: "schedule-last-run", "{last_run_text}" }
                span { class: "schedule-next-run", "{next_run_text}" }
                span {
                    class: "health-indicator {health.css_class()}",
                    "{health.label()}"
                }
            }

            div { class: "schedule-row-meta",
                // Sparkline: last 10 results as dots
                Sparkline { run_count: schedule.run_count, fail_count: schedule.fail_count }

                button {
                    class: "btn-sm",
                    disabled: triggering(),
                    onclick: move |e| {
                        e.stop_propagation();
                        triggering.set(true);
                        spawn(async move {
                            let _ = web_client().trigger_schedule(&schedule.schedule_id).await;
                            triggering.set(false);
                        });
                    },
                    if triggering() { "..." } else { "Run" }
                }

                if schedule.status == ScheduleStatus::Paused {
                    button {
                        class: "btn-sm",
                        onclick: move |e| {
                            e.stop_propagation();
                            spawn(async move {
                                let _ = web_client().resume_schedule(&schedule.schedule_id).await;
                            });
                        },
                        "Resume"
                    }
                } else {
                    button {
                        class: "btn-sm",
                        onclick: move |e| {
                            e.stop_propagation();
                            spawn(async move {
                                let _ = web_client().pause_schedule(&schedule.schedule_id).await;
                            });
                        },
                        "Pause"
                    }
                }
            }
        }

        if is_expanded {
            ScheduleDetail { schedule: schedule.clone(), now_ms }
        }
    }
}

/// 10 dots showing recent execution results
#[component]
fn Sparkline(run_count: u32, fail_count: u32) -> Element {
    // Simplified: show last 10 as proportional pass/fail
    let total = run_count.min(10);
    let fails_in_10 = if run_count > 0 {
        ((fail_count as f64 / run_count as f64) * total as f64).round() as u32
    } else { 0 };
    let passes = total.saturating_sub(fails_in_10);

    rsx! {
        span { class: "sparkline",
            for _ in 0..passes {
                span { class: "dot dot-ok", "●" }
            }
            for _ in 0..fails_in_10 {
                span { class: "dot dot-fail", "○" }
            }
            for _ in 0..(10u32.saturating_sub(total)) {
                span { class: "dot dot-empty", "·" }
            }
        }
    }
}
```

**Commit:** `feat(desktop): schedule rows with sparkline, status, and action buttons`

### Step 4: Expanded detail and edit form

Implement the expanded panel showing full stats, last 10 execution timestamps, last failure message, and an inline edit form for cron expression and name.

**Commit:** `feat(desktop): heartbeat expanded detail with edit form`

### Step 5: CSS, live updates, and navigation registration

Add heartbeat CSS to `styles.rs` (status colors, sparkline dots, row layout). Ensure `schedule_record` signal subscription in `live.rs`. Register `Heartbeat` in `WorkspacePage` enum.

```css
/* Added to styles.rs APP_STYLES */

.heartbeat-view { display: flex; flex-direction: column; height: 100%; }
.heartbeat-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; }
.system-health-badge { font-size: 12px; font-weight: 600; padding: 4px 12px; }
.system-health-badge.health-ok { color: var(--tertiary); }
.system-health-badge.health-late { color: #B8860B; }
.system-health-badge.health-failed { color: var(--primary); }

.schedule-row { padding: 10px 16px; border-bottom: 1px solid var(--outline-variant); cursor: pointer; }
.schedule-row:hover { background: var(--surface-container-low); }
.schedule-row-main { display: flex; gap: 16px; align-items: baseline; }
.schedule-name { font-weight: 600; font-size: 13px; min-width: 160px; }
.schedule-cron { font-size: 11px; color: var(--on-surface-variant); min-width: 120px; }
.schedule-last-run { font-size: 11px; color: var(--on-surface-variant); min-width: 140px; }
.schedule-next-run { font-size: 11px; min-width: 80px; }

.health-indicator { font-size: 11px; font-weight: 600; }
.health-ok { color: var(--tertiary); }
.health-late { color: #B8860B; }
.health-failed { color: var(--primary); }
.health-paused { color: var(--secondary); }

.sparkline { display: inline-flex; gap: 2px; font-size: 10px; margin-right: 8px; }
.dot-ok { color: var(--tertiary); }
.dot-fail { color: var(--primary); }
.dot-empty { color: var(--secondary); opacity: 0.3; }

.schedule-detail { padding: 12px 16px 12px 32px; background: var(--surface-container-low); font-size: 12px; }
```

**Commit:** `feat(desktop): heartbeat CSS, live updates, and navigation registration`

---

## Regression Tests

Run after every step:

```bash
# Must compile
cargo build --bin starbridge-dioxus-ui --features desktop-ui

# Unit tests
cargo test --bin starbridge-dioxus-ui --features desktop-ui

# Manual verification:
# - Navigate to Heartbeat view
# - Schedule list renders (or empty state if no schedules)
# - Status badges show correct colors (OK/LATE/FAIL/OFF)
# - Sparkline dots render proportional pass/fail
# - Relative timestamps display ("14m ago", "3h ago")
# - Wait 30s -> relative timestamps update
# - Click [Run] -> spinner shows, then result updates
# - Click [Pause] -> status changes to OFF, button becomes [Resume]
# - Click [Resume] -> status returns to active
# - Click row -> expanded detail shows stats and last failure
# - Edit cron expression -> save -> cron updates
# - System health badge reflects worst-case status
# - If a schedule goes overdue -> status transitions to LATE in real-time
# - Empty state renders when no schedules exist
```

---

## Definition of Done

- [ ] Single-column schedule list renders with all fields
- [ ] Status indicators show correct state: OK, LATE, FAIL, OFF
- [ ] Sparkline dots render last 10 execution pass/fail ratio
- [ ] System health badge reflects overall status
- [ ] Manual trigger button works and shows spinner
- [ ] Pause/Resume toggle works per schedule
- [ ] Expanded detail shows full stats and last failure message
- [ ] Edit form saves updated cron expression and name
- [ ] Relative timestamps refresh every 30 seconds
- [ ] Live updates from SpacetimeDB reflect status changes in real-time
- [ ] Empty state renders when no schedules exist
- [ ] View registered in `WorkspacePage` enum and sidebar
- [ ] `cargo build` passes with no warnings

---

## PR Template

```markdown
## Summary
- Add Heartbeat view for cron/schedule monitoring
- Status indicators (OK/LATE/FAIL/OFF), sparkline execution history, system health badge
- Manual trigger, pause/resume, inline edit per schedule
- Live updates from SpacetimeDB schedule_record table

## Test plan
- [ ] Build passes: `cargo build --bin starbridge-dioxus-ui --features desktop-ui`
- [ ] Navigate to Heartbeat, verify schedule list renders
- [ ] Status badges show correct colors for each state
- [ ] Sparkline dots represent pass/fail ratio
- [ ] Click [Run] — triggers schedule, spinner shows
- [ ] Click [Pause] — status goes OFF; [Resume] — back to active
- [ ] Click row — expanded detail shows run counts and last failure
- [ ] Edit cron expression — save — updated in list
- [ ] Wait 30s — relative timestamps refresh
- [ ] System health badge shows worst-case across all schedules
- [ ] Empty state when no schedules exist

Closes #XXX
```
