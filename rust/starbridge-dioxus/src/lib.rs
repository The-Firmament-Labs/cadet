pub mod auth_provider;
pub mod clipboard;
pub mod live;
pub mod mascot;
mod ui;
#[cfg(feature = "desktop-ui")]
pub mod web_client;
pub mod widget;

pub use auth_provider::AuthProviderRegistry;
pub use live::{
    load_live_snapshot, render_live_preview, resolve_live_approval, send_live_message,
    subscribe_live_snapshots, ChatMessageDraft, LiveSnapshotOptions,
};
#[cfg(feature = "desktop-ui")]
pub use live::{LiveState, ConnectionStatus};
pub use ui::{render_preview, sample_snapshot, MenuAction, MissionControlApp, OperatorRuntimeContext};
pub use widget::{CadetConfig, WidgetBridge};
