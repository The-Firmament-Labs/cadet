# GitHub Automation Guide

Cadet uses a compact Milady-style GitHub automation layer tuned for a two-person team and a `main`-only branch model.

## Workflow map

- `ci.yml`: required validation pipeline for pushes to `main`, `codex/**`, and `agent/**`, plus PRs to `main`.
- `release.yml`: creates Git tags on demand and publishes real GitHub Releases from `v*.*.*` tags with session and planning assets attached.
- `vercel-deploy.yml`: production deploy workflow for the Vercel control plane on `main`.
- `github-pages.yml`: publishes the project hub to GitHub Pages from the canonical docs and session files after successful `CI` runs on `main`, gated by `ENABLE_GITHUB_PAGES=true` for repositories that support Pages.
- `sync-labels.yml`: keeps repository labels in sync with `.github/labels.json`.
- `auto-label.yml`: applies PR path labels and issue keyword labels.
- `agent-review.yml`: Claude-powered PR review and issue triage.
- `agent-fix-ci.yml`: retries failed same-repo PR CI runs up to three times.
- `agent-implement.yml`: turns `agent-ready` issues into draft PRs on `agent/<issue>-<slug>`.
- `claude.yml`: handles explicit `@claude` requests on issues and review comments.

## Safety model

Cadet intentionally does **not** use contributor trust scoring. The safety boundary is simpler:

- no code-writing workflow runs for forks
- no automation pushes directly to `main`
- agent-authored changes land through PRs
- PR review automation checks out the base revision only and reads the diff through GitHub

## Labels

Source of truth: [.github/labels.json](../.github/labels.json)

Core workflow labels:

- `agent-ready`
- `agent-in-progress`
- `agent-authored`
- `needs-human-fix`

Issue/domain labels:

- `bug`
- `security`
- `performance`
- `browser`
- `workflow`
- `memory`
- `deployment`
- `docs`

Path labels:

- `ui`
- `local-control`
- `runtime-rust`
- `spacetimedb`
- `core-sdk-cli`
- `agents`
- `ci`

## Branch conventions

- `main`: only long-lived integration branch
- `codex/**`: manual agent/dev work
- `agent/<issue>-<slug>`: implementation-agent working branches

## Required secrets

- `ANTHROPIC_API_KEY`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Optional:

- `GH_PAT` when repository policy blocks branch pushes or PR creation with the default `GITHUB_TOKEN`

## Validation contract

The GitHub automation layer is built around real repo commands:

```bash
bun run docs:check
bun run docs:build
bun run typecheck
bun run test
bun run build
cargo test --workspace
cd spacetimedb && spacetime build
```

If these commands drift, the workflows must change with them.

## Project hub publishing

- `bun run docs:build` generates the Pages-ready project hub from the canonical markdown files.
- `ci.yml` uploads the generated source as the `cadet-project-hub-source` artifact on every run so collaborators can inspect the published docs surface even when GitHub Pages is not available for the repository.
- `github-pages.yml` is the only deployment path for the session/project hub. Vercel does not build or host this surface.
- `github-pages.yml` is ready for repositories that support Pages. Enable it by setting the repository variable `ENABLE_GITHUB_PAGES=true`.

## Vercel deployment visibility

- `vercel-deploy.yml` now writes a real GitHub deployment record before the Vercel deploy starts.
- On success, the workflow posts a GitHub deployment status with the live Vercel URL and the Actions run log URL.
- On failure, the workflow marks the GitHub deployment as failed so the repo history reflects actual deployment state instead of a green Actions run with no deployment record.
