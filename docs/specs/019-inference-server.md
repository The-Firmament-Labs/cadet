# 019 — cadet-inference-server (Remote ML Compute)

**Status:** Not Started
**Depends On:** 006 (Settings View)
**Effort:** Large
**PR Branch:** `feat/019-inference-server`

---

## Context

The self-improvement architecture requires compute-heavy operations: trajectory scoring, embedding generation, and eventually inference and LoRA training. Not every user has an M4 Max. The `cadet-inference-server` is a standalone Rust binary that teams deploy on any machine with a GPU — a home server with an RTX 4090, a cloud instance on Railway/Fly.io, or a shared team GPU box.

The server exposes an **OpenAI-compatible API** so existing tooling works. The desktop connects to it via a URL in Settings. Scores and embeddings computed on the remote server are written back to SpacetimeDB via reducers, so all clients see results regardless of where compute happened. This is the "Team" resource profile from `SELF_IMPROVING_AGENTS.md`.

### Architecture

```
Desktop App                          cadet-inference-server (GPU machine)
┌──────────────┐                     ┌─────────────────────────────────┐
│ Settings:    │                     │ /v1/chat/completions            │
│ Remote URL ──┼──── HTTPS/WSS ────→│ /v1/embeddings                  │
│              │                     │ /v1/score                       │
│ SpacetimeDB ←┼──── reducer ───────│ /v1/models                      │
│ (scores,    │                     │ /health                         │
│  embeddings)│                     │                                 │
└──────────────┘                     │ Backend: llama-cpp-2 + Metal/   │
                                     │          CUDA + fastembed-rs    │
                                     └─────────────────────────────────┘
```

### Why OpenAI-Compatible

The server speaks the OpenAI API format so that:
- Existing AI Gateway routing can treat it as another provider
- Tools like `curl`, Postman, and OpenAI client libraries work out of the box
- Users can swap between local, remote, and cloud without changing application code
- The `EmbeddingProvider` trait (spec 017) already has a `RemoteEmbeddingProvider` that calls `/v1/embeddings`

---

## Requirements

1. **New Rust binary:** `cadet-inference-server` in `rust/cadet-inference-server/`. Separate crate from the desktop app. Depends on `axum` for HTTP, `llama-cpp-2` for inference, `fastembed` for embeddings.
2. **`/v1/chat/completions` endpoint:** OpenAI-compatible chat completions. Accepts `model`, `messages`, `temperature`, `max_tokens`, `stream`. Supports streaming via SSE. Routes to a loaded GGUF model via llama-cpp-2.
3. **`/v1/embeddings` endpoint:** OpenAI-compatible embeddings. Accepts `model`, `input` (string or array). Returns embedding vectors. Uses fastembed-rs with the same model as spec 017 (bge-small-en-v1.5).
4. **`/v1/score` endpoint:** Cadet-specific trajectory scoring. Accepts a TOON-encoded trajectory, returns a `TrajectoryScore` JSON object with the four dimensions + composite + reasoning. Uses the loaded judge model. Writes the score back to SpacetimeDB via a reducer call if `spacetimedb_url` is configured.
5. **`/v1/models` endpoint:** List available models (loaded GGUF files + embedding model). Returns OpenAI-compatible model list.
6. **`/health` endpoint:** Returns server status, loaded models, GPU memory usage, request queue depth.
7. **Docker image:** `Dockerfile` that builds the server binary and exposes port 8443. Supports CUDA and Metal build targets. Published to `ghcr.io/the-firmament-labs/cadet-inference-server`.
8. **Desktop Settings integration:** In the Settings view (spec 006), add a "Remote Server" section with: URL input field, "Test Connection" button that calls `/health`, connection status indicator (green/red), model list from `/v1/models`.
9. **SpacetimeDB writeback:** When the server scores a trajectory, it calls the `record_trajectory_score` reducer (spec 016) via the SpacetimeDB SDK to write the score. All desktop clients see the score instantly via push subscription.

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `rust/cadet-inference-server/Cargo.toml` | NEW | Crate manifest with axum, llama-cpp-2, fastembed, spacetimedb-sdk |
| `rust/cadet-inference-server/src/main.rs` | NEW | Server entry point, CLI args, model loading, graceful shutdown |
| `rust/cadet-inference-server/src/routes/completions.rs` | NEW | `/v1/chat/completions` with SSE streaming |
| `rust/cadet-inference-server/src/routes/embeddings.rs` | NEW | `/v1/embeddings` endpoint |
| `rust/cadet-inference-server/src/routes/score.rs` | NEW | `/v1/score` endpoint with SpacetimeDB writeback |
| `rust/cadet-inference-server/src/routes/models.rs` | NEW | `/v1/models` endpoint |
| `rust/cadet-inference-server/src/routes/health.rs` | NEW | `/health` endpoint with GPU stats |
| `rust/cadet-inference-server/src/routes/mod.rs` | NEW | Route module exports |
| `rust/cadet-inference-server/src/model_manager.rs` | NEW | Load/unload GGUF models, manage fastembed instance |
| `rust/cadet-inference-server/src/stdb_client.rs` | NEW | SpacetimeDB SDK client for reducer calls (score writeback) |
| `rust/cadet-inference-server/Dockerfile` | NEW | Multi-stage build with CUDA/Metal support |
| `rust/cadet-inference-server/railway.toml` | NEW | Railway deployment config |
| `rust/cadet-inference-server/fly.toml` | NEW | Fly.io deployment config |
| `rust/starbridge-dioxus/src/ui/views/settings.rs` | MODIFY | Add "Remote Server" section with URL, test, status |
| `Cargo.toml` (workspace) | MODIFY | Add `cadet-inference-server` to workspace members |

---

## Implementation Steps

### Step 1: Crate scaffold + health endpoint

Create `rust/cadet-inference-server/` with `Cargo.toml` depending on `axum`, `tokio`, `serde`, `serde_json`, `tracing`, `clap`. Set up `main.rs` with CLI argument parsing (port, model path, SpacetimeDB URL). Create the axum router with a `/health` endpoint that returns `{ "status": "ok", "version": "0.1.0" }`. Add the crate to the workspace `Cargo.toml`. Verify `cargo build -p cadet-inference-server` compiles.

**Commit:** `feat(inference-server): crate scaffold with axum router and /health endpoint`

### Step 2: Model manager + /v1/models

Create `model_manager.rs` with a `ModelManager` struct that holds a loaded GGUF model path and a fastembed `TextEmbedding` instance. On startup, load the GGUF model specified via CLI arg `--model-path`. Create `/v1/models` endpoint that returns an OpenAI-compatible model list (loaded inference model + embedding model name).

**Commit:** `feat(inference-server): model manager and /v1/models endpoint`

### Step 3: /v1/embeddings endpoint

Create `routes/embeddings.rs`. Accept `POST /v1/embeddings` with body `{ "model": "...", "input": "text" | ["text1", "text2"] }`. Generate embeddings via the `ModelManager`'s fastembed instance. Return OpenAI-compatible response: `{ "object": "list", "data": [{ "object": "embedding", "embedding": [...], "index": 0 }], "model": "...", "usage": {...} }`.

**Commit:** `feat(inference-server): /v1/embeddings endpoint via fastembed-rs`

### Step 4: /v1/chat/completions with streaming

Create `routes/completions.rs`. Accept `POST /v1/chat/completions` with standard OpenAI fields. When `stream: false`, generate the full response via llama-cpp-2 and return it. When `stream: true`, return an SSE stream with `data: {"choices": [{"delta": {"content": "..."}}]}` chunks. Handle `temperature`, `max_tokens`, and `stop` parameters. Add `llama-cpp-2` with `metal` and `cuda` features to Cargo.toml.

**Commit:** `feat(inference-server): /v1/chat/completions with SSE streaming via llama-cpp-2`

### Step 5: /v1/score with SpacetimeDB writeback

Create `routes/score.rs`. Accept `POST /v1/score` with body `{ "trajectory_toon": "...", "trajectory_id": "..." }`. Construct the judge prompt (reuse `scoring_prompt.rs` from spec 016 or inline). Run the judge model via llama-cpp-2. Parse the 4-dimension scores from the response. Create `stdb_client.rs` that connects to SpacetimeDB and calls the `record_trajectory_score` reducer. Write the score back so all desktop clients see it. Return the score JSON to the caller.

**Commit:** `feat(inference-server): /v1/score trajectory scoring with SpacetimeDB writeback`

### Step 6: Desktop Settings integration

In the Settings view, add a "Remote Server" section:
- Text input for server URL (e.g., `https://gpu.myteam.com:8443`)
- "Test Connection" button that GETs `/health` and displays result
- Green dot = connected, model names listed. Red dot = unreachable or error.
- Model list from `/v1/models` displayed below the URL field
- Save URL to `~/.cadet/config.toml` under `[inference_server]` section
- When a remote URL is configured and the resource profile is Team, the `EmbeddingProvider` and scoring engine route to this server.

**Commit:** `feat(settings): remote inference server URL configuration with connection test`

### Step 7: Docker image + deploy configs

Create a multi-stage `Dockerfile`: build stage uses `rust:1.86-slim` with build dependencies, runtime stage uses `debian:bookworm-slim` with only the binary and runtime libs. Support build args for `CUDA_VERSION` and `METAL` (macOS builds). Create `railway.toml` with build and deploy config. Create `fly.toml` with machine size and health check config. Document deployment in a comment header in each file.

**Commit:** `feat(inference-server): Dockerfile + Railway and Fly.io deployment configs`

---

## Regression Tests

- [ ] `cargo build -p cadet-inference-server` compiles without errors
- [ ] `/health` returns 200 with status "ok"
- [ ] `/v1/models` returns loaded model names in OpenAI format
- [ ] `/v1/embeddings` with string input returns embedding vector of correct dimensions
- [ ] `/v1/embeddings` with array input returns multiple embedding vectors
- [ ] `/v1/chat/completions` (non-streaming) returns a complete response
- [ ] `/v1/chat/completions` (streaming) returns SSE chunks terminated by `[DONE]`
- [ ] `/v1/score` returns valid 4-dimension scores (all 0.0-1.0)
- [ ] `/v1/score` writes score to SpacetimeDB when `spacetimedb_url` is configured
- [ ] Desktop clients receive the score via push subscription after remote scoring
- [ ] Settings "Test Connection" shows green dot for running server
- [ ] Settings "Test Connection" shows red dot for unreachable URL
- [ ] Model list populates in Settings when server is connected
- [ ] Server gracefully shuts down on SIGTERM (in-flight requests complete)
- [ ] Docker image builds successfully
- [ ] Server starts with `--model-path` pointing to a GGUF file

---

## Definition of Done

- [ ] `cadet-inference-server` binary compiles and runs as a standalone process
- [ ] `/v1/chat/completions` works with streaming and non-streaming modes
- [ ] `/v1/embeddings` produces correct vectors via fastembed-rs
- [ ] `/v1/score` scores trajectories and writes back to SpacetimeDB
- [ ] `/v1/models` lists loaded models
- [ ] `/health` returns server status and GPU memory info
- [ ] Desktop Settings has Remote Server URL field with test button
- [ ] Connection status indicator (green/red) works
- [ ] Model list populates from remote server
- [ ] URL saved to `~/.cadet/config.toml`
- [ ] Team resource profile routes embeddings and scoring to remote server
- [ ] Docker image builds and runs
- [ ] Railway and Fly.io deploy configs included
- [ ] Server added to workspace Cargo.toml
- [ ] All regression tests pass
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui` still succeeds (no cross-dependency)

---

## PR Template

```
## 019 — cadet-inference-server (Remote ML Compute)

### Summary
- New Rust binary: cadet-inference-server with OpenAI-compatible API
- /v1/chat/completions (SSE streaming), /v1/embeddings, /v1/score, /v1/models, /health
- Trajectory scoring writes back to SpacetimeDB via reducer — all clients see scores
- Desktop Settings integration with URL configuration and connection test
- Docker image + Railway/Fly.io deploy configs for one-click deployment

### Test plan
- [ ] Start inference server with a GGUF model, verify /health returns 200
- [ ] POST to /v1/embeddings with text, verify embedding vector returned
- [ ] POST to /v1/chat/completions with stream:true, verify SSE chunks received
- [ ] POST to /v1/score with TOON trajectory, verify score JSON returned
- [ ] Verify score appears in SpacetimeDB trajectory_score table
- [ ] Open desktop Settings, enter server URL, click Test Connection — verify green dot
- [ ] Verify model list populates from /v1/models
- [ ] Set resource profile to Team, verify scoring routes to remote server
- [ ] Docker build succeeds and container starts correctly
- [ ] Desktop app builds independently (no compile dependency on inference server)
```
