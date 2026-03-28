# API Routes

The cloud control plane (`apps/web`) exposes 20 HTTP endpoints via the Next.js App Router.

## Authentication

All operator-facing routes require a valid `cadet_session` cookie, verified via
`requireOperatorApiSession` from `apps/web/lib/auth.ts`. That function returns an
`authToken` that is forwarded to every SpacetimeDB call so the session is
propagated through the full request chain.

Bot webhook routes use platform-specific verification inside the adapter returned
by `getBot()` (`apps/web/lib/bot.ts`). The legacy event-ingestion routes
(`/api/slack/events`, `/api/github/events`) are unauthenticated at the HTTP layer
and rely on payload-level verification inside `ingestSlackEvent` / `ingestGitHubEvent`
in `apps/web/lib/server.ts`.

The health and catalog routes are fully unauthenticated.

---

## Auth Routes

WebAuthn passkey flows. Both login and register are two-step: first call with
`?step=options` to obtain a challenge, then call with `?step=verify` to complete
the ceremony. Challenges are stored in-memory with a 5-minute TTL.

| Method | Path | Auth | Body / Query | Description |
|--------|------|------|--------------|-------------|
| POST | `/api/auth/register` | None | `?step=options` — `{ displayName, email }` | Begin passkey registration; returns WebAuthn creation options |
| POST | `/api/auth/register` | None | `?step=verify` — WebAuthn credential response | Complete registration; creates `operator_account` row in SpacetimeDB via `register_operator` reducer and sets `cadet_session` cookie |
| POST | `/api/auth/login` | None | `?step=options` — `{ email }` | Begin passkey authentication; returns WebAuthn get options and `operatorId` |
| POST | `/api/auth/login` | None | `?step=verify` — WebAuthn assertion response | Verify assertion, update counter via `update_webauthn_counter` reducer, set `cadet_session` cookie |
| POST | `/api/auth/logout` | Cookie | — | Calls `clearSessionCookie`, returns `{ ok: true }` |

Source: `apps/web/app/api/auth/`

---

## Agent Routes

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/agents/register` | Cookie | `AgentManifest` JSON | Register a cloud agent; delegates to `registerAgentFromPayload` in `lib/server.ts` |
| POST | `/api/agents/edge/dispatch` | Cookie | `{ agentId?, goal, priority?, context? }` | Dispatch a job to an edge-targeted agent; delegates to `dispatchEdgeJobFromPayload`. Runs on the default Node.js runtime (not Edge) so the session guard can execute |

Source: `apps/web/app/api/agents/`

---

## Job Routes

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/jobs/dispatch` | Cookie | `{ agentId, goal, priority?, context? }` | Dispatch a full workflow job; delegates to `dispatchJobFromPayload` in `lib/server.ts`. Returns `{ ok: true, result }` or `{ ok: false, error }` with status 400 |

Source: `apps/web/app/api/jobs/dispatch/route.ts`

---

## Run Routes

| Method | Path | Auth | Params | Description |
|--------|------|------|--------|-------------|
| GET | `/api/runs/[runId]` | Cookie | `runId` path segment | Load details for a single workflow run via `loadRunDetails` |
| POST | `/api/runs/[runId]/retry` | Cookie | `runId` path segment | Retry a failed or cancelled run via `retryWorkflowRun` |

Source: `apps/web/app/api/runs/`

---

## Inbox Route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/inbox` | Cookie | Returns the operator inbox via `loadInbox`. Used by the dashboard to surface pending items |

Source: `apps/web/app/api/inbox/route.ts`

---

## Approval Routes

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/api/approvals/[approvalId]/resolve` | Cookie | `{ decision, reason? }` (or empty body) | Resolve a pending approval request via `resolveApprovalFromPayload` |

Source: `apps/web/app/api/approvals/`

---

## Browser Task Routes

| Method | Path | Auth | Params | Description |
|--------|------|------|--------|-------------|
| GET | `/api/browser/tasks/[taskId]` | Cookie | `taskId` path segment | Load details for a browser automation task via `loadBrowserTask` |

Source: `apps/web/app/api/browser/`

---

## SSE Stream

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stream` | Cookie (raw header check) | Server-Sent Events stream. Marked `force-dynamic`. Checks for `cadet_session=` in the raw `Cookie` header (returns 401 if absent) |

The stream polls SpacetimeDB every 2 seconds via four parallel SQL queries and
emits two event types:

- `connected` — emitted once on connection: `{ ts: number }`
- `snapshot` — emitted on every poll cycle:
  ```
  {
    ts: number,
    runs: WorkflowRun[],          // last 20, ordered by updated_at_micros DESC
    approvals: ApprovalRequest[], // pending only, last 20
    browserTasks: BrowserTask[],  // last 10
    agents: AgentRecord[],        // all registered agents
    metrics: {
      activeRuns: number,
      pendingApprovals: number,
      browserTasks: number,
      connectedAgents: number
    }
  }
  ```

Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`.

Source: `apps/web/app/api/stream/route.ts`

---

## Bot Webhook Routes

All three routes follow the same pattern: retrieve the platform adapter from
`getBot()` and call `bot.webhooks[platform](request, { waitUntil })`. They use
`next/server`'s `after()` to defer background work past the response. Return 501
if the adapter is not configured.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/bot/slack` | Adapter-level | Slack webhook via `getBot().webhooks["slack"]` |
| POST | `/api/bot/discord` | Adapter-level | Discord webhook via `getBot().webhooks["discord"]` |
| POST | `/api/bot/telegram` | Adapter-level | Telegram webhook via `getBot().webhooks["telegram"]` |

Source: `apps/web/app/api/bot/`

---

## Event Ingestion Routes

Legacy direct-ingestion routes. No HTTP-layer auth; payload verification is
handled inside the server functions.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/slack/events` | None (payload-level) | Ingest a Slack event payload via `ingestSlackEvent` |
| POST | `/api/github/events` | None (payload-level) | Ingest a GitHub webhook payload via `ingestGitHubEvent` |

Source: `apps/web/app/api/slack/events/route.ts`, `apps/web/app/api/github/events/route.ts`

---

## Catalog Route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/catalog` | None | Returns `{ ok: true, plane: "cloud", agents: cloudAgentCatalog }` — the list of available cloud agents from `lib/cloud-agents.ts` |

Source: `apps/web/app/api/catalog/route.ts`

---

## Cron Route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cron/reconcile` | `Authorization: Bearer <CRON_SECRET>` | Triggered by Vercel cron (configured in `apps/web/vercel.json`). Calls `reconcileCloudControlPlane()` to sync scheduled jobs. Returns `{ ok, action, database, ...result }` |

The `CRON_SECRET` env var must be set. Requests without a matching `Bearer` token
receive a 401.

Source: `apps/web/app/api/cron/reconcile/route.ts`

---

## Health Route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Calls `createControlClient().schema()` to verify SpacetimeDB connectivity. Returns `{ ok, plane: "cloud", environment, edgeAgents, schema }` on success or `{ ok: false, environment, error }` with status 500 on failure |

Source: `apps/web/app/api/health/route.ts`

---

## Summary Table

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register?step=options\|verify` | None |
| POST | `/api/auth/login?step=options\|verify` | None |
| POST | `/api/auth/logout` | Cookie |
| POST | `/api/agents/register` | Cookie |
| POST | `/api/agents/edge/dispatch` | Cookie |
| POST | `/api/jobs/dispatch` | Cookie |
| GET | `/api/runs/[runId]` | Cookie |
| POST | `/api/runs/[runId]/retry` | Cookie |
| GET | `/api/inbox` | Cookie |
| POST | `/api/approvals/[approvalId]/resolve` | Cookie |
| GET | `/api/browser/tasks/[taskId]` | Cookie |
| GET | `/api/stream` | Cookie (raw header) |
| POST | `/api/bot/slack` | Adapter-level |
| POST | `/api/bot/discord` | Adapter-level |
| POST | `/api/bot/telegram` | Adapter-level |
| POST | `/api/slack/events` | None (payload-level) |
| POST | `/api/github/events` | None (payload-level) |
| GET | `/api/catalog` | None |
| GET | `/api/cron/reconcile` | Bearer token |
| GET | `/api/health` | None |

## Implementation Notes

All operator-facing routes delegate to functions in `apps/web/lib/server.ts`.
The auth guard in `apps/web/lib/auth.ts` (`requireOperatorApiSession`) extracts
the `cadet_session` cookie, decodes the `OperatorSession`, and returns an
`authToken` for downstream SpacetimeDB calls.

The local control plane (`apps/local-control`) exposes a parallel set of routes
without the Next.js App Router: `GET /health`, `GET /catalog`,
`POST /agents/register`, `POST /jobs/dispatch`, `POST /agents/local/dispatch`,
and `POST /schedules/reconcile`.
