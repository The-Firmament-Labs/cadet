# 017 — Local Embeddings (fastembed-rs)

**Status:** Not Started
**Depends On:** 001 (Live Data Layer)
**Effort:** Small
**PR Branch:** `feat/017-local-embeddings`

---

## Context

Cadet currently uses cloud API calls (OpenAI embeddings) for all vector operations: memory search, trajectory similarity, and context assembly in the `gatherStep`. This works but adds network latency (20-40ms per call) and cost ($0.02/1K tokens). The `fastembed-rs` crate provides the same embedding quality locally on CPU/CoreML with sub-5ms latency and zero cost.

Local embeddings are the lowest-effort, highest-impact step in the self-improvement pipeline. They unlock:
- Zero-latency memory search in the desktop (SimSIMD similarity on client-side vectors)
- Offline operation (no cloud dependency for retrieval)
- Free trajectory clustering for DPO pair construction (spec 016 dependency)

The feature is gated behind the `local-ml` Cargo feature flag. When disabled, the existing cloud embedding path is used unchanged. The Lightweight resource profile always uses cloud embeddings. Balanced and Power profiles use local embeddings. Team profile uses the remote inference server.

### Performance Targets

| Metric | Cloud (OpenAI) | Local (fastembed-rs) | Improvement |
|--------|---------------|---------------------|-------------|
| Latency per document | 20-40ms | < 5ms | 4-8x faster |
| Cost per 1K tokens | $0.02 | $0 | Free |
| Model memory | 0 (cloud) | ~500 MB | Tradeoff |
| Offline capable | No | Yes | New capability |

---

## Requirements

1. **fastembed-rs integration:** Add `fastembed` crate (version 5.12, `coreml` feature) as an optional dependency behind the `local-ml` feature flag. Use the `BAAI/bge-small-en-v1.5` model (33M params, 384-dim output) for the default embedding model.
2. **SimSIMD for similarity:** Add `simsimd` crate (version 5) as an optional dependency behind `local-ml`. Use cosine similarity for vector comparison. This replaces any cloud-side similarity computation.
3. **EmbeddingProvider trait:** Define a trait with `async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>>` and `fn dimensions(&self) -> usize`. Implement for `CloudEmbeddingProvider` (existing OpenAI path) and `LocalEmbeddingProvider` (fastembed-rs). A `RemoteEmbeddingProvider` variant calls `{remote_url}/v1/embeddings`.
4. **Zero behavior change for Lightweight profile:** When `local-ml` is not compiled or the user selects Lightweight, all embedding calls route to the existing cloud path. No code paths change. No new dependencies loaded.
5. **Memory search uses local embeddings:** The `gatherStep` context assembly and the desktop memory search both use the `EmbeddingProvider` trait. When local embeddings are enabled, memory search is entirely offline.
6. **Model download on first use:** On first call to `LocalEmbeddingProvider`, download the model to `~/.cadet/models/bge-small-en-v1.5/`. Show a progress indicator in the desktop status bar. Subsequent calls use the cached model.

---

## Files

| File | Action | Description |
|------|--------|-------------|
| `rust/starbridge-core/src/embeddings.rs` | NEW | `EmbeddingProvider` trait + Cloud/Local/Remote implementations |
| `rust/starbridge-core/src/similarity.rs` | NEW | SimSIMD-backed cosine similarity + fallback pure-Rust impl |
| `rust/starbridge-core/src/embeddings_local.rs` | NEW | `LocalEmbeddingProvider` using fastembed-rs (compiled only with `local-ml`) |
| `rust/starbridge-core/Cargo.toml` | MODIFY | Add `fastembed` and `simsimd` as optional deps behind `local-ml` |
| `rust/starbridge-core/src/context_engine.rs` | MODIFY | Replace direct OpenAI embedding calls with `EmbeddingProvider` trait |
| `rust/starbridge-dioxus/src/ui/views/memory.rs` | MODIFY | Use `EmbeddingProvider` for memory search queries |
| `rust/starbridge-dioxus/src/ui/shared.rs` | MODIFY | Add model download progress indicator to status bar |

---

## Implementation Steps

### Step 1: EmbeddingProvider trait + cloud implementation

Create `embeddings.rs` with the `EmbeddingProvider` trait and `CloudEmbeddingProvider` struct. The cloud provider wraps the existing OpenAI embedding HTTP calls. Create `similarity.rs` with a pure-Rust cosine similarity function as the default (no additional dependencies). Refactor `context_engine.rs` to accept an `Arc<dyn EmbeddingProvider>` instead of calling OpenAI directly. All existing behavior preserved.

**Commit:** `refactor(embeddings): extract EmbeddingProvider trait from hardcoded OpenAI calls`

### Step 2: Local embedding provider (fastembed-rs)

Create `embeddings_local.rs` behind `#[cfg(feature = "local-ml")]`. Implement `LocalEmbeddingProvider` using `fastembed::TextEmbedding` with the `BAAI/bge-small-en-v1.5` model. Handle model download to `~/.cadet/models/` on first use with a progress callback. Add `fastembed = { version = "5.12", features = ["coreml"], optional = true }` to Cargo.toml under the `local-ml` feature.

**Commit:** `feat(embeddings): local embedding provider via fastembed-rs behind local-ml flag`

### Step 3: SimSIMD similarity + remote provider

Add `simsimd = { version = "5", optional = true }` to Cargo.toml under `local-ml`. Update `similarity.rs` to use SimSIMD cosine similarity when compiled with `local-ml`, falling back to the pure-Rust implementation otherwise. Add `RemoteEmbeddingProvider` that POSTs to `{remote_url}/v1/embeddings` (OpenAI-compatible format). Provider selection is driven by the user's resource profile setting.

**Commit:** `feat(embeddings): SimSIMD accelerated similarity + remote embedding provider`

### Step 4: Desktop integration + model download UX

Update the memory view to use the configured `EmbeddingProvider` for search queries. Add a status bar indicator that shows model download progress on first local embedding use. Wire the provider selection to the Settings resource profile (Lightweight = cloud, Balanced/Power = local, Team = remote). Verify the full path: type a search query in memory view, embeddings generated locally, SimSIMD similarity computed, results returned.

**Commit:** `feat(desktop): wire local embeddings to memory search + download progress indicator`

---

## Regression Tests

- [ ] `EmbeddingProvider` trait compiles and `CloudEmbeddingProvider` produces 1536-dim vectors (OpenAI)
- [ ] `LocalEmbeddingProvider` produces 384-dim vectors (bge-small-en-v1.5)
- [ ] `RemoteEmbeddingProvider` sends correct payload to `/v1/embeddings`
- [ ] Cosine similarity (pure-Rust) returns 1.0 for identical vectors, 0.0 for orthogonal
- [ ] SimSIMD similarity matches pure-Rust results within f32 epsilon
- [ ] `context_engine.rs` works with both Cloud and Local providers
- [ ] Memory search returns relevant results with local embeddings
- [ ] Model downloads to `~/.cadet/models/` on first use and is cached
- [ ] App builds without `local-ml` feature — only cloud provider available
- [ ] App builds with `local-ml` feature — local + cloud + remote all available
- [ ] Lightweight profile never triggers local model download

---

## Definition of Done

- [ ] `EmbeddingProvider` trait defined with Cloud, Local, and Remote implementations
- [ ] `fastembed` and `simsimd` are optional dependencies behind `local-ml` feature flag
- [ ] Local embeddings produce correct 384-dim vectors via bge-small-en-v1.5
- [ ] SimSIMD provides accelerated cosine similarity when compiled with `local-ml`
- [ ] Pure-Rust fallback similarity works when `local-ml` is not compiled
- [ ] `context_engine.rs` uses `EmbeddingProvider` trait (no hardcoded OpenAI)
- [ ] Memory search in desktop uses configured provider
- [ ] Model download happens on first use with progress indicator
- [ ] Lightweight profile is completely unaffected (cloud path only)
- [ ] Balanced/Power profiles use local embeddings by default
- [ ] Team profile uses remote embedding server
- [ ] All regression tests pass
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui` succeeds (cloud only)
- [ ] `cargo build --bin starbridge-dioxus-ui --features desktop-ui,local-ml` succeeds (local + cloud)

---

## PR Template

```
## 017 — Local Embeddings (fastembed-rs)

### Summary
- Extract `EmbeddingProvider` trait from hardcoded OpenAI embedding calls
- Add local embedding via fastembed-rs (BAAI/bge-small-en-v1.5) behind `local-ml` flag
- Add SimSIMD-accelerated cosine similarity with pure-Rust fallback
- Wire memory search and context assembly to use configured provider
- Zero behavior change for Lightweight profile

### Test plan
- [ ] Build without `local-ml` — verify cloud embeddings work as before
- [ ] Build with `local-ml` — verify local embeddings produce 384-dim vectors
- [ ] Search memory with local embeddings — verify relevant results returned
- [ ] First local embedding call triggers model download to ~/.cadet/models/
- [ ] Subsequent calls use cached model (no re-download)
- [ ] Switch to Lightweight profile — verify cloud path used, no local model loaded
- [ ] Switch to Team profile with remote URL — verify embeddings come from server
- [ ] Verify SimSIMD and pure-Rust similarity return matching results
```
