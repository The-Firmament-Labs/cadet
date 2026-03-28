# Autonomous Execution Loop

## SpacetimeDB-Native Event Loop

Cadet agents run as subscribers to SpacetimeDB v2 tables. The execution loop is event-driven, not polling-based.

### Subscription Model

```rust
// Agent subscribes to its own work queue
subscribe!("SELECT * FROM workflow_step WHERE agent_id = ? AND status = 'ready'", agent_id);
subscribe!("SELECT * FROM approval_request WHERE agent_id = ? AND status = 'approved'", agent_id);
subscribe!("SELECT * FROM schedule_record WHERE agent_id = ? AND status = 'ready'", agent_id);
```

When a matching row appears or changes, the agent's reducer fires automatically.

### Event-Driven Stage Transitions

```
WorkflowStep(status: ready) → Agent claims step → status: running
Agent executes → step output written → status: completed
Next stage's step created with depends_on_step_id → status: ready
```

No polling. No cron. SpacetimeDB pushes state changes to all subscribers in real-time.

### Schedule Wakeup

```
ScheduleRecord(next_run_at_micros <= now) → reconcile reducer fires
→ creates JobRecord + WorkflowRun
→ first step becomes ready
→ agent subscription fires
→ execution begins
```

### Approval Gate Flow

```
Step requires approval → ApprovalRequest created → step status: awaiting-approval
Operator approves via dashboard → ApprovalRequest status: approved
Agent subscription fires → step resumes → status: running
```

## Self-Improvement Cycle

Every LEARN stage should:
1. Extract patterns from the run's execution
2. Store as MemoryDocument with embeddings
3. On next run, PLAN stage queries memory for relevant prior art
4. Agent improves over time without code changes

## Multi-Agent Coordination

Agents coordinate through shared SpacetimeDB state:
- Agent A creates a BrowserTask → browser-worker picks it up
- Agent A's step blocks on the task → resumes when task completes
- Both agents subscribe to the same tables — no message passing needed
