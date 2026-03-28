# Cadet

Cadet is an event-driven agent platform scaffold that blends:

- Eliza-style manifest-driven agents and pluggable extension points.
- Hermes-style CLI + memory + cloud/runtime separation.
- OpenClaw-style control plane, scheduled wakeups, and multi-surface operations.
- SpacetimeDB v2 as the shared state fabric.
- Vercel as the operator-facing control plane and webhook/cron surface.
- Rust for the runtime kernel and cloud runner.

## Planning docs

- [Conversation synthesis](docs/CONVERSATION_SYNTHESIS.md)
- [RALPH loop](docs/RALPH_LOOP.md)
- [Implementation phases](IMPLEMENTATION_PHASES.md)
- [Session tracker](SESSION.md)

## Guide docs

- [Docs index](docs/README.md)
- [Architecture guide](docs/ARCHITECTURE_GUIDE.md)
- [Dioxus + SpacetimeDB guide](docs/DIOXUS_SPACETIMEDB.md)
- [Agent manifests guide](docs/AGENT_MANIFESTS.md)
- [Dynamic agent UI](docs/DYNAMIC_AGENT_UI.md)
- [GitHub automation guide](docs/GITHUB_AUTOMATION.md)
- GitHub Pages project hub: generated from `SESSION.md`, `MASTER_IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_PHASES.md`, and `docs/**` through `.github/workflows/github-pages.yml`, with the built source also uploaded in CI as `cadet-project-hub-source`
- GitHub Releases: cut from `v*.*.*` tags through `.github/workflows/release.yml`, attaching the current session tracker, implementation plans, and a packaged project-hub snapshot

## Repo layout

```text
apps/local-control    Bun local control plane
apps/web              Next.js cloud control plane for Vercel
packages/core         Shared TypeScript types, validation, prompt building
packages/sdk          SpacetimeDB control-plane client
packages/cli          Main CLI (`starbridge`)
rust/starbridge-core  Rust runtime kernel
rust/starbridge-runner Rust cloud runner binary
spacetimedb           SpacetimeDB v2 module
examples/agents       Example agent manifests
```

## Why this is better than a direct mashup

- The stateful runtime is separated from both control planes.
- Local agents and edge agents are modeled explicitly instead of overloading one deployment field.
- SpacetimeDB owns shared state instead of ad hoc JSON or process memory.
- The CLI, web, and runner all share the same manifest and job contracts.
- Vercel is used where it is strong: orchestration, operator APIs, scheduled wakeups, and edge-hosted lightweight agents.
- Rust owns the critical execution path instead of treating it as an afterthought.
- Heartbeats and schedules are stored in SpacetimeDB instead of hidden in process memory.

## Quick start

1. Install JavaScript dependencies:

   ```bash
   bun install
   ```

2. Start SpacetimeDB locally in a separate terminal:

   ```bash
   spacetime start
   ```

3. Build and test the TypeScript surfaces:

   ```bash
   bun run typecheck
   bun run test
   bun run build
   ```

4. Validate the Rust crates:

   ```bash
   RUSTUP_TOOLCHAIN=stable cargo test --workspace
   ```

5. Build the SpacetimeDB module:

   ```bash
   cd spacetimedb
   spacetime build
   ```

6. Publish the module to a local database:

   ```bash
   spacetime publish --server local --project-path spacetimedb starbridge-control
   ```

7. Run the local control plane:

   ```bash
   bun run dev:local-control
   ```

8. Run the cloud control plane:

   ```bash
   bun run dev:web
   ```

9. Bootstrap SpacetimeDB locally:

   ```bash
   bun run spacetime:bootstrap:local
   bun run spacetime:status
   ```

10. Use the main CLI:

   ```bash
   bun run cli -- agents list --dir ./examples/agents
   bun run cli -- prompt compose --agent-file ./examples/agents/researcher.agent.json --goal "Draft a launch plan for a Solana staking analytics agent"
   bun run cli -- job submit --agent researcher --goal "Audit the new treasury policy" --api http://localhost:3010 --dir ./examples/agents
   curl -X POST http://localhost:3010/schedules/reconcile
   curl -X POST http://localhost:3001/api/agents/edge/dispatch -H 'content-type: application/json' -d '{"agentId":"operator","goal":"Triage the deploy incident"}'
   curl -H 'authorization: Bearer $CRON_SECRET' http://localhost:3001/api/cron/reconcile
   ```

11. Build the cloud-runner container:

   ```bash
   docker build -f docker/runner.Dockerfile -t starbridge-runner .
   ```

## Environment

Copy [.env.example](.env.example) to `.env.local` for local work. The web app expects the same variables in `apps/web/.env.local` or your Vercel project settings:

```bash
SPACETIMEDB_URL=http://127.0.0.1:3000
SPACETIMEDB_DATABASE=starbridge-control
SPACETIMEDB_AUTH_TOKEN=
CRON_SECRET=replace-me
NEXT_PUBLIC_CONTROL_PLANE_URL=http://localhost:3001
STARBRIDGE_HEARTBEAT_INTERVAL_MS=30000
STARBRIDGE_SCHEDULE_INTERVAL_MS=30000
STARBRIDGE_PRESENCE_TTL_MS=90000
```

## Control planes

- Local plane: `apps/local-control` serves `GET /health`, `GET /catalog`, `POST /agents/register`, `POST /jobs/dispatch`, `POST /agents/local/dispatch`, and `POST /schedules/reconcile`.
- Cloud plane: `apps/web` serves `GET /api/catalog`, `POST /api/agents/register`, `POST /api/jobs/dispatch`, `POST /api/agents/edge/dispatch`, `GET /api/cron/reconcile`, and `GET /api/health`.
- Local agents heartbeat into `runner_presence` on a fixed interval and scheduled local jobs are reconciled by the Bun control plane.
- Cloud agents heartbeat on edge execution and scheduled cloud jobs are reconciled by the secure Vercel cron route.

## Vercel

- Deploy `apps/web` as the Vercel project root.
- `apps/web/vercel.json` configures a secure cron hit to `/api/cron/reconcile`.
- `app/api/agents/edge/dispatch/route.ts` runs on the Edge Runtime.
- `examples/agents/*.agent.json` can carry `schedules[]` definitions and those schedules are registered idempotently into SpacetimeDB.
- Long-running or stateful agents should stay in the Rust runner, not in an edge or request path.
- On Vercel, `SPACETIMEDB_URL` and `SPACETIMEDB_DATABASE` are required at runtime. The cloud control plane now fails fast instead of silently falling back to `127.0.0.1`.
- `NEXT_PUBLIC_CONTROL_PLANE_URL` is optional on Vercel; when omitted, Cadet derives the public URL from Vercel runtime metadata.

## SpacetimeDB bootstrap

Local database:

```bash
spacetime start
bun run spacetime:bootstrap:local
bun run spacetime:status
```

Maincloud database:

```bash
SPACETIME_SERVER=maincloud \
SPACETIME_BASE_URL=https://maincloud.spacetimedb.com \
SPACETIME_DATABASE=cadet-control \
bun run spacetime:bootstrap
```

Available helpers:

```bash
bun run spacetime:build
bun run spacetime:publish
bun run spacetime:seed -- --catalog all
bun run spacetime:status
```

If the module schema changes and Maincloud rejects the publish because of existing data, rerun with:

```bash
SPACETIME_DELETE_DATA=1 bun run spacetime:publish
```

## GitHub Actions

- `.github/workflows/ci.yml` is the required validation pipeline. It runs `actionlint`, `bun run typecheck`, `bun run test`, `bun run build`, `cargo test --workspace`, and `spacetime build`.
- `.github/workflows/auto-label.yml` applies PR path labels and issue keyword labels.
- `.github/workflows/sync-labels.yml` keeps the repository label set in sync with `.github/labels.json`.
- `.github/workflows/agent-review.yml` handles PR review and issue triage using Claude.
- `.github/workflows/agent-fix-ci.yml` attempts same-repo PR CI fixes up to three times before labeling the PR `needs-human-fix`.
- `.github/workflows/agent-implement.yml` turns `agent-ready` issues into draft PRs on `agent/<issue>-<slug>` branches.
- `.github/workflows/claude.yml` handles explicit `@claude` requests on issues and review comments.
- `.github/workflows/vercel-deploy.yml` deploys `apps/web` to Vercel on `main` once these repository secrets are configured:
  - `ANTHROPIC_API_KEY`
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
- Optional secret:
  - `GH_PAT` when the default `GITHUB_TOKEN` does not have enough permission to push agent-authored branches or open PRs under repository policy.
- Until the Vercel secrets exist, the deploy workflow exits cleanly in a skipped state so the repo stays green.
- Successful Vercel deploys now write a GitHub deployment/status record back to the repository so production URLs show up in the repo deployment history.

Branch conventions:

- `main` is the only long-lived integration branch.
- `codex/**` is reserved for manual agent/dev work.
- `agent/<issue>-<slug>` is reserved for implementation-agent branches.

Common automation labels:

- `agent-ready`
- `agent-in-progress`
- `agent-authored`
- `needs-human-fix`
- `bug`
- `security`
- `performance`
- `browser`
- `workflow`
- `memory`
- `deployment`
- `docs`

## SpacetimeDB notes

As checked on March 27, 2026:

- The installed CLI on this machine is `2.1.0`.
- The official docs entry point still defaults to a `2.0.0` docs view.

This scaffold targets SpacetimeDB v2 semantics and uses the current `spacetimedb = "2.1.0"` crate in the module.
