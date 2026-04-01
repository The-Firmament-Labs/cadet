# 007 — Mission Journal Editor

**Status:** Not Started
**Effort:** Small
**Depends on:** [002 Web Client](002-web-client.md)
**Target file:** `rust/starbridge-dioxus/src/ui/views/journal.rs`

---

## Context

The Mission Journal is Cadet's personality and memory system. It stores operator identity, behavioral rules, learned facts, achievements, and per-agent personality overrides. The TypeScript backend (`apps/web/lib/agent-runtime/mission-journal.ts`) already exposes `GET /api/journal` and `POST /api/journal` endpoints backed by SpacetimeDB `memory_document` rows.

The desktop view is a tabbed editor that reads/writes through `WebClient` (spec 002). All data round-trips through the web server — no direct SpacetimeDB subscription is needed for this view.

**Data shape** (from `MissionJournal` interface):

```
MissionJournal {
  operatorId, callsign,
  flightPlan: { role, expertise[], timezone, communicationStyle },
  shipsLog: string[],              // max 50, most recent last
  standingOrders: string[],        // behavioral rules
  missionPatches: [{ name, description, earnedAt }],
  crewManifest: Record<agentId, { personality, specialFocus }>,
  updatedAt
}
```

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Mission Journal — {callsign}                            [Save ▪]   │
├──────────────────────────────────────────────────────────────────────┤
│ [Flight Plan] [Standing Orders] [Ship's Log] [Patches] [Crew]      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Tab: Flight Plan                                                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Role        [___Senior Engineer__________________________]     │  │
│  │ Expertise   [Rust] [TypeScript] [SpacetimeDB] [+ Add]         │  │
│  │ Timezone    [America/Los_Angeles  ▾]                           │  │
│  │ Comms Style [___direct_____________________________________]   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Tab: Standing Orders                                                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 1. Match the existing code style exactly              [✕]     │  │
│  │ 2. Don't add comments to code you didn't change       [✕]     │  │
│  │ 3. Run tests after every change                       [✕]     │  │
│  │ 4. Prefer minimal, focused changes over broad refac.. [✕]     │  │
│  │ [+ Add standing order___________________________________]     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Tab: Ship's Log                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 [_search log entries______]                                │  │
│  │                                                                │  │
│  │ • Operator prefers bun over npm           2026-03-31 09:14    │  │
│  │ • Auth uses SpacetimeDB, not Clerk        2026-03-30 17:22    │  │
│  │ • Repo uses Orbital D350 theme            2026-03-28 11:05    │  │
│  │ ...                                                            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Tab: Mission Patches                                                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │  │
│  │ │ ★ First  │  │ ★ 100    │  │ ★ Fleet  │  │ ★ Hard-  │       │  │
│  │ │  Launch  │  │  Runs    │  │  Master  │  │  ening   │       │  │
│  │ │ 03-27    │  │ 03-28    │  │ 03-29    │  │ 03-28    │       │  │
│  │ └──────────┘  └──────────┘  └──────────┘  └──────────┘       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Tab: Crew Manifest                                                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Agent: [cadet ▾]                                               │  │
│  │                                                                │  │
│  │ Personality:                                                   │  │
│  │ ┌──────────────────────────────────────────────────────────┐   │  │
│  │ │ Helpful mission control operator. Professional,         │   │  │
│  │ │ concise, space-themed acknowledgments.                   │   │  │
│  │ └──────────────────────────────────────────────────────────┘   │  │
│  │ Special Focus: [routing and delegation__________________]     │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Requirements

1. **Five tabs** — Flight Plan, Standing Orders, Ship's Log, Mission Patches, Crew Manifest
2. **Flight Plan tab** — form fields for `role` (text), `expertise` (tag input with add/remove), `timezone` (dropdown), `communicationStyle` (text)
3. **Standing Orders tab** — ordered list with inline delete (`[x]`) and an add-row input at the bottom
4. **Ship's Log tab** — reverse-chronological scrollable list with keyword search filter; read-only (entries are added by agents, not the operator)
5. **Mission Patches tab** — grid of badge cards showing name, description, and `earnedAt` timestamp; read-only
6. **Crew Manifest tab** — agent selector dropdown, personality textarea, special focus text input; one agent editable at a time
7. **Save button** — POST full journal to `WebClient::save_journal`; disable while no changes; show toast on success/error
8. **Dirty tracking** — compare loaded state vs current state to enable/disable save and warn on tab navigation away
9. **Load on mount** — call `WebClient::get_journal()` when the view activates; show loading skeleton
10. **Keyboard** — `Ctrl+S` saves, `Tab`/`Shift+Tab` moves between fields

---

## Files

| Action | Path |
|--------|------|
| CREATE | `rust/starbridge-dioxus/src/ui/views/journal.rs` |
| MODIFY | `rust/starbridge-dioxus/src/ui/views/mod.rs` — add `mod journal; pub use journal::JournalView;` |
| MODIFY | `rust/starbridge-dioxus/src/ui/models.rs` — add `Journal` variant to `WorkspacePage` |
| MODIFY | `rust/starbridge-dioxus/src/ui/styles.rs` — add journal-specific CSS |
| MODIFY | `rust/starbridge-dioxus/src/web_client.rs` — add `get_journal` / `save_journal` if not present |

---

## Steps (each = one commit)

### Step 1: Data model and WebClient methods

Add the Rust-side journal types and wire the HTTP calls.

```rust
// In web_client.rs (or a new models/journal.rs)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionJournal {
    pub operator_id: String,
    pub callsign: String,
    pub flight_plan: FlightPlan,
    pub ships_log: Vec<String>,
    pub standing_orders: Vec<String>,
    pub mission_patches: Vec<MissionPatch>,
    pub crew_manifest: HashMap<String, CrewEntry>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlightPlan {
    pub role: String,
    pub expertise: Vec<String>,
    pub timezone: String,
    pub communication_style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionPatch {
    pub name: String,
    pub description: String,
    pub earned_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrewEntry {
    pub personality: String,
    pub special_focus: String,
}

impl WebClient {
    pub async fn get_journal(&self) -> Result<MissionJournal> {
        let resp = self.client
            .get(format!("{}/api/journal", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(resp.json().await?)
    }

    pub async fn save_journal(&self, journal: &MissionJournal) -> Result<()> {
        self.client
            .post(format!("{}/api/journal", self.base_url))
            .bearer_auth(&self.session_token)
            .json(journal)
            .send()
            .await?;
        Ok(())
    }
}
```

**Commit:** `feat(desktop): add MissionJournal types and WebClient methods`

### Step 2: Journal view scaffold with tab navigation

Create `journal.rs` with the 5-tab component, loading state, and empty tab bodies.

```rust
// rust/starbridge-dioxus/src/ui/views/journal.rs

use dioxus::prelude::*;

#[derive(Clone, Copy, PartialEq, Eq)]
enum JournalTab {
    FlightPlan,
    StandingOrders,
    ShipsLog,
    MissionPatches,
    CrewManifest,
}

impl JournalTab {
    fn label(self) -> &'static str {
        match self {
            Self::FlightPlan => "Flight Plan",
            Self::StandingOrders => "Standing Orders",
            Self::ShipsLog => "Ship's Log",
            Self::MissionPatches => "Mission Patches",
            Self::CrewManifest => "Crew Manifest",
        }
    }

    fn all() -> &'static [JournalTab] {
        &[
            Self::FlightPlan,
            Self::StandingOrders,
            Self::ShipsLog,
            Self::MissionPatches,
            Self::CrewManifest,
        ]
    }
}

#[component]
pub fn JournalView() -> Element {
    let mut active_tab = use_signal(|| JournalTab::FlightPlan);
    let mut journal = use_signal(|| None::<MissionJournal>);
    let mut loading = use_signal(|| true);
    let mut dirty = use_signal(|| false);

    // Load journal on mount
    use_effect(move || {
        spawn(async move {
            match web_client().get_journal().await {
                Ok(j) => journal.set(Some(j)),
                Err(e) => log::error!("Failed to load journal: {e}"),
            }
            loading.set(false);
        });
    });

    rsx! {
        div { class: "journal-view",
            div { class: "journal-header",
                h2 { "Mission Journal" }
                button {
                    class: "btn-save",
                    disabled: !dirty(),
                    onclick: move |_| { /* save handler */ },
                    "Save"
                }
            }
            div { class: "journal-tabs",
                for tab in JournalTab::all() {
                    button {
                        class: if active_tab() == *tab { "tab active" } else { "tab" },
                        onclick: move |_| active_tab.set(*tab),
                        "{tab.label()}"
                    }
                }
            }
            div { class: "journal-body",
                match active_tab() {
                    JournalTab::FlightPlan => rsx! { FlightPlanTab { journal, dirty } },
                    JournalTab::StandingOrders => rsx! { StandingOrdersTab { journal, dirty } },
                    JournalTab::ShipsLog => rsx! { ShipsLogTab { journal } },
                    JournalTab::MissionPatches => rsx! { PatchesTab { journal } },
                    JournalTab::CrewManifest => rsx! { CrewManifestTab { journal, dirty } },
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): journal view scaffold with 5-tab navigation`

### Step 3: Flight Plan and Standing Orders tabs

Implement the editable form fields — text inputs, tag input for expertise, and the ordered-list editor for standing orders.

**Commit:** `feat(desktop): journal Flight Plan and Standing Orders tabs`

### Step 4: Ship's Log, Patches, and Crew Manifest tabs

Implement the three remaining tabs — read-only log timeline with search, badge grid, and agent personality editor.

**Commit:** `feat(desktop): journal Ship's Log, Patches, and Crew Manifest tabs`

### Step 5: Save, dirty tracking, and CSS

Wire the save button to `WebClient::save_journal`, implement dirty tracking by diffing loaded vs current state, add toast feedback, and add all journal CSS to `styles.rs`.

**Commit:** `feat(desktop): journal save, dirty tracking, and styles`

### Step 6: Register in navigation

Add `Journal` to `WorkspacePage` enum, wire into sidebar, and assign keyboard shortcut `Cmd+8`.

**Commit:** `feat(desktop): register journal view in navigation`

---

## Regression Tests

Run after every step:

```bash
# Must compile
cargo build --bin starbridge-dioxus-ui --features desktop-ui

# Unit tests (if any)
cargo test --bin starbridge-dioxus-ui --features desktop-ui

# Manual: launch app, navigate to Journal tab
# - Journal loads without error (check terminal for panics)
# - All 5 tabs switch correctly
# - Flight Plan fields are editable and Save enables
# - Standing Orders can be added/removed
# - Ship's Log is scrollable and searchable
# - Patches render as a grid
# - Crew Manifest dropdown switches agents
# - Ctrl+S triggers save
# - Dirty indicator clears after save
```

---

## Definition of Done

- [ ] `JournalView` component renders with 5 working tabs
- [ ] Flight Plan form edits persist via `save_journal`
- [ ] Standing Orders add/remove works
- [ ] Ship's Log displays entries reverse-chronologically with search
- [ ] Mission Patches render as a badge grid
- [ ] Crew Manifest allows per-agent personality editing
- [ ] Save button is disabled when clean, enabled when dirty
- [ ] Toast shown on save success/failure
- [ ] `Ctrl+S` keyboard shortcut works
- [ ] View registered in `WorkspacePage` enum and sidebar navigation
- [ ] `cargo build` passes with no warnings
- [ ] No panics in debug mode when switching tabs rapidly

---

## PR Template

```markdown
## Summary
- Add Mission Journal editor view with 5 tabs (Flight Plan, Standing Orders, Ship's Log, Mission Patches, Crew Manifest)
- Wire to WebClient GET/POST /api/journal endpoints
- Dirty tracking and Ctrl+S save shortcut

## Test plan
- [ ] Build passes: `cargo build --bin starbridge-dioxus-ui --features desktop-ui`
- [ ] Launch app, navigate to Journal
- [ ] Edit Flight Plan fields, verify Save enables
- [ ] Add and remove Standing Orders
- [ ] Verify Ship's Log renders and search filters entries
- [ ] Verify Mission Patches grid renders timestamps
- [ ] Switch agents in Crew Manifest, edit personality
- [ ] Ctrl+S saves, toast appears, dirty clears
- [ ] Rapidly switch tabs — no panics

Closes #XXX
```
