# Cadet Conversation Synthesis

This document turns the design conversation into concrete project decisions.

## Core thesis

Cadet should not copy ElizaOS, Hermes, or OpenClaw directly. It should replace the right layers:

- ElizaOS contributes manifest-driven agents, memory, and context discipline.
- Hermes contributes fast edge-facing orchestration, CLI ergonomics, and operator velocity.
- OpenClaw contributes the product challenge: multi-surface assistant UX, onboarding, and workflow management.

Cadet’s differentiator is a Rust + SpacetimeDB runtime fabric with deployment-agnostic ingress and durable workflow state.

## Hard decisions from the conversation

### 1. Deployment is runtime-agnostic, not vendor-locked

Cadet should support the same workflow/state model across:

- local execution
- Vercel
- Cloudflare Workers
- self-hosted container cloud

Implication:

- Edge runtimes are interchangeable ingress/orchestration surfaces.
- Durable state and workflow logic must stay in SpacetimeDB tables and reducers.
- Local, Vercel, Cloudflare, and container workers should read and write the same workflow, memory, and browser-task tables.

### 2. Do not embed ElizaOS directly

The intent is to replace, not integrate:

- no Eliza runtime dependency
- no Eliza plugin model as the core abstraction
- no Eliza-native memory pipeline

Instead:

- keep the useful ideas
- implement them programmatically
- make the contracts typed
- keep execution in Rust and state in SpacetimeDB

### 3. Agents are manifest-first and tool-typed

An agent is not “a prompt plus some tools.” It is:

- a manifest
- a typed workflow recipe
- typed tool policies
- browser policy
- handoff rules
- memory namespace
- learning policy

Implication:

- every tool should be typed back to the manifest
- workflow steps should be explicitly shaped, not inferred ad hoc at runtime
- manifests become the compilation and validation boundary

### 4. Crates replace plugins

The system should stay light and composable:

- gaming agents as crates
- coding agents as crates
- product/ops/social agents as crates

Implication:

- do not create a heavyweight plugin marketplace architecture first
- keep the runtime surface small and strongly typed
- use crates/modules as the extension unit

### 5. Product layer matters as much as runtime

To beat OpenClaw, Cadet needs:

- web chat / operator inbox
- workflow management in the main UI
- approval controls
- browser artifacts
- dynamic agent-specific surfaces

Implication:

- the product shell lives in the web app
- the workflow graph must be explainable from UI without reading logs
- channels are adapters, not separate runtimes

### 6. Use Chat SDK for channel reach

The conversation explicitly points to using Chat SDK to answer the OpenClaw problem.

Implication:

- Slack, GitHub, web chat, and later other channels should normalize into the same `thread_record`, `message_event`, and `workflow_run` flow
- Cadet’s product edge is adapter-driven, not bespoke per channel

### 7. Use edge speed, but keep stateful execution elsewhere

The edge is for:

- routing
- light triage
- initial planning
- fast acknowledgements
- product UX

The heavy work is for:

- local runners
- container runners
- browser workers
- learning workers

Implication:

- edge should never be the only place where work exists
- request lifetime cannot be the system’s execution boundary

### 8. Dynamic UI should come from typed data, not prompt soup

The conversation landed on:

- custom drag-and-drop workflow UI
- JSON-to-UI or manifest-to-UI ideas
- `json-render` as the better fit for dynamic UI surfaces
- TOON useful for manifests, batch prompts, and DB reads, but not the primary UI layer

Implication:

- UI composition should be generated from typed manifest/workflow data
- custom components can be declared and mounted safely
- TOON stays at the model/data boundary, not the main UI rendering format

### 9. CI/CD comes early

The conversation is explicit that CI/CD should be fixed first because everything else flows more smoothly once the gates are stable.

Implication:

- every atomic loop closes with deterministic validation
- release artifacts should be easy to push to GitHub and deploy

## Resulting architecture statement

Cadet is a deployment-agnostic, manifest-driven agent platform where:

- SpacetimeDB is the shared state and workflow fabric
- Rust is the authoritative execution kernel
- web/edge runtimes are interchangeable ingress and operator surfaces
- Chat SDK provides assistant-everywhere reach
- browser use is a first-class durable tool
- dynamic UI is generated from typed agent and workflow definitions

## Immediate priorities implied by the conversation

1. Keep the current event-driven Cadet foundation.
2. Add deployment portability for Cloudflare Workers beside Vercel.
3. Build a strong CLI and workflow editor.
4. Normalize channels into the same workflow fabric.
5. Keep agents lightweight and crate-based.
6. Expand UI generation and browser-centric workflows without breaking typed contracts.

## Explicit non-goals

- embedding ElizaOS as a runtime dependency
- making TOON the main UI protocol
- locking Cadet to one edge vendor
- recreating heavyweight plugin machinery before the crate-based extension path is proven
