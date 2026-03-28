pub mod clipboard;
pub mod live;
pub mod mascot;
mod ui;
pub mod widget;

pub use live::{
    load_live_snapshot, render_live_preview, resolve_live_approval, send_live_message,
    subscribe_live_snapshots, ChatMessageDraft, LiveSnapshotOptions,
};
pub use ui::{render_preview, sample_snapshot, MenuAction, MissionControlApp, OperatorRuntimeContext};
pub use widget::{CadetConfig, WidgetBridge};
