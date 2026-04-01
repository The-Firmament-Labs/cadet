# Cadet Competitive Strategy

## Where We Must Be Competitive (Table Stakes)

These 8 patterns are universal across ALL 14 analyzed products. Without them, users won't consider Cadet:

| Pattern | Status | Gap |
|---------|--------|-----|
| Chat that streams and renders markdown | Backend done, desktop broken | Rewrite ai_chat.rs |
| Plan-before-execute with approval gates | 7-stage workflow exists | Not visualized in desktop |
| Transparent agent work (step logs) | SpacetimeDB has all data | Not surfaced |
| @ context injection | Built in web tools | Not in desktop composer |
| Conversation history with search | SpacetimeDB chat_message | Not surfaced |
| Model/provider selection | 8 models, 4 strategies | Not surfaced |
| Dark mode default | Orbital theme exists | Needs desktop dark mode CSS |
| ⌘K command palette | Exists, works | Needs more actions |

## Where We Differentiate (Nobody Else Has This)

### Tier 1: Ship in the Desktop Rebuild

| Feature | SpacetimeDB Advantage | Implementation |
|---------|----------------------|---------------|
| **Zero-loading-state navigation** | All data in client RAM cache | Per-table Dioxus signals |
| **Quasar Beam (live workflow viz)** | Push-based step/tool updates | Subscribe to workflow_step + tool_call_record |
| **Magnetar (instant approvals)** | Bidirectional reducers over WS | Already exists — just surface it |
| **Stargate (any-surface spawning)** | Cross-client identity | Already works — web/desktop/CLI share state |
| **Database Inspector (free)** | Client cache = browsable data | Read from existing cache, no new queries |

### Tier 2: Build After Desktop Works

| Feature | SpacetimeDB Advantage | Effort |
|---------|----------------------|--------|
| **Pulsar Trace (timeline replay)** | trajectory_log + TOON encoding + client cache | Medium — subscribe to trajectory, build scrubber |
| **Redshift (cross-platform continuity)** | 4-layer message bus + entity resolution | Medium — wire existing tables |
| **Nebula Memory (shared knowledge)** | Namespace subscriptions across agents | Small — already partially works |

### Tier 3: Strategic Long-Term

| Feature | SpacetimeDB Advantage | Effort |
|---------|----------------------|--------|
| **Orbital Sync (multi-agent consciousness)** | Filtered subscriptions + SharedDiscovery table | Large — new table + agent-side subscription |
| **Dark Matter (passive learning)** | Reducer callbacks + trajectory analysis | Large — new learning agent process |
| **Event Horizon (conditional triggers)** | SQL subscription invalidation | Medium — new trigger table + orchestrator |
| **Gravity Well (auto-swarming)** | Cross-table reactive queries | Large — scheduling logic |

## What I (Claude) Can Do to Ensure This

### Immediate (Desktop Rebuild)
1. **Rewrite live.rs** — per-table Dioxus signals instead of monolithic snapshot. This is the foundation everything else depends on.
2. **Build web_client.rs** — HTTP client for localhost:3001 with session token auth. Wraps all API endpoints.
3. **Rewrite ai_chat.rs** — Full Claude Desktop-quality chat with streaming, tool cards, conversation sidebar, @ references.
4. **Surface what exists** — The approval system, workflow visualization, memory explorer, and agent dispatch all have working backends. Wire them to real SpacetimeDB signals.

### Quality Guarantees
1. **Every view works with live data** — no sample/mock data paths in the final product
2. **Every action calls a real backend** — no stub buttons, no "coming soon"
3. **Real-time updates everywhere** — navigation between views is instant (data already cached)
4. **Test by using it** — dispatch a real agent, approve a real request, search real memory

### Architecture Principles
1. **SpacetimeDB for reads, Web server for writes** — reads from client cache (0ms), mutations via reducers or HTTP
2. **Per-table signals** — each table update only rerenders the views that use it
3. **Targeted subscriptions** — subscribe to what the current view needs, not everything
4. **Reuse existing web API** — don't duplicate logic in Rust, call localhost:3001

## Product Positioning

```
                    ┌───────────────────────────┐
                    │  Full Agent Orchestration  │
                    │  Multi-agent, real-time    │
                    ├─────────────┬─────────────┤
        Cloud-only  │   Devin     │   CADET     │  Local + Cloud
        Expensive   │   Factory   │   Desktop   │  Free/open
                    │             │             │
                    ├─────────────┼─────────────┤
                    │   Cursor    │   Hermes    │
        Single IDE  │   Windsurf  │   Aider     │  Terminal/CLI
        Single agent│   Cline     │   Codex     │  Single agent
                    └─────────────┴─────────────┘
                    Light agent           Deep agent
                    integration           platform
```

Cadet occupies the **top-right quadrant**: full orchestration, local + cloud, with SpacetimeDB as the differentiating real-time data layer. No one else is here.

## Recommended Feature Priority for Next Build

1. Fix live.rs (per-table signals) — **FOUNDATION**
2. Chat that works with streaming — **CORE LOOP**
3. Overview with live workflow viz (Quasar Beam) — **DIFFERENTIATION**
4. Instant approvals surfaced everywhere (Magnetar) — **DIFFERENTIATION**
5. Database inspector (free from cache) — **UNIQUE**
6. Terminal + local agent execution — **TABLE STAKES**
7. Agent builder + dispatch — **TABLE STAKES**
8. Timeline replay (Pulsar Trace) — **DIFFERENTIATION**
9. Settings with auth providers — **TABLE STAKES**
10. Cross-platform continuity (Redshift) — **DIFFERENTIATION**
