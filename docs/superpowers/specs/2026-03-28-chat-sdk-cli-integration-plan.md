# Implementation Plan: Chat SDK + CLI Integrations + Documentation

**Date:** 2026-03-28
**Status:** Ready to execute
**Prerequisite:** `/clear` this session, then execute this plan

---

## Phase 1: Install CLIs (5 min)

```bash
# Himalaya — Rust email client
brew install himalaya

# Spotify TUI
brew install spotify-tui

# Verify all CLIs
himalaya --version && spt --version && jup --version && agent-browser --version && vercel --version
```

## Phase 2: Vercel Chat SDK Integration (30 min)

### 2a. Install packages

```bash
cd apps/web
bun add chat @chat-adapter/slack @chat-adapter/discord @chat-adapter/github @chat-adapter/telegram @chat-adapter/state-redis
```

### 2b. Create `apps/web/lib/bot.ts`

```typescript
import { Chat } from 'chat';
import { createSlackAdapter } from '@chat-adapter/slack';
import { createDiscordAdapter } from '@chat-adapter/discord';
import { createGitHubAdapter } from '@chat-adapter/github';
import { createTelegramAdapter } from '@chat-adapter/telegram';

export function createCadetBot() {
  const adapters: Record<string, any> = {};

  if (process.env.SLACK_BOT_TOKEN) {
    adapters.slack = createSlackAdapter({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
    });
  }

  if (process.env.DISCORD_TOKEN) {
    adapters.discord = createDiscordAdapter({
      token: process.env.DISCORD_TOKEN,
    });
  }

  if (process.env.GITHUB_WEBHOOK_SECRET) {
    adapters.github = createGitHubAdapter({
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    });
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    adapters.telegram = createTelegramAdapter({
      token: process.env.TELEGRAM_BOT_TOKEN,
    });
  }

  return new Chat({ adapters });
}
```

### 2c. Create webhook routes

- `app/api/bot/slack/route.ts` — Slack webhook handler
- `app/api/bot/discord/route.ts` — Discord webhook handler
- `app/api/bot/telegram/route.ts` — Telegram webhook handler
- GitHub webhook already exists at `app/api/github/events/route.ts` — integrate Chat SDK

Each route: `bot.webhooks.<platform>(req, { waitUntil })`

### 2d. Wire Chat SDK to agent dispatch

In bot event handlers:
```typescript
bot.onNewMention(async (thread, message) => {
  // Dispatch to Saturn agent via control plane
  const response = await fetch('/api/jobs/dispatch', {
    method: 'POST',
    body: JSON.stringify({
      agentId: 'saturn',
      goal: message.text,
      channel: thread.platform,
    }),
  });

  // Stream AI response back to thread
  // thread.post(result.textStream) for streaming
});
```

## Phase 3: Add CLI Tools to Tool Registry (15 min)

Update `packages/core/src/tools.ts` — add these tools:

```typescript
// EMAIL (himalaya)
{
  name: "send_email",
  category: "communication",
  cli: "himalaya send --to {to} --subject {subject} --body {body}",
  requiresApproval: true,
},
{
  name: "list_emails",
  category: "communication",
  cli: "himalaya list --folder {folder} --format json",
  requiresApproval: false,
},
{
  name: "read_email",
  category: "communication",
  cli: "himalaya read {id} --format json",
  requiresApproval: false,
},

// SPOTIFY (spt)
{
  name: "spotify_now_playing",
  category: "execution",
  cli: "spt playback --format json",
  requiresApproval: false,
},
{
  name: "spotify_search",
  category: "execution",
  cli: "spt search --query {query} --format json",
  requiresApproval: false,
},

// CHAT SDK (replaces post_slack, post_github_comment)
{
  name: "post_message",
  category: "communication",
  api: "POST /api/bot/{platform}/send",
  description: "Send message via Chat SDK to any connected platform",
  requiresApproval: true,
},
```

## Phase 4: Document Complete .cadet System (20 min)

### 4a. Update `.cadet/README.md` with complete system overview

### 4b. Create `docs/TOOLS_REFERENCE.md`

Document all 33+ tools:
- Context (5): query_memory, store_memory, load_context, get_trajectory, log_step
- State (3): query_state, create_approval, handoff
- Browser (2): browse, screenshot
- Crypto (7): dex_search/pairs/tokens, jup_quote/price/portfolio, coingecko_price/trending
- Platform (4): vercel_deploy/logs, github_issue/search
- Communication (5): post_message (Chat SDK), send_email, list_emails, read_email, post_github_comment
- Execution (4): search_web, run_code, spotify_now_playing, spotify_search

### 4c. Create `docs/AGENT_TOOLS_GUIDE.md`

How agents use tools:
- Tool selection based on manifest permissions
- Approval flow for high-risk tools
- TOON encoding for token-efficient tool results
- Trajectory logging for self-improvement

### 4d. Update agent manifests

Add new tools to Saturn and Voyager manifests' tag lists so `getAgentTools()` filters correctly.

## Phase 5: Validate (10 min)

```bash
bun run typecheck
bun run test
bun run build
cargo test --workspace
spacetime build
```

Commit and push.

---

## Execution Command

After `/clear`, paste:

```
Execute the implementation plan at docs/superpowers/specs/2026-03-28-chat-sdk-cli-integration-plan.md — read it first, then implement each phase in order. Check memory for project context.
```
