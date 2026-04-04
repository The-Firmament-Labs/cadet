use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ToolCallStatus {
    Running,
    Complete,
    Error,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ToolCallCard {
    pub tool_name: String,
    pub status: ToolCallStatus,
    pub input_summary: String,
    pub output_summary: String,
    pub run_id: Option<String>,
    pub agent_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ChatMsg {
    pub id: String,
    pub thread_id: String,
    pub role: MessageRole,
    pub content: String,
    pub tool_calls: Vec<ToolCallCard>,
    pub timestamp_ms: u64,
    pub channel: String,       // "web" | "slack" | "discord" | "telegram" | "github"
    pub user_id: String,       // operator or platform user ID
    pub actor: String,         // display name (agent name or user name)
}

#[derive(Clone, Debug, PartialEq)]
pub struct Conversation {
    pub thread_id: String,
    pub title: String,
    pub last_message_at: u64,
    pub message_count: usize,
    pub channel: String,       // primary channel for this conversation
}

#[derive(Clone, Debug, PartialEq)]
pub enum AtRefKind {
    Run,
    Agent,
    Memory,
    Skill,
}

#[derive(Clone, Debug)]
pub struct AtReference {
    pub kind: AtRefKind,
    pub id: String,
    pub display: String,
}

/// Derive conversations from flat chat messages.
pub fn derive_conversations(messages: &[ChatMsg]) -> Vec<Conversation> {
    let mut map: HashMap<String, Conversation> = HashMap::new();
    for msg in messages {
        let entry = map.entry(msg.thread_id.clone()).or_insert_with(|| Conversation {
            thread_id: msg.thread_id.clone(),
            title: String::new(),
            last_message_at: 0,
            message_count: 0,
            channel: msg.channel.clone(),
        });
        entry.message_count += 1;
        if msg.timestamp_ms > entry.last_message_at {
            entry.last_message_at = msg.timestamp_ms;
        }
        if entry.title.is_empty() && msg.role == MessageRole::User {
            entry.title = if msg.content.len() > 40 {
                format!("{}...", &msg.content[..37])
            } else {
                msg.content.clone()
            };
        }
    }
    let mut convos: Vec<Conversation> = map.into_values().collect();
    convos.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    convos
}

// ── Date classification for sidebar grouping ──

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum DateGroup {
    Today,
    Yesterday,
    Previous7,
    Older,
}

impl DateGroup {
    pub fn label(self) -> &'static str {
        match self {
            Self::Today => "Today",
            Self::Yesterday => "Yesterday",
            Self::Previous7 => "Previous 7 Days",
            Self::Older => "Older",
        }
    }
}

pub fn classify_date(timestamp_ms: u64) -> DateGroup {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let age_ms = now_ms.saturating_sub(timestamp_ms);
    let day_ms: u64 = 86_400_000;
    if age_ms < day_ms {
        DateGroup::Today
    } else if age_ms < 2 * day_ms {
        DateGroup::Yesterday
    } else if age_ms < 7 * day_ms {
        DateGroup::Previous7
    } else {
        DateGroup::Older
    }
}

/// Convert SpacetimeDB chat_message rows to our ChatMsg type.
pub fn from_spacetimedb_messages(rows: &[starbridge_core::MessageEventRecord]) -> Vec<ChatMsg> {
    rows.iter()
        .map(|row| {
            let role = match row.direction.as_str() {
                "outbound" => MessageRole::Assistant,
                _ => MessageRole::User,
            };
            ChatMsg {
                id: row.event_id.clone(),
                thread_id: row.thread_id.clone(),
                role,
                content: row.content.clone(),
                tool_calls: Vec::new(),
                timestamp_ms: (row.created_at_micros / 1000) as u64,
                channel: row.channel.clone(),
                user_id: row.actor.clone(),
                actor: row.actor.clone(),
            }
        })
        .collect()
}

/// Generate a unique message ID.
pub fn new_message_id() -> String {
    format!(
        "msg_{}_{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        rand_u32(),
    )
}

/// Generate a unique thread ID.
pub fn new_thread_id() -> String {
    format!(
        "thread_{}_{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        rand_u32(),
    )
}

fn rand_u32() -> u32 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    std::time::SystemTime::now().hash(&mut hasher);
    std::thread::current().id().hash(&mut hasher);
    hasher.finish() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_conversations_groups_by_thread() {
        let msgs = vec![
            ChatMsg { id: "1".into(), thread_id: "t1".into(), role: MessageRole::User, content: "hello".into(), tool_calls: vec![], timestamp_ms: 100, channel: "web".into(), user_id: "op1".into(), actor: "Operator".into() },
            ChatMsg { id: "2".into(), thread_id: "t1".into(), role: MessageRole::Assistant, content: "hi".into(), tool_calls: vec![], timestamp_ms: 200, channel: "web".into(), user_id: "cadet".into(), actor: "cadet".into() },
            ChatMsg { id: "3".into(), thread_id: "t2".into(), role: MessageRole::User, content: "fix the bug in authentication module please".into(), tool_calls: vec![], timestamp_ms: 300, channel: "slack".into(), user_id: "U123".into(), actor: "Alice".into() },
        ];
        let convos = derive_conversations(&msgs);
        assert_eq!(convos.len(), 2);
        assert_eq!(convos[0].thread_id, "t2"); // most recent first
        assert_eq!(convos[0].title, "fix the bug in authentication module ...");
        assert_eq!(convos[1].message_count, 2);
    }

    #[test]
    fn new_ids_are_unique() {
        let a = new_message_id();
        let b = new_message_id();
        assert_ne!(a, b);
    }
}
