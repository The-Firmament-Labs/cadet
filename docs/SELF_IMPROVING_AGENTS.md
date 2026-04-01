# Cadet Self-Improving Agent Architecture

## The Vision

Cadet agents get better with every task. Not through prompt engineering — through actual behavioral improvement at three speeds:

| Loop | Speed | Mechanism | What Changes |
|------|-------|-----------|-------------|
| **Fast** | Every session | Memory retrieval from SpacetimeDB | What the agent knows |
| **Medium** | Every run | LLM-as-judge scoring + trajectory analysis | What the agent prioritizes |
| **Slow** | Weekly batch | LoRA fine-tuning from DPO pairs | How the agent thinks |

No competitor has all three loops running simultaneously. Most have zero.

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

❌ Missing: Reward scoring (no quality signal beyond success bool)
❌ Missing: Trajectory export to training format
❌ Missing: DPO preference pair construction
❌ Missing: Local model fine-tuning pipeline
❌ Missing: Local inference for scoring and generation
```

---

## The Complete Pipeline

### Phase 1: Trajectory Scoring (Local LLM-as-Judge)

**What:** Run a local 4B-7B model to score every agent trajectory on quality.

**Why this matters:** The `success` bool is too coarse. An agent can "succeed" with ugly code or "fail" for the right reasons. A quality score enables DPO pair ranking.

**How:**
```
SpacetimeDB TrajectoryLog
    ↓ (push via subscription)
Desktop receives new trajectory in real-time
    ↓ (Tokio channel)
Local Qwen3-4B judge (via llama-cpp-2, Metal GPU)
    ↓ scores on: correctness, efficiency, tool-use quality, adherence
Score stored back to SpacetimeDB via reducer
    ↓
All clients see the score instantly
```

**Performance:** Qwen3-4B on M4 Max: ~3.6 seconds per trajectory scoring. Fast enough to score every action as a background task.

**Desktop UX:** Quality gauge in the run detail view. Trend line showing agent quality over time. Red flag on poor-quality trajectories before the user reviews them.

**SpacetimeDB advantage:** Trajectory arrives at desktop via push subscription. Score is written back via reducer. All clients see it. Zero polling.

**New table:**
```rust
#[table(accessor = trajectory_score, public)]
pub struct TrajectoryScore {
    #[primary_key]
    score_id: String,
    trajectory_id: String,
    correctness: f32,      // 0.0-1.0
    efficiency: f32,       // 0.0-1.0
    tool_use_quality: f32, // 0.0-1.0
    adherence: f32,        // 0.0-1.0
    composite: f32,        // weighted average
    judge_model: String,
    judge_reasoning: String,
    created_at_micros: i64,
}
```

**Rust crates:** `llama-cpp-2` with `metal` feature, or `candle-core` with `metal` feature.

### Phase 2: Preference Pairs (DPO Data Construction)

**What:** Group trajectories by similar tasks, rank by quality score, pair best vs worst → DPO training data.

**How:**
```
All scored trajectories from SpacetimeDB
    ↓ group by similar instruction (embedding similarity)
For each task cluster:
    ↓ sort by composite score
    Best trajectory → "chosen"
    Worst trajectory → "rejected"
    ↓ format as DPO pair
Export to .cadet/training/dpo_pairs.jsonl
```

**SpacetimeDB advantage:** Local embedding search across trajectories uses client-side cache — zero network latency. Similarity computation on Apple Silicon GPU via SimSIMD.

**Desktop UX:** "Training Data" view showing DPO pairs. User can manually accept/reject pairs. Thumbs up/down on agent responses feeds directly into pair quality.

### Phase 3: User Feedback as Reward

**What:** When the user says "good job" or "that's wrong" in chat, record it as a reward signal on the most recent trajectory.

**How:**
```
User message in chat
    ↓ sentiment detection (simple keyword: "good", "wrong", "fix", "perfect")
    ↓ or explicit thumbs up/down button on agent messages
Map to most recent trajectory_id
    ↓ store as TrajectoryScore with source "operator-feedback"
Used in DPO pair construction with higher weight
```

**This is critical.** RL without human feedback is unsupervised. The user's judgment is the gold-standard reward signal. Making it effortless (one-click thumbs up/down) means we collect high-quality preference data passively.

### Phase 4: Local LoRA Fine-Tuning

**What:** Weekly batch training produces a LoRA adapter that improves the local model.

**Hardware:** M4 Max 128GB can train QLoRA on 7B-14B models comfortably.

**Framework:** MLX-LM-LoRA for Apple Silicon native training.

**How:**
```
.cadet/training/dpo_pairs.jsonl (500+ pairs)
    ↓ MLX-LM-LoRA DPO training
    ↓ ~30-60 minutes on M4 Max for 7B model
.cadet/models/cadet-lora-v{N}.safetensors (~100MB)
    ↓ hot-swap into local inference engine
Next agent run uses improved model
```

**Desktop UX:** "Training" panel in Settings. Shows:
- Trajectory count, scored count, DPO pair count
- "Train Now" button (starts background training)
- Training progress bar
- Adapter version history with A/B comparison
- "Active Adapter" selector

### Phase 5: Local Inference (Hybrid Local/Cloud)

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

**Framework:** `mistral.rs` running locally as an OpenAI-compatible server. The web server's existing code can switch between `http://localhost:8080` (local) and the AI Gateway (cloud) with a URL change.

**Desktop UX:** Settings slider: "Local ↔ Cloud". Cost dashboard showing estimated savings. Model indicator in chat showing which model generated each response.

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
- Real-time SpacetimeDB state
- Trajectory logging with TOON encoding
- Local GPU-accelerated scoring and training
- Self-improving LoRA adapters
- All running on a single M4 Max with no cloud dependency

Hermes has some self-improvement (GEPA, Atropos) but requires cloud infrastructure for RL training. Cadet does it locally.

---

## Implementation Roadmap

### Now (With Desktop Rebuild)
- Add thumbs up/down buttons on agent messages in chat view
- Display trajectory quality trends in run detail view
- Show "Learnings" section in run output (already extracted by learnStep)

### Phase 1 (After Desktop Works): Local Embeddings
- Add `fastembed-rs` to Cargo.toml
- Replace OpenAI embedding calls with local generation
- Build local vector index for memory search
- **Effort: 2-3 days**

### Phase 2: Local Scoring
- Add `llama-cpp-2` with Metal support
- Download Qwen3-4B-Q4 as the judge model
- Score trajectories in background as they arrive via subscription
- Add `trajectory_score` table to SpacetimeDB
- **Effort: 1 week**

### Phase 3: DPO Training
- Build trajectory → JSONL exporter
- Build DPO pair constructor (embedding similarity + quality ranking)
- Integrate MLX-LM-LoRA via Python subprocess
- Add training UI to Settings
- **Effort: 2 weeks**

### Phase 4: Hybrid Local/Cloud
- Set up `mistral.rs` as local inference server
- Build complexity router (simple → local, complex → cloud)
- Add local/cloud slider to Settings
- Cost dashboard
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
// Trajectory quality scores from local LLM judge
#[table(accessor = trajectory_score, public)]
pub struct TrajectoryScore {
    #[primary_key]
    score_id: String,
    #[index(btree)]
    trajectory_id: String,
    correctness: f32,
    efficiency: f32,
    tool_use_quality: f32,
    adherence: f32,
    composite: f32,
    judge_model: String,
    judge_reasoning: String,
    source: String,  // "llm-judge" | "operator-feedback"
    created_at_micros: i64,
}

// Training run records
#[table(accessor = training_run, public)]
pub struct TrainingRun {
    #[primary_key]
    training_id: String,
    base_model: String,
    adapter_path: String,
    method: String,  // "dpo" | "grpo" | "sft"
    trajectory_count: u32,
    pair_count: u32,
    epochs: u32,
    final_loss: f32,
    duration_seconds: u32,
    status: String,  // "running" | "completed" | "failed"
    created_at_micros: i64,
}
```
