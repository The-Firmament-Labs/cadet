# Prompt System

## Overview

Agent prompts in Cadet are TOON-encoded — a whitespace-indented format that produces ~40% fewer tokens than equivalent JSON for the same structured data. Every prompt is assembled from a `PromptData` struct containing up to 12 pre-fetched context sections (identity, mission, thread history, memory, tools, etc.), which are priority-ordered and greedily packed into a configurable token budget. The Rust context engine sidecar (`starbridge-core`) handles encoding and budget management; the TypeScript layer either delegates to the sidecar or falls back to a plain-text composer when the sidecar is unavailable.

---

## TOON Encoding

Three functions handle all encoding. Source: `rust/starbridge-core/src/context_engine.rs`.

| Function | Output shape | Quoting rule |
|---|---|---|
| `encode_object(fields)` | `key: value\n` per pair | Quotes values containing `:`, `"`, `\`, `\n`, `\t`, `[`, `]`, `{`, `}`, booleans, numbers, or empty strings |
| `encode_table(key, fields, rows)` | `key[N]{f1,f2}:\n  v1,v2\n` | Quotes cell values containing `,`, `"`, or empty |
| `encode_nested(key, fields)` | `key:\n  k: v\n` per pair | Same quoting rules as `encode_object` |

**Example — TOON vs JSON**

TOON (14 tokens estimated):
```
agent:
  id: saturn
  runtime: edge-function
  namespace: operations
```

Equivalent JSON (21 tokens estimated):
```json
{"agent":{"id":"saturn","runtime":"edge-function","namespace":"operations"}}
```

Note that `"true"`, `"42"`, and `""` all require quoting in TOON because they would otherwise be ambiguous with native booleans, numbers, or missing values.

---

## Token Budget Management

All functions in `rust/starbridge-core/src/context_engine.rs`.

- **`estimate_tokens(text)`** — rough estimate: `(len + 3) / 4` (approximates ~4 chars per token for English prose).
- **`ContextFragment`** — wraps a named content string with its pre-computed token cost: `{ source: String, content: String, tokens: u32 }`.
- **`fit_to_budget(fragments, budget)`** — greedy first-fit: iterates fragments in priority order, includes each fragment if it fits within the remaining budget. Fragments that don't fit are skipped (not truncated).
- **`assemble(fragments)`** — joins fitted fragments with a single newline separator.
- **Default budget** — 4,000 tokens, set by the `tokenBudget` parameter default in `toPromptData()` (TypeScript side). Can be overridden by passing a 4th argument.

---

## PromptData — 12 Automatic Variables

The `PromptData` struct (Rust) / interface (TypeScript) carries all pre-fetched context. The caller queries SpacetimeDB and populates this; the engine only encodes.

| Field | Source | Example value |
|---|---|---|
| `agent_id` | `AgentManifest.id` | `saturn` |
| `agent_name` | `AgentManifest.name` | `Saturn` |
| `agent_runtime` | `AgentManifest.runtime` | `edge-function` |
| `namespace` | `AgentManifest.memory.namespace` | `operations` |
| `system_prompt` | `AgentManifest.system` | `You are an operations agent.` |
| `run_id` | `NormalizedJobRequest.jobId` | `run_01` |
| `goal` | `NormalizedJobRequest.goal` | `Triage the deploy incident` |
| `priority` | `NormalizedJobRequest.priority` | `high` |
| `current_stage` | `enrichment.currentStage` (default: `route`) | `verify` |
| `requested_by` | `NormalizedJobRequest.requestedBy` | `dex` |
| `sender_name / sender_channel / sender_entity_id` | Enrichment (optional) | `Dex`, `slack`, `ent_abc` |
| `thread_history` | Enrichment — recent messages | `[{sender, text, timestamp_micros}]` |
| `memory_chunks` | Enrichment — vector search results | `[{title, content, similarity}]` |
| `previous_step_output` | Enrichment (optional) | `Health check returning 503` |
| `recent_trajectories` | Enrichment — last N steps | `[{stage, success, duration_ms}]` |
| `active_routes` | Enrichment — agent's message routes | `[{channel, filter}]` |
| `tools` | Derived from `getAgentTools(manifest)` | `[{name, category, requires_approval}]` |
| `loadable_prompts` | `manifest.prompts` (system + personality + stages) | `["system/core.md", "agents/saturn.md"]` |
| `token_budget` | 4th arg to `toPromptData()` | `4000` |

---

## Priority Order

`build_prompt()` appends fragments in this order. Earlier fragments survive tight budgets; later ones are dropped first.

1. Agent identity (`agent_id`, `agent_name`, `agent_runtime`, `namespace`) — always included
2. System prompt — included if non-empty
3. Mission (`run_id`, `goal`, `priority`, `current_stage`, `requested_by`)
4. Sender context (`sender_name`, `sender_channel`, `sender_entity_id`) — included if present
5. Thread history — TOON table, included if non-empty
6. Memory chunks — TOON table, included if non-empty
7. Tools — TOON table, included if non-empty
8. Previous step output — included if present
9. Recent trajectories — TOON table, included if non-empty
10. Active routes — TOON table, included if non-empty
11. Loadable prompts — comma-separated list, included if non-empty

---

## TypeScript Bridge

Source: `packages/core/src/prompt.ts`

### `toPromptData(manifest, job, enrichment?, tokenBudget?)`

Converts an `AgentManifest` + `NormalizedJobRequest` into a `PromptData` object. Accepts an optional `enrichment` bag for runtime context (thread history, memory, sender info, etc.) and an optional `tokenBudget` (default `4000`). Calls `getAgentTools(manifest)` to derive the tools list.

### `buildToonPrompt(data, manifest, job)`

Primary entry point. Posts `data` as JSON to `${STARBRIDGE_URL}/api/prompt/build` with a 2-second timeout. If the sidecar responds `200 OK`, returns its text output (TOON-encoded). On any error or non-OK response, falls back to `composeRuntimePrompt(manifest, job)`.

### `composeRuntimePrompt(manifest, job)`

Pure TypeScript fallback. Produces a plain-text prompt with Markdown section headers (`# Identity`, `# Mission`, `# Capabilities`, `# Available Tools`, etc.). Does not apply TOON encoding or token budget management — used only when the Rust sidecar is unavailable.

---

## Trajectory Logging

`TrajectoryEntry` shape (Rust struct, matches the `trajectory_log` SpacetimeDB table):

| Field | Type | Description |
|---|---|---|
| `run_id` | `String` | Workflow run identifier |
| `step_id` | `String` | Step within the run |
| `agent_id` | `String` | Agent that executed the step |
| `stage` | `String` | Stage name (e.g. `route`, `verify`, `act`) |
| `instruction` | `String` | The instruction given to the agent |
| `context_toon` | `String` | Full TOON-encoded context at execution time |
| `output` | `String` | Agent's output text |
| `tool_calls` | `Vec<ToolCallEntry>` | Tools invoked during the step |
| `success` | `bool` | Whether the step completed successfully |
| `duration_ms` | `u64` | Wall-clock execution time |
| `timestamp_micros` | `i64` | Unix timestamp in microseconds |

Trajectories are encoded as TOON via `encode_trajectory()` for compact storage. The `context_toon` field preserves the exact prompt context that produced each output, making trajectories directly usable as SFT/RL training data for agent self-improvement.

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `STARBRIDGE_URL` | `http://localhost:3020` | Rust context engine sidecar URL used by `buildToonPrompt()` |

---

## Source Files

- Rust encoding + budget management: `rust/starbridge-core/src/context_engine.rs`
- TypeScript bridge: `packages/core/src/prompt.ts`
