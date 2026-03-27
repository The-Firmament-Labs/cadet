# Dioxus + SpacetimeDB for Cadet

Cadet can use Dioxus effectively.

The right answer is not "replace the current web plane with Dioxus everywhere." The right answer is:

- use Dioxus where a Rust-first UI is valuable
- keep SpacetimeDB as the canonical state fabric
- keep Rust workers as the execution kernel
- choose the Dioxus deployment shape based on where the UI runs

## Short answer

Yes, Dioxus works with SpacetimeDB.

For Cadet, the recommended order is:

1. `Dioxus desktop` for a serious operator mission-control app
2. `Dioxus fullstack` if you want a Rust-first web control plane
3. `Dioxus web-only WASM` only if you specifically want browser-only delivery and accept a thinner bridge

## Why the fit is good

SpacetimeDB’s client model is built around:

- generated client bindings
- subscriptions
- reducer calls
- a local client cache

Dioxus is built around:

- reactive Rust UI components
- signals and effects
- desktop, mobile, web, and fullstack deployment shapes
- server functions for typed Rust web backends

That means the two technologies line up naturally:

- SpacetimeDB provides the live state stream
- Dioxus provides the reactive UI
- Rust stays the shared language across workers, control logic, and UI state models

## Recommended Cadet shapes

## 1. Dioxus desktop + SpacetimeDB Rust client

This is the cleanest Rust-first shape.

Use it for:

- operator desktop app
- local mission control
- browser-worker supervision UI
- local coding/research cockpit

### Architecture

```text
Dioxus desktop app
-> SpacetimeDB Rust client bindings
-> subscribe to threads / runs / steps / browser tasks / retrieval traces
-> update Dioxus signals
-> call reducers from UI actions
```

### Why this is strong

- no browser bridge is required
- subscriptions map naturally into Dioxus signals
- local operator tools can stay Rust-native
- it matches Cadet's existing Rust-heavy runtime direction

## 2. Dioxus fullstack web + server functions + SpacetimeDB Rust client

This is the best Rust-first web shape.

Use it for:

- browser-accessible operator UI
- authenticated team control plane
- web inbox and approvals
- hybrid SSR + client interactivity

### Architecture

```text
Browser
-> Dioxus UI
-> Dioxus server functions / Axum handlers
-> SpacetimeDB Rust client
-> subscriptions + reducer calls
```

### Why this is strong

- browser clients do not need direct SpacetimeDB wiring
- Rust stays authoritative for state access and policy
- web delivery is simpler than running a Rust client in browser WASM
- server functions fit Cadet's thin-route, durable-backend model

## 3. Dioxus web-only WASM + thin bridge

This shape is possible, but it is not my first recommendation for Cadet.

Use it only if:

- you want a browser-only Dioxus deployment
- and you accept a small bridge layer for live DB access

### Why it is weaker for Cadet

- more moving parts at the UI boundary
- more care needed around browser-only runtime limits
- less aligned with Cadet's Rust-worker core

## Best fit for Cadet specifically

The strongest Cadet combination is:

- keep the current Next.js / Vercel shell for public operator web and channel ingress
- add `Dioxus desktop` for the serious mission-control app
- optionally add `Dioxus fullstack` later if you choose to consolidate more of the web plane into Rust

That keeps:

- Vercel and Chat SDK for product/channel surfaces
- SpacetimeDB for shared state
- Rust workers for execution
- Dioxus for a Rust-native operator experience

## Integration pattern inside Cadet

No matter which Dioxus shape you choose, keep the integration pattern stable.

### Read path

Subscribe to:

- `thread_record`
- `message_event`
- `workflow_run`
- `workflow_step`
- `approval_request`
- `browser_task`
- `browser_artifact`
- `retrieval_trace`

Map those into:

- Dioxus signals for current lists and selections
- memos for derived UI state
- effects for notifications and live refresh reactions

### Write path

UI actions should call reducers, not mutate local-only state:

- retry run
- resolve approval
- enqueue browser task
- replay workflow step
- append operator note

## What not to do

- do not move Cadet's canonical workflow logic into UI components
- do not make browser clients the source of truth for workflow state
- do not bypass reducers with ad hoc HTTP mutations
- do not tie Dioxus-specific state semantics to Cadet's storage model

The UI should consume and invoke the Cadet contract, not redefine it.

## First implementation I would do

If we add Dioxus to Cadet, do it in this order:

1. build a `dioxus-desktop` operator app
2. connect it to the existing SpacetimeDB tables through generated Rust bindings
3. implement inbox, run timeline, approvals, and browser-artifact inspection
4. keep the current Next/Vercel product shell for web and channel ingress

That gives the highest value with the least architecture churn.

## Relevant official docs

- [Dioxus 0.7 overview](https://dioxuslabs.com/learn/0.7/)
- [Dioxus fullstack](https://dioxuslabs.com/learn/0.7/essentials/fullstack/)
- [Dioxus server functions](https://dioxuslabs.com/learn/0.7/essentials/fullstack/server_functions/)
- [Dioxus desktop](https://dioxuslabs.com/learn/0.7/guides/platforms/desktop/)
- [SpacetimeDB Rust quickstart](https://spacetimedb.com/docs/quickstarts/rust/)
- [SpacetimeDB SDK API overview](https://spacetimedb.com/docs/sdks/api/)
- [SpacetimeDB code generation](https://spacetimedb.com/docs/sdks/codegen/)
