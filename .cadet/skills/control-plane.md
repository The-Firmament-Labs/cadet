---
name: control-plane
description: Local Bun and cloud Next.js control plane API patterns — dispatch, reconciliation, heartbeats
triggers:
  - file_pattern: "apps/local-control/**"
  - file_pattern: "apps/web/app/api/**"
  - file_pattern: "apps/web/lib/server.ts"
---

# Control Plane Skill

## Dual Control Plane Architecture

Cadet runs two control planes with identical API shapes:

| Plane | Runtime | URL | Port |
|-------|---------|-----|------|
| Local | Bun HTTP server | http://localhost:3010 | 3010 |
| Cloud | Next.js on Vercel | https://<domain> | 3001 (dev) |

## API Endpoints

### Job Dispatch
- `POST /api/jobs/dispatch` (cloud) / `POST /jobs/dispatch` (local)
- Body: `{ agentId, goal, priority?, context? }`
- Creates JobRecord + WorkflowRun in SpacetimeDB

### Agent Registration
- `POST /api/agents/register` (cloud) / `POST /agents/register` (local)
- Body: full agent manifest JSON
- Upserts AgentRecord in SpacetimeDB

### Edge Dispatch (cloud only)
- `POST /api/agents/edge/dispatch`
- Runs on Vercel Edge Runtime for low-latency agent execution
- Body: `{ agentId, goal }`

### Schedule Reconciliation
- `GET /api/cron/reconcile` (cloud, protected by CRON_SECRET)
- `POST /schedules/reconcile` (local)
- Wakes due schedules, marks stale runners, dispatches overdue jobs

### Health
- `GET /api/health` (cloud) / `GET /health` (local)

## SpacetimeDB Client Pattern

```typescript
import { StarbridgeControlClient } from "@starbridge/sdk";

const client = new StarbridgeControlClient({
  baseUrl: env.spacetimeUrl,       // e.g., http://127.0.0.1:3000
  database: env.database,          // e.g., starbridge-control
  authToken: env.authToken,        // optional SpacetimeDB auth token
});

// SQL queries
const rows = await client.sql("SELECT * FROM workflow_run WHERE status = 'running'");

// Reducer calls
await client.callReducer("submit_job", [jobId, agentId, goal, ...]);
```

## Runner Presence

Runners register heartbeats via `RunnerPresence` table:
- `runner_id` — unique per agent+role combination (e.g., `operator-edge@cloud`)
- `status` — active, stale
- `last_seen_at` — timestamp, stale after 90s (configurable via `STARBRIDGE_PRESENCE_TTL_MS`)

## Channel Routing

Inbound messages from different channels create ThreadRecords:
- `web` — dashboard inbox
- `slack` — Slack webhook events
- `github` — GitHub webhook events (issues, PRs)
- `system` — internal scheduled/cron triggers
