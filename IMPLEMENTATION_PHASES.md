# Implementation Phases: Cadet

**Project Type**: Event-driven agent platform  
**Core stack**: Rust + SpacetimeDB v2 + Bun/TypeScript + Next.js  
**Deployment targets**: local, Vercel, Cloudflare Workers, self-hosted containers  
**Execution model**: manifest-driven, subscription-driven workers, typed browser tasks

---

## Planning anchors

- Conversation synthesis: [docs/CONVERSATION_SYNTHESIS.md](docs/CONVERSATION_SYNTHESIS.md)
- Atomic execution method: [docs/RALPH_LOOP.md](docs/RALPH_LOOP.md)
- Current session tracker: [SESSION.md](SESSION.md)

---

## Phase 1: Deployment Portability Layer
**Type**: Infrastructure  
**Estimated**: 6-10 hours  
**Status**: 🔄 In progress

**Goal**

Make the current Cadet runtime portable across Vercel, Cloudflare Workers, and self-hosted containers without forking the workflow model.

**Atomic loops**

### Loop 1.1: Edge adapter contract
- **Route**: isolate vendor-specific ingress/runtime differences
- **Atomize**: define a provider-neutral control-edge interface and move Vercel-specific logic behind it
- **Land**: edge ingress code can be implemented once per platform without changing workflow state contracts
- **Prove**: typecheck + web build
- **Handoff**: add the first Cloudflare adapter

### Loop 1.2: Cloudflare ingress service
- **Route**: make Cloudflare a first-class deployment target
- **Atomize**: create a Worker ingress that mirrors the same `message_event -> workflow_run -> route step` path as Vercel
- **Land**: Cloudflare can accept webhook/chat ingress and enqueue runs into the same SpacetimeDB fabric
- **Prove**: Worker local dev smoke + shared SDK tests
- **Handoff**: add deployment docs and env wiring

### Loop 1.3: Container runner packaging
- **Route**: make heavy execution deployable anywhere
- **Atomize**: harden the runner container and define runtime env contracts
- **Land**: browser, local, and learning workers can run as explicit services in container cloud
- **Prove**: Rust build + container smoke
- **Handoff**: add provider docs for Railway/Fly/other container hosts

**Exit criteria**
- Same workflow/state model works from Vercel and Cloudflare ingress.
- Container workers can process workflow and browser tasks without code forks.
- Vendor-specific code is isolated to ingress/deployment adapters.

---

## Phase 2: Chat Gateway And Operator Inbox
**Type**: Product / Integration  
**Estimated**: 8-14 hours  
**Status**: 🔄 In progress

**Goal**

Turn Cadet into an assistant-everywhere product surface, not just a runtime scaffold.

**Atomic loops**

### Loop 2.1: Web inbox hardening
- **Route**: finish the operator-facing run browser
- **Atomize**: enrich inbox/run views with retry, approvals, browser artifacts, and retrieval traces
- **Land**: a run is explainable from UI
- **Prove**: web tests + build
- **Handoff**: hook actions to retry/approval routes

### Loop 2.2: Slack adapter
- **Route**: add the first real external channel
- **Atomize**: verify signatures, normalize inbound events, and persist outbound delivery attempts
- **Land**: Slack threads become Cadet threads and workflow runs
- **Prove**: adapter unit tests + manual webhook simulation
- **Handoff**: GitHub adapter

### Loop 2.3: GitHub adapter
- **Route**: support agentic engineering and repo workflows natively
- **Atomize**: normalize issues/comments/mentions into the shared event path
- **Land**: GitHub becomes a first-class Cadet channel
- **Prove**: route tests + replay fixtures
- **Handoff**: notification and subscription policy

**Exit criteria**
- Web, Slack, and GitHub all flow into the same durable thread/run model.
- Inbox supports explanation, approval handling, and retry/replay.
- Delivery attempts are stored and inspectable.

---

## Phase 3: Dynamic Agent UI And Workflow Editor
**Type**: UI / Product  
**Estimated**: 10-16 hours  
**Status**: ⏸️ Not started

**Goal**

Expose manifests and workflows as dynamic operator UI, including drag-and-drop workflow management.

**Atomic loops**

### Loop 3.1: Manifest-to-UI metadata
- **Route**: give each agent a typed UI contract
- **Atomize**: add UI metadata fields and component descriptors to manifests
- **Land**: agents can declare how they should be rendered in the control plane
- **Prove**: manifest tests + render smoke
- **Handoff**: wire `json-render` component registry

### Loop 3.2: Workflow graph editor
- **Route**: make workflows inspectable and editable visually
- **Atomize**: render route/plan/gather/act/verify/summarize/learn as graph nodes with typed edge metadata
- **Land**: workflow templates can be edited without breaking manifest validity
- **Prove**: UI tests + schema validation
- **Handoff**: drag-and-drop persistence

### Loop 3.3: Agent-specific dashboards
- **Route**: support dynamic operator surfaces per agent
- **Atomize**: map manifest UI descriptors to safe registered components
- **Land**: coding, gaming, ops, and social agents can surface custom views without one-off pages
- **Prove**: build + snapshot/render tests
- **Handoff**: permissions and tenant scoping

**Exit criteria**
- Manifests drive dynamic UI safely.
- Workflow templates can be visualized and edited.
- Agent-specific UI is composable without hardcoding per-agent pages.

---

## Phase 4: Crate-Based Agent Ecosystem
**Type**: Runtime  
**Estimated**: 8-12 hours  
**Status**: ⏸️ Not started

**Goal**

Replace plugin sprawl with crate-based, typed agent modules.

**Atomic loops**

### Loop 4.1: Crate registration contract
- **Route**: make agent crates loadable and explicit
- **Atomize**: define crate metadata, tool exports, and manifest linkage
- **Land**: crates become the extension unit
- **Prove**: Rust tests + example crate load
- **Handoff**: implement one specialized agent crate

### Loop 4.2: Specialized agent crates
- **Route**: prove the pattern on real use cases
- **Atomize**: add one coding agent crate and one browser research agent crate
- **Land**: specialized agents share the same runtime contracts but keep separate logic
- **Prove**: targeted worker/run tests
- **Handoff**: gaming/social/media crates

### Loop 4.3: Orchestration and routing policy
- **Route**: ensure the conversational agent can hand off cleanly
- **Atomize**: define route policies from user intent to specialized agent crate
- **Land**: one conversational surface can route to many specialized runtimes
- **Prove**: manifest/policy tests
- **Handoff**: cross-agent tickets and queue visualization

**Exit criteria**
- Crates are the extension model.
- Specialized agents run without bespoke glue.
- Routing to agent crates is typed and durable.

---

## Phase 5: Retrieval, Learning, And Memory Hardening
**Type**: Runtime / Data  
**Estimated**: 8-14 hours  
**Status**: 🔄 In progress

**Goal**

Move from simple note storage to real retrieval-backed learning.

**Atomic loops**

### Loop 5.1: Embedding pipeline abstraction
- **Route**: stabilize the semantic memory boundary
- **Atomize**: add one embedding provider contract and keep Spacetime-backed chunk/trace storage canonical
- **Land**: retrieval does not depend on one provider or one undocumented DB feature
- **Prove**: memory tests + SDK validation
- **Handoff**: query ranking improvements

### Loop 5.2: Retrieval-driven prompt assembly
- **Route**: make memory usage visible and deterministic
- **Atomize**: route prompt building through retrieval traces
- **Land**: each run can show which memory chunks were used
- **Prove**: unit tests + worker smoke
- **Handoff**: compaction and summary windows

### Loop 5.3: Learn-stage policy
- **Route**: keep learning bounded and useful
- **Atomize**: add compaction, retention, and namespace-specific learning rules
- **Land**: learn stages create durable, queryable memory instead of uncontrolled note spam
- **Prove**: deterministic tests
- **Handoff**: cross-agent shared knowledge policies

**Exit criteria**
- Retrieval traces are always recorded.
- Prompt assembly uses the semantic memory abstraction.
- Learn-stage outputs are compact, queryable, and policy-controlled.

---

## Phase 6: CI/CD And Release Hardening
**Type**: Infrastructure  
**Estimated**: 4-8 hours  
**Status**: 🔄 In progress

**Goal**

Keep the repo green while expanding runtime surfaces and deployment targets.

**Atomic loops**

### Loop 6.1: CI contract tests
- **Route**: stop workflow drift early
- **Atomize**: pin required gates for Bun, Rust, SpacetimeDB, and web build boundaries
- **Land**: CI mirrors the real local validation chain
- **Prove**: GitHub Actions green
- **Handoff**: deployment previews and rollback checks

### Loop 6.2: Multi-target deployment docs
- **Route**: reduce operator friction
- **Atomize**: document Vercel, Cloudflare, and container deployment paths
- **Land**: deployment becomes procedural instead of tribal knowledge
- **Prove**: docs walkthrough
- **Handoff**: automated environment provisioning

**Exit criteria**
- CI stays green across TS, Rust, SpacetimeDB, and web surfaces.
- Deployment instructions exist for each supported target.

---

## Definition of done for the current architecture push

Cadet reaches the intended shape when:

- manifests remain the source of truth
- workflows are durable and stage-typed
- browser use is a first-class durable tool
- deployment targets can change without forking the workflow model
- the product shell explains runs clearly
- specialized agents stay lightweight and crate-based
