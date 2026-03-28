# SpacetimeDB Subscription System

## Pattern: Shared Inbox + Per-Agent Routing

All agents subscribe to the `raw_message` table (filtered to `status = 'received'`), forming a shared inbox. The `message_route` table determines which agent actually owns each message — agents then filter routes by their own `target_agent_id`. This means every agent sees all arriving messages but only acts on those explicitly routed to it.

Agent-specific subscriptions (workflow steps, approvals, memory, schedules) are filtered by `agent_id` or `namespace`, ensuring each agent only receives events relevant to its own work.

---

## Subscription Types

Source: `rust/starbridge-core/src/subscriptions.rs`

- **`Subscription`** — a single table subscription with three fields: `table` (table name), `filter` (SQL WHERE clause, empty string for unfiltered), and `description` (human-readable label).
- **`SubscriptionSet`** — groups a list of `Subscription` entries under an `agent_id`. Provides two helper methods:
  - `queries()` — returns all subscriptions as SQL strings
  - `for_table(name)` — returns subscriptions matching a specific table name
- **`to_sql()`** — generates `SELECT * FROM table` or `SELECT * FROM table WHERE filter` depending on whether `filter` is empty.

---

## Builder API

```rust
SubscriptionSet::for_agent("saturn")
    .shared_inbox()
    .own_routes()
    .own_workflow_steps()
    .own_workflow_runs()
    .own_approvals()
    .shared_entities()
    .own_memory()
    .own_schedules()
    .custom("table", "filter", "description")
    .build()
```

---

## Builder Methods

| Method | Table | Filter | Description |
|---|---|---|---|
| `shared_inbox()` | `raw_message` | `status = 'received'` | Shared inbox — all inbound messages |
| `own_routes()` | `message_route` | `target_agent_id = '{agent_id}'` | Messages routed to this agent |
| `own_workflow_steps()` | `workflow_step` | `agent_id = '{agent_id}'` | Workflow steps assigned to this agent |
| `own_workflow_runs()` | `workflow_run` | `agent_id = '{agent_id}'` | Workflow runs for this agent |
| `own_approvals()` | `approval_request` | `agent_id = '{agent_id}'` | Approval requests created by this agent |
| `shared_entities()` | `message_entity` | _(none)_ | Shared entity identity graph |
| `own_memory()` | `memory_document` | `namespace = '{agent_id}'` | Memory documents in agent's namespace |
| `own_schedules()` | `agent_schedule` | `agent_id = '{agent_id}' AND status = 'ready'` | Ready scheduled jobs for this agent |
| `custom(table, filter, desc)` | _(any)_ | _(any)_ | Arbitrary subscription |

---

## Presets

Three preset functions cover the common agent profiles:

**`ops_subscriptions(agent_id)`** — 8 subscriptions. Full monitoring for operations agents (e.g. Saturn). Includes: shared inbox, own routes, own workflow steps, own workflow runs, own approvals, shared entities, own memory, own schedules.

**`research_subscriptions(agent_id)`** — 6 subscriptions. For research agents (e.g. Voyager). Same as ops minus approvals (research agents don't create approval gates) and schedules (less frequent task triggering).

**`dashboard_subscriptions()`** — 6 subscriptions, all unfiltered. The dashboard observes everything: `raw_message`, `workflow_run`, `workflow_step`, `approval_request`, `message_entity`, `trajectory_log`. No per-agent filtering.

---

## Subscription Topology

```
SpacetimeDB tables
│
├─ raw_message (status='received') ──────────────────┬─► Saturn (ops)
├─ message_route (target_agent_id='saturn') ─────────┘
├─ message_route (target_agent_id='voyager') ────────┐
├─ raw_message (status='received') ──────────────────┴─► Voyager (research)
│
├─ workflow_step (agent_id='saturn') ────────────────►  Saturn
├─ workflow_step (agent_id='voyager') ───────────────►  Voyager
│
├─ approval_request (agent_id='saturn') ─────────────►  Saturn only
├─ agent_schedule (agent_id='saturn', status='ready')►  Saturn only
│
├─ raw_message (unfiltered) ─────────────────────────┐
├─ workflow_run (unfiltered) ─────────────────────────┤
├─ workflow_step (unfiltered) ────────────────────────┤─► Dashboard
├─ approval_request (unfiltered) ────────────────────┤
├─ message_entity (unfiltered) ──────────────────────┤
└─ trajectory_log (unfiltered) ──────────────────────┘
```

---

## Adding a New Subscription

1. Add a builder method to `SubscriptionSetBuilder` in `rust/starbridge-core/src/subscriptions.rs`, following the existing pattern: push a `Subscription::new(table, filter, description)` onto `self.subscriptions`.
2. Add the new method to any relevant preset functions (`ops_subscriptions`, `research_subscriptions`, etc.).
3. The runner picks it up automatically — it calls `subscription_set.queries()` and registers all returned SQL strings with the SpacetimeDB client. No additional wiring required.

---

## Event Callbacks

When a subscribed row changes, the runner receives a `SubscriptionEvent`:

```rust
pub struct SubscriptionEvent {
    pub table: String,
    pub event_type: SubscriptionEventType, // Insert | Update | Delete
    pub row_json: String,
}
```

Runner crates implement `SubscriptionCallback` (`Box<dyn Fn(SubscriptionEvent) + Send + Sync>`) to dispatch these events to the appropriate agent handler.

---

## Source Files

- `rust/starbridge-core/src/subscriptions.rs`
