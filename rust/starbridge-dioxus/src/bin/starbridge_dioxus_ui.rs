use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use dioxus::prelude::*;
use dioxus_desktop::{Config, LogicalSize, WindowBuilder};
use starbridge_core::MissionControlSnapshot;
use starbridge_dioxus::{
    load_live_snapshot, sample_snapshot, subscribe_live_snapshots, LiveSnapshotOptions,
    MissionControlApp, OperatorRuntimeContext,
};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

const DESKTOP_STYLES: &str = r#"
    .desktop-shell {
        min-height: 100vh;
        background: linear-gradient(180deg, #121412 0%, #0d0f0d 100%);
    }

    .desktop-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(211, 225, 207, 0.14);
        background: rgba(17, 19, 17, 0.96);
    }

    .desktop-context {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .desktop-chip {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 4px;
        border: 1px solid rgba(255, 122, 77, 0.28);
        background: rgba(255, 122, 77, 0.12);
        color: #ffd9cb;
        font-family: "JetBrains Mono", monospace;
        font-size: 11px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .desktop-note {
        color: #a1ab9c;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .desktop-actions {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .desktop-button {
        border: 1px solid rgba(255, 122, 77, 0.28);
        border-radius: 4px;
        background: rgba(255, 122, 77, 0.12);
        color: #eef4e9;
        font: inherit;
        padding: 8px 13px;
        cursor: pointer;
    }

    .desktop-button:hover {
        background: rgba(255, 122, 77, 0.18);
    }

    .desktop-error {
        margin: 10px 16px 0;
        padding: 10px 12px;
        border-radius: 4px;
        border: 1px solid rgba(255, 122, 77, 0.24);
        background: rgba(255, 122, 77, 0.1);
        color: #ffd9cb;
        font-size: 13px;
    }
"#;

#[derive(Clone)]
struct DesktopBootstrap {
    options: LiveSnapshotOptions,
    snapshot: MissionControlSnapshot,
    source_label: String,
    load_error: Option<String>,
}

#[derive(Clone)]
struct DesktopLiveBridge {
    sender: UnboundedSender<DesktopEvent>,
    receiver: Arc<tokio::sync::Mutex<UnboundedReceiver<DesktopEvent>>>,
    started: Arc<AtomicBool>,
}

enum DesktopEvent {
    Snapshot(MissionControlSnapshot, String),
    Error(String),
}

fn main() {
    let options = LiveSnapshotOptions::from_env();
    let (snapshot, source_label, load_error) = match load_live_snapshot(&options) {
        Ok(snapshot) => (
            snapshot,
            format!("Live data from {}", options.database),
            None,
        ),
        Err(error) => (
            sample_snapshot(),
            "Fallback sample snapshot".to_string(),
            Some(error),
        ),
    };

    let bootstrap = DesktopBootstrap {
        options,
        snapshot,
        source_label,
        load_error,
    };

    dioxus::LaunchBuilder::desktop()
        .with_cfg(
            Config::new().with_window(
                WindowBuilder::new()
                    .with_title("Cadet Mission Control")
                    .with_always_on_top(false)
                    .with_inner_size(LogicalSize::new(1680.0, 1020.0))
                    .with_min_inner_size(LogicalSize::new(1380.0, 820.0)),
            ),
        )
        .with_context(bootstrap)
        .launch(app);
}

fn app() -> Element {
    let bootstrap = use_context::<DesktopBootstrap>();
    use_context_provider(|| OperatorRuntimeContext {
        live_options: bootstrap.options.clone(),
    });

    let mut snapshot = use_signal(|| bootstrap.snapshot.clone());
    let mut source_label = use_signal(|| bootstrap.source_label.clone());
    let mut load_error = use_signal(|| bootstrap.load_error.clone());
    let options = bootstrap.options.clone();
    let bridge = use_hook(|| {
        let (sender, receiver) = unbounded_channel();
        DesktopLiveBridge {
            sender,
            receiver: Arc::new(tokio::sync::Mutex::new(receiver)),
            started: Arc::new(AtomicBool::new(false)),
        }
    });

    if !bridge.started.swap(true, Ordering::SeqCst) {
        let event_sender = bridge.sender.clone();
        let subscribe_options = options.clone();
        subscribe_live_snapshots(
            subscribe_options,
            move |next_snapshot, label| {
                let _ = event_sender.send(DesktopEvent::Snapshot(next_snapshot, label));
            },
            {
                let error_sender = bridge.sender.clone();
                move |error| {
                    let _ = error_sender.send(DesktopEvent::Error(error));
                }
            },
        );

        let receiver = bridge.receiver.clone();
        let mut snapshot = snapshot;
        let mut source_label = source_label;
        let mut load_error = load_error;
        spawn(async move {
            loop {
                let event = {
                    let mut receiver = receiver.lock().await;
                    receiver.recv().await
                };

                match event {
                    Some(DesktopEvent::Snapshot(next_snapshot, label)) => {
                        snapshot.set(next_snapshot);
                        source_label.set(label);
                        load_error.set(None);
                    }
                    Some(DesktopEvent::Error(error)) => {
                        load_error.set(Some(error));
                    }
                    None => break,
                }
            }
        });
    }

    rsx! {
        style { "{DESKTOP_STYLES}" }
        div { class: "desktop-shell",
            div { class: "desktop-toolbar",
                div { class: "desktop-context",
                    span { class: "desktop-chip", "Native client" }
                    span { class: "desktop-note", "{source_label}" }
                }
                div { class: "desktop-actions",
                    button {
                        class: "desktop-button",
                        onclick: move |_| {
                            match load_live_snapshot(&options) {
                                Ok(next_snapshot) => {
                                    source_label.set(format!("Live data refreshed from {}", options.database));
                                    load_error.set(None);
                                    snapshot.set(next_snapshot);
                                }
                                Err(error) => {
                                    load_error.set(Some(error));
                                }
                            }
                        },
                        "Reload live data"
                    }
                }
            }

            if let Some(error) = load_error() {
                div { class: "desktop-error",
                    "Live snapshot unavailable. {error}"
                }
            }

            MissionControlApp { snapshot: snapshot() }
        }
    }
}
