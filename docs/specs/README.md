# Cadet Desktop — Atomic Spec Deck Index

## How to Use This

Each spec is a standalone document that can be executed independently. Specs have dependencies listed — don't start a spec until its dependencies are complete.

**Execution rules:**
- Each implementation step within a spec = one git commit
- Each commit must leave the app in a buildable, runnable state
- Never skip the regression tests
- Mark the spec as "Complete" when ALL checkboxes are checked
- Create one PR per spec

**Build command:** `cargo build --bin starbridge-dioxus-ui --features desktop-ui`
**Run command:** `cargo run --bin starbridge-dioxus-ui --features desktop-ui`
**Web server:** `cd apps/web && bun run dev` (needed for chat, journal, skills APIs)

---

## Build Sequence

### Phase 1: Foundation (must be first)

| Spec | Title | Depends On | Effort | Status |
|------|-------|-----------|--------|--------|
| [001](001-live-data-layer.md) | Live Data Layer (per-table signals) | None | Medium | Not Started |
| [002](002-web-client.md) | Web Client (HTTP to localhost:3001) | None | Small | Not Started |

### Phase 2: Primary Views (the core product)

| Spec | Title | Depends On | Effort | Status |
|------|-------|-----------|--------|--------|
| [003](003-chat-view.md) | Chat View (Claude Desktop quality) | 001, 002 | Large | Not Started |
| [004](004-terminal-view.md) | Terminal + Local Agent Execution | None | Large | Not Started |
| [005](005-database-inspector.md) | Database Inspector (SpacetimeDB browser) | 001 | Medium | Not Started |
| [006](006-settings-view.md) | Settings View | 002 | Small | Not Started |

### Phase 3: Data Views (surface everything)

| Spec | Title | Depends On | Effort | Status |
|------|-------|-----------|--------|--------|
| [007](007-journal-view.md) | Mission Journal Editor | 002 | Small | Not Started |
| [008](008-skills-view.md) | Skills Directory + Creator | 002 | Small | Not Started |
| [009](009-logs-view.md) | Unified Logs & Audit View | 001 | Medium | Not Started |
| [010](010-heartbeat-view.md) | Heartbeat / Cron Monitor | 001 | Small | Not Started |

### Phase 4: Existing View Updates

| Spec | Title | Depends On | Effort | Status |
|------|-------|-----------|--------|--------|
| [011](011-overview-signals.md) | Overview → Per-Table Signals | 001 | Small | Not Started |
| [012](012-agents-builder.md) | Agents View + Builder | 001, 002 | Medium | Not Started |
| [013](013-runs-detail.md) | Runs Detail + Pipeline Viz | 001 | Medium | Not Started |

### Phase 5: Polish

| Spec | Title | Depends On | Effort | Status |
|------|-------|-----------|--------|--------|
| [014](014-navigation-palette.md) | Navigation + Command Palette | All views | Small | Not Started |
| [015](015-style-polish.md) | Dark Mode + Animations + Polish | All views | Medium | Not Started |

### Phase 6: Advanced Features (SpacetimeDB differentiators)

| Spec | Title | Depends On | Effort | Status |
|------|-------|-----------|--------|--------|
| [016](016-trajectory-scoring.md) | Trajectory Scoring (LLM-as-Judge) | 001, 013 | Medium | Not Started |
| [017](017-local-embeddings.md) | Local Embeddings (fastembed-rs) | 001 | Small | Not Started |
| [018](018-quasar-beam.md) | Quasar Beam (Live Workflow Viz) | 001, 013 | Medium | Not Started |
| [019](019-inference-server.md) | cadet-inference-server (Remote ML) | 006 | Large | Not Started |

---

## Dependency Graph

```
                    ┌─────┐     ┌─────┐
                    │ 001 │     │ 002 │
                    │Live │     │ Web │
                    │Data │     │Client│
                    └──┬──┘     └──┬──┘
                       │           │
          ┌────────────┼───────────┼────────────┐
          │            │           │            │
       ┌──▼──┐     ┌──▼──┐    ┌──▼──┐     ┌──▼──┐
       │ 003 │     │ 005 │    │ 006 │     │ 004 │
       │Chat │     │ DB  │    │Sets │     │Term │
       └──┬──┘     └──┬──┘    └──┬──┘     └─────┘
          │           │          │
          │        ┌──▼──┐   ┌──▼──┐
          │        │ 009 │   │ 007 │
          │        │Logs │   │Jrnl │
          │        └─────┘   └─────┘
          │                  ┌──▼──┐
          │                  │ 008 │
          │                  │Skill│
          │                  └─────┘
       ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
       │ 011 │  │ 012 │  │ 013 │
       │ OvW │  │Agnts│  │Runs │
       └─────┘  └─────┘  └──┬──┘
                            │
                    ┌───────┼───────┐
                    │       │       │
                 ┌──▼──┐ ┌─▼──┐ ┌──▼──┐
                 │ 016 │ │018 │ │ 010 │
                 │Score│ │Beam│ │Heart│
                 └─────┘ └────┘ └─────┘

       ┌─────────────────────────────────┐
       │     014 Navigation + Palette     │
       │     015 Style + Dark Mode        │
       │     (After ALL views exist)      │
       └─────────────────────────────────┘

       ┌─────────────────────────────────┐
       │     017 Local Embeddings         │
       │     019 Inference Server         │
       │     (Independent, any time)      │
       └─────────────────────────────────┘
```

## Parallel Execution

These specs can run in parallel (no dependencies between them):
- **001 + 002 + 004**: Foundation + web client + terminal (all independent)
- **005 + 006 + 007 + 008**: After 001/002, these 4 are independent
- **009 + 010 + 011 + 012 + 013**: After 001, these 5 are independent
- **016 + 017 + 018**: After 001 + 013, these 3 are independent

## Total Scope

| Metric | Count |
|--------|-------|
| Spec decks | 19 |
| New Rust files | ~15 |
| Modified Rust files | ~8 |
| New SpacetimeDB tables | 2 (trajectory_score, training_run) |
| New Cargo dependencies | 4 (reqwest, portable-pty, fastembed, llama-cpp-2) |
| Estimated total effort | 6-8 weeks for one developer |
