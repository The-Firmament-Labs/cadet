# Spec 015 -- Style Polish, Dark Mode, Animations, and Loading States

**Status:** Draft
**Scope:** Dark mode CSS with full token overrides, new keyframes, pipeline visualization CSS, responsive layout, loading skeletons, empty states, toast wiring, connection indicators
**Files:** `styles.rs`, `shared.rs`, `mod.rs`

---

## Context

The current `styles.rs` defines a light-mode Orbital Data System design language with CSS custom properties (tokens), two keyframes (`pulse`, `fade-in`), and all component styles. The desktop spec (DESKTOP_SPEC.md section 6) defines a dark mode palette, additional animations, and high-density information design. The existing styles have no dark mode overrides, no loading skeletons, no empty states, and only a basic connection dot in the sidebar footer.

### Current token set (styles.rs:12-44)

Light mode only. Key tokens: `--primary: #AA3618`, `--surface: #F7F5F4`, `--on-surface: #1C1B1B`, `--background-sage: #c8d1c0`.

### Existing keyframes (styles.rs:51-59)

Only `pulse` (opacity toggle) and `fade-in` (translateY + opacity).

### Dark mode target (DESKTOP_SPEC.md section 6.1)

Content area: `#1A1A1F`, surface: `#252528`, text: `#E8E6E3`, mint nav stays `#D4E8D9`.

---

## Requirements

1. **Dark mode CSS** -- `@media (prefers-color-scheme: dark)` block overriding all `:root` tokens. Also a `.theme-dark` class for manual toggle.
2. **New keyframes** -- `slide-in` (toast entry), `stage-progress` (pipeline active stage pulse), `shimmer` (skeleton loading), `spin` (spinner rotation).
3. **Pipeline visualization CSS** -- Styles for the 7-stage pipeline bar from spec 013 (included here for centralized style management).
4. **Responsive layout** -- Sidebar auto-collapses to icon-only (48px) at viewport width below 900px.
5. **Loading skeletons** -- `.skeleton` class with shimmer animation for use in all data-dependent views.
6. **Empty states** -- `.empty-state` component with icon, title, description, and optional action button. One per view.
7. **Toast notification wiring** -- Connect the existing toast component to real events: run completed, approval requested, run failed.
8. **Connection status indicators** -- Three-state dot (green = connected, yellow = reconnecting, red = disconnected) in sidebar footer, driven by `ConnectionStatus` signal.

---

## Files Changed

| File | Action |
|------|--------|
| `rust/starbridge-dioxus/src/ui/styles.rs` | Add dark mode tokens, keyframes, pipeline CSS, responsive rules, skeleton/empty-state classes |
| `rust/starbridge-dioxus/src/ui/shared.rs` | Add `Skeleton`, `EmptyState`, `ConnectionDot` components |
| `rust/starbridge-dioxus/src/ui/mod.rs` | Wire toast events, use `ConnectionDot` in sidebar |
| `rust/starbridge-dioxus/src/ui/models.rs` | Add `ConnectionStatus` enum |

---

## Implementation Steps

### Step 1 -- Dark mode token overrides

Add to `styles.rs` after the `:root` block:

```css
@media (prefers-color-scheme: dark) {
    :root {
        color-scheme: dark;

        --primary:                  #EF6745;
        --primary-container:        #AA3618;
        --on-primary:               #FFFFFF;
        --on-primary-container:     #E8E6E3;
        --secondary:                #9E9D9D;
        --secondary-container:      #3A3A3C;
        --tertiary:                 #7A9B82;
        --tertiary-container:       #2A3D2E;
        --surface:                  #252528;
        --surface-container-lowest: #1A1A1F;
        --surface-container-low:    #2A2A2E;
        --surface-container:        #303034;
        --surface-container-high:   #3A3A3E;
        --surface-dim:              #1A1A1F;
        --on-surface:               #E8E6E3;
        --on-surface-variant:       #B8A8A3;
        --outline-variant:          #4A3E3B;
        --background-sage:          #1A1A1F;

        --shadow:       0 4px 12px rgba(0, 0, 0, 0.3);
        --ghost-border: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    }

    body {
        background: var(--background-sage);
        background-image: radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    }
}

/* Manual dark mode toggle class */
.theme-dark {
    color-scheme: dark;

    --primary:                  #EF6745;
    --primary-container:        #AA3618;
    --on-primary:               #FFFFFF;
    --on-primary-container:     #E8E6E3;
    --secondary:                #9E9D9D;
    --secondary-container:      #3A3A3C;
    --tertiary:                 #7A9B82;
    --tertiary-container:       #2A3D2E;
    --surface:                  #252528;
    --surface-container-lowest: #1A1A1F;
    --surface-container-low:    #2A2A2E;
    --surface-container:        #303034;
    --surface-container-high:   #3A3A3E;
    --surface-dim:              #1A1A1F;
    --on-surface:               #E8E6E3;
    --on-surface-variant:       #B8A8A3;
    --outline-variant:          #4A3E3B;
    --background-sage:          #1A1A1F;

    --shadow:       0 4px 12px rgba(0, 0, 0, 0.3);
    --ghost-border: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}
```

**Commit:** `style(desktop): dark mode token overrides with prefers-color-scheme and .theme-dark`

### Step 2 -- New keyframes

Add after the existing `@keyframes fade-in` block:

```css
@keyframes slide-in {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
}

@keyframes stage-progress {
    0%, 100% { box-shadow: 0 0 0 0 rgba(170, 54, 24, 0.4); }
    50%      { box-shadow: 0 0 0 6px rgba(170, 54, 24, 0); }
}

@keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
}
```

Update existing toast styles to use `slide-in`:

```css
.toast {
    animation: slide-in 200ms ease;
}
```

Update pipeline active node to use `stage-progress`:

```css
.pipeline-node-active {
    animation: stage-progress 1.5s ease infinite;
}
```

**Commit:** `style(desktop): add slide-in, stage-progress, shimmer, spin keyframes`

### Step 3 -- Loading skeletons and spinner

Add skeleton and spinner CSS:

```css
/* Loading skeleton */
.skeleton {
    background: linear-gradient(
        90deg,
        var(--surface-container-low) 25%,
        var(--surface-container) 50%,
        var(--surface-container-low) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 0;
}
.skeleton-text { height: 13px; margin-bottom: 8px; }
.skeleton-text-sm { height: 10px; margin-bottom: 6px; width: 60%; }
.skeleton-card { height: 64px; margin-bottom: 8px; }
.skeleton-metric { height: 48px; width: 120px; }
.skeleton-row { height: 36px; margin-bottom: 4px; }

/* Spinner */
.spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--outline-variant);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
}
.spinner-lg { width: 32px; height: 32px; border-width: 3px; }
```

Add `Skeleton` component to `shared.rs`:

```rust
#[component]
pub fn Skeleton(variant: String, count: Option<usize>) -> Element {
    let n = count.unwrap_or(1);
    rsx! {
        for _ in 0..n {
            div { class: "skeleton skeleton-{variant}" }
        }
    }
}
```

**Commit:** `style(desktop): loading skeletons with shimmer animation and spinner`

### Step 4 -- Empty states per view

Add empty state CSS and component:

```css
.empty-state {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 48px 24px; text-align: center;
    color: var(--on-surface-variant);
}
.empty-state-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.5; }
.empty-state-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; color: var(--on-surface); }
.empty-state-desc { font-size: 12px; max-width: 320px; line-height: 1.6; }
.empty-state-action { margin-top: 16px; }
```

Add `EmptyState` component to `shared.rs`:

```rust
#[component]
pub fn EmptyState(
    icon: String,
    title: String,
    description: String,
    action_label: Option<String>,
    on_action: Option<EventHandler<()>>,
) -> Element {
    rsx! {
        div { class: "empty-state",
            div { class: "empty-state-icon", "{icon}" }
            div { class: "empty-state-title", "{title}" }
            p { class: "empty-state-desc", "{description}" }
            if let Some(label) = action_label {
                div { class: "empty-state-action",
                    button {
                        class: "primary-button",
                        onclick: move |_| {
                            if let Some(ref handler) = on_action {
                                handler.call(());
                            }
                        },
                        "{label}"
                    }
                }
            }
        }
    }
}
```

Empty state messages per view:

| View | Icon | Title | Description |
|------|------|-------|-------------|
| Chat | `◉` | No conversations yet | Start a conversation with Cadet AI |
| Runs | `▶` | No runs recorded | Dispatch an agent to see run details |
| Agents | `⊞` | No custom agents | Create an agent with the builder form |
| Memory | `🧠` | Memory is empty | Agents will store learnings here as they work |
| Terminal | `⚡` | Terminal ready | Open a shell or quick-launch an agent |
| Skills | `📋` | No skills installed | Browse or create skills to extend agents |
| Logs | `📊` | No events yet | Events will appear as agents execute |

**Commit:** `feat(desktop): empty state component and per-view empty state messages`

### Step 5 -- Responsive layout and sidebar auto-collapse

Add responsive CSS:

```css
/* Responsive: collapse sidebar at narrow viewports */
@media (max-width: 900px) {
    .sidebar.sidebar-expanded {
        width: 48px;
    }
    .sidebar.sidebar-expanded .sidebar-title,
    .sidebar.sidebar-expanded .sidebar-section,
    .sidebar.sidebar-expanded .sidebar-nav-label,
    .sidebar.sidebar-expanded .sidebar-footnote {
        display: none;
    }
    .sidebar.sidebar-expanded .sidebar-nav-button {
        justify-content: center;
        padding: 8px;
    }
}

/* Fluid page shell */
.page-shell {
    min-width: 0;
    overflow: hidden;
}

/* Page grids collapse to single column on narrow viewports */
@media (max-width: 768px) {
    .page-grid-agents,
    .page-grid-runs {
        grid-template-columns: 1fr;
    }
}
```

**Commit:** `style(desktop): responsive layout with sidebar auto-collapse at 900px`

### Step 6 -- Toast notification wiring and connection status

Add `ConnectionStatus` to `models.rs`:

```rust
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connected,
    Reconnecting,
    Disconnected,
}
```

Add `ConnectionDot` component to `shared.rs`:

```rust
#[component]
pub fn ConnectionDot(status: ConnectionStatus) -> Element {
    let (class, title) = match status {
        ConnectionStatus::Connected => ("connection-dot connection-dot-ok", "Connected to SpacetimeDB"),
        ConnectionStatus::Reconnecting => ("connection-dot connection-dot-warn", "Reconnecting..."),
        ConnectionStatus::Disconnected => ("connection-dot connection-dot-err", "Disconnected"),
    };
    rsx! {
        div { class: "{class}", title: "{title}" }
    }
}
```

Add connection dot CSS:

```css
.connection-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.connection-dot-ok { background: #4CAF50; }
.connection-dot-warn { background: #FF9800; animation: pulse 1.5s ease infinite; }
.connection-dot-err { background: #F44336; }
```

Wire toast notifications in `mod.rs` by subscribing to signal changes on `approval_requests`, `workflow_runs`. When a new approval appears, show a toast. When a run completes or fails, show a toast. Use the existing toast overlay component:

```rust
// In MissionControlApp, after signal setup:
use_effect(move || {
    let runs = live_state.workflow_runs();
    for run in &runs {
        if run.status == "completed" && !notified_runs.read().contains(&run.run_id) {
            show_toast(ToastKind::Success, format!("Run {} completed", run.run_id));
            notified_runs.write().insert(run.run_id.clone());
        }
        if run.status == "failed" && !notified_runs.read().contains(&run.run_id) {
            show_toast(ToastKind::Error, format!("Run {} failed", run.run_id));
            notified_runs.write().insert(run.run_id.clone());
        }
    }
});
```

**Commit:** `feat(desktop): connection status indicators and toast notification wiring`

---

## Regression Tests

- [ ] Light mode renders with original token values (no visual regression).
- [ ] Dark mode activates with `prefers-color-scheme: dark` or `.theme-dark` class.
- [ ] Dark mode text is readable against dark surfaces (contrast ratio >= 4.5:1 for body text).
- [ ] `slide-in` animation plays on toast appearance.
- [ ] `stage-progress` animation plays on active pipeline node.
- [ ] `shimmer` animation plays on skeleton elements.
- [ ] `spin` animation plays on spinner elements.
- [ ] Sidebar auto-collapses to 48px at viewport width < 900px.
- [ ] Sidebar icons remain visible when collapsed.
- [ ] Page grids collapse to single column at viewport width < 768px.
- [ ] Skeleton components render correct number of elements.
- [ ] Empty states render with correct icon, title, and description per view.
- [ ] Empty state action button triggers callback when clicked.
- [ ] Connection dot shows green for Connected, yellow+pulse for Reconnecting, red for Disconnected.
- [ ] Toast appears when a run completes or fails.
- [ ] Toast appears when an approval request is created.
- [ ] Existing dot grid background adapts to dark mode.

---

## Definition of Done

- Dark mode fully functional via both `prefers-color-scheme` and manual `.theme-dark` toggle.
- All four new keyframes (`slide-in`, `stage-progress`, `shimmer`, `spin`) defined and used.
- Loading skeletons available as a reusable component in all data views.
- Every view has an empty state for zero-data scenarios.
- Sidebar collapses responsively at 900px; page grids at 768px.
- Connection status indicator reflects live SpacetimeDB connection state.
- Toast notifications fire for run completion, run failure, and approval requests.

---

## PR Template

```
## Summary
- Add dark mode CSS with full token overrides (prefers-color-scheme + .theme-dark)
- Add slide-in, stage-progress, shimmer, spin keyframes
- Add loading skeleton and spinner components
- Add empty state component with per-view messages
- Add responsive layout (sidebar collapse at 900px, grid collapse at 768px)
- Wire toast notifications for run events and approval requests
- Add three-state connection status indicator

## Test plan
- [ ] Toggle system appearance to dark mode, verify all surfaces update
- [ ] Apply .theme-dark class manually, verify same result
- [ ] Resize viewport below 900px, verify sidebar collapses
- [ ] Verify skeleton shimmer animation on loading states
- [ ] Verify empty states appear when views have no data
- [ ] Trigger a run completion, verify toast appears
- [ ] Disconnect SpacetimeDB, verify connection dot turns red
```
