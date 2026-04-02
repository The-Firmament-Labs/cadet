mod ai_chat;
#[allow(dead_code)]
pub(crate) mod chat_types;
mod chat_sidebar;
mod catalog;
#[allow(dead_code)]
mod chat;
mod memory;
mod ops_home;
mod overview;
#[allow(dead_code)]
mod surfaces;
mod task_detail;
mod task_home;
#[allow(dead_code)]
mod workflow;

pub use ai_chat::AiChatView;
pub use catalog::CatalogView;
pub use memory::MemoryView;
pub use ops_home::OpsHomeView;
pub use overview::OverviewView;
pub use task_detail::{TaskDetailView, TaskExecView};
pub use task_home::TaskHomeView;
