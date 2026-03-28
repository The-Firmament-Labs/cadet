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
    load_live_snapshot, sample_snapshot, subscribe_live_snapshots, CadetConfig, LiveSnapshotOptions,
    MenuAction, MissionControlApp, OperatorRuntimeContext, WidgetBridge,
    auth_provider::AuthProviderRegistry,
    clipboard::ClipboardHistory,
    widget::desktop::{
        CommandCenter, FloatingWidget, LiveAgentHud, QuickDispatchPalette, ToastOverlay,
        widget_window_config, widget_window_config_command_center, widget_window_config_dispatch,
        widget_window_config_hud,
    },
};
use starbridge_dioxus::clipboard::desktop::{ClipboardWidget, clipboard_window_config};
use starbridge_dioxus::mascot::desktop::{MascotWidget, mascot_window_config};
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};

const DESKTOP_STYLES: &str = r#"
    .desktop-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-height: 100vh;
        overflow: hidden;
        background: #c8d1c0;
    }

    .desktop-shell > .app-shell {
        flex: 1;
        min-height: 0;
        height: auto;
        max-height: none;
    }

    .desktop-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 16px;
        background: #F0EDED;
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
        border-radius: 0;
        border: 1px solid #AA3618;
        background: transparent;
        color: #AA3618;
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .desktop-note {
        color: #58413C;
        font-family: "JetBrains Mono", monospace;
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
        border: 1px solid rgba(28, 27, 27, 0.15);
        border-radius: 0;
        background: transparent;
        color: #1C1B1B;
        font: inherit;
        font-size: 10px;
        font-family: "JetBrains Mono", monospace;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding: 5px 12px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .desktop-button:hover {
        background: #1C1B1B;
        color: #FFFFFF;
    }

    .desktop-error {
        margin: 8px 16px 0;
        padding: 10px 14px;
        border-radius: 0;
        background: var(--surface-container-high, #E4E1E0);
        color: #58413C;
        font-size: 11px;
        font-family: "JetBrains Mono", monospace;
        line-height: 1.5;
        box-shadow: inset 3px 0 0 #AA3618;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 0;
        flex-shrink: 0;
    }

    .status-dot-live {
        background: #526258;
    }

    .status-dot-error {
        background: #AA3618;
    }
"#;

const SPLASH_STYLES: &str = r#"
    .splash {
        min-height: 100vh;
        background: #0a0a1a url('cadet://localhost/modern-stars-bg.png') center/cover no-repeat;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
        font-family: "Space Grotesk", sans-serif;
    }
    .splash-astronaut {
        width: 320px;
        height: 320px;
        margin-bottom: 32px;
        object-fit: contain;
        filter: drop-shadow(0 12px 48px rgba(0,0,0,0.5));
    }
    .splash-welcome {
        font-family: "JetBrains Mono", monospace;
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #FFFFFF;
        margin-bottom: 24px;
        text-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    .splash-launch {
        padding: 10px 32px;
        background: #AA3618;
        color: #FFFFFF;
        border: none;
        border-radius: 0;
        font-family: "JetBrains Mono", monospace;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 0.15s;
    }
    .splash-launch:hover {
        background: #AA3618;
    }
    .splash-massive {
        position: absolute;
        bottom: -60px;
        left: 50%;
        transform: translateX(-50%);
        font-family: "Space Grotesk", sans-serif;
        font-size: 280px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: rgba(255, 255, 255, 0.06);
        white-space: nowrap;
        pointer-events: none;
        user-select: none;
        line-height: 1;
    }
    .splash-version {
        position: absolute;
        bottom: 16px;
        right: 20px;
        font-family: "JetBrains Mono", monospace;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.3);
        letter-spacing: 0.06em;
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
        &MenuItem::with_id("view-catalog", "Catalog", true, None),
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

    // Embed images at compile time so they're always available
    static RETRO_ASTRO: &[u8] = include_bytes!("../../assets/retro-astro.png");
    static STARS_BG: &[u8] = include_bytes!("../../assets/modern-stars-bg.png");

    dioxus::LaunchBuilder::desktop()
        .with_cfg(
            Config::new()
                .with_menu(build_app_menu())
                .with_close_behaviour(WindowCloseBehaviour::WindowHides)
                .with_custom_protocol("cadet", move |_wv_id, request| {
                    use std::borrow::Cow;
                    let path = request.uri().path();
                    let (body, mime): (Cow<'static, [u8]>, &str) = match path {
                        "/retro-astro.png" => (Cow::Borrowed(RETRO_ASTRO), "image/png"),
                        "/modern-stars-bg.png" => (Cow::Borrowed(STARS_BG), "image/png"),
                        _ => (Cow::Borrowed(b"404"), "text/plain"),
                    };
                    dioxus_desktop::wry::http::Response::builder()
                        .header("Content-Type", mime)
                        .body(body)
                        .unwrap()
                })
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
        ("Super+4", "view-catalog"),
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

    // ── Widget System ────────────────────────────────────────────────
    let cadet_config = use_hook(CadetConfig::load);
    let widget_bridge = use_hook(WidgetBridge::new);
    let clipboard_history = use_hook(|| ClipboardHistory::new(100));
    let mut command_center_spawned = use_signal(|| false);
    let mut show_splash = use_signal(|| true);

    // Widget hotkeys — registered unconditionally (Dioxus hook rules),
    // but behavior is gated on widget.enabled + splash dismissed
    {
        let bridge_cc = widget_bridge.clone();
        let splash = show_splash;
        let enabled = cadet_config.widget.enabled;
        let _ = use_global_shortcut("Ctrl+Shift+Space", move |state| {
            if state == HotKeyState::Pressed && enabled && !splash() {
                if let Ok(mut cb) = arboard::Clipboard::new() {
                    if let Ok(text) = cb.get_text() {
                        if !text.trim().is_empty() {
                            bridge_cc.set_context(text);
                        }
                    }
                }
                bridge_cc.dispatch("__system__".into(), "show-command-center".into());
            }
        });
    }

    if cadet_config.widget.enabled && !show_splash() {

        // Spawn only the Command Center on startup; individual widgets are
        // spawned on-demand when toggled on via the Command Center UI.
        if !command_center_spawned() {
            // Discover auth providers once at startup
            let auth = AuthProviderRegistry::discover();

            let b = widget_bridge.clone();
            let c = cadet_config.widget.clone();
            let a = auth.clone();
            spawn(async move {
                let dom = VirtualDom::new_with_props(
                    CommandCenter,
                    starbridge_dioxus::widget::desktop::CommandCenterProps {
                        bridge: b,
                        config: c,
                        auth: a,
                    },
                );
                let _ctx = dioxus_desktop::window()
                    .new_window(dom, widget_window_config_command_center())
                    .await;
            });

            // Start clipboard watcher so context capture works even before
            // the Clipboard widget is toggled on.
            let h = clipboard_history.clone();
            starbridge_dioxus::clipboard::start_clipboard_watcher(h);

            command_center_spawned.set(true);
        }

        // On-demand widget spawning: watch widget_toggles and spawn windows
        // when a widget is switched on for the first time.
        // Each widget tracks its own "has been spawned" flag.
        let spawned_flags = use_signal(|| std::collections::HashSet::<String>::new());

        {
            let bridge_ref = widget_bridge.clone();
            let h = clipboard_history.clone();
            let c = cadet_config.widget.clone();

            // Check each widget toggle and spawn if newly enabled
            let toggles_snapshot = bridge_ref.widget_toggles.lock().unwrap().clone();
            for (id, visible) in toggles_snapshot.iter() {
                if *visible && !spawned_flags().contains(id.as_str()) {
                    let widget_id = id.clone();
                    let b = bridge_ref.clone();
                    let cfg = c.clone();
                    let history = h.clone();
                    let mut flags = spawned_flags;

                    match widget_id.as_str() {
                        "context-chat" => {
                            let bc = b.clone();
                            let cc = cfg.clone();
                            spawn(async move {
                                let dom = VirtualDom::new_with_props(FloatingWidget,
                                    starbridge_dioxus::widget::desktop::FloatingWidgetProps {
                                        bridge: bc, config: cc,
                                    });
                                let _ctx = dioxus_desktop::window()
                                    .new_window(dom, widget_window_config())
                                    .await;
                            });
                        }
                        "agent-hud" => {
                            let bh = b.clone();
                            spawn(async move {
                                let dom = VirtualDom::new_with_props(LiveAgentHud,
                                    starbridge_dioxus::widget::desktop::LiveAgentHudProps {
                                        bridge: bh,
                                    });
                                let _ctx = dioxus_desktop::window()
                                    .new_window(dom, widget_window_config_hud())
                                    .await;
                            });
                        }
                        "quick-dispatch" => {
                            let bd = b.clone();
                            let cd = cfg.clone();
                            spawn(async move {
                                let dom = VirtualDom::new_with_props(QuickDispatchPalette,
                                    starbridge_dioxus::widget::desktop::QuickDispatchPaletteProps {
                                        bridge: bd, config: cd,
                                    });
                                let _ctx = dioxus_desktop::window()
                                    .new_window(dom, widget_window_config_dispatch())
                                    .await;
                            });
                        }
                        "clipboard" => {
                            let bv = b.clone();
                            let hv = history.clone();
                            spawn(async move {
                                let dom = VirtualDom::new_with_props(ClipboardWidget,
                                    starbridge_dioxus::clipboard::desktop::ClipboardWidgetProps {
                                        history: hv, bridge: bv,
                                    });
                                let _ctx = dioxus_desktop::window()
                                    .new_window(dom, clipboard_window_config())
                                    .await;
                            });
                        }
                        "mascot" => {
                            let bm = b.clone();
                            spawn(async move {
                                let dom = VirtualDom::new_with_props(MascotWidget,
                                    starbridge_dioxus::mascot::desktop::MascotWidgetProps {
                                        bridge: bm,
                                    });
                                let _ctx = dioxus_desktop::window()
                                    .new_window(dom, mascot_window_config())
                                    .await;
                            });
                        }
                        _ => {}
                    }

                    flags.write().insert(widget_id);
                }
            }
        }
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

    // Splash screen — space scene with retro astronaut
    if show_splash() {
        return rsx! {
            style { "{DESKTOP_STYLES}" }
            style { "{SPLASH_STYLES}" }
            div { class: "splash",

                // Retro astronaut
                img {
                    class: "splash-astronaut",
                    src: "cadet://localhost/retro-astro.png",
                    alt: "Cadet astronaut",
                }

                span { class: "splash-welcome", "WELCOME TO CADET" }

                div { style: "display: flex; gap: 12px; align-items: center;",
                    button {
                        class: "splash-launch",
                        onclick: move |_| show_splash.set(false),
                        "LAUNCH"
                    }
                }

                // Massive "CADET" text bleeding off bottom
                div { class: "splash-massive", "CADET" }

                span { class: "splash-version", "v0.1.0 // ORBITAL.OPS" }
            }
        };
    }

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

            // Toast notifications overlay (renders on top of everything)
            ToastOverlay { bridge: widget_bridge.clone() }
        }
    }
}
