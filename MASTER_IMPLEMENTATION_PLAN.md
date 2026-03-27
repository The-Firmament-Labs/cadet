# Cadet Master Implementation Plan

Date: 2026-03-27
Status: Canonical implementation plan

This document consolidates the current planning set into one implementation plan that drives Cadet from the current foundation to a complete architecture, product shell, and production-ready runtime.

Reviewed inputs:

- `ARCHITECTURE.md`
- `IMPLEMENTATION_PHASES.md`
- `SESSION.md`
- `docs/ARCHITECTURE_GUIDE.md`
- `docs/AGENT_MANIFESTS.md`
- `docs/CONVERSATION_SYNTHESIS.md`
- `docs/DYNAMIC_AGENT_UI.md`
- `docs/RALPH_LOOP.md`
- `docs/FRAMEWORK_RESEARCH_BLUEPRINT.md`

## 1. Executive Direction

Cadet should be built as a workflow-first, manifest-driven, Rust-native agent platform with:

- SpacetimeDB as the durable control fabric
- Rust as the authoritative execution kernel
- TypeScript/Next/Bun as operator and ingress surfaces
- typed manifests as the source of truth for behavior, policy, workflow, and UI hints
- durable browser, approval, retrieval, and delivery records
- crate-based specialization instead of plugin sprawl

Cadet should not drift into:

- a prompt-only agent shell
- a direct Eliza, Hermes, or OpenClaw port
- a UI-first product with weak runtime contracts
- a plugin marketplace before the kernel is stable

## 2. What This Plan Replaces

This plan becomes the single implementation sequence for:

- architecture completion
- runtime design completion
- product shell completion
- deployment parity
- memory/learning hardening
- validation and release hardening

Other docs remain reference material, but execution should follow this plan and keep `SESSION.md` in sync.

## 3. Architectural End State

Cadet is complete when all of the following are true:

### Runtime

- workflow execution is durable and stage-typed
- run, step, tool, browser, approval, and delivery state are inspectable
- context assembly is trait-driven and retrieval-backed
- tool execution is policy-gated, cancellable, and replay-safe
- memory is layered into transcript, fact, and retrieval planes

### Product

- web inbox, agent home, run detail, approval flow, browser evidence, and retry/replay are complete
- channels normalize into one thread/run fabric
- dynamic UI is generated from typed manifest/runtime data, not prompt soup

### Deployment

- local, Vercel, Cloudflare, and self-hosted container topologies use the same state contracts
- heavy execution is worker-owned, not edge-owned

### Extensibility

- manifests remain canonical
- specialized behavior is added through typed crates/capabilities
- MCP and A2A are edge adapters, not kernel internals

### Operations

- observability is end-to-end
- validation is deterministic
- deployment and rollback are procedural

## 4. Execution Rules

Cadet implementation should follow these rules for every phase:

### GitHub-user execution bias

Before starting a work session, agents should check the active GitHub user with:

```bash
gh api user --jq .login
```

If the active user is `SYMBaiEX`, bias execution away from UI work unless UI work is explicitly requested or is strictly necessary to unblock non-UI progress.

For `SYMBaiEX`, prioritize:

- runtime kernel work
- workflow/state machinery
- memory and retrieval
- tools, approvals, and policy
- deployment parity
- observability, reliability, and recovery
- crate-based agent specialization

For `SYMBaiEX`, de-prioritize by default:

- visual polish
- dashboard beautification
- dynamic UI expansion
- native desktop UI experiments

This rule exists to keep active implementation effort focused on Cadet’s hardest architectural constraints first.

### RALPH remains the delivery loop

Every implementation slice should:

1. Route the next highest-value constraint
2. Atomize the smallest safe slice
3. Land code and contract changes
4. Prove with deterministic validation
5. Handoff the next slice into `SESSION.md`

### Frequent review rule

Every phase must have:

- a phase review at start
- a review checkpoint after each milestone
- a final review gate before moving to the next phase

### Update rule

After every landed milestone:

- update `SESSION.md`
- update progress in this master plan if priorities changed
- note blockers, validation status, and next loop

### Validation rule

At minimum, each milestone must specify:

- targeted Rust validation
- targeted TS/web validation
- integration validation where contracts cross boundaries

## 5. Phase Plan

## Phase 0 — Canonical Architecture Consolidation

### Goal

Finish the architecture contract before further feature sprawl.

### Outcomes

- one canonical runtime model
- one canonical workflow model
- one canonical crate map
- one canonical manifest contract
- one canonical control-plane contract

### Work

1. Freeze the core domain vocabulary:
   - `AgentId`, `RunId`, `StepId`, `ThreadId`, `SessionId`, `ToolCallId`, `ApprovalId`
   - `RunState`, `StepState`, `ToolRisk`, `ExecutionOwner`
2. Lock the canonical workflow stage set:
   - `route`, `plan`, `gather`, `act`, `verify`, `summarize`, `learn`
3. Split current `starbridge-core` concepts into future crate boundaries:
   - core types
   - runtime
   - context
   - tools
   - memory
   - workflows
   - observe
4. Decide what stays in TS and what moves to Rust.
5. Define the “no UI dependency in runtime crates” rule formally.

### Review gate

- no unresolved contradictions across architecture docs
- all core types and boundaries are named and stable

### Frequent updates

- update `SESSION.md` after each boundary decision
- log any renames that affect manifests, SDK, or schema

## Phase 1 — Durable Runtime Kernel

### Goal

Replace placeholder runtime behavior with a real workflow-first kernel.

### Outcomes

- typed `AgentKernel`
- typed workflow executor
- typed event model
- cancellation and timeout boundaries

### Work

1. Replace the current placeholder-local execution logic with a proper step executor.
2. Strengthen run and step lifecycle transitions.
3. Replace the current lightweight in-process event bus assumption with:
   - local typed event notifications
   - SpacetimeDB-backed durable orchestration
4. Add explicit claim/lease/retry semantics for workers.
5. Add deterministic replay entry points for failed/blocked steps.

### Review gate

- a run can be created, claimed, advanced, failed, and replayed deterministically
- no step depends on implicit prompt-only control flow

### Frequent updates

- checkpoint after lifecycle transitions land
- checkpoint after replay works

## Phase 2 — Context, Memory, and Prompt Assembly

### Goal

Make context assembly explicit, inspectable, and retrieval-backed.

### Outcomes

- `ContextEngine` trait
- layered memory contract
- retrieval traces in the prompt path
- compaction and learn-stage boundaries

### Work

1. Introduce the context engine lifecycle:
   - `bootstrap`
   - `ingest`
   - `assemble`
   - `compact`
   - `after_turn`
   - `maintain`
2. Separate memory into:
   - transcript
   - facts
   - retrieval/index
3. Route prompt assembly through retrieval traces end-to-end.
4. Add embedding provider abstraction.
5. Define retention and compaction policy by namespace.

### Review gate

- every retrieval-backed run shows which chunks were used
- learn-stage outputs are bounded and inspectable

### Frequent updates

- checkpoint after memory traits stabilize
- checkpoint after retrieval traces are fully wired

## Phase 3 — Tooling, Policy, and Approval System

### Goal

Turn tools into a typed subsystem rather than scattered runtime behavior.

### Outcomes

- typed tool registry
- tool metadata and concurrency semantics
- approval policy engine
- MCP adapter boundary

### Work

1. Add native `Tool` and `ToolRegistry` contracts.
2. Add descriptors with:
   - risk
   - side-effect class
   - concurrency group
   - approval requirements
   - sandbox expectations
3. Add approval evaluation and durable approval records.
4. Add safe parallel execution boundaries.
5. Add MCP-backed tool providers without polluting core internal types.

### Review gate

- risky tools cannot execute without policy or approval handling
- tool execution is inspectable and cancellable

### Frequent updates

- checkpoint after registry lands
- checkpoint after approval flow is durable

## Phase 4 — Execution Owners and Deployment Parity

### Goal

Make execution portable across local, edge, and containers without changing the workflow fabric.

### Outcomes

- provider-neutral ingress boundary
- Cloudflare parity beside Vercel
- hardened worker/container path
- clear owner routing rules

### Work

1. Extract provider-neutral control-edge adapter contracts.
2. Implement Cloudflare Worker ingress using the same event path.
3. Harden container runner packaging and deployment contracts.
4. Clarify routing rules between:
   - edge
   - local-runner
   - container-runner
   - browser-worker
   - learning-worker
5. Add runner presence, stale detection, and ownership recovery checks.

### Review gate

- the same run model works across local, Vercel, Cloudflare, and container execution
- edge runtimes never become hidden durable worker runtimes

### Frequent updates

- checkpoint after adapter extraction
- checkpoint after first Cloudflare ingress pass
- checkpoint after container smoke validation

## Phase 5 — Product Shell Completion

### Goal

Finish Cadet as an operator-facing product, not just a runtime skeleton.

### Outcomes

- web inbox complete
- run detail complete
- approval and retry controls complete
- browser evidence and retrieval evidence visible
- channel surfaces normalized

### Work

1. Harden inbox and run detail views.
2. Wire retry and approval actions to durable APIs.
3. Complete Slack normalization and verification.
4. Complete GitHub normalization and verification.
5. Standardize thread/run views around one durable data model.

### Review gate

- operators can explain, retry, approve, and inspect runs without reading raw logs

### Frequent updates

- checkpoint after UI actions are live
- checkpoint after each channel adapter becomes real

## Phase 6 — Dynamic Agent UI and Workflow Design

### Goal

Generate agent-specific UI safely from typed manifest and runtime data.

### Outcomes

- manifest-backed UI hints
- constrained component/action catalog
- dynamic agent home surfaces
- workflow graph/editor foundation

### Work

1. Add typed UI metadata to manifests.
2. Build the Cadet UI catalog and component registry.
3. Build a translator:
   - manifest + runtime state + operator context
   - to UI intent
   - to validated render spec
4. Implement agent home surfaces first.
5. Extend to workflow graph and thread/run lenses.

### Review gate

- generated UI cannot escape the safe catalog
- each agent can get a distinct UI without bespoke page code

### Frequent updates

- checkpoint after manifest UI metadata lands
- checkpoint after first agent home surface renders

## Phase 7 — Crate-Based Specialization

### Goal

Replace anticipated plugin sprawl with typed crate-based specialization.

### Outcomes

- crate registration contract
- specialized agent crates
- typed handoff/routing policy

### Work

1. Define capability and crate registration contracts.
2. Add at least two specialized crates:
   - coding agent
   - browser research agent
3. Add typed routing/handoff policies from manifests to execution owners and crates.
4. Keep the manifest as system-of-record while crates provide implementation.

### Review gate

- specialized agents run through the same kernel without bespoke orchestration paths

### Frequent updates

- checkpoint after registration contract
- checkpoint after first two specialized crates pass validation

## Phase 8 — Observability, Reliability, and Recovery

### Goal

Make Cadet operable under real load and failure.

### Outcomes

- tracing and OTEL propagation
- stable auditability
- replay/recovery tooling
- timeout and retry policies

### Work

1. Add `tracing` spans across run, step, tool, provider, and delivery boundaries.
2. Add OpenTelemetry export via collector-oriented config.
3. Harden retry, idempotency, and recovery semantics.
4. Add operator-grade replay and inspection tooling.
5. Add health checks and stale-runner remediation.

### Review gate

- a failed run can be traced, explained, and replayed from durable state

### Frequent updates

- checkpoint after trace propagation
- checkpoint after replay tooling

## Phase 9 — Security, Permissions, and Governance

### Goal

Build policy and trust boundaries before broad ecosystem expansion.

### Outcomes

- explicit tool risk controls
- approval checkpoints
- secrets and permission boundaries
- safe channel ingress assumptions

### Work

1. Define Cadet’s trust model formally.
2. Add permission-aware tool and browser policies.
3. Add operator approval paths for risky actions.
4. Harden secret handling across local, edge, and worker deployments.
5. Add audit records for sensitive operations.

### Review gate

- risky execution paths have explicit policy and audit handling

### Frequent updates

- checkpoint after trust model writeup is reflected in code
- checkpoint after approval-sensitive actions are covered

## Phase 10 — Release Hardening and Ecosystem Expansion

### Goal

Make Cadet easy to ship, extend, and operate repeatedly.

### Outcomes

- stable CI/CD gates
- deployment procedures
- MCP packs
- remote agent/A2A boundary
- optional native debugging surfaces

### Work

1. Lock CI gates across Bun, Rust, SpacetimeDB, and web surfaces.
2. Formalize deployment procedures for Vercel, Cloudflare, and containers.
3. Add MCP adapter packs.
4. Add remote-agent/A2A adapter boundaries.
5. Consider optional native tooling only after runtime contracts are stable:
   - `egui` for local inspector/debugger
   - `Slint` only for a future polished native shell

### Review gate

- Cadet can be shipped and extended without architectural churn

### Frequent updates

- checkpoint after CI contracts are locked
- checkpoint after deployment docs and rollback procedures are proven

## 6. Priority Order Right Now

Immediate order of execution:

1. Phase 0 — Canonical Architecture Consolidation
2. Phase 1 — Durable Runtime Kernel
3. Phase 2 — Context, Memory, and Prompt Assembly
4. Phase 3 — Tooling, Policy, and Approval System
5. Phase 4 — Execution Owners and Deployment Parity
6. Phase 5 — Product Shell Completion
7. Phase 8 — Observability, Reliability, and Recovery
8. Phase 6 — Dynamic Agent UI and Workflow Design
9. Phase 7 — Crate-Based Specialization
10. Phase 9 — Security, Permissions, and Governance
11. Phase 10 — Release Hardening and Ecosystem Expansion

This order is deliberate:

- kernel before product polish
- memory before dynamic UI
- policy before ecosystem breadth
- observability before scale

## 7. Current Known Gaps

Based on the reviewed docs, the current highest gaps are:

- architecture is directionally strong but spread across too many planning docs
- runtime contracts are stronger in concept than in actual crate layout
- the current event bus/runtime core is still too placeholder-shaped
- retrieval is present in schema but not yet fully driving prompt assembly end-to-end
- Cloudflare parity is still planned, not complete
- product surfaces exist but still need durable action wiring
- crate-based specialization is planned but not yet proven

## 8. Required Review Cadence

Use this cadence during implementation:

### Weekly architecture review

- check whether current work still matches this plan
- collapse drift before it spreads

### Per-milestone review

- review contracts changed
- review validation coverage
- review follow-up slices

### Phase-exit review

- confirm exit criteria
- update `SESSION.md`
- queue the next phase start slice

## 9. Update Contract

Whenever Cadet changes materially:

1. update `SESSION.md`
2. update this plan if priorities or phase ordering changed
3. note validation results
4. note the next smallest RALPH slice

If a change only affects details and not sequencing, update `SESSION.md` only.

## 10. Definition of Done

Cadet is done when:

- the runtime kernel is typed, durable, cancellable, and replayable
- manifests remain the source of truth
- context and memory are explicit and inspectable
- tools, approvals, browser work, and delivery are durable subsystems
- the product shell explains and controls runs cleanly
- deployment targets share one workflow fabric
- specialization is crate-based, not plugin-sprawl-based
- observability, security, and release discipline are built in, not bolted on
