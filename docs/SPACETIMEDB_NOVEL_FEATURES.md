# SpacetimeDB Novel Agent Features

## The Core Insight

SpacetimeDB collapses the distinction between "write" and "notify." Every reducer mutation automatically pushes to every matching subscription. This makes 10 features possible that NO competitor can replicate without rebuilding their entire data layer.

## The 10 Features

### 1. Orbital Sync — Live Multi-Agent Shared Consciousness
Agents subscribe to each other's tool calls and discoveries in real-time. When Agent A finds a function signature, Agent B sees it instantly in its local cache — no handoff files, no polling. Eliminates parallel agent conflicts.

### 2. Pulsar Trace — Real-Time Trajectory Replay with Time Travel
Every agent action logged to trajectory_log with TOON-encoded context. Desktop renders a live, scrubable timeline. Users rewind to any decision point and see exactly what the agent knew. Zero loading on scrub — all data in client RAM.

### 3. Nebula Memory — Cross-Agent Semantic Knowledge Graph
When any agent learns something, every agent subscribed to the same namespace receives it instantly. Knowledge arrives unbidden — like a colleague tapping your shoulder. Eliminates knowledge silos between agents.

### 4. Event Horizon — Conditional Agent Triggers via SQL Subscriptions
SQL WHERE clauses that fire agents: "When approval pending > 5 min, spawn reminder." Fires the instant the condition becomes true via subscription invalidation. Sub-10ms end-to-end. Not cron — reactive.

### 5. Gravity Well — Automatic Agent Swarming on High-Priority Tasks
When a critical run has one agent and three are idle, idle agents are pulled into the task automatically. Cross-table reactive queries + atomic work claiming. System is anti-fragile.

### 6. Redshift — Cross-Platform Conversation Continuity
Start on Slack, switch to desktop, review on web. Same thread, same context, same approval state. All channels write to the same tables. Nothing to reconcile.

### 7. Dark Matter — Invisible Agent Learning from Observation
A learning agent subscribes to ALL trajectories and tool calls. Watches patterns. Distills learnings into memory. The system compounds intelligence. Every failure teaches.

### 8. Magnetar — Sub-Millisecond Approval Gates
Agent requests approval → appears on ALL surfaces instantly → human clicks → agent resumes in milliseconds. Two reducer calls over WebSocket. No polling interval. No webhook delay.

### 9. Quasar Beam — Live Workflow Stage Transparency
The 7-stage workflow visible in real-time. See the gather step populating, the act step streaming tool calls, the verify step running tests. Not a progress bar — a live x-ray.

### 10. Stargate — Instant Agent Spawning from Any Surface
Spawn from Slack → desktop shows it in ~107ms. One database, many views. The agent exists in SpacetimeDB — every surface is just a subscriber.

## Competitive Moat

| Feature | SpacetimeDB Capability | What Competitors Need to Build |
|---------|----------------------|-------------------------------|
| Orbital Sync | Filtered subscriptions + client cache | Push-based inter-agent state sharing |
| Pulsar Trace | Push updates + zero-latency reads | Live trace streaming infrastructure |
| Nebula Memory | Namespace subscriptions | Real-time knowledge propagation |
| Event Horizon | SQL invalidation | Sub-10ms conditional triggers |
| Gravity Well | Cross-table queries + atomic claiming | Real-time resource scheduling |
| Redshift | Cross-client identity | True cross-platform continuity |
| Dark Matter | Reducer callbacks (any client) | Passive cross-agent learning loop |
| Magnetar | Bidirectional WebSocket reducers | Sub-ms approval round trips |
| Quasar Beam | Execution graph subscriptions | Live workflow topology streaming |
| Stargate | Push subscriptions + identity | Surface-agnostic agent spawning |
