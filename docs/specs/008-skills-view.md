# 008 — Skills Directory + Creator

**Status:** Not Started
**Effort:** Small
**Depends on:** [002 Web Client](002-web-client.md)
**Target file:** `rust/starbridge-dioxus/src/ui/views/skills.rs`

---

## Context

Skills are on-demand knowledge documents loaded into agent context when needed. The TypeScript backend (`apps/web/lib/agent-runtime/skills.ts`) defines `SkillMetadata` (list view) and `Skill` (full content) types, with 5 built-in skills and support for installed/operator-created skills stored in SpacetimeDB.

The desktop view is a 2-column layout: skill list on the left, detail or creator form on the right. Data flows through `WebClient` calls to `/api/skills`.

**Data shape** (from `SkillMetadata` / `Skill` interfaces):

```
SkillMetadata {
  id, name, description, category, version, author,
  tokenEstimate: number,
  platforms?: string[],
  requiredEnvVars?: string[],
  activationPatterns?: string[],
  source: "builtin" | "installed" | "operator"
}

Skill extends SkillMetadata {
  content: string,                              // full markdown
  references?: [{ path, content }]
}
```

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Skills                                                  [+ Create]  │
├────────────────────────┬─────────────────────────────────────────────┤
│ 🔍 [_search skills__] │                                             │
│                        │  Git Workflow                    v1.0.0     │
│ ┌────────────────────┐ │  by cadet          builtin   ~800 tokens   │
│ │ ▸ Git Workflow     │ │                                             │
│ │   workflow  builtin│ │  Branch naming, commit messages, PR         │
│ ├────────────────────┤ │  conventions, rebase vs merge strategies    │
│ │   Code Review      │ │                                             │
│ │   quality  builtin │ │  Category: workflow                         │
│ ├────────────────────┤ │  Activation: git, branch, commit, rebase   │
│ │   Testing Guide    │ │  Platforms: all                             │
│ │   testing  builtin │ │  Env vars: none                             │
│ ├────────────────────┤ │                                             │
│ │   Security Audit   │ │  ── Content ────────────────────────────    │
│ │   security builtin │ │  # Git Workflow                             │
│ ├────────────────────┤ │                                             │
│ │   Deploy Checklist │ │  ## Branch Naming                           │
│ │   ops      builtin │ │  - feature/TICKET-description               │
│ ├────────────────────┤ │  - fix/TICKET-description                   │
│ │   My Custom Skill  │ │  - chore/description                       │
│ │   custom  operator │ │  ...                                        │
│ └────────────────────┘ │                                             │
│                        │  [Edit] [Delete]                            │
├────────────────────────┴─────────────────────────────────────────────┤
│                                                                      │
│  Creator Form (replaces right panel when [+ Create] clicked)         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Name        [____________________________________]             │  │
│  │ Description [____________________________________]             │  │
│  │ Category    [workflow ▾]                                       │  │
│  │ Activation  [git, branch, commit_______________]               │  │
│  │ Version     [1.0.0_]   Author [operator_______]               │  │
│  │                                                                │  │
│  │ Content (markdown):                                            │  │
│  │ ┌──────────────────────────────────────────────────────────┐   │  │
│  │ │ # My Custom Skill                                        │   │  │
│  │ │                                                          │   │  │
│  │ │ Write your skill content here...                         │   │  │
│  │ │                                                          │   │  │
│  │ └──────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │ Preview:                                                       │  │
│  │ ┌──────────────────────────────────────────────────────────┐   │  │
│  │ │ (rendered markdown preview)                              │   │  │
│  │ └──────────────────────────────────────────────────────────┘   │  │
│  │                                                                │  │
│  │ [Cancel]                                          [Save Skill] │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Requirements

1. **Two-column layout** — skill list (left, 280px) and detail/creator pane (right, fluid)
2. **Skill list** — shows all skills (built-in + installed + operator); each row displays name, category badge, source badge, token estimate
3. **Search** — text input above list filters by name, description, and activation patterns (client-side, instant)
4. **Skill detail** — shows full metadata (version, author, platforms, env vars, activation patterns) and rendered markdown content
5. **Source badges** — colored: `builtin` (sage), `installed` (blue), `operator` (coral)
6. **Create button** — top-right; switches right panel to creator form
7. **Creator form** — fields: name, description, category (dropdown: workflow, quality, testing, security, ops, custom), activation patterns (comma-separated), version, author, content (markdown textarea)
8. **Markdown preview** — live preview below the content textarea, togglable
9. **Edit** — operator-created skills can be edited (pre-fill creator form); built-in and installed skills are read-only
10. **Delete** — operator-created skills only; confirmation dialog before delete
11. **Save** — POST to `WebClient::save_skill`; show toast; refresh list
12. **Load on mount** — call `WebClient::list_skills()` to populate; show loading skeleton

---

## Files

| Action | Path |
|--------|------|
| CREATE | `rust/starbridge-dioxus/src/ui/views/skills.rs` |
| MODIFY | `rust/starbridge-dioxus/src/ui/views/mod.rs` — add `mod skills; pub use skills::SkillsView;` |
| MODIFY | `rust/starbridge-dioxus/src/ui/models.rs` — add `Skills` variant to `WorkspacePage` |
| MODIFY | `rust/starbridge-dioxus/src/ui/styles.rs` — add skills-specific CSS |
| MODIFY | `rust/starbridge-dioxus/src/web_client.rs` — add `list_skills`, `get_skill`, `save_skill`, `delete_skill` |

---

## Steps (each = one commit)

### Step 1: Skill types and WebClient methods

Add the Rust-side skill types and HTTP methods.

```rust
// In web_client.rs (or models/skill.rs)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillMetadata {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub version: String,
    pub author: String,
    pub token_estimate: u32,
    pub platforms: Option<Vec<String>>,
    pub required_env_vars: Option<Vec<String>>,
    pub activation_patterns: Option<Vec<String>>,
    pub source: SkillSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SkillSource {
    Builtin,
    Installed,
    Operator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    #[serde(flatten)]
    pub metadata: SkillMetadata,
    pub content: String,
    pub references: Option<Vec<SkillReference>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillReference {
    pub path: String,
    pub content: String,
}

impl WebClient {
    pub async fn list_skills(&self) -> Result<Vec<SkillMetadata>> {
        let resp = self.client
            .get(format!("{}/api/skills", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(resp.json().await?)
    }

    pub async fn get_skill(&self, id: &str) -> Result<Skill> {
        let resp = self.client
            .get(format!("{}/api/skills/{id}", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(resp.json().await?)
    }

    pub async fn save_skill(&self, skill: &Skill) -> Result<()> {
        self.client
            .post(format!("{}/api/skills", self.base_url))
            .bearer_auth(&self.session_token)
            .json(skill)
            .send()
            .await?;
        Ok(())
    }

    pub async fn delete_skill(&self, id: &str) -> Result<()> {
        self.client
            .delete(format!("{}/api/skills/{id}", self.base_url))
            .bearer_auth(&self.session_token)
            .send()
            .await?;
        Ok(())
    }
}
```

**Commit:** `feat(desktop): add Skill types and WebClient CRUD methods`

### Step 2: Skills view scaffold with list and detail

Create `skills.rs` with the 2-column layout, skill list loading, selection, and detail display.

```rust
// rust/starbridge-dioxus/src/ui/views/skills.rs

use dioxus::prelude::*;
use std::collections::HashMap;

#[derive(Clone, PartialEq)]
enum SkillsPanel {
    Detail(String),    // skill id
    Creator,
    Editor(String),    // skill id being edited
    Empty,
}

#[component]
pub fn SkillsView() -> Element {
    let mut skills = use_signal(Vec::<SkillMetadata>::new);
    let mut search = use_signal(String::new);
    let mut panel = use_signal(|| SkillsPanel::Empty);
    let mut loading = use_signal(|| true);
    let mut selected_skill = use_signal(|| None::<Skill>);

    // Load skills on mount
    use_effect(move || {
        spawn(async move {
            match web_client().list_skills().await {
                Ok(s) => skills.set(s),
                Err(e) => log::error!("Failed to load skills: {e}"),
            }
            loading.set(false);
        });
    });

    let filtered: Vec<_> = skills.read().iter().filter(|s| {
        let q = search.read().to_lowercase();
        q.is_empty()
            || s.name.to_lowercase().contains(&q)
            || s.description.to_lowercase().contains(&q)
            || s.activation_patterns.as_ref().map_or(false, |pats| {
                pats.iter().any(|p| p.to_lowercase().contains(&q))
            })
    }).cloned().collect();

    rsx! {
        div { class: "skills-view",
            div { class: "skills-list-panel",
                div { class: "skills-list-header",
                    input {
                        class: "search-input",
                        placeholder: "Search skills...",
                        value: "{search}",
                        oninput: move |e| search.set(e.value()),
                    }
                }
                div { class: "skills-list",
                    for skill in filtered.iter() {
                        SkillListItem {
                            skill: skill.clone(),
                            selected: matches!(&*panel.read(), SkillsPanel::Detail(id) if id == &skill.id),
                            on_click: move |id: String| {
                                panel.set(SkillsPanel::Detail(id));
                            },
                        }
                    }
                }
            }
            div { class: "skills-detail-panel",
                match &*panel.read() {
                    SkillsPanel::Detail(id) => rsx! { SkillDetail { id: id.clone() } },
                    SkillsPanel::Creator => rsx! { SkillCreator { on_save: move |_| {} } },
                    SkillsPanel::Editor(id) => rsx! { SkillCreator { editing: id.clone() } },
                    SkillsPanel::Empty => rsx! { EmptyState {} },
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): skills view scaffold with list and detail panels`

### Step 3: Skill detail panel with markdown rendering

Implement the full detail view showing all metadata fields and rendered markdown content.

**Commit:** `feat(desktop): skill detail panel with metadata and content display`

### Step 4: Skill creator/editor form

Implement the creator form with all fields, live markdown preview toggle, and save/cancel actions.

**Commit:** `feat(desktop): skill creator and editor form with markdown preview`

### Step 5: Delete, confirmation dialog, and CSS

Add delete for operator skills with confirmation, wire all actions to WebClient, and add skills CSS to `styles.rs`.

```rust
// Confirmation dialog pattern used throughout the app

#[component]
fn ConfirmDialog(
    title: String,
    message: String,
    on_confirm: EventHandler<()>,
    on_cancel: EventHandler<()>,
) -> Element {
    rsx! {
        div { class: "confirm-overlay",
            div { class: "confirm-dialog",
                h3 { "{title}" }
                p { "{message}" }
                div { class: "confirm-actions",
                    button {
                        class: "btn-cancel",
                        onclick: move |_| on_cancel.call(()),
                        "Cancel"
                    }
                    button {
                        class: "btn-danger",
                        onclick: move |_| on_confirm.call(()),
                        "Delete"
                    }
                }
            }
        }
    }
}
```

**Commit:** `feat(desktop): skill delete with confirmation, styles`

### Step 6: Register in navigation

Add `Skills` to `WorkspacePage` enum, wire into sidebar, assign keyboard shortcut `Cmd+7`.

**Commit:** `feat(desktop): register skills view in navigation`

---

## Regression Tests

Run after every step:

```bash
# Must compile
cargo build --bin starbridge-dioxus-ui --features desktop-ui

# Unit tests
cargo test --bin starbridge-dioxus-ui --features desktop-ui

# Manual verification:
# - Skills view loads and shows 5+ built-in skills
# - Search filters list in real-time
# - Click a skill -> detail panel shows full content
# - Click [+ Create] -> creator form appears
# - Fill in all fields, click Save -> skill appears in list
# - Click Edit on operator skill -> form pre-filled
# - Click Delete on operator skill -> confirmation dialog -> removed
# - Built-in skills show no Edit/Delete buttons
# - Source badges colored correctly (sage/blue/coral)
# - Markdown content renders headings, lists, code blocks
```

---

## Definition of Done

- [ ] 2-column layout renders: skill list (left) + detail/creator (right)
- [ ] All skills load from WebClient on mount
- [ ] Search filters by name, description, and activation patterns
- [ ] Skill detail displays all metadata fields and rendered content
- [ ] Source badges show correct colors for builtin/installed/operator
- [ ] Creator form has all fields and saves via WebClient
- [ ] Markdown preview toggles in creator form
- [ ] Edit pre-fills creator form for operator skills
- [ ] Delete shows confirmation dialog and removes operator skills only
- [ ] Built-in/installed skills are read-only (no Edit/Delete)
- [ ] View registered in `WorkspacePage` enum and sidebar
- [ ] `cargo build` passes with no warnings

---

## PR Template

```markdown
## Summary
- Add Skills Directory view with 2-column layout (list + detail/creator)
- Wire to WebClient CRUD endpoints for /api/skills
- Search, source badges, markdown rendering, create/edit/delete for operator skills

## Test plan
- [ ] Build passes: `cargo build --bin starbridge-dioxus-ui --features desktop-ui`
- [ ] Launch app, navigate to Skills
- [ ] Verify 5 built-in skills render with correct badges
- [ ] Search for "git" — only Git Workflow skill remains
- [ ] Click skill — detail panel shows metadata + rendered markdown
- [ ] Create new skill — fills form, save, appears in list
- [ ] Edit operator skill — form pre-fills, save updates
- [ ] Delete operator skill — confirmation, then removed
- [ ] Built-in skills show no Edit/Delete buttons

Closes #XXX
```
