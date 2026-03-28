use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

use crate::ui::{
    models::{canonical_stages, lane_copy, move_step_to_stage},
    shared::{workflow_lane_class, CalloutBox, InspectorCard},
};

#[component]
pub fn WorkflowStudioView(snapshot: MissionControlSnapshot) -> Element {
    let live_steps = snapshot.workflow_steps.clone();
    let mut workflow_override = use_signal(|| None::<Vec<_>>);
    let mut dragged_step_id = use_signal(|| None::<String>);

    let steps = workflow_override()
        .clone()
        .unwrap_or_else(|| live_steps.clone());
    let stage_counts = canonical_stages()
        .into_iter()
        .map(|stage| {
            let count = steps.iter().filter(|step| step.stage == stage).count();
            (stage.to_string(), count)
        })
        .collect::<Vec<_>>();

    rsx! {
        div { class: "page-grid page-grid-workflow",
            section { class: "panel",
                div { class: "panel-head",
                    div {
                        p { class: "section-eyebrow", "Workflow board" }
                        h3 { class: "card-title", "Stage choreography" }
                        p { class: "row-copy", "Drag cards across stages to draft a new execution shape on top of the live snapshot." }
                    }
                    div { class: "chip-row",
                        if workflow_override().is_some() {
                            button {
                                class: "secondary-button",
                                onclick: move |_| workflow_override.set(None),
                                "Reset live layout"
                            }
                        }
                        span { class: "pill pill-subtle", "{steps.len()} step cards" }
                    }
                }
                div { class: "panel-body",
                    if workflow_override().is_some() {
                        CalloutBox {
                            tone: "warn".to_string(),
                            title: "Draft mode".to_string(),
                            body: "The board is showing a local working copy. Reset to restore the live lane arrangement.".to_string(),
                        }
                    }

                    div { class: "workflow-board", style: "margin-top: 10px;",
                        for stage in canonical_stages() {
                            div {
                                class: workflow_lane_class(dragged_step_id().is_some()),
                                ondragover: move |event| event.prevent_default(),
                                ondrop: {
                                    let lane_steps = steps.clone();
                                    let stage_name = stage.to_string();
                                    move |_| {
                                        if let Some(step_id) = dragged_step_id() {
                                            workflow_override.set(Some(move_step_to_stage(&lane_steps, &step_id, &stage_name)));
                                            dragged_step_id.set(None);
                                        }
                                    }
                                },
                                div { class: "lane-head",
                                    div {
                                        p { class: "section-eyebrow", "{stage}" }
                                        h3 { class: "card-title", "{lane_copy(stage)}" }
                                    }
                                    span { class: "pill pill-subtle", "{steps.iter().filter(|step| step.stage == stage).count()}" }
                                }
                                p { class: "lane-copy", "{lane_copy(stage)}" }
                                for step in steps.iter().filter(|step| step.stage == stage).cloned() {
                                    article {
                                        class: "workflow-card",
                                        draggable: true,
                                        ondragstart: move |_| dragged_step_id.set(Some(step.step_id.clone())),
                                        p { class: "section-eyebrow", "{step.agent_id}" }
                                        h3 { class: "card-title", "{step.step_id}" }
                                        p { class: "row-copy", "{step.owner_execution}" }
                                        div { class: "chip-row", style: "margin-top: 8px;",
                                            span { class: crate::ui::shared::status_badge_class(step.status.as_str()), "{step.status}" }
                                            span { class: "pill pill-subtle", "retry {step.retry_count}" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            aside { class: "inspector-stack",
                InspectorCard {
                    eyebrow: "Stage counts".to_string(),
                    title: "Current distribution".to_string(),
                    ul { class: "key-value-list",
                        for (stage, count) in stage_counts {
                            li { span { "{stage}" } strong { "{count}" } }
                        }
                    }
                }
                InspectorCard {
                    eyebrow: "Behavior".to_string(),
                    title: "Studio contract".to_string(),
                    p { class: "row-copy", "This board never mutates the control plane directly. It is a native drafting surface for workflow recipes and handoff rehearsals." }
                }
            }
        }
    }
}
