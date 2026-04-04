use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

use crate::ui::shared::{format_timestamp_micros, QualityGauge, Sparkline, TrainingBufferBadge};

#[derive(Debug, Clone, PartialEq)]
struct RlvrSignals {
    compile_success: Option<bool>,
    tests_passed: Option<bool>,
    deploy_success: Option<bool>,
    task_completed: Option<bool>,
    platform: Option<String>,
}

fn parse_rlvr_signals(json: &str) -> RlvrSignals {
    let value: serde_json::Value = serde_json::from_str(json).unwrap_or(serde_json::Value::Null);
    RlvrSignals {
        compile_success: value.get("compile_success").and_then(|v| v.as_bool()),
        tests_passed: value.get("tests_passed").and_then(|v| v.as_bool()),
        deploy_success: value.get("deploy_success").and_then(|v| v.as_bool()),
        task_completed: value.get("task_completed").and_then(|v| v.as_bool()),
        platform: value.get("platform").and_then(|v| v.as_str()).map(|s| s.to_string()),
    }
}

fn score_bar_color(composite: f32) -> &'static str {
    if composite < 0.4 {
        "var(--error)"
    } else if composite < 0.7 {
        "var(--warning)"
    } else {
        "var(--success)"
    }
}

#[component]
pub fn RlDashboardView(snapshot: MissionControlSnapshot) -> Element {
    let mut selected_score = use_signal(|| None::<String>);
    let mut show_consumed = use_signal(|| false);

    let scores = snapshot.trajectory_scores.clone();
    let buffer = snapshot.training_buffer.clone();

    // Aggregate stats
    let total = scores.len();
    let avg_composite = if total > 0 {
        scores.iter().map(|s| s.composite).sum::<f32>() / total as f32
    } else {
        0.0
    };
    let avg_delight = if total > 0 {
        scores.iter().map(|s| s.delight).sum::<f32>() / total as f32
    } else {
        0.0
    };
    let buffer_size = buffer.iter().filter(|b| !b.consumed).count();
    let consumed_count = buffer.iter().filter(|b| b.consumed).count();

    // Composite sparkline (most recent 20)
    let sparkline_values: Vec<f32> = scores.iter().rev().take(20).rev().map(|s| s.composite).collect();

    // Selected score detail
    let selected_id = selected_score();
    let selected = selected_id.as_ref().and_then(|id| scores.iter().find(|s| &s.score_id == id)).cloned();

    // Buffer grouped by task_cluster
    let mut cluster_groups: Vec<(String, Vec<_>)> = Vec::new();
    for entry in &buffer {
        if !show_consumed() && entry.consumed {
            continue;
        }
        if let Some(group) = cluster_groups.iter_mut().find(|(k, _)| k == &entry.task_cluster) {
            group.1.push(entry.clone());
        } else {
            cluster_groups.push((entry.task_cluster.clone(), vec![entry.clone()]));
        }
    }

    rsx! {
        div { class: "rl-dashboard",
            // Stats row
            div { class: "rl-stats",
                div { class: "rl-stat",
                    div { class: "rl-stat-label", "Total Scores" }
                    div { class: "rl-stat-value", "{total}" }
                }
                div { class: "rl-stat",
                    div { class: "rl-stat-label", "Avg Composite" }
                    div { class: "rl-stat-value", "{avg_composite:.2}" }
                }
                div { class: "rl-stat",
                    div { class: "rl-stat-label", "Avg Delight" }
                    div { class: "rl-stat-value", "{avg_delight:.2}" }
                }
                div { class: "rl-stat",
                    div { class: "rl-stat-label", "Buffer (unconsumed)" }
                    div { class: "rl-stat-value",
                        TrainingBufferBadge { count: buffer_size }
                        " {buffer_size}"
                    }
                }
                div { class: "rl-stat",
                    div { class: "rl-stat-label", "Consumed" }
                    div { class: "rl-stat-value", "{consumed_count}" }
                }
                if !sparkline_values.is_empty() {
                    div { class: "rl-stat", style: "flex: 2;",
                        div { class: "rl-stat-label", "Composite Trend" }
                        Sparkline { values: sparkline_values, width: 160.0, height: 32.0 }
                    }
                }
            }

            // Two-panel layout
            div { class: "rl-panels",
                // Left: score list
                div { class: "rl-panel",
                    div { class: "rl-panel-head",
                        span { "Trajectory Scores" }
                        span { style: "font-size: 11px; font-weight: 400; color: var(--on-surface-variant);",
                            "{total} entries"
                        }
                    }
                    div { class: "rl-panel-body",
                        if scores.is_empty() {
                            div { class: "empty-state",
                                p { "No trajectory scores yet" }
                            }
                        }
                        for score in scores.iter() {
                            {
                                let sid = score.score_id.clone();
                                let is_selected = selected_id.as_deref() == Some(&score.score_id);
                                let composite = score.composite;
                                let pct = (composite * 100.0).clamp(0.0, 100.0);
                                let color = score_bar_color(composite);
                                let run_id_short = score.run_id.chars().take(8).collect::<String>();
                                let source = score.source.clone();
                                let ts = format_timestamp_micros(score.created_at_micros);
                                rsx! {
                                    div {
                                        class: if is_selected { "rl-score-row rl-score-row-selected" } else { "rl-score-row" },
                                        onclick: move |_| {
                                            if is_selected {
                                                selected_score.set(None);
                                            } else {
                                                selected_score.set(Some(sid.clone()));
                                            }
                                        },
                                        div { class: "rl-score-meta",
                                            span { style: "font-weight: 500;", "{run_id_short}…" }
                                            span { class: "pill pill-subtle", "{source}" }
                                            span { style: "margin-left: auto;", "{ts}" }
                                        }
                                        div { class: "rl-score-bar", style: "width: {pct}%; background: {color};" }
                                    }
                                }
                            }
                        }
                    }
                }

                // Right: detail or buffer
                div { class: "rl-panel",
                    div { class: "rl-panel-head",
                        if selected.is_some() {
                            span { "Score Detail" }
                        } else {
                            span { "Training Buffer" }
                        }
                        if selected.is_none() {
                            button {
                                class: if show_consumed() { "pill pill-subtle" } else { "pill pill-accent" },
                                onclick: move |_| show_consumed.set(!show_consumed()),
                                if show_consumed() { "Hide Consumed" } else { "Show Consumed" }
                            }
                        }
                    }
                    div { class: "rl-panel-body",
                        if let Some(score) = selected {
                            // Score detail view
                            {
                                let signals = parse_rlvr_signals(&score.rlvr_signals_json);
                                let run_id = score.run_id.clone();
                                let trajectory_id = score.trajectory_id.clone();
                                let judge_model = score.judge_model.clone();
                                let reasoning = score.judge_reasoning.clone();
                                let source = score.source.clone();
                                rsx! {
                                    // Full quality gauge
                                    div { style: "padding: 8px;",
                                        QualityGauge {
                                            composite: score.composite,
                                            correctness: score.correctness,
                                            efficiency: score.efficiency,
                                            tool_use_quality: score.tool_use_quality,
                                            adherence: score.adherence,
                                            delight: score.delight,
                                            source: source.clone(),
                                        }
                                    }

                                    dl { class: "rl-score-detail",
                                        dt { "Run ID" }
                                        dd { "{run_id}" }
                                        dt { "Trajectory" }
                                        dd { "{trajectory_id}" }
                                        dt { "Source" }
                                        dd { "{source}" }
                                        dt { "Loss" }
                                        dd { "{score.loss:.3}" }
                                        dt { "Surprise" }
                                        dd { "{score.surprise:.3}" }
                                        dt { "Delight" }
                                        dd { "{score.delight:.3}" }
                                        dt { "Correctness" }
                                        dd { "{score.correctness:.2}" }
                                        dt { "Efficiency" }
                                        dd { "{score.efficiency:.2}" }
                                        dt { "Tool Use" }
                                        dd { "{score.tool_use_quality:.2}" }
                                        dt { "Adherence" }
                                        dd { "{score.adherence:.2}" }
                                        dt { "Judge Model" }
                                        dd { "{judge_model}" }
                                    }

                                    // RLVR signals
                                    if source == "rlvr" || !score.rlvr_signals_json.is_empty() && score.rlvr_signals_json != "{}" {
                                        div { style: "padding: 0 12px;",
                                            div { class: "rl-stat-label", style: "margin-bottom: 4px;", "RLVR Signals" }
                                            div { class: "rl-signal-grid",
                                                {
                                                    let compile = signals.compile_success;
                                                    let tests = signals.tests_passed;
                                                    let deploy = signals.deploy_success;
                                                    let task = signals.task_completed;
                                                    let platform = signals.platform.clone();
                                                    rsx! {
                                                        if let Some(v) = compile {
                                                            span { class: if v { "rl-signal rl-signal-pass" } else { "rl-signal rl-signal-fail" },
                                                                if v { "compile ✓" } else { "compile ✗" }
                                                            }
                                                        } else {
                                                            span { class: "rl-signal rl-signal-null", "compile —" }
                                                        }
                                                        if let Some(v) = tests {
                                                            span { class: if v { "rl-signal rl-signal-pass" } else { "rl-signal rl-signal-fail" },
                                                                if v { "tests ✓" } else { "tests ✗" }
                                                            }
                                                        } else {
                                                            span { class: "rl-signal rl-signal-null", "tests —" }
                                                        }
                                                        if let Some(v) = deploy {
                                                            span { class: if v { "rl-signal rl-signal-pass" } else { "rl-signal rl-signal-fail" },
                                                                if v { "deploy ✓" } else { "deploy ✗" }
                                                            }
                                                        } else {
                                                            span { class: "rl-signal rl-signal-null", "deploy —" }
                                                        }
                                                        if let Some(v) = task {
                                                            span { class: if v { "rl-signal rl-signal-pass" } else { "rl-signal rl-signal-fail" },
                                                                if v { "task ✓" } else { "task ✗" }
                                                            }
                                                        } else {
                                                            span { class: "rl-signal rl-signal-null", "task —" }
                                                        }
                                                        if let Some(p) = platform {
                                                            span { class: "rl-platform-badge", "{p}" }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    // Judge reasoning (llm-judge source)
                                    if source == "llm-judge" && !reasoning.is_empty() {
                                        div { style: "padding: 0 12px 12px;",
                                            div { class: "rl-stat-label", style: "margin-bottom: 4px;", "Judge Reasoning" }
                                            div { class: "rl-reasoning", "{reasoning}" }
                                        }
                                    }
                                }
                            }
                        } else {
                            // Training buffer panel
                            if cluster_groups.is_empty() {
                                div { class: "empty-state",
                                    p { "No training buffer entries" }
                                    p { style: "font-size: 12px; color: var(--on-surface-variant);",
                                        "High-delight trajectories appear here before GRPO training."
                                    }
                                }
                            }
                            for (cluster, entries) in cluster_groups.iter() {
                                div { class: "rl-cluster-group",
                                    div { class: "rl-cluster-label", "{cluster} ({entries.len()})" }
                                    for entry in entries.iter() {
                                        {
                                            let delight = entry.delight;
                                            let consumed = entry.consumed;
                                            let ts = format_timestamp_micros(entry.created_at_micros);
                                            let tid_short = entry.trajectory_id.chars().take(8).collect::<String>();
                                            rsx! {
                                                div {
                                                    class: if consumed { "rl-buffer-row rl-buffer-consumed" } else { "rl-buffer-row" },
                                                    span { style: "font-weight: 500;", "{tid_short}…" }
                                                    span { style: "color: var(--on-surface-variant);", "{ts}" }
                                                    span { style: "margin-left: auto;",
                                                        span { class: "pill pill-subtle", "delight {delight:.2}" }
                                                    }
                                                    if consumed {
                                                        span { class: "pill pill-success", "consumed" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
