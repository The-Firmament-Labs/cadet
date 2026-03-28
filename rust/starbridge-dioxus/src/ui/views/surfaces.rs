use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

use crate::ui::{
    models::{default_agent_ui_spec, memory_namespaces, parse_ui_spec, SurfaceFocus},
    shared::{segmented_button_class, CalloutBox, DynamicUiNode, InspectorCard},
};

#[component]
pub fn SurfacesView(snapshot: MissionControlSnapshot) -> Element {
    let default_json = default_agent_ui_spec(&snapshot);
    let mut json_draft = use_signal(|| default_json.clone());
    let mut focus = use_signal(|| SurfaceFocus::Split);

    let parsed_ui = parse_ui_spec(&json_draft());
    let namespaces = memory_namespaces(&snapshot);
    let page_class = if focus() == SurfaceFocus::Preview {
        "page-grid page-grid-surfaces preview-only"
    } else {
        "page-grid page-grid-surfaces"
    };

    rsx! {
        div { class: "{page_class}",
            // Mode toggle lives OUTSIDE both panels so it's always visible
            div { class: "surfaces-toolbar",
                div { class: "segmented",
                    button {
                        class: segmented_button_class(focus() == SurfaceFocus::Split),
                        onclick: move |_| focus.set(SurfaceFocus::Split),
                        "Split"
                    }
                    button {
                        class: segmented_button_class(focus() == SurfaceFocus::Preview),
                        onclick: move |_| focus.set(SurfaceFocus::Preview),
                        "Preview"
                    }
                }
            }

            if focus() == SurfaceFocus::Split {
                section { class: "panel",
                    div { class: "panel-head",
                        div {
                            p { class: "section-eyebrow", "Schema editor" }
                            h3 { class: "card-title", "JSON contract" }
                            p { class: "row-copy", "Edit the constrained surface spec that drives native operator widgets." }
                        }
                    }
                    div { class: "editor-body",
                        textarea {
                            value: json_draft(),
                            oninput: move |event| json_draft.set(event.value()),
                            placeholder: "Paste a JSON surface specification"
                        }
                        div { class: "composer-actions",
                            p { class: "composer-help", "This renderer stays manifest-shaped so agent surfaces remain typed and constrained." }
                            div { class: "chip-row",
                                button {
                                    class: "secondary-button",
                                    onclick: move |_| json_draft.set(default_json.clone()),
                                    "Reset generated spec"
                                }
                            }
                        }
                    }
                }
            }

            section { class: "panel",
                div { class: "panel-head",
                    div {
                        p { class: "section-eyebrow", "Native preview" }
                        h3 { class: "card-title", "Rendered operator surface" }
                        p { class: "row-copy", "This is how the current JSON contract projects into the Dioxus client." }
                    }
                }
                div { class: "preview-body",
                    match parsed_ui.clone() {
                        Ok(spec) => rsx! {
                            div { class: "surface-preview",
                                for node in spec {
                                    DynamicUiNode { node }
                                }
                            }
                        },
                        Err(error) => rsx! {
                            CalloutBox {
                                tone: "danger".to_string(),
                                title: "Invalid JSON".to_string(),
                                body: error,
                            }
                        },
                    }
                }
            }

            aside { class: "inspector-stack",
                InspectorCard {
                    eyebrow: "Renderer".to_string(),
                    title: "Contract health".to_string(),
                    ul { class: "key-value-list",
                        li { span { "Nodes" } strong { "{parsed_ui.clone().ok().map(|nodes| nodes.len()).unwrap_or(0)}" } }
                        li { span { "Threads" } strong { "{snapshot.threads.len()}" } }
                        li { span { "Namespaces" } strong { "{namespaces.len()}" } }
                    }
                }
                InspectorCard {
                    eyebrow: "Why this exists".to_string(),
                    title: "Surface rules".to_string(),
                    p { class: "row-copy", "Cadet agents define workflow templates, tool profiles, and UI contracts in manifests. This page lets the operator client reverse-project those contracts into native control surfaces." }
                }
                if !namespaces.is_empty() {
                    InspectorCard {
                        eyebrow: "Namespaces".to_string(),
                        title: "Currently indexed".to_string(),
                        div { class: "chip-row",
                            for namespace in namespaces {
                                span { class: "pill pill-subtle", "{namespace}" }
                            }
                        }
                    }
                }
            }
        }
    }
}
