use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use dioxus::prelude::*;
use dioxus_desktop::{
    muda::{self, Menu, MenuItem, PredefinedMenuItem, Submenu},
    trayicon, use_global_shortcut, use_muda_event_handler, use_tray_menu_event_handler,
    use_window, Config, HotKeyState, LogicalSize, WindowBuilder, WindowCloseBehaviour,
};
use starbridge_core::MissionControlSnapshot;
use starbridge_dioxus::{
    load_live_snapshot, sample_snapshot, subscribe_live_snapshots, LiveSnapshotOptions,
    MenuAction, MissionControlApp, OperatorRuntimeContext,
};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

const DESKTOP_STYLES: &str = r#"
    .desktop-shell {
        min-height: 100vh;
        background: #c8d1c0;
    }

    .desktop-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        background: rgba(190, 200, 182, 0.96);
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
        padding: 4px 10px;
        border-radius: 4px;
        border: 1px solid rgba(224, 123, 90, 0.4);
        background: rgba(224, 123, 90, 0.12);
        color: #e07b5a;
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .desktop-note {
        color: rgba(26, 26, 26, 0.55);
        font-size: 11px;
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
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.05);
        color: #1a1a1a;
        font: inherit;
        font-size: 11px;
        padding: 6px 12px;
        cursor: pointer;
    }

    .desktop-button:hover {
        background: rgba(0, 0, 0, 0.08);
        border-color: rgba(0, 0, 0, 0.2);
    }

    .desktop-error {
        margin: 8px 16px 0;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid rgba(201, 74, 74, 0.3);
        background: rgba(201, 74, 74, 0.08);
        color: #c94a4a;
        font-size: 12px;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status-dot-live {
        background: #5a8a5a;
        box-shadow: 0 0 4px rgba(90, 138, 90, 0.4);
    }

    .status-dot-error {
        background: #c94a4a;
        box-shadow: 0 0 4px rgba(201, 74, 74, 0.4);
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

fn build_app_menu() -> Menu {
    let menu = Menu::new();

    let file = Submenu::new("File", true);
    let _ = file.append_items(&[
        &MenuItem::with_id("reload-data", "Reload Data", true, None),
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::quit(None),
    ]);

    let edit = Submenu::new("Edit", true);
    let _ = edit.append_items(&[
        &PredefinedMenuItem::undo(None),
        &PredefinedMenuItem::redo(None),
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::cut(None),
        &PredefinedMenuItem::copy(None),
        &PredefinedMenuItem::paste(None),
        &PredefinedMenuItem::separator(),
        &PredefinedMenuItem::select_all(None),
    ]);

    let view = Submenu::new("View", true);
    let _ = view.append_items(&[
        &MenuItem::with_id("view-overview", "Overview", true, None),
        &MenuItem::with_id("view-conversations", "Conversations", true, None),
        &MenuItem::with_id("view-workflow", "Workflow Studio", true, None),
        &MenuItem::with_id("view-surfaces", "Surfaces", true, None),
        &MenuItem::with_id("view-memory", "Memory", true, None),
        &PredefinedMenuItem::separator(),
        &MenuItem::with_id("toggle-sidebar", "Toggle Sidebar", true, None),
    ]);

    let help = Submenu::new("Help", true);
    let _ = help.append_items(&[
        &MenuItem::with_id("about", "About Cadet", true, None),
    ]);

    let _ = menu.append_items(&[&file, &edit, &view, &help]);
    menu
}

fn build_tray_menu() -> trayicon::DioxusTrayMenu {
    use dioxus_desktop::trayicon::menu::{Menu as TrayMenu, MenuItem as TrayMenuItem, PredefinedMenuItem as TrayPredefined};
    let tray_menu = TrayMenu::new();
    let _ = tray_menu.append_items(&[
        &TrayMenuItem::with_id("tray-show", "Show Cadet", true, None),
        &TrayPredefined::separator(),
        &TrayPredefined::quit(None),
    ]);
    tray_menu
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
            Config::new()
                .with_menu(build_app_menu())
                .with_close_behaviour(WindowCloseBehaviour::WindowHides)
                .with_window(
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

    // Menu action signal for cross-component communication
    let mut menu_action = use_signal(|| None::<String>);
    use_context_provider(|| MenuAction(menu_action));

    // System tray
    use_hook(|| {
        trayicon::init_tray_icon(build_tray_menu(), None);
    });

    // Tray event handler: "Show Cadet" brings window to front
    let desktop = use_window();
    use_tray_menu_event_handler({
        let window = desktop.window.clone();
        move |event: &dioxus_desktop::trayicon::menu::MenuEvent| {
            if event.id.0 == "tray-show" {
                window.set_visible(true);
                window.set_focus();
            }
        }
    });

    // Menu bar event handler
    let mut menu_action_signal = menu_action;
    use_muda_event_handler(move |event: &muda::MenuEvent| {
        menu_action_signal.set(Some(event.id.0.clone()));
    });

    // Global keyboard shortcuts — ⌘K opens command palette, ⌘1-5 navigate views
    let shortcuts: [(&str, &str); 6] = [
        ("Super+K", "toggle-palette"),
        ("Super+1", "view-overview"),
        ("Super+2", "view-conversations"),
        ("Super+3", "view-workflow"),
        ("Super+4", "view-surfaces"),
        ("Super+5", "view-memory"),
    ];
    for (accel, action_id) in shortcuts {
        let mut signal = menu_action;
        let id = action_id.to_string();
        let _ = use_global_shortcut(accel, move |state| {
            if state == HotKeyState::Pressed {
                signal.set(Some(id.clone()));
            }
        });
    }

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

    // Process menu actions (reload-data handled here, view navigation handled in MissionControlApp)
    if let Some(action) = menu_action() {
        if action == "reload-data" {
            menu_action.set(None);
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
        }
    }

    let status_class = if load_error().is_some() {
        "status-dot status-dot-error"
    } else {
        "status-dot status-dot-live"
    };

    rsx! {
        style { "{DESKTOP_STYLES}" }
        div { class: "desktop-shell",
            div { class: "desktop-toolbar",
                div { class: "desktop-context",
                    div { class: "{status_class}" }
                    span { class: "desktop-chip", "Cadet" }
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
                        "Reload"
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
