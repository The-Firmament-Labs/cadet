---
name: workflow-ops
description: Workflow stage management, step dependencies, and approval gate patterns for Cadet autonomous agents
triggers:
  - file_pattern: "packages/core/src/**"
  - file_pattern: "spacetimedb/src/**"
  - file_pattern: "apps/web/lib/server.ts"
  - file_pattern: "apps/local-control/**"
---

# Workflow Operations Skill

## Workflow Stage Pipeline

Every Cadet workflow follows this stage sequence:

```
route → plan → gather → act → verify → summarize → learn
```

| Stage | Owner | Purpose |
|-------|-------|---------|
| `route` | Edge/Cloud | Classify the goal, select execution target, create thread |
| `plan` | Runner | Break goal into executable steps |
| `gather` | Runner | Collect evidence, browse, query APIs |
| `act` | Runner | Execute the plan — write code, call APIs, run tools |
| `verify` | Runner/Browser | Validate results, run tests, check artifacts |
| `summarize` | Runner | Produce operator-facing summary |
| `learn` | Runner | Extract reusable knowledge, store memory notes |

## SpacetimeDB Tables

### WorkflowRun
Primary record for a workflow execution:
- `run_id` (PK), `thread_id`, `agent_id`, `goal`, `priority`
- `current_stage` — which stage is active
- `status` — queued, running, blocked, awaiting-approval, completed, failed
- `trigger_source` — what initiated this run (cron, web, slack, github)

### WorkflowStep
Individual step within a run:
- `step_id` (PK), `run_id`, `agent_id`, `stage`
- `owner_execution` — who executes (edge, local-runner, container-runner, browser-worker)
- `status` — ready, running, blocked, awaiting-approval, completed, failed
- `depends_on_step_id` — dependency chain
- `approval_request_id` — links to ApprovalRequest if gated

### ApprovalRequest
Human-in-the-loop gate:
- `approval_id` (PK), `run_id`, `step_id`, `agent_id`
- `title`, `detail`, `risk` (low, medium, high, critical)
- `status` — pending, approved, rejected, expired

## Dispatch Flow

```
1. Goal arrives (web/slack/github/cron)
2. Cloud control plane seeds WorkflowRun + route step
3. Route step classifies → picks execution target
4. For each subsequent stage:
   a. Create WorkflowStep with depends_on_step_id
   b. If browser work needed → create BrowserTask
   c. If high-risk → create ApprovalRequest, step blocked until resolved
   d. Runner claims step, executes, writes output
5. summarize + learn stages run after verify completes
6. WorkflowRun status → completed
```

## Key Functions (lib/server.ts)

- `seedWorkflowFromGoal()` — creates run + route step
- `nextWorkflowStage()` — advances to next stage
- `ownerExecutionForStage()` — determines who runs each stage
- `createStepId()` — generates deterministic step IDs
- `executeEdgeAgent()` — runs edge-hosted agent inline
