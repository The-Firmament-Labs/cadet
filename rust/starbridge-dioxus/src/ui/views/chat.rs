use dioxus::prelude::*;
use starbridge_core::MissionControlSnapshot;

use crate::{
    send_live_message, ChatMessageDraft,
    ui::{
        shared::{
            CalloutBox, EmptyState, InspectorCard, MessageBubble, ThreadListItem,
        },
        OperatorRuntimeContext,
    },
};

#[component]
pub fn ChatView(snapshot: MissionControlSnapshot) -> Element {
    let runtime = try_use_context::<OperatorRuntimeContext>();
    let threads = snapshot.threads.clone();
    let messages = snapshot.message_events.clone();
    let runs = snapshot.workflow_runs.clone();

    let default_thread_id = threads
        .first()
        .map(|thread| thread.thread_id.clone())
        .or_else(|| messages.first().map(|message| message.thread_id.clone()));
    let mut selected_thread_id = use_signal(|| default_thread_id.clone());
    let mut composer_text = use_signal(String::new);
    let action_notice = use_signal(|| None::<String>);
    let mut action_error = use_signal(|| None::<String>);

    let active_thread_id = selected_thread_id().or(default_thread_id.clone());
    let active_thread = active_thread_id
        .as_ref()
        .and_then(|thread_id| threads.iter().find(|thread| &thread.thread_id == thread_id))
        .cloned();
    let thread_messages = active_thread_id
        .as_ref()
        .map(|thread_id| {
            messages
                .iter()
                .filter(|message| &message.thread_id == thread_id)
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let linked_runs = active_thread_id
        .as_ref()
        .map(|thread_id| {
            runs
                .iter()
                .filter(|run| &run.thread_id == thread_id)
                .cloned()
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let active_thread_for_send = active_thread.clone();
    let thread_messages_count = thread_messages.len();

    rsx! {
        div { class: "page-grid page-grid-chat",
            section { class: "panel",
                div { class: "panel-head",
                    p { class: "section-eyebrow", "Threads" }
                    h3 { class: "card-title", "Conversation queue" }
                    p { class: "row-copy", "{threads.len()} durable channel threads are available." }
                }
                div { class: "panel-body list-stack",
                    if threads.is_empty() {
                        EmptyState {
                            title: "No conversations".to_string(),
                            body: "Create a thread through an adapter or the web inbox to populate this queue.".to_string(),
                        }
                    } else {
                        for thread in threads.clone() {
                            ThreadListItem {
                                thread: thread.clone(),
                                active: active_thread_id.as_ref().map(|value| value == &thread.thread_id).unwrap_or(false),
                                onclick: {
                                    let thread_id = thread.thread_id.clone();
                                    move |_| selected_thread_id.set(Some(thread_id.clone()))
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
                            title: "Message posted".to_string(),
                            body: notice,
                        }
                    }
                }
                if let Some(error) = action_error() {
                    div { class: "panel-body", style: "padding-bottom: 0;",
                        CalloutBox {
                            tone: "danger".to_string(),
                            title: "Message failed".to_string(),
                            body: error,
                        }
                    }
                }

                if let Some(thread) = active_thread.clone() {
                    div { class: "thread-header",
                        p { class: "section-eyebrow", "{thread.channel}" }
                        h3 { class: "card-title", "{thread.title}" }
                        div { class: "thread-meta", style: "margin-top: 8px;",
                            div { class: "chip-row",
                                span { class: "pill pill-subtle", "{thread.channel_thread_id}" }
                                span { class: "pill pill-subtle", "{thread_messages_count} messages" }
                            }
                            p { class: "row-copy", "{crate::ui::shared::format_timestamp_micros(thread.latest_message_at_micros)}" }
                        }
                    }
                    div { class: "chat-body",
                        div { class: "message-stream",
                            if thread_messages.is_empty() {
                                EmptyState {
                                    title: "No thread messages".to_string(),
                                    body: "This thread exists, but the message log is still empty.".to_string(),
                                }
                            } else {
                                for message in thread_messages.clone() {
                                    MessageBubble { message }
                                }
                            }
                        }

                        div { class: "composer",
                            textarea {
                                value: composer_text(),
                                oninput: move |event| composer_text.set(event.value()),
                                placeholder: "Reply into the selected live thread"
                            }
                            div { class: "composer-actions",
                                p { class: "composer-help", "Messages post back into the durable control-plane thread model." }
                                div { class: "chip-row",
                                    button {
                                        class: "secondary-button",
                                        onclick: move |_| composer_text.set(String::new()),
                                        "Clear"
                                    }
                                    button {
                                        class: "primary-button",
                                        disabled: composer_text().trim().is_empty(),
                                        onclick: move |_| {
                                            let content = composer_text();
                                            if content.trim().is_empty() {
                                                return;
                                            }

                                            match (runtime.clone(), active_thread_for_send.clone()) {
                                                (Some(runtime), Some(thread)) => {
                                                    composer_text.set(String::new());
                                                    let options = runtime.live_options.clone();
                                                    let draft = ChatMessageDraft {
                                                        thread_id: thread.thread_id.clone(),
                                                        channel: thread.channel.clone(),
                                                        channel_thread_id: thread.channel_thread_id.clone(),
                                                        title: thread.title.clone(),
                                                        actor: "operator".to_string(),
                                                        content,
                                                        run_id: None,
                                                    };
                                                    let thread_title = thread.title.clone();
                                                    let mut action_notice = action_notice;
                                                    let mut action_error = action_error;
                                                    spawn(async move {
                                                        match tokio::task::spawn_blocking(move || {
                                                            send_live_message(&options, draft)
                                                        }).await {
                                                            Ok(Ok(())) => action_notice.set(Some(format!("Posted into {thread_title}"))),
                                                            Ok(Err(error)) => action_error.set(Some(error)),
                                                            Err(error) => action_error.set(Some(format!("Message task failed: {error}"))),
                                                        }
                                                    });
                                                }
                                                _ => action_error.set(Some("Choose a live thread before sending a message.".to_string())),
                                            }
                                        },
                                        "Send reply"
                                    }
                                }
                            }
                        }
                    }
                } else {
                    div { class: "panel-body",
                        EmptyState {
                            title: "No thread selected".to_string(),
                            body: "Choose a thread from the queue to open the conversation workspace.".to_string(),
                        }
                    }
                }
            }

            aside { class: "inspector-stack",
                InspectorCard {
                    eyebrow: "Thread context".to_string(),
                    title: active_thread
                        .clone()
                        .map(|thread| thread.title)
                        .unwrap_or_else(|| "Nothing selected".to_string()),
                    if let Some(thread) = active_thread {
                        ul { class: "key-value-list",
                            li { span { "Channel" } strong { "{thread.channel}" } }
                            li { span { "Thread id" } strong { "{thread.channel_thread_id}" } }
                            li { span { "Messages" } strong { "{thread_messages_count}" } }
                        }
                    } else {
                        p { class: "row-copy", "Pick a thread to review its live channel metadata." }
                    }
                }

                InspectorCard {
                    eyebrow: "Linked runs".to_string(),
                    title: "Workflow context".to_string(),
                    if linked_runs.is_empty() {
                        p { class: "row-copy", "No workflow runs are attached to the selected thread." }
                    } else {
                        ul { class: "key-value-list",
                            for run in linked_runs {
                                li { span { "{run.current_stage}" } strong { "{run.goal}" } }
                            }
                        }
                    }
                }
            }
        }
    }
}
