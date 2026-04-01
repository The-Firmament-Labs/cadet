# Cadet Desktop — Complete Product Specification

**Version:** 1.0
**Date:** April 1, 2026
**Stack:** Dioxus 0.7.3 (Rust) + SpacetimeDB 2.1 (Maincloud) + Next.js 16 (localhost:3001)

---

## 1. Product Vision

Cadet Desktop is a **native mission control for AI agent operations** — a chat-first desktop application that lets developers dispatch, monitor, and coordinate multiple coding agents across local and cloud environments, with real-time visibility into every action, memory, and decision through SpacetimeDB's zero-latency client-side cache.

**What makes Cadet different from every competitor:**

| Competitor | Model | Cadet's Advantage |
|---|---|---|
| Claude Desktop / ChatGPT | Chat-only, no agent orchestration | Multi-agent dispatch + orchestration + real-time monitoring |
| Cursor / Windsurf | IDE-embedded, single agent | Fleet overview of parallel agents across repos |
| Devin | Cloud-only, expensive | Local + cloud execution, SpacetimeDB real-time state |
| Factory | Enterprise black box | Inspectable memory, editable mission briefs, open data |
| Hermes | Terminal-only, no dashboard | Native desktop UI with 3D memory viz, live data |
| Warp | Terminal-first, no agent management | Agent builder, skill directory, approval workflow |

**Core differentiator:** SpacetimeDB gives us **zero-latency reads** (all data in client-side RAM), **push-based updates** (server pushes deltas, not polling), and **cross-client identity** (web + desktop + CLI share the same real-time state).

---

## 2. Information Architecture

### 2.1 Navigation Structure

**Sidebar** (always visible, collapsible):

```
⌘ Chat            ← Default view. AI conversation with Cadet.
⊞ Overview         ← Fleet dashboard. Runs, approvals, metrics.
▶ Runs             ← Workflow runs detail with stage timeline.
⊞ Agents           ← Agent registry + builder + dispatch.
🧠 Memory          ← Documents, chunks, embeddings, 3D field.
⚡ Terminal         ← Embedded PTY + local agent execution.
📋 Skills          ← Skill directory + creator.
📓 Journal         ← Mission Journal editor (Flight Plan, Orders, Log).
🗄 Database        ← Live SpacetimeDB table browser + SQL console.
📊 Logs            ← Unified event stream with taxonomy filters.
♥ Heartbeat       ← Cron jobs, schedules, health monitoring.
⚙ Settings        ← Auth providers, model routing, config.
```

12 pages. Keyboard shortcuts: ⌘1-⌘9 for first 9, ⌘0 for Settings.

### 2.2 Window Layout

**Primary layout:** Sidebar (200px, collapsible to 48px) + Main content area.

**Chat view special layout:** Sidebar (200px) + Conversation list (280px) + Chat area (fluid) + Optional inspector (320px).

**Split view capability:** Any two pages can be shown side-by-side (e.g., Chat + Terminal, Runs + Logs).

---

## 3. Data Architecture

### 3.1 SpacetimeDB Subscription Strategy

**Replace the current "subscribe to all tables, rebuild full snapshot on every change" with targeted per-view subscriptions:**

| View | Subscriptions | Priority |
|---|---|---|
| **Always active** | `approval_request`, `workflow_run WHERE status IN ('running','blocked')` | Background — drives notifications |
| **Chat** | `chat_message WHERE operator_id = :me`, `agent_session WHERE operator_id = :me` | On view active |
| **Overview** | `workflow_run` (all), `workflow_step`, `browser_task` | On view active |
| **Runs** | `workflow_step WHERE run_id = :selected`, `tool_call_record WHERE run_id = :selected` | On run selection |
| **Memory** | `memory_document`, `memory_chunk`, `memory_embedding`, `retrieval_trace` | On view active |
| **Database** | All subscribed tables (read from cache) | Always (free — cache already exists) |
| **Logs** | `chat_message` (all), `message_event` | On view active |

### 3.2 Per-Table Signals (Replace MissionControlSnapshot)

Instead of one monolithic `MissionControlSnapshot` that rebuilds on every row change, maintain individual Dioxus signals per table:

```rust
struct LiveState {
    workflow_runs: Signal<Vec<WorkflowRunRecord>>,
    workflow_steps: Signal<Vec<WorkflowStepRecord>>,
    approval_requests: Signal<Vec<ApprovalRequestRecord>>,
    chat_messages: Signal<Vec<ChatMessageRecord>>,
    memory_documents: Signal<Vec<MemoryDocumentRecord>>,
    // ... per table
    connection_status: Signal<ConnectionStatus>,
}
```

Each `on_insert` / `on_delete` / `on_update` callback updates ONLY its own signal. Views only re-render when their specific data changes.

### 3.3 Web Server API Layer

For operations SpacetimeDB doesn't handle (AI chat, external APIs, file operations):

```rust
struct WebClient {
    base_url: String,     // http://localhost:3001
    session_token: String, // from ~/.cadet/session.json
}

impl WebClient {
    async fn chat(&self, messages: Vec<Message>) -> Result<StreamingResponse>;
    async fn dispatch_agent(&self, agent_id: &str, goal: &str) -> Result<RunId>;
    async fn get_journal(&self) -> Result<MissionJournal>;
    async fn save_journal(&self, journal: &MissionJournal) -> Result<()>;
    async fn list_skills(&self) -> Result<Vec<Skill>>;
    // ... wraps all /api/* endpoints
}
```

---

## 4. View Specifications

### 4.1 Chat View (Default)

**Reference:** Claude Desktop + Cursor's multi-agent awareness

**Layout:**
```
┌─────────────┬──────────────────────────────────────────────┐
│ Conversations│                                              │
│             │  Cadet AI                          ⌘J focus  │
│ 🔍 Search   │                                              │
│             │  ┌─────────────────────────────────────────┐  │
│ Today       │  │ You: fix the login bug in auth.ts      │  │
│  └ fix auth │  └─────────────────────────────────────────┘  │
│  └ deploy   │                                              │
│             │  ┌─────────────────────────────────────────┐  │
│ Yesterday   │  │ Cadet: I'll delegate this to Voyager.   │  │
│  └ refactor │  │                                         │  │
│             │  │ ┌─ handoff_to_agent ──────────────────┐ │  │
│             │  │ │ Agent: voyager                      │ │  │
│             │  │ │ Run: run_abc123     [View Run →]    │ │  │
│             │  │ └────────────────────────────────────┘ │  │
│             │  └─────────────────────────────────────────┘  │
│             │                                              │
│             │  ┌─ Agent Result ─────────────────────────┐  │
│             │  │ ✓ Voyager completed: Fixed email       │  │
│             │  │   validation in auth.ts                │  │
│             │  │   PR: github.com/org/repo/pull/42      │  │
│             │  └────────────────────────────────────────┘  │
│             │                                              │
│             │  ┌────────────────────────────────────────┐  │
│             │  │ Ask Cadet anything... (Enter to send)  │  │
│             │  │                                        │  │
│             │  │ @run @agent @memory    Model: ▾ Sonnet │  │
│             │  └────────────────────────────────────────┘  │
└─────────────┴──────────────────────────────────────────────┘
```

**Features:**
- **Conversation sidebar:** History from SpacetimeDB `chat_message` table, grouped by date, searchable
- **Message rendering:** Markdown with syntax-highlighted code blocks, diff rendering, LaTeX math
- **Tool call display:** Collapsible cards showing tool name, input (collapsed), output, with status badges
- **Agent handoff indicators:** When Cadet delegates, show the agent name, run ID, and a "View Run →" link
- **Agent result cards:** When delegated agent completes, show result summary, PR URL, branch name
- **Composer:** Multi-line textarea, Enter to send, Shift+Enter for newline
- **@ references:** Autocomplete for `@run:`, `@agent:`, `@memory:`, `@skill:`, `@file:` in the composer
- **Model selector:** Dropdown showing available models from provider-routing (cost/speed/quality indicators)
- **Streaming:** Token-by-token display with pulsing cursor, tool calls appear as they happen
- **Voice:** Microphone button for speech-to-text input (calls web server /api/voice)

### 4.2 Overview (Fleet Dashboard)

**Reference:** Cursor Mission Control + Linear dashboard density

**Layout:** 3-column grid
- **Left:** Run queue (list of active/recent runs with status badges)
- **Center:** Selected run detail with tabbed content (Timeline, Browser, Approvals, Output)
- **Right:** Inspector sidebar with metrics (4 MetricTile gauges: active runs, pending approvals, blocked items, completed today)

**Data source:** SpacetimeDB `workflow_run`, `workflow_step`, `browser_task`, `approval_request` (all live-updating via signals)

**Actions:**
- Click run to select and inspect
- Approve/reject approval requests (calls SpacetimeDB `resolve_approval` reducer)
- Retry failed runs (calls web server `/api/runs/[runId]/retry`)
- Cancel running tasks (calls web server `cancel_run`)

### 4.3 Runs (Workflow Detail)

**Reference:** Devin timeline + Cline plan-and-act

**Layout:** 2-column
- **Left:** Run list with filters (status, agent, date range)
- **Right:** Run detail with:
  - 7-stage pipeline visualization (Route → Plan → Gather → Act → Verify → Summarize → Learn) with active stage highlighted
  - Step timeline: each step as an expandable card showing agent, duration, status, input/output
  - Plan display: the generated plan from planStep (collapsible)
  - Tool call log: every tool invocation with input/output
  - Output viewer: the agent's final response or error
  - Learnings: extracted learnings from learnStep

**Data source:** SpacetimeDB `workflow_run`, `workflow_step`, `tool_call_record`, `chat_message` (filtered by run_id)

### 4.4 Agents (Registry + Builder)

**Reference:** Factory Droid builder + Hermes skill system

**Layout:** 2-column
- **Left:** Agent list (3 cloud personas + 6 coding agents + user-created)
  - Search and filter by capability
  - Status badges (available, running, offline)
- **Right:** Agent detail OR agent builder form

**Agent detail panel:**
- Name, model, runtime, capabilities
- System prompt (expandable)
- Handoff rules
- Recent runs by this agent
- "Dispatch" button (open dispatch dialog with goal input)
- "Test" button (quick test with a simple task)

**Agent builder form:**
- Name, display name
- Model selector (from provider-routing catalog)
- Spawn command (for local execution)
- Install command
- Capabilities checkboxes
- API key field (encrypted)
- Repo URL, branch defaults
- Save → writes to SpacetimeDB `user_agent_config`

### 4.5 Memory (Knowledge Observatory)

**Reference:** Existing 3D vector field (keep it — it's impressive)

**Layout:** 3-column (already exists and works well)
- **Left:** Document list + chunk lattice
- **Center:** 3D vector field projection (interactive, clickable)
- **Right:** Inspector (namespace coverage, embedding profiles, retrieval traces)

**Enhancements:**
- Add "Create Memory" button (form: title, content, namespace)
- Add "Delete" button on selected document
- Add search input above document list (keyword filter)
- Add namespace filter dropdown
- Connect to SpacetimeDB live data (currently works from snapshot)

### 4.6 Terminal (Local Agent Execution)

**Reference:** Warp Terminal blocks + split panel

**Layout:** Full-width with optional split
- **Main area:** Embedded PTY terminal (via `portable-pty` crate)
- **Top toolbar:** Quick-launch agent buttons ("Claude Code", "Codex", "Aider", etc.)
- **Split option:** Terminal left + agent output stream right

**Features:**
- Full shell access (zsh/bash)
- Agent quick-launch: click "Claude Code" → runs `claude --yes --print "..."` with a goal input dialog
- Agent output parsing: detect thinking, tool calls, diffs in the output stream
- Mission brief: auto-write CLAUDE.md to the working directory before launching an agent
- Environment injection: automatically set API keys from AuthProviderRegistry
- Process management: cancel (Ctrl+C), kill, restart

### 4.7 Skills (Directory + Creator)

**Reference:** Hermes Agent skills + VS Code extension marketplace

**Layout:** 2-column
- **Left:** Skill list (5 built-in + installed + operator-created)
  - Category badges, token estimate, activation patterns
  - Search input
- **Right:** Skill detail (full content rendered as markdown) OR skill creator form

**Skill creator form:**
- Name, description, category dropdown
- Content editor (markdown textarea with preview)
- Activation patterns (comma-separated keywords)
- Version, author
- Save → calls web server `/api/skills`

### 4.8 Journal (Mission Journal Editor)

**Reference:** Notion-style block editor + Hermes SOUL.md

**Layout:** Single column, tabbed
- **Tab: Flight Plan** — Form: role, expertise (tag input), timezone, communication style
- **Tab: Standing Orders** — List with add/remove. Each order is a text field.
- **Tab: Ship's Log** — Timeline of entries (scrollable, searchable). Most recent first.
- **Tab: Mission Patches** — Grid of achievement badges with timestamps.
- **Tab: Crew Manifest** — Per-agent personality editor (agent selector → personality textarea, special focus)

**Data source:** Web server `/api/journal` (reads/writes to SpacetimeDB via memory_document)

### 4.9 Database (SpacetimeDB Inspector)

**Reference:** Prisma Studio + Supabase Table Editor

**Layout:** 2-column
- **Left:** Table list with row counts (live-updating badges)
  - All 33 SpacetimeDB tables listed
  - Grouped by category (Core, Workflow, Messaging, Memory, Browser, Sandbox, Auth, Agent)
- **Right:** Table viewer
  - Column headers with type indicators
  - Rows rendered as a data grid (scrollable, sortable)
  - Click row → JSON detail panel (slide-in)
  - Row count, update timestamp

**SQL Console:**
- Textarea for ad-hoc SQL queries
- Execute button → results in a table below
- Query history dropdown

**Key advantage:** All subscribed table data is ALREADY in the client-side cache. No network call needed for reads. The database inspector is essentially free.

### 4.10 Logs (Unified Event Stream)

**Reference:** Datadog log viewer + Linear activity feed

**Layout:** Single column with filter bar
- **Filter bar:** Dropdowns for message kind (7 types from taxonomy), agent, time range, keyword search
- **Log stream:** Reverse-chronological list of events
  - Each entry: timestamp, message kind badge, actor, content preview
  - Click → expand to full detail with metadata JSON
  - Tool call entries show tool name + input/output
  - Handoff entries show from→to agent + goal
  - System events show run status changes

**Data source:** SpacetimeDB `chat_message` (with taxonomy metadata), `message_event`, `workflow_run` status changes

### 4.11 Heartbeat (Cron & Schedule Monitor)

**Reference:** Vercel cron dashboard + Uptime Robot

**Layout:** Single column
- **Cron list:** Each scheduled job as a row
  - Name, schedule (cron expression), last run time, next run time
  - Heartbeat indicator: green (healthy), yellow (delayed >1 min), red (failed)
  - Execution history: sparkline of last 10 runs (green/red dots)
- **Actions:** Manual trigger button, pause/resume, edit schedule

**Data source:** SpacetimeDB `schedule_record` table (already exists) + web server cron endpoints

### 4.12 Settings

**Reference:** Claude Desktop settings + Raycast preferences

**Layout:** Single column with sections

**Sections:**
1. **Account** — Operator name, email, role, avatar initials
2. **Auth Providers** — 20-provider grid (from AuthProviderRegistry). Green/yellow/gray status. "Add Key" button for missing. Redacted token display for discovered.
3. **Model Routing** — Strategy selector (cost/speed/quality/balanced). Preferred/blocked provider toggles. Current model display.
4. **Appearance** — Theme selector (dark default, light option). Widget style (glass/solid/minimal). Sidebar position.
5. **Keyboard Shortcuts** — Full shortcut list with current bindings.
6. **Connections** — SpacetimeDB connection status. Web server status. Maincloud dashboard link.
7. **About** — Version, build info, license.

---

## 5. Interaction Patterns

### 5.1 Command Palette (⌘K)

Available everywhere. Actions:
- Navigate to any view
- Quick agent dispatch ("Run Claude Code on...")
- Search conversations, runs, memory
- SQL query shortcut
- Model switch
- Theme toggle

### 5.2 Notifications

**Toast overlay** (bottom-right, existing component):
- Agent run completed (with PR link if available)
- Approval requested (with approve/reject inline buttons)
- Agent run failed (with error summary)
- Schedule missed (heartbeat alert)

**OS-level notifications** (via `dioxus_desktop`):
- Approval requests (high priority)
- Run completions (normal priority)

### 5.3 Global Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Command palette |
| ⌘J | Focus chat composer |
| ⌘T | Open/focus terminal |
| ⌘1-⌘9 | Navigate to view 1-9 |
| ⌘0 | Settings |
| ⌘N | New chat conversation |
| ⌘Enter | Send chat message |
| ⌘. | Cancel running agent |
| ⌘\ | Toggle sidebar |
| ⌘, | Settings |
| Ctrl+Shift+Space | Quick dispatch (clipboard context) |

### 5.4 Drag & Drop

- Drag files onto chat composer to reference them
- Drag workflow steps between stages (existing, local draft mode)
- Drag skills to reorder priority

### 5.5 Autonomy Levels

Three named levels for agent execution (inspired by Cursor/Cline):
- **Supervised:** Agent shows plan, waits for approval at each step
- **Semi-auto:** Agent executes plan, pauses at approval gates only
- **Full auto:** Agent executes everything, reports results when done

Selectable per-dispatch in the chat composer or agent dispatch dialog.

---

## 6. Design Language

### 6.1 Orbital Data System (existing, refined)

**Palette:**
```
Primary:          #AA3618 (coral/rust — brand, CTAs)
Primary Active:   #EF6745 (bright coral — active states, hover)
Surface:          #F7F5F4 (warm off-white — content backgrounds)
On-Surface:       #1C1B1B (near-black — text, sidebar bg)
On-Surface-Var:   #58413C (muted brown — secondary text)
Background Sage:  #c8d1c0 (sage green — app background, dot grid)
Tertiary:         #526258 (dark sage — accents)
Tertiary-Cont:    #D4E8D9 (mint — nav text, success)
Outline:          #E0BFB8 (warm border — dividers, ghost borders)
Secondary:        #5F5E5E (neutral gray — badges, muted elements)
```

**Typography:**
- UI text: Space Grotesk (400/500/600/700)
- Code/data: JetBrains Mono (400/500/600)
- Base size: 13px
- Line height: 1.5

**Geometry:**
- Border radius: 0 everywhere (aerospace/industrial aesthetic)
- Shadows: `0 4px 12px rgba(28,27,27,0.06)` — subtle, close
- Ghost borders: `inset 0 0 0 1px rgba(224,191,184,0.20)`
- Grid: 24px base unit

**Dark mode:**
- Sidebar: #1C1B1B (already dark)
- Content area: #1A1A1F (near-black)
- Surface: #252528 (dark gray)
- Text: #E8E6E3 (warm white)
- Mint nav text stays #D4E8D9

### 6.2 Information Density

**High density** — inspired by Linear and Raycast:
- Compact list items (36-40px height)
- Small fonts (11-13px) with clear hierarchy
- Dense metric tiles
- Minimal padding (8-12px)
- Maximum information per screen

### 6.3 Animations

- **Message fade-in:** 150ms ease, translateY(4px) → 0
- **Tab switch:** Instant (no transition — speed over polish)
- **Sidebar collapse:** 200ms ease width transition
- **Toast slide-in:** 200ms ease from bottom-right
- **Pulse:** Streaming indicator, live connection dot

---

## 7. Implementation Architecture

### 7.1 New Rust Files

```
rust/starbridge-dioxus/src/
├── web_client.rs          ← HTTP client for localhost:3001 API
├── local_agent.rs         ← Spawn/manage local CLI agent processes
├── output_parser.rs       ← Port of TypeScript output parser to Rust
├── ui/
│   ├── views/
│   │   ├── ai_chat.rs     ← REWRITE: Full chat with conversation sidebar
│   │   ├── overview.rs    ← UPDATE: Wire to per-table signals
│   │   ├── catalog.rs     ← UPDATE: Rename to agents, add builder
│   │   ├── memory.rs      ← UPDATE: Add CRUD actions
│   │   ├── workflow.rs    ← UPDATE: Rename to runs, add detail
│   │   ├── chat.rs        ← KEEP: Rename to threads
│   │   ├── terminal.rs    ← NEW: Embedded PTY + agent launch
│   │   ├── skills.rs      ← NEW: Directory + creator
│   │   ├── journal.rs     ← NEW: Mission Journal editor
│   │   ├── database.rs    ← NEW: SpacetimeDB table browser
│   │   ├── logs.rs        ← NEW: Unified event stream
│   │   ├── heartbeat.rs   ← NEW: Cron monitor
│   │   └── settings.rs    ← NEW: Config panels
│   ├── models.rs          ← UPDATE: 12 WorkspacePage variants
│   ├── shared.rs          ← UPDATE: Add new components
│   ├── styles.rs          ← UPDATE: Add new view styles
│   └── mod.rs             ← UPDATE: New navigation + per-table signals
└── live.rs                ← REWRITE: Per-table signals, targeted subscriptions
```

### 7.2 New Dependencies

```toml
reqwest = { version = "0.12", features = ["json", "stream"], optional = true }
portable-pty = { version = "0.8", optional = true }
```

### 7.3 Build Order

| Phase | What | Depends On | Effort |
|-------|------|-----------|--------|
| 1 | Rewrite `live.rs` → per-table signals | Nothing | Medium |
| 2 | Build `web_client.rs` (HTTP to localhost:3001) | Nothing | Small |
| 3 | Rewrite `ai_chat.rs` (full chat) | web_client, live signals | Large |
| 4 | Build `terminal.rs` + `local_agent.rs` | portable-pty | Large |
| 5 | Build `database.rs` (table browser) | live signals | Medium |
| 6 | Build `settings.rs` | web_client | Small |
| 7 | Build `journal.rs` | web_client | Small |
| 8 | Build `skills.rs` | web_client | Small |
| 9 | Build `logs.rs` | live signals | Medium |
| 10 | Build `heartbeat.rs` | live signals | Small |
| 11 | Update `overview.rs` → per-table signals | live signals | Small |
| 12 | Update `catalog.rs` → agents + builder | web_client, live signals | Medium |
| 13 | Update `workflow.rs` → runs detail | live signals | Medium |
| 14 | Update navigation, command palette, shortcuts | All views | Small |
| 15 | Style polish, dark mode, animations | All views | Medium |

---

## 8. Verification Checklist

### Chat
- [ ] Type "hello" → Cadet responds via web server streaming
- [ ] Type "fix the login bug" → handoff card appears → run starts
- [ ] Agent completes → result card appears in chat
- [ ] @ reference autocomplete works
- [ ] Conversation history persists (from SpacetimeDB)
- [ ] Model selector changes the model

### Agent Dispatch
- [ ] Click "Agents" → see all 9 agents (3 cloud + 6 coding)
- [ ] Click "Dispatch" on an agent → goal dialog → run starts
- [ ] Agent builder form → save → appears in agent list

### Terminal
- [ ] Embedded terminal works (type commands, see output)
- [ ] Click "Claude Code" → goal dialog → agent runs in terminal
- [ ] Agent output parsed for thinking/tool calls/diffs

### Data Views
- [ ] Overview shows live run data from SpacetimeDB
- [ ] Memory shows documents and 3D vector field
- [ ] Database shows all 33 tables with live row counts
- [ ] Logs shows filtered event stream

### Configuration
- [ ] Settings shows 20 auth providers with status
- [ ] Journal editor saves changes via API
- [ ] Skills directory shows built-in + installed

### Real-time
- [ ] Approve a request on web → desktop overview updates instantly
- [ ] Send a message from web chat → desktop threads update instantly
- [ ] Agent completes in cloud → desktop overview shows completion
