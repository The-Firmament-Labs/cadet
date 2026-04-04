//! Web Client — typed HTTP client for localhost:3001 API.
//!
//! Wraps reqwest with session auth from ~/.cadet/session.json.
//! Provides methods for chat (SSE streaming), agent dispatch,
//! journal CRUD, skill management, and run control.

use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ── Error Type ───────────────────────────────────────────────────────

#[derive(Debug)]
pub enum WebClientError {
    Network(reqwest::Error),
    Auth { message: String },
    Server { status: u16, body: String },
    Parse(String),
    NoSession { path: String },
}

impl std::fmt::Display for WebClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Network(e) => write!(f, "Network error: {e}"),
            Self::Auth { message } => write!(f, "Auth failed: {message}"),
            Self::Server { status, body } => write!(f, "Server error ({status}): {body}"),
            Self::Parse(msg) => write!(f, "Parse error: {msg}"),
            Self::NoSession { path } => write!(f, "No session at {path}"),
        }
    }
}

impl std::error::Error for WebClientError {}

impl From<reqwest::Error> for WebClientError {
    fn from(e: reqwest::Error) -> Self {
        Self::Network(e)
    }
}

// ── Session File ─────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SessionFile {
    token: String,
}

// ── API Response Types ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ApiOk<T> {
    pub ok: bool,
    #[serde(flatten)]
    pub data: T,
}

#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub ok: bool,
    pub status: String,
    #[serde(default)]
    pub agent_count: u32,
    #[serde(default)]
    pub schema_ok: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct JournalData {
    pub journal: serde_json::Value,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SkillItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub source: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SkillsResponse {
    pub skills: Vec<SkillItem>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SkillDetail {
    pub skill: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct DispatchRequest {
    pub agent_id: String,
    pub goal: String,
}

#[derive(Debug, Serialize)]
pub struct JournalAction {
    pub action: String,
    #[serde(flatten)]
    pub data: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub parts: Vec<ChatPart>,
}

#[derive(Debug, Serialize)]
pub struct ChatPart {
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
}

// ── Web Client ───────────────────────────────────────────────────────

#[derive(Clone)]
pub struct WebClient {
    client: Client,
    base_url: String,
    session_token: String,
}

impl WebClient {
    /// Load session from ~/.cadet/session.json.
    pub fn from_session() -> Result<Self, WebClientError> {
        let home = std::env::var("HOME").unwrap_or_default();
        let path = PathBuf::from(&home).join(".cadet/session.json");
        let content = std::fs::read_to_string(&path).map_err(|_| WebClientError::NoSession {
            path: path.display().to_string(),
        })?;
        let session: SessionFile =
            serde_json::from_str(&content).map_err(|e| WebClientError::Parse(e.to_string()))?;

        Ok(Self {
            client: Client::new(),
            base_url: std::env::var("CADET_WEB_URL")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),
            session_token: session.token,
        })
    }

    /// Create with explicit values.
    pub fn new(base_url: String, session_token: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            session_token,
        }
    }

    pub fn has_session(&self) -> bool {
        !self.session_token.is_empty()
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn get(&self, path: &str) -> Result<Response, WebClientError> {
        let resp = self
            .client
            .get(self.url(path))
            .header("Cookie", format!("cadet_session={}", self.session_token))
            .send()
            .await?;
        Self::check(resp).await
    }

    async fn post<T: Serialize>(&self, path: &str, body: &T) -> Result<Response, WebClientError> {
        let resp = self
            .client
            .post(self.url(path))
            .header("Cookie", format!("cadet_session={}", self.session_token))
            .json(body)
            .send()
            .await?;
        Self::check(resp).await
    }

    #[allow(dead_code)]
    async fn post_raw(&self, path: &str, body: &str) -> Result<Response, WebClientError> {
        let resp = self
            .client
            .post(self.url(path))
            .header("Cookie", format!("cadet_session={}", self.session_token))
            .header("Content-Type", "application/json")
            .body(body.to_string())
            .send()
            .await?;
        Self::check(resp).await
    }

    async fn check(resp: Response) -> Result<Response, WebClientError> {
        let status = resp.status();
        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            let body = resp.text().await.unwrap_or_default();
            return Err(WebClientError::Auth { message: body });
        }
        if !status.is_success() {
            let code = status.as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(WebClientError::Server {
                status: code,
                body,
            });
        }
        Ok(resp)
    }

    // ── Health ───────────────────────────────────────────────────────

    pub async fn health(&self) -> Result<HealthResponse, WebClientError> {
        let resp = self.client.get(self.url("/api/health")).send().await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Chat (SSE streaming) ─────────────────────────────────────────

    /// Send a chat message and return the full response text.
    /// Parses the SSE stream from /api/chat.
    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<String, WebClientError> {
        let body = ChatRequest { messages };
        let resp = self
            .client
            .post(self.url("/api/chat"))
            .header("Cookie", format!("cadet_session={}", self.session_token))
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(WebClientError::Server { status, body });
        }

        let body_text = resp.text().await?;
        Ok(parse_sse_text(&body_text))
    }

    // ── Agent Dispatch ───────────────────────────────────────────────

    pub async fn dispatch_agent(
        &self,
        agent_id: &str,
        goal: &str,
    ) -> Result<serde_json::Value, WebClientError> {
        let body = DispatchRequest {
            agent_id: agent_id.to_string(),
            goal: goal.to_string(),
        };
        let resp = self.post("/api/jobs/dispatch", &body).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn invoke_agent(
        &self,
        agent_id: &str,
        goal: &str,
    ) -> Result<serde_json::Value, WebClientError> {
        let body = serde_json::json!({ "prompt": goal });
        let resp = self
            .post(&format!("/api/agents/{agent_id}/prompt"), &body)
            .await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Runs ─────────────────────────────────────────────────────────

    pub async fn list_runs(
        &self,
        limit: Option<u32>,
    ) -> Result<serde_json::Value, WebClientError> {
        let path = match limit {
            Some(n) => format!("/api/runs?limit={n}"),
            None => "/api/runs".to_string(),
        };
        let resp = self.get(&path).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn get_run(&self, run_id: &str) -> Result<serde_json::Value, WebClientError> {
        let resp = self.get(&format!("/api/runs/{run_id}")).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn retry_run(&self, run_id: &str) -> Result<serde_json::Value, WebClientError> {
        let resp = self
            .post(&format!("/api/runs/{run_id}/retry"), &serde_json::json!({}))
            .await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Journal ──────────────────────────────────────────────────────

    pub async fn get_journal(&self) -> Result<serde_json::Value, WebClientError> {
        let resp = self.get("/api/journal").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn save_journal(&self, action: &JournalAction) -> Result<serde_json::Value, WebClientError> {
        let resp = self.post("/api/journal", action).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Skills ───────────────────────────────────────────────────────

    pub async fn list_skills(&self) -> Result<SkillsResponse, WebClientError> {
        let resp = self.get("/api/skills").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn get_skill(&self, skill_id: &str) -> Result<SkillDetail, WebClientError> {
        let resp = self.get(&format!("/api/skills?id={skill_id}")).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn create_skill(&self, skill: &serde_json::Value) -> Result<serde_json::Value, WebClientError> {
        let mut merged = skill.clone();
        if let Some(obj) = merged.as_object_mut() {
            obj.insert("action".to_string(), serde_json::json!("install"));
        }
        let resp = self.post("/api/skills", &merged).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Approvals ────────────────────────────────────────────────────

    pub async fn list_approvals(
        &self,
        status: Option<&str>,
    ) -> Result<serde_json::Value, WebClientError> {
        let path = match status {
            Some(s) => format!("/api/approvals?status={s}"),
            None => "/api/approvals".to_string(),
        };
        let resp = self.get(&path).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn resolve_approval(
        &self,
        approval_id: &str,
        decision: &str,
        note: Option<&str>,
    ) -> Result<serde_json::Value, WebClientError> {
        let body = serde_json::json!({
            "status": decision,
            "note": note.unwrap_or(""),
        });
        let resp = self
            .post(&format!("/api/approvals/{approval_id}/resolve"), &body)
            .await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Memory ───────────────────────────────────────────────────────

    pub async fn list_memory(
        &self,
        namespace: Option<&str>,
    ) -> Result<serde_json::Value, WebClientError> {
        let path = match namespace {
            Some(ns) => format!("/api/memory?namespace={ns}"),
            None => "/api/memory".to_string(),
        };
        let resp = self.get(&path).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Usage ────────────────────────────────────────────────────────

    pub async fn usage(&self) -> Result<serde_json::Value, WebClientError> {
        let resp = self.get("/api/usage").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Hooks ────────────────────────────────────────────────────────

    pub async fn list_hooks(&self) -> Result<serde_json::Value, WebClientError> {
        let resp = self.get("/api/hooks").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Feedback ─────────────────────────────────────────────────────

    pub async fn submit_feedback(&self, message_id: &str, is_positive: bool) -> Result<serde_json::Value, WebClientError> {
        let resp = self.post("/api/feedback", &serde_json::json!({
            "messageId": message_id,
            "isPositive": is_positive,
        })).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Quick Memory (# prefix) ────────────────────────��────────────

    pub async fn store_quick_memory(&self, content: &str, user_id: &str) -> Result<serde_json::Value, WebClientError> {
        let resp = self.post("/api/memory", &serde_json::json!({
            "action": "quick_memory",
            "content": content,
            "userId": user_id,
        })).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    // ── Filesystem Skills (/ prefix) ─────────────────────────────────

    pub async fn list_skill_directories(&self) -> Result<serde_json::Value, WebClientError> {
        let resp = self.get("/api/skills?source=directories").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn list_filesystem_skills(&self, enabled_dirs: &[&str]) -> Result<serde_json::Value, WebClientError> {
        let dirs = enabled_dirs.join(",");
        let resp = self.get(&format!("/api/skills?source=filesystem&dirs={dirs}")).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn read_skill_content(&self, skill_id: &str) -> Result<serde_json::Value, WebClientError> {
        let resp = self.get(&format!("/api/skills?id={skill_id}")).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }
}

// ── SSE Parser ───────────────────────────────────────────────────────

/// Parse AI SDK SSE stream format and extract text content.
fn parse_sse_text(body: &str) -> String {
    let mut result = String::new();
    for line in body.lines() {
        // AI SDK v6 format: lines starting with "d:" contain JSON data
        if let Some(data) = line.strip_prefix("d:") {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(data.trim()) {
                // Text parts: {"type":"text","value":"..."}
                if json.get("type").and_then(|t| t.as_str()) == Some("text") {
                    if let Some(text) = json.get("value").and_then(|v| v.as_str()) {
                        result.push_str(text);
                    }
                }
                // Also handle text-delta: {"type":"text-delta","textDelta":"..."}
                if json.get("type").and_then(|t| t.as_str()) == Some("text-delta") {
                    if let Some(text) = json.get("textDelta").and_then(|v| v.as_str()) {
                        result.push_str(text);
                    }
                }
            }
        }
    }
    if result.is_empty() {
        // Fallback: return non-SSE content
        body.lines()
            .filter(|l| !l.starts_with("d:") && !l.starts_with("e:") && !l.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_client_has_session() {
        let client = WebClient::new("http://localhost:3001".into(), "tok_123".into());
        assert!(client.has_session());
        assert_eq!(client.base_url, "http://localhost:3001");
    }

    #[test]
    fn empty_session_detected() {
        let client = WebClient::new("http://localhost:3001".into(), "".into());
        assert!(!client.has_session());
    }

    #[test]
    fn from_session_fails_without_file() {
        // Ensure no session file exists at a fake HOME
        std::env::set_var("HOME", "/tmp/nonexistent_cadet_test");
        let result = WebClient::from_session();
        assert!(result.is_err());
        std::env::remove_var("HOME");
    }

    #[test]
    fn parse_sse_extracts_text() {
        let sse = r#"d:{"type":"text","value":"Hello"}
d:{"type":"text","value":" world"}
e:{"finishReason":"stop"}"#;
        assert_eq!(parse_sse_text(sse), "Hello world");
    }

    #[test]
    fn parse_sse_handles_text_delta() {
        let sse = r#"d:{"type":"text-delta","textDelta":"chunk1"}
d:{"type":"text-delta","textDelta":"chunk2"}"#;
        assert_eq!(parse_sse_text(sse), "chunk1chunk2");
    }

    #[test]
    fn parse_sse_fallback_on_non_sse() {
        let plain = "Just plain text\nWith multiple lines";
        assert_eq!(parse_sse_text(plain), "Just plain text\nWith multiple lines");
    }

    #[test]
    fn url_building() {
        let client = WebClient::new("http://localhost:3001".into(), "tok".into());
        assert_eq!(client.url("/api/health"), "http://localhost:3001/api/health");
    }
}
