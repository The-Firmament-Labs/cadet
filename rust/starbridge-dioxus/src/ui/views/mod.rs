mod ai_chat;
#[allow(dead_code)]
pub(crate) mod chat_types;
mod chat_sidebar;
mod catalog;
mod chat;
mod memory;
mod ops_home;
mod overview;
#[allow(dead_code)]
mod surfaces;
mod task_detail;
mod task_home;
mod workflow;
mod rl_dashboard;
mod wallet;

pub use ai_chat::AiChatView;
pub use catalog::CatalogView;
pub use chat::ChatView;
pub use memory::MemoryView;
pub use ops_home::OpsHomeView;
pub use overview::OverviewView;
pub use rl_dashboard::RlDashboardView;
pub use task_detail::{TaskDetailView, TaskExecView};
pub use task_home::TaskHomeView;
pub use wallet::WalletView;
pub use workflow::WorkflowStudioView;
