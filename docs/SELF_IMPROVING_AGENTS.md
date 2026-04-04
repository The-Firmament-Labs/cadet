# Cadet Self-Improving Agent Architecture

## The Vision

Cadet agents get better with every task. Not through prompt engineering — through actual behavioral improvement at three speeds:

| Loop | Speed | Mechanism | What Changes |
|------|-------|-----------|-------------|
| **Fast** | Every run | Memory retrieval from SpacetimeDB | What the agent knows |
| **Medium** | Real-time | RLVR + LLM judge → delight filtering | What enters the training buffer |
| **Slow** | Periodic batch | GRPO from high-delight trajectories | How the agent thinks |

No competitor has all three loops running simultaneously. Most have zero.

### Core Principle: Delight = Loss x Surprise

You can't just do continuous RL — you get mode collapse. Human memory works the same way: you remember 1-2 striking moments from a day, not everything. As a kid, everything is new, so you learn fast. As you age, your brain filters most information that isn't novel.

Models must do the same. **Only the top ~3% most delightful trajectories enter the training buffer.**

- **Loss**: How wrong was the model? (1.0 - composite_score)
- **Surprise**: How novel is this? (embedding distance from cluster centroid)
- **Delight**: loss × surprise — high only when the model was wrong about something new

Training on correct, routine trajectories is waste. Training on surprising failures is gold. This prevents catastrophic forgetting by being extremely selective about what changes the weights.

Reference: https://arxiv.org/abs/2603.20526

---

## Core Principle: No Lock-In, Every Layer Optional

**Every compute-heavy capability has three execution modes.** The user picks per-capability, not all-or-nothing:

| Capability | Local (on-device) | Remote (your server) | Cloud (managed API) |
|-----------|-------------------|---------------------|-------------------|
| **LLM inference** | llama.cpp / MLX on Apple Silicon | Self-hosted vLLM / Ollama on your GPU server | OpenAI / Anthropic / AI Gateway |
| **Embeddings** | fastembed-rs on CPU/Metal | Remote embedding server | OpenAI embeddings API |
| **Trajectory scoring** | Local 4B judge model | Remote judge on GPU server | Cloud LLM-as-judge (Haiku) |
| **LoRA training** | MLX-LM-LoRA on M4 Max | Remote training on GPU cluster | (Not offered — training stays user-owned) |
| **Vector search** | SimSIMD / Qdrant embedded | Remote Qdrant server | Cloud Pinecone / Weaviate |

**Settings UI:** Each capability has a 3-way toggle: `Local | Remote | Cloud`. Default is Cloud (zero setup). Users who want performance/privacy switch to Local. Teams with a GPU server use Remote.

**Remote server deployment:** Users can run `cadet-inference-server` (a Rust binary we ship) on any machine with a GPU. It exposes the same API as the local services. The desktop connects to it via URL in settings. This means:
- A team shares one GPU server for scoring and embeddings
- An individual uses a home server with an RTX 4090
- A cloud instance on Railway/Fly.io/Modal runs the heavy compute
- The desktop stays lightweight — just the UI + SpacetimeDB subscription

**Resource-conscious mode:** For users who multitask heavily, the default profile uses:
- Cloud APIs for inference (zero local resources)
- Cloud embeddings (zero local resources)
- Background-only scoring (only when idle, pauses when CPU > 60%)
- No local training (export trajectories to train elsewhere)

The local ML features are **opt-in behind a feature flag** (`local-ml` in Cargo.toml). The base desktop app doesn't even compile the ML crates unless enabled.

---

## What We Already Built

The trajectory pipeline is already 60% complete:

```
✅ TrajectoryLog table in SpacetimeDB
   - instruction, context_toon, output, tool_calls_json, success, duration_ms
   - Every agent action recorded automatically

✅ TOON encoding (40% fewer tokens than JSON)
   - encode_trajectory() serializes full context
   - fit_to_budget() manages token limits
   - Built for training data from day one

✅ learnStep in 7-stage workflow
   - Extracts 1-3 text learnings via Haiku after every run
   - Stores in memory_document with source_kind "agent-learning"
   - Available to all future runs via context assembly

✅ Memory retrieval in gatherStep
   - Queries learnings filtered by goal keywords
   - Builds context from past successes/failures
   - The fast loop is WORKING

❌ Missing: RLVR signal emission from workflow steps
❌ Missing: LLM-as-judge scoring (no quality signal beyond success bool)
❌ Missing: Surprise computation (embedding distance for novelty)
❌ Missing: Delight filtering (loss × surprise → top 3% gate)
❌ Missing: Training buffer for high-delight trajectories
❌ Missing: GRPO training pipeline
❌ Missing: Local model fine-tuning (LoRA via MLX)
❌ Missing: Local inference for scoring and generation
```

---

## The Complete Pipeline

### Phase 1: RLVR Signals + LLM-as-Judge Scoring

**What:** Two reward sources — verifiable rewards (free, instant) and LLM judge (richer, ~3.6s).

**RLVR (Verifiable Rewards — always on, zero cost):**
```
Agent completes task
    ↓ verifyStep checks outcomes:
    - Did tests pass?         → binary 1.0/0.0
    - Did code compile?       → binary 1.0/0.0
    - Did deploy succeed?     → binary 1.0/0.0
    - Did user thumbs-up?     → binary 1.0/0.0
    - Task completed?         → binary 1.0/0.0
    ↓ composite = average of available signals
Stored as TrajectoryScore with source "rlvr"
```

These are deterministic, unchallengeable rewards. No judge model needed. Score the instant the task completes.

**LLM-as-Judge (richer signal, per resource profile):**
```
SpacetimeDB TrajectoryLog
    ↓ (push via subscription)
Scoring daemon receives trajectory in real-time
    ↓ (Tokio channel)
Judge model scores on: correctness, efficiency, tool-use quality, adherence
    ↓ returns 4 scores (0.0-1.0) + reasoning
Score stored back to SpacetimeDB via reducer
    ↓
All clients see the score instantly
```

3 modes: Local (Qwen3-4B via llama-cpp-2, Metal), Remote (cadet-inference-server), Cloud (Haiku).

**New tables:**
```rust
#[table(accessor = trajectory_score, public)]
pub struct TrajectoryScore {
    #[primary_key]
    score_id: String,
    #[index(btree)]
    trajectory_id: String,
    run_id: String,
    correctness: f32,
    efficiency: f32,
    tool_use_quality: f32,
    adherence: f32,
    composite: f32,
    loss: f32,           // 1.0 - composite
    surprise: f32,       // embedding distance from cluster centroid
    delight: f32,        // loss × surprise — the selectivity signal
    source: String,      // "rlvr" | "llm-judge" | "operator-feedback"
    judge_model: String,
    judge_reasoning: String,
    rlvr_signals_json: String,
    created_at_micros: i64,
}
```

### Phase 2: Delight Filtering (Real-Time Curation)

**What:** The 97% rejection gate. Only surprising failures enter the training buffer.

**How:**
```
For each scored trajectory:
    loss = 1.0 - composite_score
    surprise = embedding_distance(trajectory, nearest_centroid)
    delight = loss × surprise

    if delight > adaptive_threshold:  // targets top ~3%
        → insert into training_buffer
    else:
        → discard (routine, nothing to learn)
```

**Surprise computation:**
1. Embed trajectory (instruction + output) via configured embedding provider
2. Find nearest cluster centroid in trajectory embedding index
3. `surprise = normalized_distance(embedding, centroid)`
4. Cold-start: surprise = 1.0 for all (everything is new — like a kid)
5. Centroids update incrementally as trajectories accumulate

**Adaptive threshold:**
- Target: top 3% acceptance rate
- If buffer empty too long: relax to top 10% (floor)
- If buffer fills too fast: tighten to top 1% (ceiling)
- Computed over rolling window of last 500 scored trajectories

**Human feedback special case:**
- Thumbs-down → surprise = 1.0 (human judgment is always novel) → delight = 1.0 → always enters buffer
- Thumbs-up → loss = 0.0 → delight = 0.0 → doesn't enter buffer (model was right, nothing to learn)
- This is correct: you train on what went wrong, not what already works

### Phase 3: GRPO Training (Batch)

**What:** Periodic batch training using Group Relative Policy Optimization on high-delight trajectories.

**Why GRPO, not DPO:**
- DPO needs explicit preference pairs — fragile to construct, binary signal
- GRPO groups trajectories by task type, computes relative rewards within the group
- The group IS the comparison — no pairing needed
- Works naturally with the delight-filtered training buffer

**How:**
```
training_buffer reaches threshold (e.g. 200+ trajectories)
    ↓ group by task_cluster (embedding-derived)
For each cluster with 3+ trajectories:
    ↓ GRPO: compute relative advantage within group
    ↓ trajectories with higher delight get higher advantage
    ↓ produces gradient signal
    ↓ LoRA weight update via MLX-LM
.cadet/models/cadet-lora-v{N}.safetensors
    ↓ hot-swap into local inference engine
    ↓ mark consumed trajectories in buffer
Next agent run uses improved weights
```

**Hardware:** M4 Max 128GB. QLoRA on 7B-14B. ~30-60 min per batch.

**Desktop UX:** "Training" panel in Settings:
- Training buffer count + delight distribution chart
- "Train Now" button (triggers GRPO on current buffer)
- Training progress bar
- Adapter version history with A/B comparison
- Active adapter selector

### Phase 4: Local Inference (Hybrid Local/Cloud)

**What:** Simple tasks use the local fine-tuned model. Complex tasks route to cloud.

**How:**
```
User sends message
    ↓ complexity estimate (token count, tool requirements)
Simple (< 4 tools, < 2000 tokens) → local 14B + LoRA adapter
Complex (planning, multi-step, vision) → cloud Claude/GPT
    ↓
Response streams to chat
```

**Framework:** Local inference server (OpenAI-compatible). The web server switches between local and cloud with a URL change.

**Desktop UX:** Settings slider: "Local ↔ Cloud". Cost dashboard. Model indicator per message.

---

## Local GPU Capabilities (M4 Max 128GB)

### What We Can Run

| Capability | Crate | Speed | Memory |
|-----------|-------|-------|--------|
| 7B inference | llama-cpp-2 | 60-80 tok/s | ~4 GB |
| 14B inference | llama-cpp-2 | 40-55 tok/s | ~8 GB |
| 70B inference | llama-cpp-2 | 22-25 tok/s | ~40 GB |
| Embeddings | fastembed-rs | <5ms per doc | ~500 MB |
| Vector search | SimSIMD | <1ms / 1M vectors | In-memory |
| Trajectory scoring | Qwen3-4B judge | 3.6s per trajectory | ~2.5 GB |
| LoRA training (7B) | MLX-LM-LoRA | 30-60 min / 1000 examples | ~7 GB |
| DPO training (7B) | MLX-LM-LoRA | 30-60 min / 1000 pairs | ~7 GB |

**Total memory for running everything simultaneously:**
- 14B inference + 4B judge + embeddings + vector index = ~15 GB
- Leaves 113 GB free on 128GB M4 Max

### What This Replaces

| Cloud API Call | Local Replacement | Latency Improvement | Cost Savings |
|---------------|------------------|--------------------|-----------| 
| OpenAI embeddings | fastembed-rs | 20-40x faster | $0 vs $0.02/1K tokens |
| GPT-4o for scoring | Local Qwen3-4B | No network latency | $0 vs $0.01/call |
| Claude Sonnet for simple tasks | Local 14B + LoRA | 10x faster first-token | $0 vs $0.003/1K tokens |
| Pinecone vector search | SimSIMD local | 50-200x faster | $0 vs $25-100/mo |

### Privacy

**Everything stays on device.** Code, trajectories, scores, training data, model weights — none of it leaves the machine. This is a hard requirement for enterprise users with proprietary codebases.

---

## How SpacetimeDB Amplifies Everything

| RL Pipeline Step | SpacetimeDB Role | Advantage |
|-----------------|-----------------|-----------|
| Trajectory collection | TrajectoryLog table with real-time push | Zero-delay data capture, no batch export |
| Score delivery | TrajectoryScore table with subscription | All clients see scores instantly |
| Feedback collection | Reducer from any surface | User rates from desktop, web, or Slack |
| Training data query | Client-side cache iteration | Zero-network reads for pair construction |
| Model deployment | Reducer to update agent config | All agents pick up new adapter on next run |
| A/B comparison | Per-agent config with model override | Test LoRA vs base on real tasks |

The key insight: **the RL pipeline is not a separate system.** It's just more SpacetimeDB tables and reducers that participate in the same real-time subscription model as everything else. The desktop sees training progress in real-time. Score updates push to all clients. Model selection is a reducer call.

---

## Competitive Position

```
                    Manual            Self-Improving
                    ┌─────────────────┬─────────────────┐
                    │                 │                 │
Cloud-only          │  Devin          │  (Nobody)       │
                    │  Factory        │                 │
                    │                 │                 │
                    ├─────────────────┼─────────────────┤
                    │                 │                 │
Local capable       │  Cursor         │  CADET          │
                    │  Claude Code    │  + Hermes       │
                    │  Aider          │  (partial)      │
                    │                 │                 │
                    └─────────────────┴─────────────────┘
```

Cadet is the only platform that combines:
- Local + cloud execution
- Real-time SpacetimeDB state for trajectory + score push
- RLVR (verifiable rewards from task outcomes — free, instant)
- Delight filtering (loss × surprise → top 3% only → no mode collapse)
- GRPO training on high-delight trajectories (not outdated DPO)
- Local GPU-accelerated scoring and training on M4 Max
- Self-improving LoRA adapters, hot-swappable via reducer
- All running on a single machine with no cloud dependency

Hermes has some self-improvement (GEPA, Atropos) but requires cloud infrastructure for RL training and doesn't have delight filtering. Cadet does it locally with biological selectivity.

---

## Implementation Roadmap

### Now (With Desktop Rebuild)
- Add thumbs up/down buttons on agent messages in chat view
- Display trajectory quality trends in run detail view
- Show "Learnings" section in run output (already extracted by learnStep)
- Wire RLVR signal emission from verify/act steps in durable workflow

### Phase 1 (After Desktop Works): RLVR + Scoring Tables
- Add `trajectory_score`, `training_buffer`, `training_run` tables to SpacetimeDB
- Emit RLVR signals from workflow steps (tests, compile, deploy outcomes)
- Cloud judge scoring via Haiku (zero local deps)
- **Effort: 1 week**

### Phase 2: Delight Filtering + Local Embeddings
- Add `fastembed-rs` for surprise computation
- Build cluster centroid tracking for novelty detection
- Implement delight gate with adaptive threshold (target top 3%)
- Background scoring daemon with idle detection
- **Effort: 1-2 weeks**

### Phase 3: GRPO Training
- Build GRPO training pipeline (not DPO — group relative, no pairing needed)
- Group training buffer by task cluster
- Integrate MLX-LM-LoRA via Python subprocess
- Add training UI to Settings with buffer visualization
- **Effort: 2 weeks**

### Phase 4: Hybrid Local/Cloud
- Local inference server (OpenAI-compatible)
- Complexity router (simple → local 14B + LoRA, complex → cloud)
- Local/cloud slider in Settings, cost dashboard
- **Effort: 2 weeks**

---

## Remote Server Architecture (cadet-inference-server)

A standalone Rust binary that teams deploy on any GPU machine:

```
cadet-inference-server
├── /v1/chat/completions     ← OpenAI-compatible inference
├── /v1/embeddings           ← Embedding generation
├── /v1/score                ← Trajectory scoring
├── /v1/train/start          ← Start LoRA training job
├── /v1/train/status         ← Training job status
├── /v1/models               ← List available models + adapters
└── /health                  ← Health check
```

**Deployment options:**
- `cargo install cadet-inference-server` on any Linux/macOS machine with GPU
- Docker image: `ghcr.io/the-firmament-labs/cadet-inference-server`
- One-click deploy on Railway / Fly.io / Modal
- Kubernetes Helm chart for teams

**Desktop connection:** Settings → Remote Server URL → `https://gpu.myteam.com:8443`

The remote server writes scores back to SpacetimeDB via the same reducers the local pipeline uses. All clients see results regardless of where compute happened.

---

## Resource Profiles (User Selectable)

### Profile: Lightweight (default)
**For:** Users who multitask, limited RAM, don't want background processes
```
Inference:  Cloud (AI Gateway)
Embeddings: Cloud (OpenAI)
Scoring:    Cloud (Haiku) — only on explicit request, not automatic
Training:   Disabled (export trajectories for external training)
Memory:     ~0 MB additional (SpacetimeDB subscription only)
```

### Profile: Balanced
**For:** Users with M4 Pro+ who want some local benefits
```
Inference:  Cloud (AI Gateway)
Embeddings: Local (fastembed-rs, ~500MB model, idle when not needed)
Scoring:    Local when idle (4B judge, pauses at CPU > 60%)
Training:   Manual trigger only (not scheduled)
Memory:     ~3 GB when active, ~500 MB idle
```

### Profile: Power
**For:** Users with M4 Max 128GB who want maximum performance/privacy
```
Inference:  Local for simple tasks (14B), Cloud for complex
Embeddings: Local (fastembed-rs)
Scoring:    Local continuous (4B judge on every trajectory)
Training:   Weekly automatic (LoRA via MLX)
Memory:     ~15 GB when active
```

### Profile: Team
**For:** Teams with a shared GPU server
```
Inference:  Remote server (team GPU)
Embeddings: Remote server
Scoring:    Remote server (continuous)
Training:   Remote server (scheduled)
Memory:     ~0 MB local (all compute on remote)
```

### Profile: Custom
**For:** Users who want granular control
```
Each capability individually configurable:
  Inference:  [Local | Remote | Cloud]
  Embeddings: [Local | Remote | Cloud]
  Scoring:    [Local | Remote | Cloud | Off]
  Training:   [Local | Remote | Off]
  
  Local options:
    Model size: [3B | 7B | 14B | 30B | 70B]
    GPU priority: [Background | Normal | High]
    Idle-only mode: [On | Off]
    Max memory: [slider, GB]
```

---

## New Cargo Dependencies

```toml
# Local ML (opt-in, not compiled by default)
fastembed = { version = "5.12", features = ["coreml"], optional = true }
simsimd = { version = "5", optional = true }
llama-cpp-2 = { version = "0.1", features = ["metal"], optional = true }

[features]
default = []
desktop-ui = ["dioxus/desktop", "dep:dioxus-desktop", "dep:arboard", "dep:toml", "dep:reqwest"]
local-ml = ["dep:fastembed", "dep:simsimd", "dep:llama-cpp-2"]
```

The `local-ml` feature is separate from `desktop-ui`. Users can run the desktop without any ML dependencies. The Settings UI shows which capabilities are available based on compiled features.

## New SpacetimeDB Tables

```rust
// Trajectory quality scores — from RLVR, LLM judge, or human feedback
#[table(accessor = trajectory_score, public)]
pub struct TrajectoryScore {
    #[primary_key]
    score_id: String,
    #[index(btree)]
    trajectory_id: String,
    run_id: String,
    correctness: f32,
    efficiency: f32,
    tool_use_quality: f32,
    adherence: f32,
    composite: f32,
    loss: f32,              // 1.0 - composite
    surprise: f32,          // embedding distance from cluster centroid
    delight: f32,           // loss × surprise — the selectivity signal
    source: String,         // "rlvr" | "llm-judge" | "operator-feedback"
    judge_model: String,
    judge_reasoning: String,
    rlvr_signals_json: String,
    created_at_micros: i64,
}

// High-delight trajectories awaiting GRPO training
#[table(accessor = training_buffer, public)]
pub struct TrainingBuffer {
    #[primary_key]
    buffer_id: String,
    trajectory_id: String,
    score_id: String,
    delight: f32,
    task_cluster: String,   // embedding-derived cluster for GRPO grouping
    consumed: bool,         // true after training run uses it
    created_at_micros: i64,
}

// Training run records
#[table(accessor = training_run, public)]
pub struct TrainingRun {
    #[primary_key]
    training_id: String,
    base_model: String,
    adapter_path: String,
    method: String,  // "grpo" | "rlvr" | "sft"
    trajectory_count: u32,
    group_count: u32,
    epochs: u32,
    final_loss: f32,
    delight_threshold: f32,  // cutoff used for this batch
    duration_seconds: u32,
    status: String,  // "running" | "completed" | "failed"
    created_at_micros: i64,
}
```
