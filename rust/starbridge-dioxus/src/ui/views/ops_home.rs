use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

use crate::ui::models::queue_metrics;
use crate::ui::shared::{ErrorBanner, RunCard, ApprovalCard, Sparkline, TrainingBufferBadge};

#[component]
pub fn OpsHomeView(snapshot: MissionControlSnapshot) -> Element {
    let metrics = queue_metrics(&snapshot);
    let mut action_error = use_signal(|| None::<String>);

    rsx! {
        div { class: "ops-home",
            // Error banner
            if let Some(err) = action_error() {
                ErrorBanner {
                    message: err,
                    on_dismiss: move |_| action_error.set(None),
                }
            }

            // Metrics bar
            div { class: "ops-metrics",
                div { class: "ops-metric",
                    p { class: "ops-metric-label", "Active Runs" }
                    p { class: "ops-metric-value ops-metric-value-accent", "{metrics.active_runs}" }
                }
                div { class: "ops-metric",
                    p { class: "ops-metric-label", "Approvals" }
                    p { class: "ops-metric-value ops-metric-value-warning", "{metrics.pending_approvals}" }
                }
                div { class: "ops-metric",
                    p { class: "ops-metric-label", "Blocked" }
                    p { class: "ops-metric-value", "{metrics.blocked_items}" }
                }
                div { class: "ops-metric",
                    p { class: "ops-metric-label", "Browser Tasks" }
                    p { class: "ops-metric-value", "{metrics.browser_tasks}" }
                }
                // Quality trend sparkline from trajectory scores
                div { class: "ops-metric",
                    p { class: "ops-metric-label",
                        "Quality Trend "
                        TrainingBufferBadge {
                            count: snapshot.training_buffer.iter().filter(|b| !b.consumed).count(),
                        }
                    }
                    {
                        let scores: Vec<f32> = snapshot.trajectory_scores.iter()
                            .map(|s| s.composite)
                            .collect();
                        let avg = if scores.is_empty() { 0.0 } else { scores.iter().sum::<f32>() / scores.len() as f32 };
                        rsx! {
                            div { style: "display: flex; align-items: center; gap: 8px;",
                                p { class: "ops-metric-value", "{avg:.0}%" }
                                Sparkline { values: scores, width: 80.0, height: 24.0 }
                            }
                        }
                    }
                }
            }

            // Grid: runs + approvals
            div { class: "ops-grid",
                // Runs panel
                div { class: "ops-panel",
                    div { class: "ops-panel-head",
                        p { class: "ops-panel-title", "Runs" }
                        span { class: "pill pill-subtle", "{snapshot.workflow_runs.len()}" }
                    }
                    div { class: "ops-panel-body",
                        if snapshot.workflow_runs.is_empty() {
                            div { class: "empty-state",
                                h3 { "No runs" }
                                p { "Dispatch an agent to see runs here." }
                            }
                        }
                        for run in snapshot.workflow_runs.iter() {
                            RunCard {
                                run: run.clone(),
                                onclick: move |_| {},
                            }
                        }
                    }
                }

                // Approvals panel
                div { class: "ops-panel",
                    div { class: "ops-panel-head",
                        p { class: "ops-panel-title", "Approvals" }
                        span { class: "pill pill-subtle", "{snapshot.approval_requests.len()}" }
                    }
                    div { class: "ops-panel-body",
                        if snapshot.approval_requests.is_empty() {
                            div { class: "empty-state",
                                h3 { "No pending approvals" }
                                p { "Approval requests appear here." }
                            }
                        }
                        for approval in snapshot.approval_requests.iter() {
                            ApprovalCard {
                                approval_id: approval.approval_id.clone(),
                                title: approval.title.clone(),
                                detail: approval.detail.clone(),
                                status: approval.status.clone(),
                                run_id: approval.run_id.clone(),
                                step_id: approval.step_id.clone(),
                                on_approve: move |id: String| {
                                    resolve_action(id, "approved", &mut action_error);
                                },
                                on_reject: move |id: String| {
                                    resolve_action(id, "rejected", &mut action_error);
                                },
                            }
                        }
                    }
                }
            }
        }
    }
}

fn resolve_action(
    approval_id: String,
    decision: &'static str,
    error: &mut Signal<Option<String>>,
) {
    #[cfg(feature = "desktop-ui")]
    {
        use crate::web_client::WebClient;
        let mut error = error.clone();
        if let Ok(client) = WebClient::from_session() {
            spawn(async move {
                match client.resolve_approval(&approval_id, decision, None).await {
                    Ok(_) => error.set(None),
                    Err(e) => error.set(Some(format!("{e}"))),
                }
            });
        } else {
            error.set(Some("Not logged in".to_string()));
        }
    }
    #[cfg(not(feature = "desktop-ui"))]
    {
        let _ = (approval_id, decision, error);
    }
}
