# GitHub Automation Guide

Cadet uses a compact Milady-style GitHub automation layer tuned for a two-person team and a `main`-only branch model.

## Workflow map

- `ci.yml`: required validation pipeline for pushes to `main`, `codex/**`, and `agent/**`, plus PRs to `main`.
- `vercel-deploy.yml`: production deploy workflow for the Vercel control plane on `main`.
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
bun run typecheck
bun run test
bun run build
cargo test --workspace
cd spacetimedb && spacetime build
```

If these commands drift, the workflows must change with them.
