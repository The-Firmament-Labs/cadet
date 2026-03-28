# Dashboard + Native App Redesign

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Web dashboard with passkey auth, Dioxus native app redesign, shared design system

---

## 1. Auth — SpacetimeDB + WebAuthn Passkeys

### New SpacetimeDB Tables

```rust
#[table(accessor = operator_account, public)]
pub struct OperatorAccount {
    #[primary_key]
    operator_id: String,          // UUID
    identity: Identity,           // SpacetimeDB connection identity
    display_name: String,
    email: String,
    role: String,                 // "admin" | "operator" | "viewer"
    created_at: Timestamp,
    updated_at: Timestamp,
}

#[table(accessor = webauthn_credential, public)]
pub struct WebAuthnCredential {
    #[primary_key]
    credential_id: String,        // base64url-encoded credential ID
    operator_id: String,          // FK to OperatorAccount
    public_key_json: String,      // JSON-serialized public key
    counter: u64,                 // signature counter for replay protection
    transports_json: String,      // ["internal", "usb", "ble", "nfc"]
    created_at: Timestamp,
}

#[table(accessor = auth_challenge, public)]
pub struct AuthChallenge {
    #[primary_key]
    challenge_id: String,         // UUID
    challenge: String,            // base64url-encoded random bytes
    operator_id: Option<String>,  // Set during authentication, None during registration
    expires_at_micros: i64,       // TTL: 5 minutes
}
```

### Reducers

- `create_auth_challenge(ctx, challenge_id, challenge, operator_id, expires_at_micros)` — inserts a challenge row
- `register_operator(ctx, operator_id, display_name, email, credential_id, public_key_json, transports_json)` — creates `OperatorAccount` + `WebAuthnCredential`
- `delete_expired_challenges(ctx)` — cleanup reducer, called by cron

### Web Auth Flow

**Registration (`/sign-up`):**
1. User enters display name + email
2. `POST /api/auth/register/options` — generates WebAuthn creation options, stores challenge in `AuthChallenge`
3. Browser calls `startRegistration()` from `@simplewebauthn/browser`
4. `POST /api/auth/register/verify` — verifies attestation, calls `register_operator` reducer, issues session cookie
5. Redirect to `/dashboard`

**Authentication (`/sign-in`):**
1. User clicks "Sign in with passkey"
2. `POST /api/auth/login/options` — generates WebAuthn request options with `allowCredentials` from stored credentials, stores challenge
3. Browser calls `startAuthentication()` from `@simplewebauthn/browser`
4. `POST /api/auth/login/verify` — verifies assertion against stored public key, updates counter, issues session cookie
5. Redirect to `/dashboard`

**Session cookie:** httpOnly, secure, sameSite=lax. Contains:
- `operator_id` — links to `OperatorAccount`
- `spacetimedb_token` — the auth token for SpacetimeDB API calls
- `expires` — 7-day rolling expiry

**Route protection:** `proxy.ts` checks for valid session cookie on all `/dashboard/*` routes. Invalid/missing cookie redirects to `/sign-in`. Public routes: `/`, `/sign-in`, `/sign-up`, `/docs`, `/api/health`.

### Dioxus Auth

The desktop app stores the SpacetimeDB auth token in the OS keychain via `keyring` crate. On launch:
1. Check keychain for stored token
2. If present, connect to SpacetimeDB and verify identity matches an `OperatorAccount`
3. If not present or invalid, show a local login screen that generates a SpacetimeDB connection and registers/authenticates

### Libraries

- `@simplewebauthn/server@11` — server-side WebAuthn (Next.js API routes)
- `@simplewebauthn/browser@11` — client-side WebAuthn
- No additional auth framework needed

---

## 2. Dashboard Shell + Routes

### Route Structure

```
/                        Landing page (existing, theme refresh)
/sign-in                 Passkey login
/sign-up                 Passkey registration + passkey creation
/dashboard               Overview — mission control HUD
/dashboard/agents        Agent roster + status + management
/dashboard/runs          Workflow runs list
/dashboard/runs/[runId]  Run detail (timeline, browser, approvals)
/dashboard/threads       Conversation threads
/dashboard/approvals     Approval queue with inline approve/reject
/dashboard/memory        Memory documents + embedding field visualizer
/dashboard/settings      Control plane config, operator accounts
```

### Layout (`app/dashboard/layout.tsx`)

Three-zone layout:

1. **Sidebar** (48px collapsed / 220px expanded on hover):
   - Brand mark (28px, "C" glyph)
   - Nav items as icons, labels appear on expand: Overview, Agents, Runs, Threads, Approvals, Memory, Settings
   - Active item: cyan left border + subtle glow background
   - Footer: operator avatar + name, sign-out action

2. **Top bar** (48px height):
   - Left: breadcrumb trail (e.g., Dashboard > Runs > run-abc123)
   - Center: environment badge — "LOCAL" (amber) or "CLOUD" (cyan) based on control plane
   - Right: connection status indicator (pulsing green dot = connected), operator display name

3. **Content area**:
   - Full remaining space, scrollable
   - 20px padding
   - Each page is a Server Component that loads data, passes to client components where interactivity is needed

### Data Loading

All dashboard pages use the existing `lib/server.ts` functions (`createControlClient()` → SpacetimeDB SQL queries). The session cookie provides the `spacetimedb_token` for authenticated queries.

### SSE Real-Time Stream

`GET /api/stream` — Server-Sent Events endpoint:
- Authenticated (reads session cookie)
- Polls SpacetimeDB every 2 seconds
- Emits JSON events: `run:update`, `approval:new`, `agent:heartbeat`, `browser:progress`
- Client pages use `EventSource` + React state to merge live updates into the initial server-rendered data
- Graceful reconnection with exponential backoff

---

## 3. Design System — Shared Tokens

### `design-tokens.json` (repo root)

Single source of truth consumed by both web (CSS variables) and Dioxus (`styles.rs`).

```json
{
  "color": {
    "background": "#02050d",
    "card": "rgba(8, 12, 26, 0.72)",
    "cardStrong": "rgba(7, 10, 22, 0.88)",
    "border": "rgba(100, 180, 255, 0.14)",
    "borderStrong": "rgba(100, 180, 255, 0.28)",
    "primary": "#00e5ff",
    "primarySoft": "rgba(0, 229, 255, 0.12)",
    "accent": "#ffd66b",
    "accentSoft": "rgba(255, 214, 107, 0.12)",
    "destructive": "#ff4d4d",
    "destructiveSoft": "rgba(255, 77, 77, 0.12)",
    "success": "#4dff88",
    "successSoft": "rgba(77, 255, 136, 0.12)",
    "warning": "#ffaa33",
    "warningSoft": "rgba(255, 170, 51, 0.12)",
    "text": "#f5f7ff",
    "textStrong": "#ffffff",
    "muted": "rgba(220, 228, 255, 0.6)",
    "mutedSubtle": "rgba(220, 228, 255, 0.36)"
  },
  "font": {
    "sans": "\"Geist\", \"Geist Fallback\", ui-sans-serif, system-ui, sans-serif",
    "mono": "\"Geist Mono\", \"Geist Mono Fallback\", ui-monospace, monospace"
  },
  "fontSize": {
    "xs": "10px",
    "sm": "11px",
    "base": "12px",
    "md": "13px",
    "lg": "15px",
    "xl": "18px",
    "2xl": "24px"
  },
  "spacing": {
    "xs": "4px",
    "sm": "6px",
    "md": "10px",
    "lg": "14px",
    "xl": "20px"
  },
  "radius": {
    "sm": "4px",
    "md": "6px",
    "lg": "8px"
  },
  "effect": {
    "glowPrimary": "0 0 12px rgba(0, 229, 255, 0.15)",
    "glowAccent": "0 0 12px rgba(255, 214, 107, 0.12)",
    "shadow": "0 14px 28px rgba(0, 0, 0, 0.24)",
    "gridLine": "rgba(100, 180, 255, 0.04)",
    "gridSize": "28px"
  }
}
```

### Web Theme Integration

shadcn/ui initialized with `--base-color zinc`, then overridden in `globals.css` `@theme inline` block with the design tokens above. Dark mode only (no light mode toggle for this product).

Grid background on `html`:
```css
background:
  linear-gradient(var(--grid-line) 1px, transparent 1px),
  linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
  var(--background);
background-size: var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size), auto;
```

### Dioxus Theme Integration

`styles.rs` consumes the same token values directly as CSS custom properties. The existing green-tinted palette (`#d7e5cf`, `#ff7a4d`) is replaced with the shared cyan/gold tokens.

---

## 4. Dioxus Native App — Complete Redesign

### Design Philosophy

**Dense, keyboard-driven, information-rich.** Think Linear meets a mission control terminal. Every pixel earns its place.

### Layout Changes

| Property | Current | New |
|----------|---------|-----|
| Base font | 13px | 12px |
| Meta/labels | implicit | 11px, `--muted` |
| Sidebar width | 292px fixed | 48px collapsed, 200px expanded |
| Panel padding | 18px | 12px |
| Stack gaps | 10px | 6px |
| Metric values | 24px | 18px |
| Brand mark | 44px square | 28px square |
| Sidebar title | 19px | 13px font-weight-650 |
| Grid columns (overview) | 340px + 1fr + 340px | 260px + 1fr + 280px |
| Grid columns (chat) | 320px + 1fr + 340px | 240px + 1fr + 280px |
| Grid columns (memory) | 340px + 1fr + 360px | 260px + 1fr + 300px |
| Panel border-radius | 8px | 6px |
| Button padding | 9px 12px | 6px 10px |
| Pill padding | 5px 10px | 3px 8px |
| Empty state padding | 36px 22px | 20px 16px |

### New Sidebar Design

Collapsed state (48px):
- 28px brand icon
- Icon-only nav items (16px icons), tooltip on hover
- Connection status dot at bottom

Expanded state (200px, on hover or pin toggle):
- Brand icon + "Cadet" text
- Full nav labels appear
- Operator name + role at bottom
- Pin/unpin button

### New Features

1. **Command palette** (`Cmd+K`): Quick navigation, run search, agent search
2. **Keyboard shortcuts**: `a` approve, `r` reject, `j/k` navigate runs, `1-5` switch views
3. **Connection indicator**: Green pulsing dot when SpacetimeDB subscription is active, red when disconnected
4. **Operator identity**: Shows `display_name` from `OperatorAccount` in sidebar footer
5. **Compact inspector**: Right panel shrinks to key-value pairs only, no instructional text

### View-Specific Changes

**Overview:** Tighter 3-column grid. Run queue items are single-line rows (agent + goal + status pill), not cards. Detail pane uses compact tabs. Inspector is key-value only.

**Chat:** Message bubbles have 10px padding (down from 14px). Composer textarea is 80px min-height (down from 148px). Thread list items are single-line.

**Memory:** Embedding field visualization stays but grid lines are thinner. Stat cards use 18px values (down from 32px). Dimension bars are narrower.

**Workflow:** Lane cards are more compact (10px padding). Lane min-height reduced to 400px.

### Styles Structure

`styles.rs` is rewritten from scratch using the shared design tokens. The CSS string is organized into sections:
1. Reset + tokens (from `design-tokens.json` values)
2. Shell layout (sidebar, topbar, content)
3. Panel primitives (card, panel, inspector)
4. Typography (eyebrow, title, copy, mono)
5. Interactive (buttons, segmented, pills, inputs)
6. Status (badge colors, connection indicator)
7. View-specific (overview grid, chat stream, memory field, workflow board)

---

## 5. Dashboard Pages — Component Design

### Overview (`/dashboard`)

4 `MetricHUD` cards across the top:
- Active runs (cyan glow if > 0)
- Pending approvals (gold glow if > 0)
- Connected agents (green when all healthy)
- Browser tasks (neutral)

Below: 2-column layout
- Left (60%): Recent runs table — columns: Agent, Goal, Stage, Status, Age. Click to navigate to detail.
- Right (40%): Approval queue — compact list with inline approve/reject buttons.

### Agents (`/dashboard/agents`)

Table view: Agent ID, Display Name, Runtime, Execution Target, Control Plane, Schedules, Last Heartbeat, Status.

Each row expandable to show schedule details and recent jobs.

### Runs (`/dashboard/runs`)

Filterable table: Status filter (all/running/completed/failed/blocked), agent filter, date range.

Columns: Agent, Goal, Stage, Status, Steps, Duration, Requested By.

### Run Detail (`/dashboard/runs/[runId]`)

Header: agent name + goal + status badge + stage badge
Tabs: Timeline | Browser | Approvals | Tool Calls
Timeline: vertical step list with status indicators
Browser: artifact cards with screenshots/URLs
Approvals: inline approve/reject with risk level
Tool calls: expandable rows with input/output JSON

### Threads (`/dashboard/threads`)

Left: thread list (channel icon + title + message count + last active)
Right: message stream with composer

### Approvals (`/dashboard/approvals`)

Full-page approval queue. Grouped by risk level (high first). Each card shows: agent, goal, title, detail, risk badge, approve/reject buttons. Keyboard shortcuts for fast triage.

### Memory (`/dashboard/memory`)

Left: document list grouped by agent + namespace
Center: document content viewer
Right: embedding field visualizer (ported from Dioxus, implemented as canvas/SVG)

### Settings (`/dashboard/settings`)

Tabs: Control Plane | Operators | API
- Control plane: SpacetimeDB URL, database name, connection status
- Operators: table of `OperatorAccount` records, invite flow (admin only)
- API: endpoint reference, cron secret status

---

## 6. Web Components (shadcn/ui based)

### New Components to Build

| Component | Base | Purpose |
|-----------|------|---------|
| `StatusBadge` | shadcn `Badge` | Color-coded status pill |
| `MetricHUD` | shadcn `Card` | Monospace number + label + glow |
| `AgentCard` | shadcn `Card` | Agent summary with status ring |
| `RunTimeline` | custom | Horizontal stage pipeline |
| `ApprovalGate` | shadcn `Card` + `Button` | Inline approve/reject |
| `ConnectionIndicator` | custom | Pulsing dot + label |
| `CommandLog` | custom | Terminal-style log viewer |
| `DashboardSidebar` | shadcn `Sheet` (mobile) / custom (desktop) | Collapsible nav |
| `DashboardTopBar` | custom | Breadcrumb + env badge + status |
| `DataTable` | shadcn `Table` | Sortable/filterable table |
| `EmbeddingField` | custom (SVG) | 2D embedding visualizer |

### shadcn Components to Install

```bash
npx shadcn@latest add badge button card dialog dropdown-menu input label \
  scroll-area separator sheet skeleton table tabs tooltip avatar alert-dialog \
  command popover select
```

---

## 7. Implementation Dependencies

### Install Order

1. Tailwind CSS + shadcn/ui initialization
2. Design tokens file
3. `globals.css` rewrite with shared tokens
4. `proxy.ts` for route protection
5. Auth tables + reducers in SpacetimeDB module
6. WebAuthn API routes + sign-in/sign-up pages
7. Dashboard layout shell
8. Dashboard pages (overview first, then agents, runs, threads, approvals, memory, settings)
9. SSE stream endpoint
10. Dioxus `styles.rs` rewrite
11. Dioxus view rewrites (all 5 views)
12. Dioxus sidebar + command palette

### No Changes To

- `packages/core` — types and validation unchanged
- `packages/sdk` — SpacetimeDB HTTP client unchanged
- `packages/cli` — CLI unchanged
- `apps/local-control` — Bun control plane unchanged
- Existing API routes — all preserved, just auth-gated where needed
- `rust/starbridge-core` — execution kernel unchanged
- `rust/starbridge-runner` — cloud runner unchanged
