# SPEC 002: Web Client — HTTP to localhost:3001

## Status: Ready to Execute
## Priority: P0
## Depends on: None (parallel with SPEC 001)
## Estimated effort: 1-2 days

## Context

The desktop app needs to call the Next.js web server at `localhost:3001` for operations that SpacetimeDB does not handle: AI chat (streaming), agent dispatch, journal CRUD, skill management, and run control. Currently there is no HTTP client in the Rust codebase.

The web server already has 50+ API routes under `apps/web/app/api/`. The desktop needs a typed Rust client that wraps `reqwest`, handles session auth from `~/.cadet/session.json`, and provides SSE stream parsing for the chat endpoint.

`reqwest` is already in `Cargo.toml` as an optional dependency behind the `desktop-ui` feature flag.

## Requirements

1. `WebClient` struct with `base_url` (default `http://localhost:3001`) and `session_token`
2. Session token loaded from `~/.cadet/session.json` at startup, with refresh via `/api/auth/desktop-token`
3. Typed async methods for every API endpoint the desktop views need
4. `WebClientError` enum with variants for network, auth, parse, and server errors
5. SSE stream parsing for `/api/chat` (token-by-token streaming)
6. All methods return `Result<T, WebClientError>`
7. Unit tests with a mock HTTP server

## Files to Create/Modify

- `rust/starbridge-dioxus/src/web_client.rs` — New file: `WebClient` struct and all methods
- `rust/starbridge-dioxus/src/lib.rs` — Add `pub mod web_client;`
- `rust/starbridge-dioxus/Cargo.toml` — Add `tokio-stream` and `futures` for SSE parsing (if not already present)

## Implementation Steps

### Step 1: Define WebClient struct, error type, and session loading

Create `web_client.rs` with the core struct, error enum, and session token loading from disk.

```rust
use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum WebClientError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Authentication failed: {message}")]
    Auth { message: String },

    #[error("Server error ({status}): {body}")]
    Server { status: u16, body: String },

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Session file not found at {path}")]
    NoSession { path: String },
}

#[derive(Debug, Deserialize)]
struct SessionFile {
    token: String,
    #[serde(default)]
    expires_at: Option<String>,
}

#[derive(Clone)]
pub struct WebClient {
    client: Client,
    base_url: String,
    session_token: String,
}

impl WebClient {
    /// Load session from ~/.cadet/session.json and create a client.
    pub fn from_session() -> Result<Self, WebClientError> {
        let home = std::env::var("HOME").unwrap_or_default();
        let path = PathBuf::from(&home).join(".cadet/session.json");
        let content = std::fs::read_to_string(&path).map_err(|_| {
            WebClientError::NoSession {
                path: path.display().to_string(),
            }
        })?;
        let session: SessionFile = serde_json::from_str(&content)
            .map_err(|e| WebClientError::Parse(format!("Invalid session.json: {e}")))?;

        Ok(Self {
            client: Client::new(),
            base_url: std::env::var("CADET_WEB_URL")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),
            session_token: session.token,
        })
    }

    /// Create with explicit values (useful for testing).
    pub fn new(base_url: String, session_token: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
            session_token,
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn auth_get(&self, path: &str) -> Result<Response, WebClientError> {
        let resp = self.client
            .get(self.url(path))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Self::check_response(resp).await
    }

    async fn auth_post<T: Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<Response, WebClientError> {
        let resp = self.client
            .post(self.url(path))
            .bearer_auth(&self.session_token)
            .json(body)
            .send()
            .await?;
        Self::check_response(resp).await
    }

    async fn auth_put<T: Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> Result<Response, WebClientError> {
        let resp = self.client
            .put(self.url(path))
            .bearer_auth(&self.session_token)
            .json(body)
            .send()
            .await?;
        Self::check_response(resp).await
    }

    async fn check_response(resp: Response) -> Result<Response, WebClientError> {
        let status = resp.status();
        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            let body = resp.text().await.unwrap_or_default();
            return Err(WebClientError::Auth { message: body });
        }
        if !status.is_success() {
            let code = status.as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(WebClientError::Server { status: code, body });
        }
        Ok(resp)
    }
}
```

**Commit:** `feat(desktop): WebClient struct with session loading and auth helpers`
**Test:** Unit test: `WebClient::new("http://localhost:0", "fake")` compiles. Session loading returns `NoSession` when file missing.

### Step 2: Add typed API methods for CRUD endpoints

Add methods for the non-streaming endpoints the desktop needs. Each method corresponds to an existing API route.

```rust
// --- Chat threads ---

#[derive(Debug, Deserialize)]
pub struct ThreadSummary {
    pub thread_id: String,
    pub title: Option<String>,
    pub created_at: String,
}

impl WebClient {
    pub async fn list_threads(&self) -> Result<Vec<ThreadSummary>, WebClientError> {
        let resp = self.auth_get("/api/threads").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn get_thread(&self, thread_id: &str) -> Result<serde_json::Value, WebClientError> {
        let resp = self.auth_get(&format!("/api/threads/{thread_id}")).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }
}

// --- Agent dispatch ---

#[derive(Debug, Serialize)]
pub struct DispatchRequest {
    pub agent_id: String,
    pub goal: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DispatchResponse {
    pub run_id: String,
}

impl WebClient {
    pub async fn dispatch_agent(
        &self,
        request: &DispatchRequest,
    ) -> Result<DispatchResponse, WebClientError> {
        let resp = self.auth_post("/api/jobs/dispatch", request).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }
}

// --- Runs ---

#[derive(Debug, Deserialize)]
pub struct RunSummary {
    pub run_id: String,
    pub agent_id: String,
    pub status: String,
    pub goal: String,
}

impl WebClient {
    pub async fn list_runs(&self) -> Result<Vec<RunSummary>, WebClientError> {
        let resp = self.auth_get("/api/runs").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn get_run(&self, run_id: &str) -> Result<serde_json::Value, WebClientError> {
        let resp = self.auth_get(&format!("/api/runs/{run_id}")).await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn retry_run(&self, run_id: &str) -> Result<(), WebClientError> {
        self.auth_post(&format!("/api/runs/{run_id}/retry"), &serde_json::json!({})).await?;
        Ok(())
    }
}

// --- Approvals ---

#[derive(Debug, Serialize)]
pub struct ResolveApprovalRequest {
    pub approved: bool,
    pub reason: Option<String>,
}

impl WebClient {
    pub async fn list_approvals(&self) -> Result<Vec<serde_json::Value>, WebClientError> {
        let resp = self.auth_get("/api/approvals").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn resolve_approval(
        &self,
        approval_id: &str,
        request: &ResolveApprovalRequest,
    ) -> Result<(), WebClientError> {
        self.auth_post(
            &format!("/api/approvals/{approval_id}/resolve"),
            request,
        ).await?;
        Ok(())
    }
}

// --- Journal ---

#[derive(Debug, Serialize, Deserialize)]
pub struct MissionJournal {
    pub flight_plan: serde_json::Value,
    pub standing_orders: Vec<String>,
    pub ships_log: Vec<serde_json::Value>,
}

impl WebClient {
    pub async fn get_journal(&self) -> Result<MissionJournal, WebClientError> {
        let resp = self.auth_get("/api/journal").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn save_journal(&self, journal: &MissionJournal) -> Result<(), WebClientError> {
        self.auth_put("/api/journal", journal).await?;
        Ok(())
    }
}

// --- Skills ---

#[derive(Debug, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct CreateSkillRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub content: String,
    pub activation_patterns: Vec<String>,
}

impl WebClient {
    pub async fn list_skills(&self) -> Result<Vec<Skill>, WebClientError> {
        let resp = self.auth_get("/api/skills").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    pub async fn create_skill(&self, skill: &CreateSkillRequest) -> Result<(), WebClientError> {
        self.auth_post("/api/skills", skill).await?;
        Ok(())
    }
}

// --- Health ---

impl WebClient {
    pub async fn health(&self) -> Result<serde_json::Value, WebClientError> {
        let resp = self.client
            .get(self.url("/api/health"))
            .send()
            .await?;
        Self::check_response(resp).await?
            .json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }
}

// --- Auth ---

impl WebClient {
    pub async fn me(&self) -> Result<serde_json::Value, WebClientError> {
        let resp = self.auth_get("/api/auth/me").await?;
        resp.json().await.map_err(|e| WebClientError::Parse(e.to_string()))
    }

    /// Refresh the desktop token. Returns a new token string.
    pub async fn refresh_token(&self) -> Result<String, WebClientError> {
        let resp = self.auth_post("/api/auth/desktop-token", &serde_json::json!({})).await?;
        let body: serde_json::Value = resp.json().await
            .map_err(|e| WebClientError::Parse(e.to_string()))?;
        body["token"].as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| WebClientError::Parse("No token in response".into()))
    }
}
```

**Commit:** `feat(desktop): typed API methods for threads, runs, approvals, journal, skills`
**Test:** Unit tests with `mockito` or `wiremock` for each endpoint. Verify correct URL paths, auth headers, and response deserialization.

### Step 3: Add SSE streaming for chat endpoint

The `/api/chat` endpoint returns Server-Sent Events. Parse the SSE stream into typed events.

```rust
use futures::StreamExt;
use reqwest::header;

#[derive(Debug, Clone)]
pub enum ChatStreamEvent {
    /// A text delta (token) from the model
    TextDelta(String),
    /// A tool call started
    ToolCallStart { id: String, name: String },
    /// A tool call result
    ToolCallResult { id: String, output: String },
    /// Stream finished
    Done,
    /// An error occurred during streaming
    Error(String),
}

#[derive(Debug, Serialize)]
pub struct ChatRequest {
    pub thread_id: Option<String>,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

impl WebClient {
    /// Send a chat request and return a stream of SSE events.
    /// The caller iterates the receiver to get token-by-token updates.
    pub async fn chat_stream(
        &self,
        request: &ChatRequest,
    ) -> Result<tokio::sync::mpsc::Receiver<ChatStreamEvent>, WebClientError> {
        let resp = self.client
            .post(self.url("/api/chat"))
            .bearer_auth(&self.session_token)
            .header(header::ACCEPT, "text/event-stream")
            .json(request)
            .send()
            .await?;

        let resp = Self::check_response(resp).await?;
        let (tx, rx) = tokio::sync::mpsc::channel(64);

        // Spawn a task to read the SSE stream
        tokio::spawn(async move {
            let mut stream = resp.bytes_stream();
            let mut buffer = String::new();

            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(bytes) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        // Parse SSE events from buffer
                        while let Some(pos) = buffer.find("\n\n") {
                            let event_str = buffer[..pos].to_string();
                            buffer = buffer[pos + 2..].to_string();

                            if let Some(event) = parse_sse_event(&event_str) {
                                let is_done = matches!(event, ChatStreamEvent::Done);
                                if tx.send(event).await.is_err() {
                                    return; // receiver dropped
                                }
                                if is_done {
                                    return;
                                }
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(ChatStreamEvent::Error(e.to_string())).await;
                        return;
                    }
                }
            }

            // Stream ended without explicit done event
            let _ = tx.send(ChatStreamEvent::Done).await;
        });

        Ok(rx)
    }
}

/// Parse a single SSE event block into a ChatStreamEvent.
fn parse_sse_event(raw: &str) -> Option<ChatStreamEvent> {
    let mut event_type = None;
    let mut data = String::new();

    for line in raw.lines() {
        if let Some(value) = line.strip_prefix("event: ") {
            event_type = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("data: ") {
            data.push_str(value);
        }
    }

    match event_type.as_deref() {
        Some("text_delta") | None if !data.is_empty() => {
            // Try parsing as JSON first, fall back to raw text
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(text) = parsed["text"].as_str() {
                    return Some(ChatStreamEvent::TextDelta(text.to_string()));
                }
            }
            Some(ChatStreamEvent::TextDelta(data))
        }
        Some("tool_call_start") => {
            let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;
            Some(ChatStreamEvent::ToolCallStart {
                id: parsed["id"].as_str()?.to_string(),
                name: parsed["name"].as_str()?.to_string(),
            })
        }
        Some("tool_call_result") => {
            let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;
            Some(ChatStreamEvent::ToolCallResult {
                id: parsed["id"].as_str()?.to_string(),
                output: parsed["output"].as_str().unwrap_or("").to_string(),
            })
        }
        Some("done") | Some("[DONE]") => Some(ChatStreamEvent::Done),
        Some("error") => Some(ChatStreamEvent::Error(data)),
        _ => None,
    }
}
```

**Commit:** `feat(desktop): SSE stream parsing for chat endpoint`
**Test:** Mock server returns `event: text_delta\ndata: {"text":"Hello"}\n\n` followed by `event: done\ndata: {}\n\n`. Verify receiver yields `TextDelta("Hello")` then `Done`.

### Step 4: Wire into Dioxus context and add session refresh

Provide `WebClient` as Dioxus context alongside `LiveState`. Add automatic token refresh when auth errors occur.

```rust
// In ui/mod.rs or a new ui/providers.rs

use crate::web_client::{WebClient, WebClientError};

#[component]
pub fn MissionControlApp() -> Element {
    // Provide LiveState (from SPEC 001)
    let state = use_context_provider(|| LiveState::new());

    // Provide WebClient
    let web_client = use_context_provider(|| {
        Signal::new(WebClient::from_session().ok())
    });

    // Show connection banner if no session
    let has_client = (web_client)().is_some();

    rsx! {
        if !has_client {
            div { class: "auth-banner",
                "No session found. Run `cadet auth login` to authenticate."
            }
        }
        // ... rest of app
    }
}

// Views consume it:
// let client = use_context::<Signal<Option<WebClient>>>();
// if let Some(ref client) = (client)() {
//     let runs = client.list_runs().await?;
// }
```

Add a retry wrapper that refreshes the token on 401:

```rust
impl WebClient {
    /// Execute a request, refreshing the token once on 401.
    pub async fn with_retry<T, F, Fut>(&mut self, f: F) -> Result<T, WebClientError>
    where
        F: Fn(&WebClient) -> Fut,
        Fut: std::future::Future<Output = Result<T, WebClientError>>,
    {
        match f(self).await {
            Err(WebClientError::Auth { .. }) => {
                // Try refreshing the token
                let new_token = self.refresh_token().await?;
                self.session_token = new_token.clone();
                // Persist the new token
                if let Ok(home) = std::env::var("HOME") {
                    let path = format!("{home}/.cadet/session.json");
                    let session = serde_json::json!({ "token": new_token });
                    let _ = std::fs::write(&path, session.to_string());
                }
                // Retry the original request
                f(self).await
            }
            other => other,
        }
    }
}
```

**Commit:** `feat(desktop): WebClient Dioxus context provider with auto token refresh`
**Test:** Mock server returns 401 on first request, 200 with new token on `/api/auth/desktop-token`, then 200 on retry. Verify `with_retry` succeeds.

### Step 5: Module registration and Cargo.toml updates

Register the module and ensure dependencies are correct.

```rust
// In src/lib.rs, add:
pub mod web_client;
```

```toml
# In Cargo.toml, add under [dependencies]:
futures = { version = "0.3", optional = true }
thiserror = "2"

# Update desktop-ui feature:
# desktop-ui = ["dioxus/desktop", "dep:dioxus-desktop", "dep:arboard", "dep:toml", "dep:reqwest", "dep:futures"]
```

**Commit:** `feat(desktop): register web_client module, add futures + thiserror deps`
**Test:** `cargo check --features desktop-ui` passes. `cargo test` passes all unit tests.

## Regression Tests

- **Session loading**: Valid `session.json` loads correctly. Missing file returns `NoSession` error. Malformed JSON returns `Parse` error.
- **Auth header**: Every authenticated request includes `Authorization: Bearer <token>` header.
- **Error mapping**: 401 -> `Auth`, 500 -> `Server`, network timeout -> `Network`, invalid JSON -> `Parse`.
- **SSE parsing**: Multi-event stream with text deltas, tool calls, and done event parses correctly. Incomplete chunks buffer correctly. Dropped receiver doesn't panic.
- **Token refresh**: Expired token triggers refresh, new token is persisted to disk and used for retry.
- **Base URL**: Respects `CADET_WEB_URL` env var. Defaults to `http://localhost:3001`.

## Definition of Done

- [ ] `WebClient` struct with `from_session()` and `new()` constructors
- [ ] `WebClientError` enum covers network, auth, server, parse, and no-session errors
- [ ] Methods for: `list_threads`, `get_thread`, `dispatch_agent`, `list_runs`, `get_run`, `retry_run`, `list_approvals`, `resolve_approval`, `get_journal`, `save_journal`, `list_skills`, `create_skill`, `health`, `me`, `refresh_token`
- [ ] `chat_stream()` returns an `mpsc::Receiver<ChatStreamEvent>` with SSE parsing
- [ ] `with_retry()` refreshes token on 401 and retries
- [ ] Session token loaded from `~/.cadet/session.json`
- [ ] Provided as Dioxus context for all views to consume
- [ ] Unit tests for each endpoint with mock server
- [ ] `cargo check --features desktop-ui` passes

## PR

**Title:** feat(desktop): typed HTTP client for web server API
**Labels:** desktop, foundation
