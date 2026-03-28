# Contributing to Cadet

## Repo Layout

| Path | Type | Description |
|------|------|-------------|
| `apps/web` | Next.js app | Cloud control plane served on Vercel |
| `apps/local-control` | Bun app | Local control plane for on-machine agent ops |
| `packages/core` | TypeScript lib | Shared types, validation, prompt building, tool registry (`@starbridge/core`) |
| `packages/sdk` | TypeScript lib | SpacetimeDB control-plane client (`@starbridge/sdk`) |
| `packages/cli` | TypeScript bin | Main CLI (`starbridge`) |
| `rust/starbridge-core` | Rust crate | Runtime kernel |
| `rust/starbridge-runner` | Rust crate | Cloud runner binary |
| `spacetimedb` | SpacetimeDB module | Shared state fabric (Rust, v2) |
| `examples/agents` | JSON | Example agent manifests |
| `scripts/` | Bun scripts | SpacetimeDB build/publish/seed helpers, doc link checker |
| `.github/workflows/` | CI/CD | 6 required jobs + agent automation workflows |

## Prerequisites

- **Bun** 1.2+ (project uses `bun@1.3.10` as `packageManager`)
- **Rust** stable toolchain (`RUSTUP_TOOLCHAIN=stable`)
- **SpacetimeDB CLI** `spacetime` 2.1.0+
- **Node.js** 24+ (type definitions target `@types/node ^24`)
- **Docker** (optional, for building the cloud-runner container)

## Dev Setup

1. Install JavaScript dependencies:
   ```bash
   bun install
   ```

2. Start SpacetimeDB locally (separate terminal):
   ```bash
   spacetime start
   ```

3. Build and publish the SpacetimeDB module:
   ```bash
   bun run spacetime:build
   spacetime publish --server local --project-path spacetimedb starbridge-control
   ```

4. Bootstrap the local database:
   ```bash
   bun run spacetime:bootstrap:local
   bun run spacetime:status
   ```

5. Copy environment variables:
   ```bash
   cp .env.example apps/web/.env.local
   # fill in AUTH_SECRET, CRON_SECRET, and SPACETIMEDB_* values
   ```

6. Start the local control plane:
   ```bash
   bun run dev:local-control
   ```

7. Start the cloud control plane (Next.js):
   ```bash
   bun run dev:web
   ```

The web app runs on `http://localhost:3001` by default. The local control plane
runs on `http://localhost:3010`.

## Running Tests

All CI checks must pass before merging. Run them locally in the same order as CI:

```bash
# TypeScript — all 5 packages (core, sdk, cli, local-control, web)
bun run typecheck

# Vitest — 170+ tests across packages/core, packages/sdk, packages/cli, apps/web
bun run test

# Full build
bun run build

# Rust workspace
RUSTUP_TOOLCHAIN=stable cargo test --workspace

# SpacetimeDB module
cd spacetimedb && spacetime build
```

CI also runs `bun run docs:check` and `bun run docs:build` (the `docs` job).
Run those locally before touching any file in `docs/` or `SESSION.md`.

## Adding a New Tool

Tools are the atomic capabilities exposed to agents.

1. Add a `ToolDefinition` entry to `packages/core/src/tools.ts`.
2. Add a corresponding row to `docs/TOOLS_REFERENCE.md`.
3. Update the tool count in `.cadet/README.md`.
4. If the tool requires a new server function, add it to `apps/web/lib/server.ts`
   and expose it through an appropriate route in `apps/web/app/api/`.

## Adding a SpacetimeDB Reducer

Reducers are the write path for all shared state.

1. Add a `#[reducer]` function to `spacetimedb/src/lib.rs`.
2. Run `spacetime build` to verify compilation, then republish:
   ```bash
   bun run spacetime:publish
   ```
   If the schema changed incompatibly, set `SPACETIME_DELETE_DATA=1` before
   publishing to a local database.
3. Update the SDK client in `packages/sdk/src/client.ts` with a typed wrapper
   that calls `client.callReducer("your_reducer_name", [...args])`.
4. Document the reducer in `docs/ARCHITECTURE_GUIDE.md` (section 5 covers the
   SpacetimeDB module).

## Adding a New API Route

Cloud control plane routes live under `apps/web/app/api/`.

1. Create `apps/web/app/api/<your-path>/route.ts`.
2. Import `requireOperatorApiSession` from `../../../../lib/auth` if the route
   is operator-facing (cookie auth).
3. Delegate business logic to a function in `apps/web/lib/server.ts` rather than
   putting it in the route handler.
4. Add the route to `docs/API_ROUTES.md`.

## Adding an Agent

Agents are defined as JSON manifests and can carry schedule definitions.

1. Create `examples/agents/{name}.agent.json` following the `AgentManifest`
   schema in `packages/core/src/agent-manifest.ts`.
2. Add agent-specific prompts to `.cadet/prompts/agents/{name}.md`.
3. Register the agent either:
   - Locally: `bun run cli -- agents list --dir ./examples/agents` to verify,
     then register via `POST /agents/register` on the local control plane.
   - Cloud: `POST /api/agents/register` with the manifest as the request body.
4. If the manifest includes `schedules[]`, those are registered idempotently into
   SpacetimeDB on the next reconcile cycle.
5. Long-running or stateful agents belong in the Rust runner
   (`rust/starbridge-runner`), not in an edge or request path.

## Commit Style

Follow the existing pattern:

```bash
git log --oneline -10
```

The repo uses short imperative-mood subject lines without a scope prefix. Keep
subjects under 72 characters. No `Co-Authored-By` trailers.

Branch conventions:

- `main` — only long-lived integration branch
- `codex/**` — manual agent/dev work
- `agent/<issue>-<slug>` — branches created by the implementation agent workflow

## CI

Six required jobs defined in `.github/workflows/ci.yml`, all gated by a
`ci-status` aggregator job:

| Job | Command | What it checks |
|-----|---------|----------------|
| `typecheck` | `bun run typecheck` | TypeScript across all 5 packages |
| `test` | `bun run test` | Vitest suites (packages/core, sdk, cli, apps/web) |
| `build` | `bun run build` | Full production build |
| `rust` | `cargo test --workspace` | Rust crates (`starbridge-core`, `starbridge-runner`) |
| `spacetime` | `spacetime build` | SpacetimeDB module compiles |
| `docs` | `bun run docs:check && bun run docs:build` | Doc link integrity and static site build |

Additional automation workflows in `.github/workflows/`:

- `vercel-deploy.yml` — deploys `apps/web` on pushes to `main` (requires
  `ANTHROPIC_API_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets)
- `agent-review.yml` — automated PR review and issue triage
- `agent-implement.yml` — turns `agent-ready` issues into draft PRs
- `agent-fix-ci.yml` — retries CI fixes up to three times before labelling
  `needs-human-fix`
- `claude.yml` — handles explicit `@claude` mentions on issues and review comments
- `auto-label.yml` / `sync-labels.yml` — label management

## Environment Variables

Copy `.env.example` to `apps/web/.env.local`. Required at runtime:

| Variable | Description |
|----------|-------------|
| `SPACETIMEDB_URL` | SpacetimeDB server URL (e.g. `http://127.0.0.1:3000`) |
| `SPACETIMEDB_DATABASE` | Database name (e.g. `starbridge-control`) |
| `SPACETIMEDB_AUTH_TOKEN` | Auth token for SpacetimeDB calls |
| `AUTH_SECRET` | Secret for signing `cadet_session` JWTs |
| `CRON_SECRET` | Bearer token checked by `/api/cron/reconcile` |
| `OPERATOR_AUTH_ALLOWED_EMAILS` | Comma-separated list of permitted operator emails |

Optional (OIDC login):

| Variable | Description |
|----------|-------------|
| `SPACETIMEAUTH_ISSUER` | SpacetimeDB Auth OIDC issuer URL |
| `SPACETIMEAUTH_CLIENT_ID` | OIDC client ID |
| `SPACETIMEAUTH_CLIENT_SECRET` | OIDC client secret |
| `NEXT_PUBLIC_CONTROL_PLANE_URL` | Public URL of the control plane (derived from Vercel metadata if omitted) |
