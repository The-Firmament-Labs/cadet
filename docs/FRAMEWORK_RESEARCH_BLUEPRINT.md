# Cadet Framework Research and Rust-Native Blueprint

Date: 2026-03-27

## 1. Executive Summary

Cadet should not become a Rust port of any one donor repo. The right direction is a typed, event-driven Rust kernel with narrow extension seams, durable workflow state in SpacetimeDB, runner-local memory/index support where needed, and thin TS operator/control surfaces on top.

Strongest ideas by repo:

- `openclaw`: context engine lifecycle, gateway/control-plane architecture, session identity, plugin runtime facades, durable cron/workflow orchestration.
- `hermes-agent`: tool registry and toolset policy, pragmatic session persistence, FTS-backed recall, safe parallel tool execution heuristics, cron independence from chat UI.
- `eliza`: typed plugin/service/adapter concepts, runtime composition, explicit action/provider/evaluator separation.
- `doolittle`: deferred hydration and explicit run-progress tracking.

Biggest weaknesses by repo:

- `openclaw`: API sprawl, huge subsystem count, one-user trust assumptions baked into product shape.
- `hermes-agent`: giant orchestrator files, feature accretion, too much prompt-coupled behavior.
- `eliza`: oversized runtime core, overlapping autonomy/planning/memory layers, docs drift from reality.
- `doolittle`: too much shell-over-Eliza behavior, not enough repo-native substrate.

Recommended overall Rust direction:

- Preserve Cadet’s current shape: TS control planes + Rust execution core + SpacetimeDB control fabric.
- Make Rust the source of truth for runtime, tools, workflows, memory policy, approvals, and observability.
- Use SpacetimeDB for distributed run/step/task state and SQLite/FTS5 only for optional runner-local transcript/cache/index responsibilities.
- Treat MCP and A2A as interoperability adapters, not internal architecture.

## 2. Repo-by-Repo Deep Audit

### 2.1 Doolittle

#### Actual architecture overview

Real center of gravity is `packages/agent`, not a broad platform substrate. Key files:

- `doolittle/packages/agent/src/runtime/bootstrap.ts`
- `doolittle/packages/agent/src/runtime/chat.ts`
- `doolittle/packages/agent/src/services/index.ts`
- `doolittle/packages/agent/src/services/run-controller-service.ts`
- `doolittle/packages/agent/src/services/cron-service.ts`
- `doolittle/packages/agent/src/gateway/gateway-runner.ts`

It is effectively a Bun-first product shell that assembles an Eliza runtime, wraps it in service modules, then layers gateway, cron, diagnostics, and operator UX on top.

#### Subsystem map

- Runtime bootstrap and deferred hydration
- Chat loop bridge into Eliza runtime
- Service registry
- Run controller
- MCP service
- Skills service
- Cron service
- Gateway runner

#### Runtime model

Message handling routes through `runtime.messageService.handleMessage(...)` with depth heuristics and multi-step settings. This is not a fully repo-owned kernel; it is mostly orchestration around Eliza runtime semantics.

#### Memory / tool / plugin / task model

- Memory/planning largely inherited from Eliza flags and plugin assembly.
- MCP is practical but thin-shell.
- Skills are filesystem/catalog driven.
- Cron is simple JSON-backed scheduling.
- Plugin composition exists, but the durable contracts belong more to Eliza than to Doolittle.

#### Strengths

- Good startup shape: boot fast, hydrate heavy systems later.
- Useful run-controller abstraction with configured vs observed progress.
- Service registry is understandable.

#### Weaknesses

- `runtime/chat.ts` and `server.ts` are god-files.
- Core abstractions are not strongly repo-owned.
- Useful product shell, weak framework substrate.

#### Legacy / slop / problematic areas

- Thin wrappers over external runtime behavior.
- Large orchestration files.
- Too much architecture gravity around one package.

#### Concepts worth extracting

- Deferred hydration
- Run snapshot model
- Service registration/lazy attachment

#### Concepts not worth carrying forward

- External runtime dependence as Cadet’s core
- Large integration shells
- MCP as mostly command wrapping

### 2.2 OpenClaw

#### Actual architecture overview

`openclaw` is the strongest donor for framework-grade concepts. Key files:

- `openclaw/src/gateway/server.impl.ts`
- `openclaw/src/context-engine/types.ts`
- `openclaw/src/context-engine/init.ts`
- `openclaw/src/plugins/runtime/index.ts`
- `openclaw/src/plugins/loader.ts`
- `openclaw/src/agents/pi-embedded-runner/run.ts`
- `openclaw/src/cron/service.ts`
- `openclaw/src/cron/service/ops.ts`
- `openclaw/src/gateway/server-cron.ts`

Real architecture is gateway-centric with a repo-owned session/control plane, plugin runtime, context engine abstraction, cron/workflow machinery, and embedded runner.

#### Subsystem map

- Gateway bootstrap and control plane
- Embedded runner
- Context engine lifecycle
- Plugin loader/runtime facade
- Session model
- Cron/workflow orchestration
- Channel and node adapters
- Memory plugin/runtime surfaces

#### Runtime model

A run is not just “one chat completion.” The system manages active runs, queueing, aborts, retries, context assembly, channel delivery, and session-bound execution across a gateway fabric.

#### Memory / tool / plugin / task model

- Memory is a real subsystem with startup, plugin state restoration, and retrieval surfaces.
- Tools are repo-owned and broad.
- Plugin runtime exposes formal facades (`config`, `agent`, `subagent`, `system`, `media`, `events`, `logging`, `state`).
- Cron is durable and isolated enough to be reused as Cadet’s workflow donor.

#### Strengths

- Best context lifecycle model of the set.
- Best plugin runtime boundary.
- Best session/control-plane treatment.
- Best durable workflow/cron concept.
- Strong production/security posture.

#### Weaknesses

- Massive scope.
- Plugin SDK is broader than it should be.
- Product complexity can leak into framework decisions.

#### Legacy / slop / problematic areas

- API/export sprawl.
- Dense bootstrap logic.
- Still has large run files.

#### Concepts worth extracting

- Context engine trait shape
- Session-keyed runtime model
- Plugin runtime facades
- Workflow/cron queueing and ownership
- Explicit trust model as architecture input

#### Concepts not worth carrying forward

- Channel explosion as core framework concern
- Broad plugin SDK surface
- One-user trust assumptions as default Cadet stance

### 2.3 Eliza

#### Actual architecture overview

Current repo reality is runtime-library first, centered in `packages/typescript`, not the older README server/client/core picture. Key files:

- `eliza/packages/typescript/src/runtime.ts`
- `eliza/packages/typescript/src/services/message.ts`
- `eliza/packages/typescript/src/types/plugin.ts`
- `eliza/packages/typescript/src/plugin.ts`
- `eliza/packages/typescript/src/advanced-memory/services/memory-service.ts`
- `eliza/packages/typescript/src/advanced-planning/services/planning-service.ts`
- `eliza/packages/typescript/src/autonomy/service.ts`

#### Subsystem map

- Agent runtime
- Message service
- Plugin system
- DB adapter
- Advanced memory
- Advanced planning
- Autonomy service
- Runtime composition

#### Runtime model

Pipeline style:

1. compose state
2. preprocess attachments
3. decide whether to respond
4. generate response
5. persist memory
6. execute actions

Good for a library runtime, but too centralized for Cadet if copied directly.

#### Memory / tool / plugin / task model

- Plugin contract is rich and typed.
- DB adapter abstraction is useful.
- Memory exists as base plus advanced memory plugin/service.
- Planning/autonomy exist, but overlap and are not canonicalized into one executor.

#### Strengths

- Best typed extension vocabulary.
- Good separation of actions, providers, evaluators, services, routes, models.
- Useful runtime composition concepts.

#### Weaknesses

- `runtime.ts` is too large.
- `services/message.ts` is too large.
- Planning/autonomy/memory overlap.
- README architecture is stale relative to actual source.

#### Legacy / slop / problematic areas

- Runtime god-object.
- Plugin auto-install behavior is sloppy for production.
- Too much mutable extension surface.

#### Concepts worth extracting

- Typed plugin capability model
- DB adapter abstraction
- Runtime composition/dedupe ideas
- Explicit provider/action/evaluator split

#### Concepts not worth carrying forward

- Runtime centralization
- Auto-install behavior
- Multiple overlapping “brains” inside one runtime

### 2.4 Hermes Agent

#### Actual architecture overview

`hermes-agent` is the most operationally real system in the set. Key files:

- `hermes-agent/run_agent.py`
- `hermes-agent/tools/registry.py`
- `hermes-agent/model_tools.py`
- `hermes-agent/toolsets.py`
- `hermes-agent/hermes_state.py`
- `hermes-agent/gateway/run.py`
- `hermes-agent/gateway/session.py`
- `hermes-agent/cron/scheduler.py`

It is a Python monolith, but it has practical systems ideas Cadet should reuse conceptually.

#### Subsystem map

- Main agent loop
- Tool registry/toolsets
- Session database
- Gateway runtime
- Cron scheduler
- Skill system
- Honcho-backed user modeling

#### Runtime model

The agent loop is a continuous tool-using conversation engine with context restoration, prompt caching, memory flush, tool batching, interrupts, and cross-session recall.

#### Memory / tool / plugin / task model

- Tool registry is a strong central abstraction.
- Toolsets are policy-shaped capability bundles.
- SQLite/FTS5 transcript/session recall is pragmatic and effective.
- Memory is multi-layered, though conceptually sprawling.
- Cron is independent enough to influence Cadet’s background workflow model.

#### Strengths

- Strong tool policy model.
- Strong local persistence and recall.
- Practical cron and sessioning.
- Real test breadth and operational behaviors.

#### Weaknesses

- `run_agent.py` and `gateway/run.py` are giant monoliths.
- Too many features compete inside one agent class.
- Prompt building is overloaded as the integration layer.

#### Legacy / slop / problematic areas

- Sync/async bridging complexity.
- Too many memory knobs.
- Feature accretion in a monolithic runtime.

#### Concepts worth extracting

- Tool registry
- Toolset policy
- FTS-backed transcript recall
- Safe parallel tool execution metadata
- Session persistence and replay

#### Concepts not worth carrying forward

- Monolithic orchestrator design
- Prompt-coupled system integration
- Too many memory modes in one runtime

## 3. Cross-Repo Concept Matrix

| Area | Doolittle | OpenClaw | Eliza | Hermes | Cadet decision |
| --- | --- | --- | --- | --- | --- |
| Agent runtime | Shell over Eliza | Repo-owned runner + gateway | Library runtime | Monolithic continuous loop | Rust kernel + durable workflow executor |
| Planning | Heuristic multi-step | Workflow/cron oriented | Planning + autonomy overlap | Loop-local planning | One canonical workflow/task executor |
| Memory | Mostly delegated | First-class subsystem | Base + advanced plugin | Practical multi-layer local memory | Layered memory with hard interfaces |
| Tools | Mixed/Eliza-backed | Broad repo-owned tools | Plugin-driven tools/actions | Strong registry/toolsets | Typed tool registry + policy engine |
| Plugins | Product assembly | Runtime facades + loader | Rich typed plugin contract | Less formal plugin story | Narrow versioned capability ABI |
| Workflows | Shallow cron | Strongest durable workflow donor | Some task/autonomy concepts | Cron + delegation patterns | Durable step machine in Rust |
| Coordination | Service shell | Session/control-plane strong | Multi-runtime composition | Gateway/session strong | SpacetimeDB-backed run/step/session coordination |
| Persistence | Some local JSON | Mixed persistent subsystems | Adapter-oriented | SQLite/FTS strong | SpacetimeDB + optional SQLite local store |
| Observability | Good run snapshots | Better ops/security posture | Hooks exist | Logs/tests strong | `tracing` + OTEL + durable audit events |
| Extensibility | Moderate | High but sprawling | High but too broad | Practical but ad hoc | Small traits, stable enums, explicit versions |
| Ergonomics | Good operator shell | Rich product surfaces | Good library ergonomics | Strong CLI/operator experience | TS operator surfaces over Rust kernel |
| Production-readiness | Moderate | High | Moderate | High in practice | Build production boundaries in early |

## 4. Rust Adaptation Blueprint

### 4.1 Target topology

Preserve current Cadet topology:

- `apps/local-control`: local operator/control plane
- `apps/web`: cloud operator/control plane
- `packages/core`, `packages/sdk`, `packages/cli`: TS domain/UI/operator layer
- `spacetimedb`: shared durable control plane
- `rust/*`: runtime, workflows, tools, memory, observability, runner binaries

### 4.2 Recommended crate layout

- `rust/cadet-core-types`
  - IDs, manifests, policy structs, canonical enums, validation
- `rust/cadet-runtime`
  - `AgentKernel`, run state machine, turn executor, approvals, cancellation
- `rust/cadet-context`
  - context engine trait, retrieval packs, compaction, prompt pack assembly
- `rust/cadet-tools`
  - tool trait, metadata, registry, policy gating, execution planner, MCP adapters
- `rust/cadet-memory`
  - transcript store trait, fact store trait, retriever, embedding provider boundary
- `rust/cadet-workflows`
  - workflow templates, step graph, scheduler, replay, retry, leasing
- `rust/cadet-plugins`
  - capability bundles, plugin descriptors, compatibility/version negotiation
- `rust/cadet-observe`
  - tracing, metrics, event sinks, trajectory/audit emitters
- `rust/cadet-runner`
  - worker binaries, execution owners, browser worker, learning worker

Near-term compatibility:

- `starbridge-core` can become a re-export façade or be folded into `cadet-*` crates later.

### 4.3 Core traits

```rust
pub trait AgentKernel {
    async fn start_run(&self, req: RunRequest) -> Result<RunHandle, CadetError>;
    async fn resume_step(&self, step_id: StepId) -> Result<(), CadetError>;
    async fn cancel_run(&self, run_id: RunId, reason: CancelReason) -> Result<(), CadetError>;
}

pub trait ContextEngine {
    async fn bootstrap(&self, ctx: SessionBootstrap) -> Result<BootstrapResult, CadetError>;
    async fn ingest(&self, msg: ContextMessage) -> Result<IngestResult, CadetError>;
    async fn assemble(&self, req: AssembleRequest) -> Result<PromptPack, CadetError>;
    async fn compact(&self, req: CompactRequest) -> Result<CompactionResult, CadetError>;
    async fn after_turn(&self, req: AfterTurnRequest) -> Result<(), CadetError>;
    async fn maintain(&self, req: MaintainRequest) -> Result<MaintenanceResult, CadetError>;
}

pub trait Tool: Send + Sync {
    fn descriptor(&self) -> ToolDescriptor;
    async fn invoke(&self, req: ToolInvocation) -> Result<ToolOutput, ToolError>;
}

pub trait MemoryStore {
    async fn append_transcript(&self, event: TranscriptEvent) -> Result<(), CadetError>;
    async fn store_fact(&self, fact: FactRecord) -> Result<(), CadetError>;
    async fn query(&self, req: RetrievalRequest) -> Result<Vec<RetrievedChunk>, CadetError>;
}

pub trait WorkflowEngine {
    async fn create_run(&self, req: WorkflowRunRequest) -> Result<RunId, CadetError>;
    async fn claim_step(&self, step_id: StepId, owner: ExecutionOwner) -> Result<Claim, CadetError>;
    async fn complete_step(&self, result: StepResult) -> Result<(), CadetError>;
}
```

### 4.4 Core enums and types

- IDs: `AgentId`, `RunId`, `StepId`, `ThreadId`, `SessionId`, `ToolCallId`, `ApprovalId`
- State enums:
  - `RunState { Queued, Ready, Running, WaitingApproval, Blocked, Completed, Failed, Cancelled }`
  - `StepState { Ready, Running, Blocked, Completed, Failed, Cancelled }`
  - `ToolRisk { Low, Medium, High }`
  - `ExecutionOwner { Edge, LocalRunner, ContainerRunner, BrowserWorker, LearningWorker, ExternalAgent }`
- Policy types:
  - `ExecutionPolicy`
  - `ApprovalPolicy`
  - `MemoryPolicy`
  - `RetentionPolicy`
  - `ToolCapability`
  - `ToolProfile`
- Trace/audit types:
  - `RuntimeEvent`
  - `RetrievalTrace`
  - `ToolInvocationRecord`
  - `DeliveryRecord`
  - `ApprovalRecord`

### 4.5 Runtime design

Cadet should be workflow-first, not chat-loop-first.

Execution path:

1. ingress or operator dispatch creates `message_event` and/or `workflow_run`
2. `route` step claims initial responsibility
3. workflow engine expands typed stages
4. context engine builds prompt pack using transcript + retrieval traces
5. tool planner evaluates allowed tools and approval requirements
6. execution owner runs the step
7. results emit durable tool, approval, delivery, retrieval, and memory records
8. terminal or partial completion triggers summary + learn policy

### 4.6 Async model

Use Tokio for all I/O boundaries and structured concurrency.

Async:

- network I/O
- model providers
- MCP clients
- channel adapters
- SpacetimeDB subscriptions
- event streaming

Blocking or bounded-thread execution:

- SQLite access if using blocking drivers
- FTS/indexing if not async-native
- local shell/browser subprocesses
- CPU-heavy embedding transforms if local

Use:

- `tokio::task::JoinSet` for bounded spawned work
- cancellation tokens for run/step cancellation
- timeouts at tool, model, and step levels
- semaphore-based concurrency ceilings by tool capability and owner

### 4.7 Event bus / messaging model

Current `broadcast` bus in `starbridge-core` is too small for the target system. Replace with:

- in-process typed event bus for ephemeral notifications
- SpacetimeDB durable event/state tables as distributed source of truth

Event bus is for local coordination, not durability.

Durable state belongs in SpacetimeDB tables:

- runs
- steps
- tool calls
- approvals
- browser tasks
- delivery attempts
- retrieval traces
- memory document/chunk/embedding metadata

### 4.8 Memory subsystem

Use a layered memory architecture:

1. Transcript memory
   - exact message and artifact history
2. Fact memory
   - durable extracted notes/profile/operational facts
3. Retrieval memory
   - chunks + embeddings + retrieval traces
4. Optional external semantic/user-model adapters
   - future A2A knowledge or Honcho-like profile systems

Rules:

- transcript is append-only
- facts are policy-scoped and reviewable
- retrieval traces are always recorded
- compaction is explicit and replay-safe

### 4.9 Tool subsystem

Use Hermes-style registry plus Rust metadata:

- tool descriptor contains:
  - id
  - version
  - risk level
  - capability tags
  - blocking/async behavior
  - concurrency group
  - approval requirements
  - side-effect class
  - sandbox requirements

Tool policy is separate from tool implementation.

MCP support:

- MCP servers are adapters behind `ToolProvider`
- internal Cadet tools remain native typed tools
- do not make MCP the internal tool ABI

### 4.10 Workflow/task subsystem

Adopt a stage-typed durable workflow engine:

- canonical stage graph
- explicit dependencies
- owner execution routing
- retries and replay
- operator approval checkpoints
- browser work as durable tasks, not transient side-calls

This aligns with Cadet’s current `workflow_run`, `workflow_step`, and `browser_task` model and should be strengthened, not replaced.

### 4.11 Plugin / extension system

Use narrow capability bundles, not giant plugin objects.

A plugin may contribute one or more of:

- tools
- context engines
- memory backends
- model providers
- channel adapters
- workflow templates
- observability sinks

Each capability should be versioned independently. Cadet should reject incompatible plugins at load time.

### 4.12 Persistence layer

Distributed durable plane:

- SpacetimeDB: runs, steps, ownership, approvals, delivery, shared memory metadata

Optional local durable plane:

- SQLite/libsql-compatible storage for local transcript cache, prompt cache, FTS5 recall, and runner-local indexes

### 4.13 Config model

Compile-time constrained:

- core enums
- ID types
- workflow stage vocabulary
- plugin capability versions
- risk tiers

Runtime-configurable:

- agent manifests
- tool profiles
- model/provider selection
- memory retention limits
- scheduler settings
- channel bindings

### 4.14 Error model

Use typed errors with stable categories:

- `CadetError::Validation`
- `CadetError::Policy`
- `CadetError::ApprovalRequired`
- `CadetError::Timeout`
- `CadetError::Dependency`
- `CadetError::Storage`
- `CadetError::Provider`
- `CadetError::Tool`
- `CadetError::Workflow`
- `CadetError::Cancelled`

### 4.15 Testing model

From day one:

- unit tests for manifests, policies, tool registry, workflow transitions
- property tests for state transitions and retry/idempotency
- contract tests for plugin capability registration
- replay tests for failed/blocked runs
- integration tests against local SpacetimeDB
- runner tests for cancellation, leasing, and recovery
- deterministic snapshot tests for prompt pack assembly

### 4.16 Observability model

Use:

- `tracing` spans for run/step/tool/provider boundaries
- OpenTelemetry exporters through a collector in production
- durable audit rows for retrieval/tool/approval/delivery facts
- run/step IDs propagated across TS surfaces, Rust services, and SpacetimeDB

## 5. Design Decisions and Tradeoffs

### Decision: workflow-first kernel

Why:

- Best fit for Cadet’s existing schema.
- Easier replay, approval, retry, and observability.

Alternatives:

- monolithic chat loop
- pure message-service pipeline

Rejected because:

- harder to inspect and replay
- more prompt-coupled
- weak for multi-owner execution

Tradeoff:

- more state machinery up front

### Decision: layered memory, not one generic “memory” abstraction

Why:

- donor repos conflate transcript, facts, summaries, and retrieval
- Cadet needs replay-safe semantics

Alternative:

- single memory plugin API

Rejected because:

- guarantees become vague
- retention and observability suffer

Tradeoff:

- more interfaces
- cleaner semantics

### Decision: narrow plugin capabilities

Why:

- OpenClaw and Eliza both show plugin-sprawl risk

Alternative:

- one giant plugin object

Rejected because:

- versioning and compatibility get sloppy

Tradeoff:

- slightly more registration code

### Decision: MCP as adapter boundary

Why:

- MCP is a strong interoperability standard, but a poor internal kernel type system

Alternative:

- make Cadet internally MCP-native

Rejected because:

- internal semantics become stringly and least-common-denominator

Tradeoff:

- requires adapter layer maintenance

### Decision: SpacetimeDB for shared orchestration, SQLite for local recall/cache

Why:

- Cadet already leans this way
- donor repos show the need for both distributed control state and local fast recall

Alternative:

- all state in one store

Rejected because:

- one store will be wrong for at least one workload

Tradeoff:

- two persistence planes to reason about

## 6. March 2026 Research Synthesis

### Rust ecosystem choices

- Tokio remains the correct async runtime foundation.
- Tokio guidance continues to emphasize `tracing`, structured task ownership, and avoiding invisible background task sprawl.
- OpenTelemetry Rust guidance favors using the collector in production rather than direct vendor export from each service.
- `sqlx` remains a strong default for async SQL access; its SQLite driver still uses background-thread mediation because SQLite is blocking internally.
- SQLite FTS5 remains a strong pragmatic recall/index option for local transcript search and summary lookup.

### Agent framework design patterns

- Best current direction is toward durable workflows, explicit tool metadata, replayability, and typed boundaries.
- Monolithic chat loops remain common in practice but are weak for auditability and operator control.
- Context assembly is increasingly its own subsystem, not just prompt concatenation.

### Orchestration and tooling trends

- MCP 2025-11-25 is the right standard to support for tool and context interoperability, but not as the internal kernel ABI.
- A2A is useful for remote-agent interoperability and agent cards/skills discovery; it should sit at Cadet’s edge, not become Cadet’s internal control model.

### Concurrency/runtime guidance

- Favor explicit cancellation, bounded parallelism, and timeout policies.
- Distinguish CPU-heavy, blocking, and async workloads clearly.

### Testing and observability guidance

- Instrument IDs and causal spans early.
- Keep state transitions deterministic and replayable.
- Prefer contract tests and replay fixtures over only prompt golden tests.

## 7. Explicit Answers to the 20 Required Questions

1. Real architecture of each repo: Doolittle is a Bun shell over Eliza; OpenClaw is a gateway/session/control-plane platform; Eliza is a runtime library with oversized core; Hermes is a Python monolith with strong ops behavior.
2. Core concepts contributed: Doolittle startup/run tracking; OpenClaw context/session/workflow/plugin runtime; Eliza typed plugin vocabulary; Hermes tool registry/session recall/toolset policy.
3. Overlap: tools, memory, plugins, scheduling, sessions, multi-step execution.
4. Unique/value: OpenClaw context lifecycle; Hermes toolsets + SQLite recall; Eliza typed extension categories; Doolittle deferred hydration.
5. Outdated/weak/sloppy: god-files, prompt-coupled integration, plugin sprawl, runtime centralization, stale docs, overly broad mutable APIs.
6. Preserve in spirit but redesign: context engines, tool registries, session control, durable workflows, typed plugins, run snapshots.
7. Rust runtime model: durable event-driven workflow executor with stage claims and replay.
8. Rust memory architecture: transcript + facts + retrieval index + optional external profile backends.
9. Rust plugin system: narrow versioned capability bundles.
10. Message/event/task orchestration: SpacetimeDB durable state + local typed event bus.
11. Concurrency model: Tokio structured async, bounded worker pools, cancellation tokens, explicit blocking isolation.
12. Crate/module boundaries: core-types, runtime, context, tools, memory, workflows, plugins, observe, runner.
13. Traits/enums/core types: `AgentKernel`, `ContextEngine`, `Tool`, `MemoryStore`, `WorkflowEngine`, typed IDs, run/step/tool/approval enums.
14. Sync vs async: validation/pure transforms sync; I/O/provider/tool/model/storage boundaries async; blocking subprocess/SQLite isolated.
15. Generic vs concrete: generic traits at capability seams, concrete workflow/risk/state vocabularies in kernel.
16. Compile-time vs runtime config: core protocol/state types compile-time; manifests, policies, adapters, providers runtime.
17. Testing strategy: state-transition, property, replay, contract, integration, prompt-pack snapshot, worker recovery tests.
18. Production-hardening concerns: cancellation, retries, idempotency, approval gates, audit logs, secrets isolation, sandbox policy, observability, replay.
19. MVP first: typed IDs/policies, workflow engine, context engine trait, tool registry, retrieval traces, runner execution owners, observability basics.
20. Defer later: rich multi-agent A2A, advanced plugin marketplace, sophisticated profile modeling, broad channel surface, advanced autonomous self-improvement.

## 8. Implementation Roadmap

### Phase 0: architecture and scaffolding

- carve target crates
- define canonical IDs/enums/policies
- map existing `starbridge-core` types into new boundaries

### Phase 1: minimal runtime and core agent loop

- implement `AgentKernel`
- strengthen workflow run/step state machine
- replace placeholder execution with typed step execution contracts

### Phase 2: tools, memory, plugins

- add native tool registry
- add context engine trait
- add layered memory traits and retrieval traces
- add narrow plugin capability loader

### Phase 3: workflows and multi-agent coordination

- add handoff rules
- add delegated execution owners
- add remote agent adapter boundary for future A2A

### Phase 4: persistence, observability, production hardening

- add SQLite/FTS local store option
- add replay/retry operator flow
- wire tracing + OTEL + audit events

### Phase 5: advanced features and ecosystem integration

- MCP adapter packs
- richer browser worker semantics
- cross-agent knowledge policies
- remote agent card discovery

## 9. Rust UI Framework Landscape and Cadet Implications

The current Rust UI landscape matters for Cadet, but it should not change the core architecture decision: Cadet’s kernel must remain UI-agnostic and headless-first.

### Current 2026 read

- `Slint`: best pure-Rust production candidate for polished native UI, especially if Cadet later wants a serious desktop console.
- `egui`: strongest fit for internal tools, dashboards, inspection panels, workflow debuggers, and runner consoles.
- `Dioxus 0.7`: strongest “ship fast” full-stack Rust UI story, but desktop remains WebView-shaped and overlaps with Cadet’s existing TS/Next operator surfaces.
- `Freya`: promising native-rendered path, still too early for Cadet’s main operator experience.
- `Xilem`: most architecturally interesting long-term bet, not mature enough to anchor Cadet now.
- `GPUI`: valuable to study for IDE/editor-class ideas, too bespoke to adopt.

### Cadet recommendation

Near-term:

- Keep operator surfaces in Next.js and Bun/TS.
- Do not move Cadet’s main operator UI to Rust now.
- Use Rust UI only for specialized local tools if the value is clear.

Recommended choices by use case:

- Local runner inspector / workflow debugger / memory explorer: `egui`
- Future polished native desktop operator console: `Slint`
- Experimental future-native rewrite candidate to watch: `Xilem`

Why not make Rust UI a priority now:

- Cadet already has working TS operator surfaces.
- The hard problem is runtime architecture, not frontend rendering.
- React/TS still has the stronger design-system and product-shell ecosystem for operator tooling.

Practical design rule:

- Cadet runtime crates must expose stable HTTP/WebSocket/Spacetime contracts so any UI stack can sit on top later.
- No runtime module should depend on any UI framework.

## 10. Build Checklist

| Task | Area | Priority | Difficulty | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Define typed IDs and state enums | Core | P0 | M | none | no raw string IDs in runtime core |
| Split `starbridge-core` into core-types/runtime-facing modules | Rust core | P0 | M | typed IDs | compile passes with preserved public semantics |
| Replace placeholder event bus with typed local event layer + durable orchestration boundaries | Runtime | P0 | M | core types | run/step events no longer rely on broadcast-only semantics |
| Formalize workflow step lifecycle and owner routing | Workflows | P0 | M | core types | route/plan/gather/act/verify/summarize/learn all typed |
| Add context engine trait and default implementation | Context | P0 | H | runtime, memory | prompt packs assembled through trait |
| Add tool descriptor metadata and registry | Tools | P0 | H | core types | tool execution uses registry and policy gating |
| Add approval policy evaluation | Safety | P0 | M | tools, workflows | risky tool calls produce approval rows |
| Add retrieval trace contract to runtime | Memory | P1 | M | memory traits | every retrieval-backed prompt records traces |
| Add transcript/fact/retrieval memory traits | Memory | P1 | H | core types | memory layers no longer conflated |
| Add SQLite/FTS local store crate | Persistence | P1 | H | memory traits | local recall works with deterministic tests |
| Add plugin capability descriptors and version checks | Plugins | P1 | H | core types | incompatible plugins rejected cleanly |
| Add cancellation tokens and timeout policy per step/tool | Runtime | P1 | M | runtime core | cancelled runs stop cleanly and deterministically |
| Add OTEL tracing propagation through runs/steps/tools | Observe | P1 | M | runtime, workflows | a run is traceable end-to-end |
| Add replay and retry APIs for failed/blocked steps | Operator | P1 | M | workflows | operators can replay from durable state |
| Add MCP adapter boundary for external tool servers | Interop | P2 | M | tools | MCP tools register through adapters without polluting core types |
| Add A2A-facing remote agent adapter contract | Interop | P2 | H | workflows, runtime | remote agents can be modeled as execution owners |
| Add `egui` inspector prototype only if local debugging pressure justifies it | UI | P3 | M | stable runtime APIs | optional native inspector works without touching kernel logic |
| Evaluate `Slint` desktop shell after runtime stabilizes | UI | P4 | H | stable APIs, auth model | native operator shell can be added without backend rewrites |
