# TOON Prompt Builder + SpacetimeDB Multi-Agent Subscriptions

**Date:** 2026-03-28
**Status:** Completed (2026-03-28)

---

## Vision

Build a system prompt assembler that:
1. Uses TOON encoding for ~40% fewer tokens
2. Automatically fills variables from SpacetimeDB state
3. Packs maximum context into minimum token budget
4. Leverages SpacetimeDB multi-subscriber architecture for multi-agent coordination

## SpacetimeDB Multi-Agent Subscriptions

### How it works

SpacetimeDB v2 subscriptions are SQL-based. Any client can subscribe to any table with a WHERE filter:

```rust
// Saturn subscribes to messages routed to it
subscribe!("SELECT * FROM raw_message WHERE status = 'received'");
subscribe!("SELECT * FROM message_route WHERE target_agent_id = 'saturn'");

// Voyager subscribes to the SAME tables with different filters
subscribe!("SELECT * FROM raw_message WHERE status = 'received'");
subscribe!("SELECT * FROM message_route WHERE target_agent_id = 'voyager'");

// Both see the same RawMessage insert in real-time
// The message_route table determines who acts on it
```

### Multi-agent patterns to implement

1. **Shared inbox**: All agents subscribe to `raw_message`. MessageRoute determines who owns it.
2. **Collaborative workflows**: Agent A creates a WorkflowStep for Agent B. B's subscription fires.
3. **Memory sharing**: Agents can query each other's namespaces via `memory_document`.
4. **Entity dedup**: All agents share the same `message_entity` table — one identity graph.
5. **Trajectory learning**: Agent A's trajectories are visible to Agent B for cross-agent learning.

### Subscription topology

```
SpacetimeDB
├── raw_message ──────► Saturn (ops), Voyager (research), Dashboard (display)
├── workflow_step ────► Saturn (own steps), Voyager (own steps), Dashboard
├── approval_request ─► Dashboard (all), Saturn (own), Voyager (own)
├── message_entity ───► All agents (shared identity graph)
├── trajectory_log ───► Training pipeline (batch export)
└── memory_document ──► Each agent (own namespace), cross-query for collaboration
```

## TOON Prompt Builder

### Architecture

```
AgentManifest
  + SpacetimeDB state queries (automatic)
  + .cadet/prompts/ files (on demand)
  + MessageEntity context (who am I talking to)
  + Recent RawMessages (conversation history)
  + Memory chunks (relevant prior knowledge)
  ↓
Rust context_engine::build_prompt()
  ↓
TOON-encoded prompt string (40% fewer tokens)
  ↓
LLM API call
```

### Automatic Variables

The prompt builder queries SpacetimeDB and fills these automatically:

| Variable | Source | Example |
|----------|--------|---------|
| `{agent.name}` | AgentRecord | Saturn |
| `{agent.runtime}` | AgentRecord | edge-function |
| `{run.goal}` | WorkflowRun | Triage the deploy incident |
| `{run.stage}` | WorkflowRun | verify |
| `{sender.name}` | MessageEntity | Dex |
| `{sender.channel}` | RawMessage | slack |
| `{thread.history}` | RawMessage[] | Last 5 messages TOON-encoded |
| `{memory.relevant}` | MemoryChunk[] | Top 4 chunks by similarity |
| `{entity.context}` | MessageEntity | Known user preferences, past interactions |
| `{routes.active}` | MessageRoute[] | Which channels this agent monitors |
| `{step.previous}` | WorkflowStep | Previous step output for continuity |
| `{trajectory.recent}` | TrajectoryLog[] | Last 3 trajectory entries |

### TOON-encoded prompt structure

```toon
agent:
  id: saturn
  name: Saturn
  runtime: edge-function
  namespace: operations

mission:
  goal: Triage the deploy incident
  priority: high
  stage: verify
  requested_by: dex

sender:
  name: Dex
  channel: slack
  entity_id: ent_abc123

thread_history[3]{sender,text,ts}:
  dex,Deploy looks broken on prod,1711612800
  saturn,Checking deployment status,1711612860
  dex,The health check is failing,1711612920

memory_context[2]{title,content}:
  Previous deploy incident,Rolled back v2.3.1 due to OOM in edge function
  Deploy checklist,Always check health endpoint before promoting

tools[8]{name,category}:
  query_memory,context
  browse,browser
  vercel_logs,platform
  create_approval,state
  query_state,state
  screenshot,browser
  dex_search,crypto
  post_message,communication
```

### Implementation steps

1. Add `build_prompt()` to `rust/starbridge-core/src/context_engine.rs`
   - Takes: agent_id, run_id, step_id
   - Queries SpacetimeDB for all automatic variables
   - Loads manifest prompts from filesystem
   - Encodes everything as TOON
   - Fits to token budget

2. Add SpacetimeDB subscription helpers to `rust/starbridge-core/src/subscriptions.rs`
   - Per-agent subscription builder
   - Shared table subscriptions with agent-specific filters
   - Callback dispatching when subscribed rows change

3. Update `packages/core/src/prompt.ts` to call the Rust builder (via HTTP or WASM)
   - Falls back to the current TS prompt builder if Rust is unavailable

4. Test with both Saturn and Voyager subscribing to the same tables simultaneously

## Key Insight

SpacetimeDB replaces:
- Message queue (RabbitMQ, SQS) → subscription pushes
- Pub/sub (Redis, NATS) → table subscriptions with SQL filters
- Identity service → MessageEntity table
- Embedding store → MessageEmbeddingRecord table
- Conversation store → RawMessage + ConversationLink
- Agent coordination → shared WorkflowStep table
- Training data pipeline → TrajectoryLog table

One database. Real-time. Multiplayer. No infrastructure to manage.
