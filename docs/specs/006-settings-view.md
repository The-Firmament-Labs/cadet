# Spec 006 — Settings View (Auth, Routing, Profiles, Appearance)

**Status:** Not Started
**Effort:** Small
**Depends on:** 002 (Web Client)
**Produces:** `rust/starbridge-dioxus/src/ui/views/settings.rs`

---

## Context

The settings view is the central configuration hub for Cadet Desktop. It surfaces the `AuthProviderRegistry` (20 provider credentials with discovery status), model routing strategy, resource profiles from `SELF_IMPROVING_AGENTS.md`, appearance/theme toggles, keyboard shortcut reference, and connection status for SpacetimeDB and the web server.

**Data sources:**
- Auth providers: `AuthProviderRegistry::discover()` (reads keychain, env, config files).
- Model routing: Web server `/api/settings/routing` (reads/writes routing config).
- Resource profiles: Local config from `~/.cadet/config.toml`.
- Connections: `LiveState::connection_status` signal + web client health check.

**Reference UX:** Claude Desktop settings (clean, sectioned) + Raycast preferences (dense, keyboard-navigable).

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ app-shell                                                            │
├────────┬─────────────────────────────────────────────────────────────┤
│sidebar │  Settings                                     Cmd+, / Cmd+0│
│        │                                                             │
│  Chat  │  ┌─ Section Nav ──────────────────────────────────────────┐ │
│  Ovw   │  │ [Account] [Auth] [Routing] [Resources] [Appearance]   │ │
│  ...   │  │ [Shortcuts] [Connections] [About]                     │ │
│ [Sets] │  └────────────────────────────────────────────────────────┘ │
│        │                                                             │
│        │  ┌─ Auth Providers ───────────────────────────────────────┐ │
│        │  │                                                       │ │
│        │  │ ● Anthropic     Discovered (keychain)   [an...k4f2]  │ │
│        │  │ ● OpenAI        Discovered (env)        [sk...Tz9a]  │ │
│        │  │ ● GitHub        Discovered (config)     [gh...p_8x]  │ │
│        │  │ ○ Google AI     Missing                 [Add Key]    │ │
│        │  │ ○ Mistral       Missing                 [Add Key]    │ │
│        │  │ ● Groq          Configured (manual)     [gr...ok12]  │ │
│        │  │ ...                                                   │ │
│        │  └───────────────────────────────────────────────────────┘ │
│        │                                                             │
│        │  ┌─ Model Routing ────────────────────────────────────────┐ │
│        │  │ Strategy: [Cost v] [Speed] [Quality] [Balanced]       │ │
│        │  │ Current model: Claude Sonnet 4 (via Anthropic)        │ │
│        │  │ Preferred: [x] Anthropic  [x] OpenAI  [ ] Google     │ │
│        │  │ Blocked:   [ ] Anthropic  [ ] OpenAI  [ ] Google     │ │
│        │  └───────────────────────────────────────────────────────┘ │
│        │                                                             │
│        │  ┌─ Resource Profile ─────────────────────────────────────┐ │
│        │  │ Active: (Lightweight) [Balanced] [Power] [Team] [Cust]│ │
│        │  │                                                       │ │
│        │  │ Inference:  Cloud (AI Gateway)                        │ │
│        │  │ Embeddings: Cloud (OpenAI)                            │ │
│        │  │ Scoring:    Cloud (Haiku) — on request only           │ │
│        │  │ Training:   Disabled                                  │ │
│        │  │ Memory:     ~0 MB additional                          │ │
│        │  └───────────────────────────────────────────────────────┘ │
│        │                                                             │
│        │  ┌─ Appearance ───────────────────────────────────────────┐ │
│        │  │ Theme:   (Dark) [Light]                               │ │
│        │  │ Widgets: (Glass) [Solid] [Minimal]                    │ │
│        │  │ Sidebar: (Left) [Right]                               │ │
│        │  └───────────────────────────────────────────────────────┘ │
│        │                                                             │
│        │  ┌─ Connections ──────────────────────────────────────────┐ │
│        │  │ SpacetimeDB: ● Connected (ws://127.0.0.1:3000)       │ │
│        │  │ Web Server:  ● Connected (http://localhost:3001)      │ │
│        │  │ Maincloud:   [Open Dashboard →]                       │ │
│        │  └───────────────────────────────────────────────────────┘ │
├────────┴─────────────────────────────────────────────────────────────┤
```

---

## Requirements

### R1 — Auth Provider Grid
- Display all providers from `AuthProviderRegistry::discover()`.
- Each row: status dot (green = discovered/configured, gray = missing), provider name, source label, redacted token or "Add Key" button.
- "Add Key" button opens an inline text input for manual token entry.
- On save, write token to `~/.cadet/credentials.json` and re-discover.

### R2 — Model Routing
- Strategy selector: segmented buttons for Cost, Speed, Quality, Balanced.
- Current model display (read from web server or config).
- Preferred/blocked provider toggles (checkboxes per provider).
- Changes saved via web server `/api/settings/routing` or local config.

### R3 — Resource Profiles
- 5 named profiles from the Self-Improving Agents spec: Lightweight, Balanced, Power, Team, Custom.
- Each profile shows: inference, embeddings, scoring, training, memory usage.
- Select a profile to apply its settings.
- "Custom" profile enables per-capability 3-way toggles: Local | Remote | Cloud.

### R4 — Appearance
- Theme: Dark (default) / Light toggle.
- Widget style: Glass / Solid / Minimal.
- Sidebar position: Left (default) / Right.
- Changes apply immediately via CSS class toggling.

### R5 — Keyboard Shortcuts Reference
- Full table of all keyboard shortcuts with current bindings.
- Non-editable in v1 (display only).

### R6 — Connection Status
- SpacetimeDB: show connection state from `LiveState::connection_status`.
- Web server: periodic health check to `http://localhost:3001/api/health`.
- Status dots: green (connected), yellow (reconnecting), red (disconnected).

### R7 — Account Section
- Operator name, email from `~/.cadet/session.json`.
- Avatar initials badge.
- "Log out" button (clears session).

### R8 — About Section
- App version from `env!("CARGO_PKG_VERSION")`.
- Build date, Rust version.
- License info.

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `rust/starbridge-dioxus/src/ui/views/settings.rs` | **Create** | Settings view with all 8 sections |
| `rust/starbridge-dioxus/src/ui/views/mod.rs` | **Modify** | Add `mod settings;` |
| `rust/starbridge-dioxus/src/ui/models.rs` | **Modify** | Add `WorkspacePage::Settings` variant |
| `rust/starbridge-dioxus/src/ui/styles.rs` | **Modify** | Add settings-specific CSS |

---

## Implementation Steps

### Step 1 — Settings section types and resource profile model

**Commit:** `feat(settings): add SettingsSection enum and ResourceProfile model`

```rust
// Within settings.rs or a shared types area

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SettingsSection {
    Account,
    Auth,
    Routing,
    Resources,
    Appearance,
    Shortcuts,
    Connections,
    About,
}

impl SettingsSection {
    pub fn label(self) -> &'static str {
        match self {
            SettingsSection::Account => "Account",
            SettingsSection::Auth => "Auth Providers",
            SettingsSection::Routing => "Model Routing",
            SettingsSection::Resources => "Resource Profile",
            SettingsSection::Appearance => "Appearance",
            SettingsSection::Shortcuts => "Shortcuts",
            SettingsSection::Connections => "Connections",
            SettingsSection::About => "About",
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Self::Account, Self::Auth, Self::Routing, Self::Resources,
            Self::Appearance, Self::Shortcuts, Self::Connections, Self::About,
        ]
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ResourceProfile {
    Lightweight,
    Balanced,
    Power,
    Team,
    Custom,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ComputeMode {
    Local,
    Remote,
    Cloud,
    Off,
}

#[derive(Clone)]
pub struct ResourceConfig {
    pub profile: ResourceProfile,
    pub inference: ComputeMode,
    pub embeddings: ComputeMode,
    pub scoring: ComputeMode,
    pub training: ComputeMode,
}

impl ResourceConfig {
    pub fn from_profile(profile: ResourceProfile) -> Self {
        match profile {
            ResourceProfile::Lightweight => Self {
                profile,
                inference: ComputeMode::Cloud,
                embeddings: ComputeMode::Cloud,
                scoring: ComputeMode::Cloud,
                training: ComputeMode::Off,
            },
            ResourceProfile::Balanced => Self {
                profile,
                inference: ComputeMode::Cloud,
                embeddings: ComputeMode::Local,
                scoring: ComputeMode::Local,
                training: ComputeMode::Off,
            },
            ResourceProfile::Power => Self {
                profile,
                inference: ComputeMode::Local,
                embeddings: ComputeMode::Local,
                scoring: ComputeMode::Local,
                training: ComputeMode::Local,
            },
            ResourceProfile::Team => Self {
                profile,
                inference: ComputeMode::Remote,
                embeddings: ComputeMode::Remote,
                scoring: ComputeMode::Remote,
                training: ComputeMode::Remote,
            },
            ResourceProfile::Custom => Self {
                profile,
                inference: ComputeMode::Cloud,
                embeddings: ComputeMode::Cloud,
                scoring: ComputeMode::Off,
                training: ComputeMode::Off,
            },
        }
    }

    pub fn memory_estimate_mb(&self) -> &'static str {
        match self.profile {
            ResourceProfile::Lightweight => "~0 MB",
            ResourceProfile::Balanced => "~3 GB active, ~500 MB idle",
            ResourceProfile::Power => "~15 GB active",
            ResourceProfile::Team => "~0 MB local",
            ResourceProfile::Custom => "varies",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RoutingStrategy {
    Cost,
    Speed,
    Quality,
    Balanced,
}
```

**Test:** `test_resource_config_from_profile` for each of the 5 profiles. `test_memory_estimate` returns expected strings.

---

### Step 2 — Auth provider section component

**Commit:** `feat(settings): add auth provider grid with status dots and redacted tokens`

```rust
use crate::auth_provider::{AuthProviderRegistry, ProviderCredential, ProviderStatus};

#[component]
fn AuthProviderSection(registry: AuthProviderRegistry) -> Element {
    let mut editing_provider = use_signal(|| None::<String>);
    let mut key_input = use_signal(String::new);

    rsx! {
        div { class: "settings-section",
            h3 { class: "settings-section-title", "Auth Providers" }
            p { class: "row-copy", "API keys discovered from keychain, env vars, and config files." }
            div { class: "auth-grid",
                for provider in registry.providers.iter() {
                    div { class: "auth-row",
                        span {
                            class: match provider.status {
                                ProviderStatus::Discovered | ProviderStatus::Configured => "status-dot status-dot-ok",
                                ProviderStatus::Missing => "status-dot status-dot-missing",
                            },
                        }
                        span { class: "auth-name", "{provider.display_name}" }
                        span { class: "auth-source",
                            match provider.status {
                                ProviderStatus::Discovered => format!("Discovered ({})", provider.source),
                                ProviderStatus::Configured => format!("Configured ({})", provider.source),
                                ProviderStatus::Missing => "Missing".to_string(),
                            }
                        }
                        if let Some(token) = &provider.token {
                            span { class: "auth-token", "{redact_token(token)}" }
                        } else if editing_provider() == Some(provider.provider_id.clone()) {
                            input {
                                class: "auth-key-input",
                                placeholder: "Paste API key...",
                                value: key_input(),
                                oninput: move |e| key_input.set(e.value()),
                            }
                            button {
                                class: "primary-button",
                                onclick: move |_| {
                                    // Save to ~/.cadet/credentials.json
                                    editing_provider.set(None);
                                    key_input.set(String::new());
                                },
                                "Save"
                            }
                        } else {
                            button {
                                class: "secondary-button",
                                onclick: {
                                    let pid = provider.provider_id.clone();
                                    move |_| editing_provider.set(Some(pid.clone()))
                                },
                                "Add Key"
                            }
                        }
                    }
                }
            }
        }
    }
}

fn redact_token(token: &str) -> String {
    if token.len() <= 8 {
        "****".to_string()
    } else {
        format!("{}...{}", &token[..2], &token[token.len()-4..])
    }
}
```

**Test:** `test_redact_token` with short and long tokens. Verify "Add Key" button shows input when clicked.

---

### Step 3 — Full settings view composition

**Commit:** `feat(settings): compose SettingsView with all sections and section navigation`

```rust
#[component]
pub fn SettingsView() -> Element {
    let mut active_section = use_signal(|| SettingsSection::Auth);
    let registry = use_signal(|| AuthProviderRegistry::discover());
    let mut resource_config = use_signal(|| ResourceConfig::from_profile(ResourceProfile::Lightweight));
    let mut routing_strategy = use_signal(|| RoutingStrategy::Balanced);
    let mut theme = use_signal(|| "dark".to_string());

    rsx! {
        div { class: "page-grid page-grid-settings",
            section { class: "panel", style: "grid-column: 1 / -1;",
                div { class: "panel-head",
                    p { class: "section-eyebrow", "CONFIGURATION" }
                    h3 { class: "card-title", "Settings" }
                }

                // Section tabs
                div { class: "settings-tabs",
                    for section in SettingsSection::all() {
                        button {
                            class: if active_section() == section { "settings-tab settings-tab-active" } else { "settings-tab" },
                            onclick: move |_| active_section.set(section),
                            "{section.label()}"
                        }
                    }
                }

                div { class: "settings-body",
                    match active_section() {
                        SettingsSection::Auth => rsx! {
                            AuthProviderSection { registry: registry() }
                        },
                        SettingsSection::Resources => rsx! {
                            ResourceProfileSection {
                                config: resource_config(),
                                on_change: move |cfg: ResourceConfig| resource_config.set(cfg),
                            }
                        },
                        SettingsSection::Appearance => rsx! {
                            AppearanceSection {
                                theme: theme(),
                                on_theme: move |t| theme.set(t),
                            }
                        },
                        SettingsSection::Connections => rsx! {
                            ConnectionsSection {}
                        },
                        SettingsSection::About => rsx! {
                            div { class: "settings-section",
                                h3 { class: "settings-section-title", "About Cadet Desktop" }
                                p { "Version: ", env!("CARGO_PKG_VERSION") }
                            }
                        },
                        _ => rsx! {
                            div { class: "settings-section",
                                p { class: "row-copy", "Coming soon." }
                            }
                        },
                    }
                }
            }
        }
    }
}
```

**Test:** Build the app, navigate to Settings, verify section tabs work and Auth section shows provider grid.

---

### Step 4 — Settings CSS and polish

**Commit:** `style(settings): add settings layout, auth grid, profile selector, and tab styles`

```css
.page-grid-settings {
    grid-template-columns: 1fr;
}
.settings-tabs {
    display: flex;
    gap: 2px;
    padding: 0 12px;
    border-bottom: 1px solid var(--outline-variant);
    overflow-x: auto;
}
.settings-tab {
    padding: 8px 14px;
    font-size: 12px;
    background: none;
    border: none;
    color: var(--on-surface-variant);
    cursor: pointer;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
}
.settings-tab:hover { color: var(--on-surface); }
.settings-tab-active {
    color: var(--primary);
    border-bottom-color: var(--primary);
    font-weight: 600;
}
.settings-body {
    padding: 16px 24px;
    overflow-y: auto;
    max-height: calc(100vh - 180px);
}
.settings-section { margin-bottom: 24px; }
.settings-section-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
}

/* Auth grid */
.auth-grid { display: flex; flex-direction: column; gap: 4px; }
.auth-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 12px;
}
.auth-name { font-weight: 500; min-width: 120px; }
.auth-source { color: var(--on-surface-variant); min-width: 160px; }
.auth-token {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--secondary);
}
.auth-key-input {
    font-family: var(--mono);
    font-size: 11px;
    padding: 4px 8px;
    border: 1px solid var(--outline-variant);
    background: var(--surface-container);
    width: 200px;
}
.status-dot-ok { background: #4a7; }
.status-dot-missing { background: var(--secondary); }
.status-dot-warn { background: #e90; }
.status-dot-error { background: var(--primary); }

/* Resource profiles */
.profile-selector {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
}
.profile-button {
    padding: 6px 14px;
    font-size: 12px;
    background: var(--surface-container);
    border: 1px solid var(--outline-variant);
    cursor: pointer;
}
.profile-button-active {
    background: var(--primary);
    color: var(--on-primary);
    border-color: var(--primary);
}
.profile-details {
    font-size: 12px;
    font-family: var(--mono);
    line-height: 1.8;
}
.profile-row {
    display: flex;
    gap: 12px;
}
.profile-row-label {
    min-width: 100px;
    color: var(--on-surface-variant);
}
```

**Test:** Build the app, verify all settings sections have correct styling, tab switching is instant, auth grid aligns properly.

---

## Regression Tests

| # | Test | Validates |
|---|------|-----------|
| 1 | `test_resource_config_lightweight` | Lightweight profile: inference=Cloud, embeddings=Cloud, scoring=Cloud, training=Off |
| 2 | `test_resource_config_power` | Power profile: all capabilities = Local |
| 3 | `test_resource_config_team` | Team profile: all capabilities = Remote |
| 4 | `test_redact_token_long` | `"sk-abc123xyz456"` produces `"sk...z456"` |
| 5 | `test_redact_token_short` | `"abc"` produces `"****"` |
| 6 | `test_settings_section_all` | `SettingsSection::all()` returns 8 sections |
| 7 | `test_settings_section_labels` | Each section has a non-empty label |
| 8 | `test_routing_strategy_variants` | 4 routing strategy variants exist |
| 9 | `test_memory_estimate_lightweight` | Returns "~0 MB" |
| 10 | `cargo build --features desktop-ui` | Full app compiles with settings view |

---

## Definition of Done

- [ ] Settings accessible via sidebar (Cmd+, or Cmd+0)
- [ ] Section tabs navigate between 8 sections
- [ ] Auth Providers section shows 20 providers with status dots
- [ ] Discovered providers show redacted tokens
- [ ] Missing providers show "Add Key" button with inline input
- [ ] Model Routing section shows strategy selector and provider toggles
- [ ] Resource Profile section shows 5 profiles with capability breakdown
- [ ] Appearance section toggles theme (Dark/Light) and widget style
- [ ] Connections section shows SpacetimeDB and web server status
- [ ] About section shows app version
- [ ] All 10 regression tests pass
- [ ] `cargo build --features desktop-ui` succeeds

---

## PR Template

```markdown
## Summary
- Added Settings view with 8 configuration sections
- Built auth provider grid showing 20 providers with discovery status
- Implemented resource profile selector (Lightweight/Balanced/Power/Team/Custom)
- Added model routing strategy selector with provider toggles
- Theme and appearance toggles with immediate application

## Test plan
- [ ] Navigate to Settings, verify all 8 section tabs work
- [ ] Verify auth providers show discovered keys with redacted tokens
- [ ] Click "Add Key" on a missing provider, verify input appears
- [ ] Switch resource profile, verify capability table updates
- [ ] Toggle theme Dark/Light, verify immediate change
- [ ] Check Connections section shows SpacetimeDB status
- [ ] Run `cargo test` — all 10 tests pass
- [ ] Run `cargo build --features desktop-ui` — builds clean
```
