---
name: cadet-agent-ops
description: Autonomous agent operations for the Cadet platform — manifest validation, workflow stage management, SpacetimeDB reducer patterns
triggers:
  - file_pattern: "examples/agents/**/*.json"
  - file_pattern: "spacetimedb/src/**"
  - file_pattern: "packages/core/src/**"
---

# Cadet Agent Operations

Use this skill when working with agent manifests, SpacetimeDB reducers, workflow stage code, or `packages/core` types.

## Agent Manifest JSON Schema

Manifests live in `examples/agents/` as `*.agent.json`. TypeScript source of truth: `packages/core/src/agent-manifest.ts`. Rust mirror: `rust/starbridge-core/src/lib.rs`.

### Required top-level fields

```json
{
  "id": "kebab-case-stable-id",
  "name": "Human Name",
  "description": "Operator-facing description.",
  "system": "System prompt text.",
  "model": "gpt-5.4",
  "runtime": "rust-core",
  "deployment": {
    "controlPlane": "local",
    "execution": "local-runner",
    "workflow": "research"
  },
  "tags": [],
  "tools": { "allowExec": false, "allowBrowser": false, "allowNetwork": false, "allowMcp": false },
  "memory": { "namespace": "default", "maxNotes": 200, "summarizeAfter": 16 },
  "workflowTemplates": [],
  "toolProfiles": [],
  "handoffRules": [],
  "learningPolicy": { "enabled": false, "summarizeEveryRuns": 5, "embedMemory": false, "maxRetrievedChunks": 4 },
  "schedules": []
}
```

### Runtime values
- `rust-core` — long-lived subscription-driven Rust worker
- `bun-sidecar` — local Bun sidecar process
- `edge-function` — Vercel/Cloudflare edge function

### Deployment combinations
| controlPlane | execution | Use case |
|---|---|---|
| `local` | `local-runner` | Private/dev agents |
| `cloud` | `vercel-edge` | Edge-triaged cloud agents |
| `cloud` | `container-runner` | Durable heavy execution |
| `cloud` | `maincloud-runner` | SpacetimeDB Maincloud workers |

### Browser policy block (`tools.browser`)

```json
{
  "enabled": true,
  "allowedDomains": ["github.com", "docs.example.com"],
  "blockedDomains": [],
  "maxConcurrentSessions": 2,
  "allowDownloads": false,
  "defaultMode": "extract",
  "requiresApprovalFor": ["form", "download"]
}
```

Browser modes: `read`, `extract`, `navigate`, `form`, `download`, `monitor`. The modes `form` and `download` should almost always be in `requiresApprovalFor`.

## Workflow Stage Transitions

Canonical stage order: `route` → `plan` → `gather` → `act` → `verify` → `summarize` → `learn`

Not all stages are required. A minimal workflow may be `route` → `act` → `summarize`. The `learn` stage is managed by the learning worker, not the main runner.

Stage ownership by execution target:
- `route`: claimed by the control plane (local or edge) that received the request
- `plan`, `gather`, `act`, `verify`: claimed by `local-runner` or `container-runner`
- `act` with browser: handed off to `browser-worker` via `browser_task`
- `learn`: claimed by `learning-worker`

### `WorkflowStep` status lifecycle
`ready` → `running` → (`awaiting-approval` →) `completed` | `failed`

Blocked steps (unresolved `depends_on_step_id`) stay `ready` until their dependency reaches `completed`.

## SpacetimeDB Table Relationships

```
agent_record (agent_id)
  └── job_record (agent_id)
  └── workflow_run (agent_id, run_id)
        └── workflow_step (run_id, step_id)
              ├── approval_request (run_id, step_id)
              ├── tool_call_record (run_id, step_id)
              └── browser_task (run_id, step_id)
                    └── browser_artifact (task_id, run_id, step_id)
  └── memory_document (agent_id, namespace)
        └── memory_chunk (document_id, agent_id, namespace)
              └── memory_embedding (chunk_id, agent_id, namespace)
  └── schedule_record (agent_id, schedule_id)
  └── runner_presence (agent_id, runner_id)
```

Key foreign key patterns:
- All workflow objects carry both `run_id` and `agent_id` for efficient subscription filtering
- `workflow_step.depends_on_step_id` is nullable — null means no dependency
- `workflow_step.approval_request_id` is nullable — set when step requires approval before proceeding
- `browser_task.step_id` links back to the step that spawned the task

## Reducer Naming Conventions (`spacetimedb/src/lib.rs`)

Reducers follow the pattern `verb_noun` in snake_case:

- `register_agent` — upsert `agent_record`
- `dispatch_job` — insert `job_record`
- `seed_workflow_run` — insert `workflow_run` + initial `workflow_step`
- `claim_workflow_step` — transition step to `running`, set `runner_id`
- `complete_workflow_step` — write `output_json`, transition to `completed`
- `fail_workflow_step` — transition to `failed`
- `enqueue_next_step` — insert next `workflow_step` with correct `stage` and `owner_execution`
- `request_approval` — insert `approval_request`, block step
- `resolve_approval` — update `approval_request.status`, unblock step
- `create_browser_task` — insert `browser_task`
- `complete_browser_task` — write `result_json`, update status
- `write_memory_document` — insert `memory_document`
- `heartbeat_runner` — upsert `runner_presence`

## Job Dispatch Pattern

Jobs enter through the control plane (local at `localhost:3010` or cloud at Vercel), not directly into SpacetimeDB from external callers.

Flow:
1. POST `/api/dispatch` with `{ agentId, goal, priority?, requestedBy? }`
2. Control plane calls `normalizeJobRequest()` from `@starbridge/core`
3. Control plane calls `seedWorkflowFromGoal()` to create `workflow_run` + `route` step
4. Runner subscription picks up the `route` step and claims it

Priority values: `low`, `normal`, `high`, `critical`

## `packages/core` Key Exports

- `AgentManifest` — manifest type
- `WorkflowRun`, `WorkflowStep` — runtime workflow types
- `JobRequest`, `JobRecord` — job dispatch types
- `seedWorkflowFromGoal()` — creates run + first step
- `nextWorkflowStage()` — returns the next stage given current
- `ownerExecutionForStage()` — maps stage to execution target from manifest
- `isScheduleDue()` — checks if a `ScheduleRecord` needs to fire
- `filterAgentsByControlPlane()` — filter manifest list by `local`/`cloud`
- `executeEdgeAgent()` — edge function execution wrapper

## Common Mistakes to Avoid

- Do not set `deployment.execution = "browser-worker"` in the manifest — browser handoff happens via `handoffRules`, not as the primary execution target
- Do not use `controlPlane: "maincloud"` — only `"local"` and `"cloud"` are valid control plane targets
- Do not omit `workflowTemplates` — at minimum provide one template with `stages`
- Do not put the same domain in both `allowedDomains` and `blockedDomains`
- `schedule.intervalMinutes` must be >= 1; use `enabled: false` for dormant schedules
