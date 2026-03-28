use dioxus::prelude::*;
use starbridge_core::{ApprovalRequestRecord, MissionControlSnapshot};

use crate::{
    resolve_live_approval,
    ui::{
        models::{queue_metrics, OverviewTab},
        shared::{
            status_badge_class, BrowserTaskRow, CalloutBox, EmptyState, InspectorCard,
            RunListItem, WorkflowStepRow, segmented_button_class,
        },
        OperatorRuntimeContext,
    },
};

#[component]
pub fn OverviewView(snapshot: MissionControlSnapshot) -> Element {
    let runtime = try_use_context::<OperatorRuntimeContext>();
    let metrics = queue_metrics(&snapshot);
    let runs = snapshot.workflow_runs.clone();
    let browser_tasks = snapshot.browser_tasks.clone();
    let approvals = snapshot.approval_requests.clone();
    let steps = snapshot.workflow_steps.clone();

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

    rsx! {
        div { class: "page-grid page-grid-overview",
            section { class: "panel",
                div { class: "panel-head",
                    p { class: "section-eyebrow", "Run queue" }
                    h3 { class: "card-title", "Live runs" }
                    p { class: "row-copy", "{runs.len()} tracked workflows in the current snapshot." }
                }
                div { class: "panel-body list-stack",
                    if runs.is_empty() {
                        EmptyState {
                            title: "No workflow runs".to_string(),
                            body: "Publish a run into SpacetimeDB to populate the operator queue.".to_string(),
                        }
                    } else {
                        for run in runs.clone() {
                            RunListItem {
                                run: run.clone(),
                                active: active_run_id.as_ref().map(|value| value == &run.run_id).unwrap_or(false),
                                onclick: {
                                    let run_id = run.run_id.clone();
                                    move |_| selected_run_id.set(Some(run_id.clone()))
                                }
                            }
                        }
                    }
                }
            }

            section { class: "panel",
                if let Some(notice) = action_notice() {
                    div { class: "panel-body", style: "padding-bottom: 0;",
                        CalloutBox {
                            tone: "tip".to_string(),
                            title: "Approval updated".to_string(),
                            body: notice,
                        }
                    }
                }
                if let Some(error) = action_error() {
                    div { class: "panel-body", style: "padding-bottom: 0;",
                        CalloutBox {
                            tone: "danger".to_string(),
                            title: "Operator action failed".to_string(),
                            body: error,
                        }
                    }
                }

                if let Some(run) = selected_run.clone() {
                    div { class: "detail-hero",
                        p { class: "section-eyebrow", "{run.agent_id}" }
                        h3 { class: "card-title", "{run.goal}" }
                        p { class: "detail-summary",
                            "{run.summary.clone().unwrap_or_else(|| \"Waiting for the next stage summary.\".to_string())}"
                        }
                        div { class: "detail-meta", style: "margin-top: 10px;",
                            div { class: "chip-row",
                                span { class: status_badge_class(run.status.as_str()), "{run.status}" }
                                span { class: "pill pill-subtle", "{run.current_stage}" }
                                span { class: "pill pill-subtle", "{run.priority}" }
                                span { class: "pill pill-subtle", "{run.trigger_source}" }
                            }
                            div { class: "segmented",
                                button {
                                    class: segmented_button_class(tab() == OverviewTab::Timeline),
                                    onclick: move |_| tab.set(OverviewTab::Timeline),
                                    "Timeline"
                                }
                                button {
                                    class: segmented_button_class(tab() == OverviewTab::Browser),
                                    onclick: move |_| tab.set(OverviewTab::Browser),
                                    "Browser"
                                }
                                button {
                                    class: segmented_button_class(tab() == OverviewTab::Approvals),
                                    onclick: move |_| tab.set(OverviewTab::Approvals),
                                    "Approvals"
                                }
                            }
                        }
                    }

                    div { class: "detail-body",
                        if tab() == OverviewTab::Timeline {
                            if selected_steps.is_empty() {
                                EmptyState {
                                    title: "No workflow steps".to_string(),
                                    body: "The run exists, but no stage rows have been materialized yet.".to_string(),
                                }
                            } else {
                                for step in selected_steps {
                                    WorkflowStepRow { step }
                                }
                            }
                        } else if tab() == OverviewTab::Browser {
                            if selected_browser.is_empty() {
                                EmptyState {
                                    title: "No browser work".to_string(),
                                    body: "This run has not queued any browser tasks.".to_string(),
                                }
                            } else {
                                for task in selected_browser {
                                    BrowserTaskRow { task }
                                }
                            }
                        } else {
                            if selected_approvals.is_empty() {
                                EmptyState {
                                    title: "No approvals".to_string(),
                                    body: "This run is not waiting on operator approval right now.".to_string(),
                                }
                            } else {
                                for approval in selected_approvals {
                                    ApprovalRow {
                                        approval,
                                        runtime: runtime.clone(),
                                        onnotice: move |notice| action_notice.set(Some(notice)),
                                        onerror: move |error| action_error.set(Some(error)),
                                    }
                                }
                            }
                        }
                    }
                } else {
                    div { class: "panel-body",
                        EmptyState {
                            title: "No run selected".to_string(),
                            body: "Choose a workflow from the queue to inspect its timeline.".to_string(),
                        }
                    }
                }
            }

            aside { class: "inspector-stack",
                InspectorCard {
                    eyebrow: "Selected run".to_string(),
                    title: selected_run
                        .clone()
                        .map(|run| run.goal)
                        .unwrap_or_else(|| "Nothing selected".to_string()),
                    if let Some(run) = selected_run {
                        ul { class: "key-value-list",
                            li { span { "Thread" } strong { "{run.thread_id}" } }
                            li { span { "Agent" } strong { "{run.agent_id}" } }
                            li { span { "Requested by" } strong { "{run.requested_by}" } }
                            li { span { "Current stage" } strong { "{run.current_stage}" } }
                        }
                    } else {
                        p { class: "row-copy", "Pick a run from the queue to see its metadata." }
                    }
                }

                InspectorCard {
                    eyebrow: "Queue health".to_string(),
                    title: "Current pressure".to_string(),
                    ul { class: "key-value-list",
                        li { span { "Active runs" } strong { "{metrics.active_runs}" } }
                        li { span { "Pending approvals" } strong { "{metrics.pending_approvals}" } }
                        li { span { "Browser tasks" } strong { "{metrics.browser_tasks}" } }
                        li { span { "Blocked items" } strong { "{metrics.blocked_items}" } }
                    }
                }

                InspectorCard {
                    eyebrow: "Focus".to_string(),
                    title: "How to use this page".to_string(),
                    p { class: "row-copy", "Select a run on the left, inspect the center detail pane, and resolve approvals without leaving the workflow context." }
                }
            }
        }
    }
}

#[component]
fn ApprovalRow(
    approval: ApprovalRequestRecord,
    runtime: Option<OperatorRuntimeContext>,
    onnotice: EventHandler<String>,
    onerror: EventHandler<String>,
) -> Element {
    rsx! {
        article { class: "row-card",
            div { class: "row-top",
                div {
                    p { class: "section-eyebrow", "{approval.agent_id}" }
                    h3 { class: "card-title", "{approval.title}" }
                    p { class: "row-copy", "{approval.detail}" }
                }
                div { class: "chip-row",
                    span { class: status_badge_class(approval.status.as_str()), "{approval.status}" }
                    span { class: crate::ui::shared::risk_badge_class(approval.risk.as_str()), "{approval.risk}" }
                }
            }
            ul { class: "key-value-list", style: "margin-top: 8px;",
                li { span { "Step" } strong { "{approval.step_id}" } }
                li { span { "Requested by" } strong { "{approval.requested_by}" } }
            }
            if approval.status == "pending" {
                div { class: "composer-actions", style: "margin-top: 10px;",
                    button {
                        class: "primary-button",
                        onclick: {
                            let approval_id = approval.approval_id.clone();
                            let runtime = runtime.clone();
                            move |_| {
                                match runtime.clone() {
                                    Some(runtime) => {
                                        let options = runtime.live_options.clone();
                                        let onnotice = onnotice;
                                        let onerror = onerror;
                                        let resolved_id = approval_id.clone();
                                        let approval_id = approval_id.clone();
                                        spawn(async move {
                                            match tokio::task::spawn_blocking(move || {
                                                resolve_live_approval(&options, approval_id, "approved".to_string())
                                            }).await {
                                                Ok(Ok(())) => onnotice.call(format!("Resolved approval {resolved_id}")),
                                                Ok(Err(error)) => onerror.call(error),
                                                Err(error) => onerror.call(format!("Approval task failed: {error}")),
                                            }
                                        });
                                    }
                                    None => onerror.call("Live control context is unavailable in preview mode.".to_string()),
                                }
                            }
                        },
                        "Approve"
                    }
                    button {
                        class: "secondary-button",
                        onclick: {
                            let approval_id = approval.approval_id.clone();
                            let runtime = runtime.clone();
                            move |_| {
                                match runtime.clone() {
                                    Some(runtime) => {
                                        let options = runtime.live_options.clone();
                                        let onnotice = onnotice;
                                        let onerror = onerror;
                                        let resolved_id = approval_id.clone();
                                        let approval_id = approval_id.clone();
                                        spawn(async move {
                                            match tokio::task::spawn_blocking(move || {
                                                resolve_live_approval(&options, approval_id, "rejected".to_string())
                                            }).await {
                                                Ok(Ok(())) => onnotice.call(format!("Rejected approval {resolved_id}")),
                                                Ok(Err(error)) => onerror.call(error),
                                                Err(error) => onerror.call(format!("Approval task failed: {error}")),
                                            }
                                        });
                                    }
                                    None => onerror.call("Live control context is unavailable in preview mode.".to_string()),
                                }
                            }
                        },
                        "Reject"
                    }
                }
            }
        }
    }
}
