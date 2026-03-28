# Cadet Agent Tool Registry — Reference

Every tool is a direct API call or CLI invocation — no MCP overhead.
Tools are defined in `packages/core/src/tools.ts` and exposed to agents via `composeRuntimePrompt()`.

Tools marked **[APPROVAL]** require a human-in-the-loop gate before execution.

---

## Context

Memory, prompt loading, and trajectory tracking. Always available to all agents.

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `query_memory` | `POST /api/memory/query` | `namespace` (req), `query` (req), `max_chunks` | No |
| `store_memory` | reducer: `insert_memory_document` | `title` (req), `content` (req), `source_kind` (req), `namespace` (req) | No |
| `load_context` | file read | `path` (req) — relative to `.cadet/prompts/` | No |
| `get_trajectory` | internal | `run_id` (req), `last_n_steps` | No |
| `log_step` | reducer: `log_trajectory` | `run_id` (req), `step_id` (req), `output` (req), `success` (req) | No |

---

## State

SpacetimeDB queries and workflow control. Always available to all agents.

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `query_state` | `POST /api/spacetime/sql` | `sql` (req) — SELECT only | No |
| `create_approval` | reducer: `create_approval_request` | `title` (req), `detail` (req), `risk` (req) — low\|medium\|high\|critical | No |
| `handoff` | reducer: `create_workflow_step` | `target` (req) — runner name, `stage` (req), `input` (req) | No |

---

## Browser

Web extraction and automation. Requires `allowBrowser` in agent manifest.

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `browse` | `agent-browser` CLI | `url` (req), `extract` — text\|links\|data | No |
| `screenshot` | `agent-browser` CLI | `url` (req), `output` — file path | No |

---

## Crypto

DexScreener, Jupiter, and CoinGecko market data. Requires `allowNetwork`.

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `dex_search` | `GET api.dexscreener.com/…/search` | `query` (req) — token name, symbol, or address | No |
| `dex_pairs` | `GET api.dexscreener.com/…/pairs/{chain}/{address}` | `chain` (req), `address` (req) | No |
| `dex_tokens` | `GET api.dexscreener.com/…/tokens/{address}` | `address` (req) | No |
| `jup_quote` | `jup spot quote` CLI | `input_mint` (req), `output_mint` (req), `amount` (req) | No |
| `jup_price` | `jup spot price` CLI | `token` (req) | No |
| `jup_portfolio` | `jup spot portfolio` CLI | — | No |
| `coingecko_price` | `GET api.coingecko.com/…/simple/price` | `coin` (req) — CoinGecko ID | No |
| `coingecko_trending` | `GET api.coingecko.com/…/search/trending` | — | No |

---

## Platform

Vercel deployments and GitHub API. Requires `allowNetwork`.

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `vercel_deploy` | `vercel deploy` CLI | `prod` — boolean, deploy to production | **Yes** |
| `vercel_logs` | `vercel logs` CLI | `deployment_url` (req) | No |
| `github_issue` | `POST api.github.com/…/issues` | `repo` (req) — owner/repo, `title` (req), `body` (req) | **Yes** |
| `github_search` | `GET api.github.com/search/{type}` | `type` (req) — code\|issues\|repositories, `query` (req) | No |

---

## Communication

Email via himalaya CLI and multi-platform messaging via Chat SDK.
Requires `allowNetwork`.

### Email (himalaya CLI — `/opt/homebrew/bin/himalaya`)

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `send_email` | `himalaya send` | `to` (req), `subject` (req), `body` (req) | **Yes** |
| `list_emails` | `himalaya list` | `folder` — mailbox folder name (default: INBOX) | No |
| `read_email` | `himalaya read` | `id` (req) — email ID | No |

### Multi-platform Messaging (Chat SDK)

Replaces the old `post_slack` and `post_github_comment` tools. Routes through the bot singleton at `/api/bot/{platform}/send`.

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `post_message` | `POST /api/bot/{platform}/send` | `platform` (req) — slack\|discord\|github\|telegram, `channel` (req), `text` (req) | **Yes** |

---

## Execution

Spotify Web API, general web search, and code sandboxes. Requires `allowExec` (code) or `allowNetwork` (search/Spotify).

### Spotify (Web API)

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `spotify_now_playing` | `GET api.spotify.com/v1/me/player/currently-playing` | — | No |
| `spotify_search` | `GET api.spotify.com/v1/search` | `query` (req), `type` — track\|album\|artist (default: track) | No |

### General

| Name | Backend | Params | Approval |
|------|---------|--------|----------|
| `search_web` | `GET api.serper.dev/search` | `query` (req), `num` — result count (default: 5) | No |
| `run_code` | `POST api.e2b.dev/sandboxes` | `code` (req), `language` (req) — typescript\|python\|rust | **Yes** |

---

## Summary

| Category | Count | Notes |
|----------|-------|-------|
| context | 5 | Always available |
| state | 3 | Always available |
| browser | 2 | Requires `allowBrowser` |
| crypto | 8 | Requires `allowNetwork` |
| platform | 4 | Requires `allowNetwork` |
| communication | 4 | Requires `allowNetwork` |
| execution | 4 | Requires `allowExec` or `allowNetwork` |
| **Total** | **30** | |
