<original_task>
Build the Cadet platform — a space-themed AI agent control plane with:
- Native Dioxus desktop app as the primary interface
- Next.js web dashboard at localhost:3001
- SpacetimeDB (Maincloud) as the real-time database
- Multi-agent orchestration (Cadet router, Voyager coding, Saturn ops)
- 25 chat tools, 19 agent-runtime modules, 56 API routes

The CURRENT task: Complete rebuild of the Dioxus desktop app into a fully functional mission control with chat-first interface, all data views working, agent dispatch, terminal, database inspector, and all platform features wired end-to-end.
</original_task>

<work_completed>
## Session Summary (March 31 - April 1, 2026)

### Web Platform (Complete — 1055 tests passing)
All of this is built, tested, and pushed to origin/main:

**Core Infrastructure:**
- Sign in with Vercel (OAuth 2.0 + PKCE, HMAC-signed sessions)
- Vercel Sandbox integration (coding agents with Claude Code CLI)
- Vercel Queues (async dispatch with retry logic)
- Vercel Workflow DevKit (7-stage durable workflows: route→plan→gather→act→verify→summarize→learn)
- SpacetimeDB Maincloud deployed (database: `cadet-control`, host: `maincloud.spacetimedb.com`)
- WebAuthn passkey auth (Touch ID) with conditional UI

**Agent Runtime (19 modules in `apps/web/lib/agent-runtime/`):**
- `registry.ts` — 6 built-in coding agents (Claude Code, Codex, Gemini CLI, Aider, Cursor, Copilot)
- `session.ts` — persistent sessions scoped by operator+agent+repo in SpacetimeDB
- `executor.ts` — runs agents in Vercel Sandbox with mission briefs
- `output.ts` — ACP JSON-RPC + raw text parser → 6 typed event types
- `mission-brief.ts` — generates CLAUDE.md with journal, memories, learnings, standing orders
- `mission-journal.ts` — Flight Plan, Ship's Log, Standing Orders, Mission Patches, Crew Manifest
- `skills.ts` — 5 built-in skills, progressive disclosure, install/remove from registry
- `checkpoints.ts` — Vercel Sandbox VM snapshots, rollback to any checkpoint
- `provider-routing.ts` — 8 models, 5 providers, cost/speed/quality strategies, fallback chains
- `hooks.ts` — 12 lifecycle events, JS handlers in vm.runInNewContext sandbox
- `session-search.ts` — full-text search across chat, runs, memory, threads
- `context-refs.ts` — @run, @agent, @memory, @thread, @skill, @url, @diff references
- `context-assembly.ts` — priority-ordered SpacetimeDB context builder with token budgets
- `message-taxonomy.ts` — 7 message types (user_prompt, agent_response, agent_thinking, tool_call, a2a_handoff, a2a_result, system_event)
- `voice.ts` — OpenAI TTS/STT with space-themed presets
- `browser.ts` — Browserbase cloud browser automation
- `batch.ts` — parallel prompt dispatch via Vercel Queues
- `internet-channels.ts` — web, search, YouTube, GitHub, RSS channels
- `index.ts` — barrel exports for all modules

**Chat Tools (25 in `apps/web/lib/chat-tools.ts`):**
handoff_to_agent, chain_tasks, search_memory, get_run_status, remember, ingest_url, set_reminder, list_reminders, check_deployment, list_recent_runs, create_pr, compose_standup, list_skills, load_skill, search_history, rollback, set_routing, cancel_run, delete_memory, list_agents, fetch_url, search_web, check_channels, list_approvals, resolve_approval

**API Routes (57 in `apps/web/app/api/`):**
Auth (8), Agents (8), Runs (4), Workflows (2), Jobs (1), Chat (1), Voice (1), Batch (1), Threads (2), Memory (2), Approvals (2), Sandboxes (4), Browser (2), Bots (6), Webhooks (1), Usage (1), Skills (1), Hooks (1), Journal (1), Health/Catalog/Stream (3), Crons (2), Queues (2), Desktop Token (1)

**Security:**
- LLM sanitization: fenceContext structural protection, SSRF prevention (IPv4/IPv6/decimal/hex/redirect blocking)
- Webhook HMAC verification (Slack + GitHub)
- Hook execution in vm.runInNewContext sandbox
- AsyncLocalStorage for request-scoped tool context (no concurrency race)

**Tests:**
- 1055 unit tests across 49 test files (all passing)
- 40 integration tests (conditional on env vars)
- 15 agent-runtime test files with 436 tests
- 11 sanitize tests, 11 webhook-verify tests

**QA Audits Completed:**
- 4-agent parallel QA simulation (router, executor, security, e2e flow)
- 30-message LLM simulation (8/10 rating, all findings fixed)
- 5-handoff Voyager simulation (context gaps fixed)
- Orchestration layer audit (all no-op stages replaced with real implementations)

### Desktop App (Dioxus/Rust — Partially Working)

**What exists and renders correctly:**
- `overview.rs` (350 lines) — 3-column: run queue, detail pane with tabs (Timeline/Browser/Approvals), inspector sidebar. Approval resolve works via SpacetimeDB.
- `chat.rs` (248 lines) — 3-column: thread list, message stream + composer, inspector. Sends via SpacetimeDB ingest_message reducer.
- `catalog.rs` (555 lines) — 2-column: searchable/filterable agent+tool list, detail panel. Dispatch/Test buttons NOT wired.
- `memory.rs` (683 lines) — 3-column: documents/chunks, 3D vector field visualization (!), inspector with namespace/embedding info.
- `workflow.rs` (116 lines) — Kanban with 7 lanes, drag-drop step cards (local draft only).
- `ai_chat.rs` (NEW, 280 lines) — Chat with Cadet via HTTP to localhost:3001/api/chat. Sends messages, parses SSE responses.

**Shared components (`ui/shared.rs`):**
SidebarNavButton, MetricTile, InspectorCard, CalloutBox, EmptyState, RunListItem, ThreadListItem, WorkflowStepRow, BrowserTaskRow, RetrievalTraceRow, MessageBubble, DynamicUiNode + 7 helper functions

**Widget system:**
CommandCenter (provider discovery, widget toggles, config), FloatingWidget (context chat), LiveAgentHud (arc gauges), QuickDispatchPalette (spotlight dispatch), ToastOverlay, ClipboardWidget (arboard polling), MascotWidget (Three.js)

**Auth provider discovery (`auth_provider.rs`):**
20 providers: Anthropic (keychain→file→env), Vercel Gateway, OpenRouter, OpenAI (codex auth.json), Cursor, Gemini, Copilot, Antigravity, Kilo, Warp, Ollama, Groq, Mistral, DeepSeek, xAI, Together, Fireworks, Perplexity, Cohere, Bedrock

**Desktop auth flow (working):**
Splash → "LOG IN" opens browser to /sign-in?desktop=true → Touch ID → /desktop-callback → token exchange via SpacetimeDB → desktop polls /api/auth/desktop-token → saves to ~/.cadet/session.json → dismisses splash

**SpacetimeDB live connection (`live.rs`):**
- Connects via WebSocket, subscribes to all tables
- Real-time change watchers on 10 tables
- Bidirectional: send_live_message, resolve_live_approval
- Reads config from ~/.cadet/.env (SPACETIMEDB_URL, DATABASE, AUTH_TOKEN)
- websocket_url() correctly converts https:// → wss://

**Design language (`ui/styles.rs`, 700+ lines):**
- Orbital palette: primary #AA3618, accent #EF6745, surface #F7F5F4, sage bg #c8d1c0
- Fonts: Space Grotesk (sans) + JetBrains Mono (mono)
- No border-radius (aerospace aesthetic)
- Mint nav text #D4E8D9, dot grid background
- 48px/200px collapsible sidebar, dark #1C1B1B

### Commits on origin/main (latest first):
- b46586d — AI Chat view (desktop talks to web server)
- 041d41b — Desktop reads ~/.cadet/.env for Maincloud config
- 655adbf — Reducer arg order fix for desktop token
- b935b68 — Desktop token + callback accessible without auth
- dd7cea7 — HttpOnly cookie read server-side for callback
- 0d3fd89 — Challenge mismatch fix
- 7ae4937 — Button click desktop redirect fix
- 788800b — WebAuthn conditional UI
- 75c3d7f — SQL result decoding (root cause of passkey bug)
- ccf1e3d — Desktop sidebar fix
- c42ce5b — Mint nav color
- 71adecb — Dashboard sidebar match Dioxus design
- ce68527 — Close simulation gaps (chaining, clone depth, previous run)
- b07502f — Wire follow-up and debug context
- c7be94e — Tool quality improvements from LLM sim
- a99b3d3 — Router agent QA fixes (21→25 tools)
- 86d43ea — Hydration mismatch fix
- Multiple earlier commits for full platform build
</work_completed>

<work_remaining>
## PRIORITY 1: Complete Desktop App Rebuild (Native Dioxus)

User wants: Full dashboard + chat, ALL views working, native Dioxus (not WebView).

### 1. Rewrite AI Chat View (`ui/views/ai_chat.rs`)
The current version is a bare minimum. Needs:
- Clean modern layout matching Claude Desktop / ChatGPT Desktop aesthetic
- Conversation sidebar (list of past chats from SpacetimeDB chat_message)
- Proper markdown rendering in messages (code blocks, headers, lists, bold/italic)
- Tool call display (collapsible sections showing tool name + result)
- @reference autocomplete in the composer
- Model selector dropdown (provider routing)
- Streaming response display (not wait-for-complete)
- File: `rust/starbridge-dioxus/src/ui/views/ai_chat.rs`

### 2. Wire Existing Views to Real Actions
- **Catalog dispatch/test buttons** — call `/api/agents/[agentId]/invoke` and `/api/jobs/dispatch`
- **HudMetrics bridge** — populate from live snapshot data (currently always zeroes)
- **Toast notifications** — fire on run completion, approval needed, errors
- **Widget dispatch consumption** — `take_dispatch()` in main app loop
- **Agent chip buttons in chat composer** — actually switch the target agent

### 3. New Views to Build (ALL in Rust/Dioxus RSX)

**Terminal View** (`ui/views/terminal.rs`)
- Embedded PTY terminal (portable-pty crate)
- Quick-launch buttons for agents (claude, codex, gemini, aider)
- Agent output streaming into terminal
- Need to add `portable-pty` to Cargo.toml

**Database Inspector** (`ui/views/database.rs`)
- Table browser from SpacetimeDB subscription (already have all table data)
- SQL query input → execute via SpacetimeDB SDK
- Row detail inspector
- Live row count badges

**Agent Builder** (`ui/views/agent_builder.rs`)
- Form: name, model, spawn command, capabilities, API key, repo URL
- Save to SpacetimeDB user_agent_config table
- Test dispatch button

**Mission Journal** (`ui/views/journal.rs`)
- Flight Plan editor
- Standing Orders CRUD
- Ship's Log timeline
- Mission Patches display
- Crew Manifest editor
- Read/write via localhost:3001/api/journal

**Skills Directory** (`ui/views/skills.rs`)
- Browse built-in + installed skills
- Create new skill form
- Read/write via localhost:3001/api/skills

**Heartbeat/Cron** (`ui/views/heartbeat.rs`)
- Cron job list with heartbeat indicators
- Execution history
- Manual trigger
- Needs new SpacetimeDB table: cron_schedule

**Logs & Audit** (`ui/views/logs.rs`)
- Unified log stream from message taxonomy
- Filterable by kind, agent, time, keyword
- Click to drilldown

**Settings** (`ui/views/settings.rs`)
- Auth providers (already discovered in auth_provider.rs)
- Model routing preferences
- Config editor

### 4. Navigation Update
Add all new pages to:
- WorkspacePage enum in `ui/models.rs`
- Sidebar nav in `ui/mod.rs`
- Command palette in `ui/mod.rs`
- Menu bar in `bin/starbridge_dioxus_ui.rs`
- Keyboard shortcuts

### 5. Local Agent Spawner
- `local_agent.rs` — spawn CLI agents as child processes
- `output_parser.rs` — port of TypeScript output parser to Rust
- `mission_brief.rs` — port of mission brief generator to Rust

### 6. Style/UX Overhaul
- The whole app needs to feel like a modern desktop app, not a data dashboard
- Chat should look like Claude Desktop / ChatGPT Desktop
- Clean, minimal, lots of whitespace
- Smooth transitions, loading states
- Responsive to window resize

## PRIORITY 2: Web Dashboard Fixes
- The web dashboard sidebar was rewritten to match Dioxus theme — may need revision
- API explorer playground component was untracked — now committed
- Integration tests need SpacetimeDB secrets in CI

## PRIORITY 3: Documentation
- User requested complete doc rewrite and repo cleanup
- Need CLAUDE.md, README.md, architecture docs
- API documentation
- Agent development guide
</work_remaining>

<attempted_approaches>
### Desktop Auth Flow
1. First tried opening system browser with `open` command — worked for auth but couldn't get token back to desktop
2. Tried WebView navigation interception — Dioxus main window can't navigate to URLs (it renders RSX)
3. Tried reqwest polling of /api/auth/me — cookie not shared between browser and Rust HTTP client
4. **Working approach:** Browser writes token to SpacetimeDB via /api/auth/desktop-token, desktop polls that endpoint via curl

### WebAuthn / Passkey Issues
1. Server was sending `authenticatorAttachment: "platform"` with `residentKey: "preferred"` — Chrome still showed QR code
2. Changed to `residentKey: "required"`, `userVerification: "required"` — didn't help
3. Added conditional UI (`useBrowserAutofill: true`) — helped for existing credentials
4. **ROOT CAUSE FOUND:** `client.sql()` in the SDK was returning raw SpacetimeDB wire format instead of decoded row objects. The credential ID was empty string, causing Chrome to show QR picker. Fixed by auto-decoding in `decodeSqlRows()`.
5. Challenge mismatch: conditional UI and button click created different challenges. Fixed by extracting challenge from clientDataJSON.
6. Desktop callback couldn't read cookie: `httpOnly: true` blocks JavaScript. Fixed with server component reading cookie.

### Desktop UI Approaches
1. Tried patching existing views one by one — user rejected, wants complete rebuild
2. Added AI chat view that calls web server — functional but UX is not up to standard
3. User explicitly rejected WebView/Electron approach — wants native Dioxus
4. User explicitly wants it to look like Claude Desktop / ChatGPT Desktop quality

### Sanitization
1. First built regex-based injection pattern matching (13 patterns) — abandoned as arms race
2. Switched to structural protection: fenceContext with <context> tags + invisible char stripping
3. Added SSRF protection: IPv4/IPv6/decimal/hex/redirect blocking
</attempted_approaches>

<critical_context>
### User Preferences (IMPORTANT)
- "run" ALWAYS means launch the desktop app (`cargo run --bin starbridge-dioxus-ui --features desktop-ui`)
- No Gemini naming for agents — use space exploration themes (Saturn, Voyager, Apollo, Mercury, Atlas, Titan)
- SpacetimeDB for auth, not Clerk or external providers
- D350 orbital theme: sage background, coral/rust primary, mint text, no border-radius
- Space Grotesk + JetBrains Mono fonts
- Prefers dense, information-rich UI (Linear/Raycast aesthetic)
- User is frustrated with incremental patches — wants complete, working features
- User wants NATIVE Dioxus (NOT WebView/Electron)
- User wants FULL dashboard + chat as first ship (not MVP)

### SpacetimeDB Maincloud
- Database: `cadet-control`
- Host: `maincloud.spacetimedb.com`
- Auth token in `~/.cadet/.env`
- Published with `spacetime publish cadet-control --server maincloud`
- 35+ tables with BTree indexes
- WebSocket subscription works (wss:// for Maincloud)

### Dioxus 0.7.3 Key APIs
- `use_signal(|| value)` — reactive state (Copy, read/write)
- `use_resource(|| async { ... })` — async data fetching
- `spawn(async move { ... })` — event-driven async (button clicks)
- `rsx! { div { ... } }` — HTML-like elements
- Controlled inputs: `input { value: "{signal}", oninput: move |e| signal.set(e.value()) }`
- `dioxus_desktop::window().new_window(dom, config)` — spawn child windows
- `tokio::task::spawn_blocking` for CPU-bound work
- `reqwest` added as dependency for HTTP calls

### Key File Paths
- Desktop binary: `rust/starbridge-dioxus/src/bin/starbridge_dioxus_ui.rs`
- UI library: `rust/starbridge-dioxus/src/ui/`
- Views: `rust/starbridge-dioxus/src/ui/views/`
- Styles: `rust/starbridge-dioxus/src/ui/styles.rs` (700+ lines)
- Shared components: `rust/starbridge-dioxus/src/ui/shared.rs`
- Live connection: `rust/starbridge-dioxus/src/live.rs`
- Web chat tools: `apps/web/lib/chat-tools.ts`
- Agent runtime: `apps/web/lib/agent-runtime/`
- Web API routes: `apps/web/app/api/`
- SpacetimeDB schema: `spacetimedb/src/lib.rs`

### Competitive Positioning
- Only platform with real-time SpacetimeDB control plane
- Bridges local (Bun) and cloud (Vercel) execution
- Rust for performance/security, sits above individual tools
- No competitor combines: unified local+cloud visibility, inspectable/editable memory, mission briefs with approval gates, agent fleet topology, cost attribution, session replay

### Dependencies
- Dioxus 0.7.3, dioxus-desktop 0.7.3
- SpacetimeDB SDK 2.1.0
- reqwest 0.12 (just added for HTTP)
- tokio 1.48 (with rt, sync, time, process, io-util)
- arboard 3.4 (clipboard)
- serde/serde_json
- Need to add: portable-pty (terminal emulation)
</critical_context>

<current_state>
### Git Status
- Branch: main
- Latest commit: b46586d (AI Chat view)
- All changes pushed to origin/main
- Working tree is clean

### What's Running
- Web server: `cd apps/web && bun run dev` on localhost:3001 (must be started manually)
- Desktop: `cargo run --bin starbridge-dioxus-ui --features desktop-ui` (must be started manually)
- SpacetimeDB: Maincloud (always running, no local server needed)

### Desktop App Current State
- Shows splash screen on launch → "LOG IN" opens browser → auth works → dismisses splash
- Default view is Chat (AiChatView) — functional but bare-bones UX
- Sidebar has: Chat, Overview, Threads, Runs, Agents, Memory
- SpacetimeDB live connection: WORKING (connected to Maincloud)
- Existing views render from live snapshot data
- Chat calls localhost:3001/api/chat — requires web server running
- Session token stored at ~/.cadet/session.json

### What Needs to Happen Next
1. COMPLETE REWRITE of the desktop UI — user is clear this is not incremental patches
2. Study Claude Desktop / ChatGPT Desktop for UX reference
3. Build all 8+ new views in native Dioxus RSX
4. Wire every existing view to real backend actions
5. Add local agent spawning (portable-pty)
6. Make it look and feel like a professional desktop application
7. The user is frustrated — deliver quality, not quantity of patches

### Open Questions
- Exact layout for the chat view (split panel? full width? conversation sidebar?)
- How to handle markdown rendering in Dioxus RSX (no built-in markdown component)
- Terminal emulation approach (portable-pty vs. running commands via std::process)
- Whether to keep the floating widget system or simplify
</current_state>
