pub const APP_STYLES: &str = r#"
    /* ================================================================
       ORBITAL DATA SYSTEM -- Complete Design Language
       Aerospace-grade operator dashboard
       Reference: Claude Code / Factory.ai aesthetic
       ================================================================ */

    /* ── 1. TOKENS ──────────────────────────────────────────────────── */

    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

    :root {
        color-scheme: light;

        /* Orbital palette */
        --primary:                  #AA3618;
        --primary-container:        #EF6745;
        --on-primary:               #FFFFFF;
        --on-primary-container:     #1C1B1B;
        --secondary:                #5F5E5E;
        --secondary-container:      #E4E2E1;
        --tertiary:                 #526258;
        --tertiary-container:       #D4E8D9;
        --surface:                  #F7F5F4;
        --surface-container-lowest: #FFFFFF;
        --surface-container-low:    #F0EDED;
        --surface-container:        #EAE7E6;
        --surface-container-high:   #E4E1E0;
        --surface-dim:              #DCD9D9;
        --on-surface:               #1C1B1B;
        --on-surface-variant:       #58413C;
        --outline-variant:          #E0BFB8;
        --background-sage:          #c8d1c0;

        /* Typography stacks */
        --sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        --mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", ui-monospace, monospace;

        /* Effects -- subtle, close shadows; ghost borders, no radius */
        --shadow:       0 4px 12px rgba(28, 27, 27, 0.06);
        --ghost-border: inset 0 0 0 1px rgba(224, 191, 184, 0.20);

        /* Grid */
        --grid-size: 24px;
    }

    /* ── 2. RESET ───────────────────────────────────────────────────── */

    *, *::before, *::after { box-sizing: border-box; }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
    }

    @keyframes fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    html, body, #main {
        margin: 0;
        height: 100%;
        min-height: 100%;
        color: var(--on-surface);
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    body {
        background: var(--background-sage);
        background-image: radial-gradient(circle, rgba(28, 27, 27, 0.06) 1px, transparent 1px);
        background-size: var(--grid-size) var(--grid-size);
        overflow: hidden;
    }

    #main { background: transparent; }

    button, textarea, input { font: inherit; }

    /* Scrollbar -- thin, unobtrusive */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
        background: rgba(28, 27, 27, 0.12);
        border-radius: 0;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(28, 27, 27, 0.22); }

    /* ================================================================
       3. SHELL LAYOUT
       app-shell grid, sidebar, topbar, page-shell, page-content
       ================================================================ */

    .app-shell {
        display: grid;
        grid-template-columns: 200px minmax(0, 1fr);
        height: 100vh;
        max-height: 100vh;
        min-height: 0;
        overflow: hidden;
        transition: grid-template-columns 200ms ease;
    }

    .app-shell.app-shell-collapsed {
        grid-template-columns: 48px minmax(0, 1fr);
    }

    /* ── Sidebar ────────────────────────────────────────────────────── */

    .sidebar {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 0;
        width: 48px;
        min-width: 48px;
        background: var(--on-surface);
        overflow: hidden;
        transition: width 200ms ease, min-width 200ms ease, padding 200ms ease;
        position: relative;
        z-index: 20;
    }

    .sidebar.sidebar-expanded {
        width: 200px;
        min-width: 200px;
        padding: 8px 8px;
    }

    /* Brand */
    .sidebar-brand {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 4px 4px 12px;
        margin-bottom: 4px;
        overflow: hidden;
        white-space: nowrap;
    }

    .sidebar.sidebar-expanded .sidebar-brand {
        justify-content: flex-start;
        padding: 4px 8px 12px;
    }

    .brand-mark {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 0;
        border: none;
        background: var(--primary);
        color: var(--on-primary);
        font-weight: 700;
        font-size: 15px;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: background 150ms ease;
    }

    .brand-mark:hover {
        background: var(--primary-container);
    }

    .sidebar-title {
        margin: 0;
        color: var(--surface-container-lowest);
        font-family: var(--sans);
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.01em;
        opacity: 0;
        overflow: hidden;
        transition: opacity 150ms ease;
    }

    .sidebar.sidebar-expanded .sidebar-title { opacity: 1; }

    /* Section label (e.g. "Workspace") */
    .sidebar-section {
        margin: 8px 8px 2px;
        color: rgba(255, 255, 255, 0.30);
        font-family: var(--mono);
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        opacity: 0;
        white-space: nowrap;
        overflow: hidden;
        transition: opacity 150ms ease;
    }

    .sidebar.sidebar-expanded .sidebar-section { opacity: 1; }

    /* Nav */
    .sidebar-nav {
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    /* Stacks */
    .list-stack,
    .panel-stack,
    .surface-node-stack {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .inspector-stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    /* ── Nav button + List item (shared base) ───────────────────────── */

    .nav-button,
    .list-item {
        width: 100%;
        border: none;
        border-radius: 0;
        background: transparent;
        color: var(--tertiary-container);
        text-align: left;
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
        display: flex;
        align-items: center;
        gap: 10px;
        white-space: nowrap;
        overflow: hidden;
    }

    .nav-button {
        height: 40px;
        padding: 0 8px;
        justify-content: flex-start;
    }

    .sidebar:not(.sidebar-expanded) .nav-button {
        justify-content: center;
        padding: 0;
        width: 48px;
    }

    .nav-button:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.90);
    }

    .nav-button-active {
        background: rgba(170, 54, 24, 0.12);
        color: #EF6745;
        box-shadow: inset 3px 0 0 var(--primary);
    }

    .nav-button-active:hover {
        background: rgba(170, 54, 24, 0.18);
        color: #EF6745;
    }

    .list-item {
        padding: 14px 16px;
        color: var(--on-surface);
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
    }

    .list-item:hover {
        background: var(--surface-container-low);
    }

    .list-item-active {
        background: rgba(170, 54, 24, 0.06);
        color: var(--on-surface);
        box-shadow: inset 3px 0 0 var(--primary);
    }

    /* Nav icon */
    .nav-icon {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-size: 14px;
        line-height: 1;
    }

    /* Active nav icon color */
    .nav-button-active .nav-icon {
        color: #EF6745;
    }

    /* Nav label */
    .nav-label {
        opacity: 0;
        transition: opacity 150ms ease;
        font-size: 12px;
        font-weight: 500;
        color: var(--tertiary-container);
        font-family: var(--sans);
    }

    .sidebar.sidebar-expanded .nav-label { opacity: 1; }

    .nav-button:hover .nav-label { color: #E8F5EC; }
    .nav-button-active .nav-label { color: #EF6745; }

    /* Nav count badge */
    .nav-count {
        min-width: 22px;
        padding: 1px 5px;
        border-radius: 0;
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.35);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 150ms ease;
    }

    .sidebar.sidebar-expanded .nav-count { opacity: 1; }

    .nav-button-active .nav-count {
        background: rgba(239, 103, 69, 0.15);
        color: #EF6745;
    }

    /* Row utilities */
    .nav-row,
    .list-item-head,
    .metric-tile-top,
    .row-top,
    .surface-node-head,
    .message-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 6px;
    }

    /* Sidebar metrics */
    .sidebar-metrics {
        display: grid;
        gap: 6px;
    }

    .sidebar-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    /* Sidebar footer */
    .sidebar-footer {
        margin-top: auto;
        padding: 10px 0 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: center;
        overflow: hidden;
    }

    .sidebar.sidebar-expanded .sidebar-footer {
        padding: 10px 8px 8px;
        align-items: flex-start;
    }

    .sidebar-footnote {
        margin: 0;
        color: rgba(255, 255, 255, 0.35);
        font-family: var(--mono);
        font-size: 9px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 150ms ease;
    }

    .sidebar.sidebar-expanded .sidebar-footnote { opacity: 1; }

    /* ── Page shell (topbar + content area) ─────────────────────────── */

    .page-shell {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        height: 100vh;
        overflow: hidden;
    }

    /* ── Topbar ─────────────────────────────────────────────────────── */

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 20px;
        height: 44px;
        min-height: 44px;
        flex-shrink: 0;
        background: var(--surface-container-low);
        z-index: 10;
        /* No bottom border -- separation via color shift to sage content area */
    }

    .topbar-copy {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
    }

    .topbar-eyebrow {
        margin: 0;
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.10em;
        text-transform: uppercase;
    }

    .sidebar-eyebrow,
    .section-eyebrow {
        margin: 0 0 4px;
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.10em;
        text-transform: uppercase;
    }

    .topbar-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--on-surface);
        font-family: var(--sans);
    }

    .topbar-subtitle {
        margin: 0;
        color: var(--on-surface-variant);
        font-size: 11px;
        display: none; /* hidden in compact topbar; shown via expanded variant if needed */
    }

    .topbar-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        flex-shrink: 0;
    }

    .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    /* Live indicator dot */
    .live-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--tertiary);
        animation: pulse 2s ease-in-out infinite;
        flex-shrink: 0;
    }

    /* ── Page content (scrollable area with sage dot grid showing through) */

    .page-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 16px;
        background: transparent;
    }

    .page-grid {
        display: grid;
        gap: 12px;
        align-items: start;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        animation: fade-in 200ms ease;
    }

    /* ================================================================
       4. PANEL PRIMITIVES
       card, panel, inspector, detail hero, document viewer
       ================================================================ */

    .metric-tile,
    .inspector-card,
    .panel,
    .row-card,
    .surface-node,
    .message-bubble,
    .composer,
    .thread-header,
    .detail-hero,
    .document-viewer {
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
    }

    .metric-tile,
    .inspector-card,
    .row-card,
    .surface-node,
    .document-viewer {
        padding: 16px;
    }

    .metric-tile-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .panel {
        min-width: 0;
        min-height: 0;
        padding: 0;
        overflow: hidden;
    }

    .panel-head,
    .panel-body,
    .detail-body,
    .chat-body,
    .editor-body,
    .preview-body,
    .document-body {
        padding: 14px 16px;
        min-height: 0;
    }

    .panel-head {
        padding: 14px 16px 12px;
        margin-bottom: 0;
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
    }

    .detail-hero,
    .thread-header {
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
    }

    .panel-title-row,
    .detail-meta,
    .thread-meta,
    .composer-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
    }

    .detail-hero {
        padding: 14px 16px 12px;
    }

    .detail-summary {
        margin: 6px 0 0;
        color: var(--on-surface-variant);
        max-width: 70ch;
        font-size: 13px;
        line-height: 1.6;
    }

    .detail-body,
    .chat-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    /* ================================================================
       5. TYPOGRAPHY
       eyebrow, titles, copy, mono, meta
       ================================================================ */

    /* Eyebrow -- mono, uppercase, muted */
    .card-eyebrow,
    .panel-eyebrow,
    .metric-eyebrow {
        margin: 0 0 4px;
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: var(--on-surface-variant);
    }

    /* Titles -- Space Grotesk 14px weight 600 */
    .card-title,
    .panel-title,
    .inspector-title {
        margin: 0 0 2px;
        font-size: 14px;
        font-weight: 600;
        color: var(--on-surface);
        font-family: var(--sans);
    }

    .nav-label,
    .list-item-title,
    .card-title,
    .topbar-title,
    .empty-state h3 {
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .list-item-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
    }

    /* Copy -- body text */
    .sidebar-copy,
    .nav-detail,
    .metric-detail,
    .list-item-copy,
    .row-copy,
    .empty-state p,
    .callout p,
    .composer-help,
    .message-meta {
        margin: 0;
        color: var(--on-surface-variant);
        font-size: 12px;
        line-height: 1.6;
    }

    .list-item-copy {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Meta text */
    .list-item-meta,
    .thread-sub,
    .message-channel,
    .row-copy,
    .message-meta {
        color: var(--on-surface-variant);
        font-size: 11px;
        font-family: var(--mono);
    }

    /* Metric values -- mono data display */
    .metric-value,
    .surface-node-value {
        font-size: 20px;
        line-height: 1;
        letter-spacing: -0.03em;
        color: var(--on-surface);
        font-family: var(--mono);
    }

    /* Large hero metric */
    .metric-value-hero {
        font-size: 48px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.03em;
        font-family: var(--sans);
        color: var(--on-surface);
    }

    .metric-value-primary { color: var(--primary); }
    .metric-value-accent  { color: var(--primary); }

    /* Lists */
    .simple-list,
    .key-value-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .key-value-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        color: var(--on-surface-variant);
        font-size: 11px;
        font-family: var(--mono);
        padding: 8px 0;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
    }

    .key-value-list strong {
        color: var(--on-surface);
        font-weight: 600;
    }

    /* ================================================================
       6. INTERACTIVE
       buttons, segmented, pills, inputs, textarea
       ================================================================ */

    /* Segmented control */
    .segmented {
        display: inline-flex;
        padding: 0;
        border-radius: 0;
        border: none;
        background: var(--surface-container-high);
        gap: 0;
    }

    .segmented-button,
    .secondary-button,
    .primary-button {
        border-radius: 0;
        border: none;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
    }

    .segmented-button {
        background: transparent;
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .segmented-button-active {
        background: var(--primary);
        color: var(--on-primary);
    }

    .primary-button {
        background: var(--primary);
        color: var(--on-primary);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 7px 14px;
    }

    .primary-button:hover {
        background: var(--primary-container);
        box-shadow: var(--shadow);
    }

    .secondary-button {
        background: var(--surface-container-high);
        color: var(--on-surface);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 7px 14px;
    }

    .secondary-button:hover {
        background: var(--surface-container);
    }

    .secondary-button:disabled,
    .primary-button:disabled {
        opacity: 0.40;
        cursor: not-allowed;
    }

    /* ── Pills / status badges -- JetBrains Mono 10px uppercase, 0px radius */

    .pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 0;
        border: none;
        background: var(--surface-container-high);
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .pill-live {
        background: var(--tertiary-container);
        color: var(--tertiary);
    }

    .pill-live::before {
        content: "";
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--tertiary);
        animation: pulse 2s ease-in-out infinite;
    }

    .pill-accent {
        background: rgba(170, 54, 24, 0.10);
        color: var(--primary);
    }

    .pill-success {
        background: #D4E8D9;
        color: #526258;
    }

    .pill-warn {
        background: #E4E2E1;
        color: #5F5E5E;
    }

    .pill-danger {
        background: rgba(170, 54, 24, 0.10);
        color: var(--primary);
    }

    .pill-subtle {
        background: #E4E2E1;
        color: #5F5E5E;
    }

    /* ── Textarea ────────────────────────────────────────────────────── */

    textarea {
        width: 100%;
        min-height: 80px;
        resize: vertical;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: var(--surface-container-lowest);
        color: var(--on-surface);
        padding: 12px 14px;
        outline: none;
        font-size: 13px;
        font-family: var(--sans);
        line-height: 1.5;
        transition: border-color 150ms ease;
        box-shadow: var(--ghost-border);
    }

    textarea:focus {
        border-bottom-color: var(--primary);
    }

    textarea::placeholder {
        color: var(--on-surface-variant);
        opacity: 0.5;
    }

    /* ================================================================
       7. STATUS INDICATORS
       connection dot, status badges, callouts, empty state
       ================================================================ */

    .connection-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 6px rgba(74, 222, 128, 0.4);
        flex-shrink: 0;
    }

    .connection-dot.disconnected {
        background: var(--primary);
        box-shadow: 0 0 6px rgba(170, 54, 24, 0.4);
    }

    /* Status badge color helpers */
    .status-running   { background: #D4E8D9; color: #526258; }
    .status-completed { background: #D4E8D9; color: #526258; }
    .status-queued    { background: #E4E2E1; color: #5F5E5E; }
    .status-pending   { background: #E4E2E1; color: #5F5E5E; }
    .status-failed    { background: rgba(170, 54, 24, 0.10); color: #AA3618; }
    .status-blocked   { background: rgba(170, 54, 24, 0.10); color: #AA3618; }
    .status-draft     { background: #E4E2E1; color: var(--on-surface-variant); }

    /* Callouts */
    .callout {
        padding: 12px 14px;
        border-radius: 0;
        border: none;
        box-shadow: var(--ghost-border);
        font-size: 12px;
    }

    .callout strong {
        display: block;
        margin-bottom: 4px;
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .callout p {
        margin: 0;
        color: var(--on-surface-variant);
    }

    .callout-info  { background: rgba(170, 54, 24, 0.06); }
    .callout-info strong { color: var(--primary); }

    .callout-tip   { background: var(--tertiary-container); }
    .callout-tip strong { color: var(--tertiary); }

    .callout-warn  { background: var(--secondary-container); }
    .callout-warn strong { color: var(--secondary); }

    .callout-danger { background: var(--primary); }
    .callout-danger strong { color: var(--on-primary); }
    .callout-danger p { color: var(--on-primary); }

    /* Empty state */
    .empty-state {
        padding: 24px 16px;
        border: 1px dashed rgba(224, 191, 184, 0.30);
        border-radius: 0;
        text-align: center;
    }

    .empty-state h3 {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--on-surface);
        font-family: var(--sans);
    }

    .empty-state p {
        font-size: 12px;
        line-height: 1.6;
        color: var(--on-surface-variant);
    }

    /* ================================================================
       8. VIEW-SPECIFIC GRIDS
       Overview, Chat, Workflow, Surfaces, Memory, Catalog
       ================================================================ */

    .page-grid-overview  { grid-template-columns: 300px minmax(0, 1fr) 280px; }
    .page-grid-chat      { grid-template-columns: 260px minmax(0, 1fr) 280px; }
    .page-grid-workflow  { grid-template-columns: minmax(0, 1fr) 280px; }
    .page-grid-surfaces  { grid-template-columns: 440px minmax(0, 1fr) 280px; }
    .page-grid-memory    { grid-template-columns: 260px minmax(0, 1fr) 300px; }
    .page-grid-catalog   { grid-template-columns: 360px minmax(0, 1fr); }

    .page-grid-surfaces.preview-only {
        grid-template-columns: minmax(0, 1fr) 280px;
    }

    .surfaces-toolbar {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        padding: 8px 12px 0;
    }

    /* ================================================================
       9. CHAT VIEW
       Message stream, bubbles, composer
       ================================================================ */

    .message-stream {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        max-height: 100%;
        overflow-y: auto;
    }

    .message-bubble {
        max-width: 78%;
        padding: 14px 16px;
        border-radius: 0;
        margin-bottom: 4px;
    }

    /* Inbound: left-aligned, surface-container-low */
    .message-bubble-inbound {
        align-self: flex-start;
        background: var(--surface-container-low);
        box-shadow: var(--ghost-border);
    }

    /* Outbound: right-aligned, coral tint */
    .message-bubble-outbound {
        align-self: flex-end;
        background: rgba(170, 54, 24, 0.06);
        box-shadow: var(--ghost-border);
    }

    .message-body {
        margin: 6px 0 0;
        white-space: pre-wrap;
        font-size: 13px;
        line-height: 1.6;
        color: var(--on-surface);
    }

    /* ── Composer (Claude Code style) ───────────────────────────────── */

    .composer {
        display: flex;
        flex-direction: column;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border);
        border-radius: 0;
        overflow: hidden;
    }

    .composer-input {
        width: 100%;
        padding: 14px 16px;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: transparent;
        color: var(--on-surface);
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
        min-height: 48px;
        outline: none;
        transition: border-color 150ms ease;
    }

    .composer-input:focus {
        border-bottom-color: var(--primary);
    }

    .composer-input::placeholder {
        color: var(--on-surface-variant);
        opacity: 0.5;
    }

    .composer-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        gap: 6px;
    }

    .composer-chips {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .composer-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border: 1px solid rgba(224, 191, 184, 0.25);
        border-radius: 0;
        background: transparent;
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
    }

    .composer-chip:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
        border-color: var(--on-surface-variant);
    }

    .composer-chip-active {
        background: var(--surface-container-high);
        color: var(--on-surface);
        border-color: var(--on-surface-variant);
    }

    .composer-chip-help {
        padding: 3px 8px;
    }

    /* ================================================================
       10. WORKFLOW BOARD (Kanban)
       Surface-container lanes with white cards
       ================================================================ */

    .workflow-board {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(220px, 1fr);
        gap: 10px;
        overflow: auto;
        padding-bottom: 4px;
    }

    .workflow-lane {
        min-height: 400px;
        padding: 12px;
        border-radius: 0;
        background: var(--surface-container);
    }

    .workflow-lane-active {
        background: var(--surface-container-low);
        box-shadow: var(--ghost-border);
    }

    .lane-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 10px;
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--on-surface-variant);
    }

    .lane-copy {
        margin: 0 0 8px;
        color: var(--on-surface-variant);
        font-size: 11px;
    }

    .workflow-card {
        padding: 12px;
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border);
        cursor: grab;
        font-size: 12px;
        transition: background 150ms ease, box-shadow 150ms ease;
    }

    .workflow-card + .workflow-card {
        margin-top: 6px;
    }

    .workflow-card:hover {
        box-shadow: var(--ghost-border), var(--shadow);
    }

    .workflow-card:active {
        cursor: grabbing;
        background: var(--surface-container-low);
    }

    /* ================================================================
       11. CODE / EDITOR
       ================================================================ */

    .editor-body,
    .preview-body,
    .document-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .code-block,
    .document-content {
        margin: 0;
        padding: 12px 14px;
        border-radius: 0;
        border: none;
        box-shadow: var(--ghost-border);
        background: var(--on-surface);
        color: var(--surface-container-lowest);
        white-space: pre-wrap;
        overflow: auto;
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.7;
    }

    /* ================================================================
       12. SURFACES / PREVIEW
       ================================================================ */

    .surface-preview {
        min-height: 540px;
        border-radius: 0;
        background: var(--surface-container);
        box-shadow: var(--ghost-border);
        padding: 12px;
    }

    .surface-node + .surface-node,
    .callout + .surface-node,
    .surface-node + .callout {
        margin-top: 8px;
    }

    .surface-node-metric {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    /* ================================================================
       13. MEMORY VIEW
       3D field canvas, stages, dimension strips
       ================================================================ */

    .memory-stage-panel { min-height: 0; }
    .memory-stage-head  { align-items: start; }

    .memory-stage-body,
    .memory-detail-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    /* Memory field -- dark canvas, aerospace */
    .memory-field-shell {
        min-height: 420px;
        background: var(--on-surface);
        background-image: radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
        background-size: 24px 24px;
        border-radius: 0;
        padding: 12px;
    }

    .memory-field {
        position: relative;
        min-height: 380px;
        background: var(--on-surface);
        overflow: hidden;
        border-radius: 0;
    }

    .memory-field-grid,
    .memory-field-axis {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .memory-field-grid {
        background:
            linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
        background-size: 48px 48px;
    }

    .memory-field-axis.axis-x::before,
    .memory-field-axis.axis-y::before {
        content: "";
        position: absolute;
        background: rgba(255, 255, 255, 0.1);
    }

    .memory-field-axis.axis-x::before {
        left: 8%; right: 8%; top: 50%; height: 1px;
    }

    .memory-field-axis.axis-y::before {
        top: 10%; bottom: 10%; left: 50%; width: 1px;
    }

    .memory-point,
    .memory-query-marker {
        position: absolute;
        border: 0;
        background: transparent;
        padding: 0;
    }

    .memory-point {
        width: 0;
        height: 0;
        cursor: pointer;
    }

    /* Memory point -- coral #EF6745 */
    .memory-point-core {
        display: block;
        width: 14px;
        height: 14px;
        background: #EF6745;
        opacity: 0.7;
        border-radius: 0;
        transition: opacity 150ms ease, box-shadow 150ms ease;
    }

    .memory-point:hover .memory-point-core {
        opacity: 1;
        box-shadow: 0 0 8px rgba(239, 103, 69, 0.5);
    }

    .memory-point-active .memory-point-core {
        background: #EF6745;
        opacity: 1;
        box-shadow: 0 0 0 3px rgba(239, 103, 69, 0.3);
    }

    .memory-point-label {
        position: absolute;
        top: 18px;
        left: -6px;
        padding: 2px 6px;
        border-radius: 0;
        background: rgba(28, 27, 27, 0.95);
        color: var(--surface-container-lowest);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.05em;
        white-space: nowrap;
    }

    /* Memory query marker -- primary #AA3618 */
    .memory-query-marker {
        width: 22px;
        height: 22px;
        border: 1px solid var(--primary);
        background: rgba(170, 54, 24, 0.15);
        border-radius: 0;
    }

    .memory-query-marker::before,
    .memory-query-marker::after {
        content: "";
        position: absolute;
        background: var(--primary);
    }

    .memory-query-marker::before {
        left: 50%; top: 2px; bottom: 2px; width: 1px;
        transform: translateX(-50%);
    }

    .memory-query-marker::after {
        top: 50%; left: 2px; right: 2px; height: 1px;
        transform: translateY(-50%);
    }

    .memory-stage-stat-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
    }

    .memory-detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .memory-stat-card,
    .memory-detail-card {
        padding: 12px 14px;
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
    }

    .memory-stat-value {
        display: block;
        margin-top: 4px;
        font-size: 20px;
        line-height: 1;
        letter-spacing: -0.04em;
        color: var(--on-surface);
        font-family: var(--mono);
    }

    .dimension-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14px, 1fr));
        gap: 4px;
        align-items: end;
        min-height: 140px;
        padding: 10px 0 4px;
    }

    .dimension-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 0;
    }

    .dimension-bar {
        width: 100%;
        min-height: 2px;
        background: linear-gradient(90deg, var(--primary), var(--primary-container));
        border-radius: 0;
    }

    .dimension-index {
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        writing-mode: vertical-rl;
        text-orientation: mixed;
    }

    .memory-json {
        margin: 0;
        padding: 12px 14px;
        border: none;
        border-radius: 0;
        box-shadow: var(--ghost-border);
        background: var(--on-surface);
        color: var(--surface-container-lowest);
        font-family: var(--mono);
        font-size: 10px;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow: auto;
    }

    /* ================================================================
       14. COMMAND PALETTE (Cmd+K overlay)
       ================================================================ */

    .command-palette {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 18vh;
        background: rgba(28, 27, 27, 0.50);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    }

    .command-palette-panel {
        width: 560px;
        max-width: calc(100vw - 32px);
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: 0 24px 48px rgba(28, 27, 27, 0.25);
        overflow: hidden;
        animation: fade-in 150ms ease;
    }

    .command-palette-input {
        width: 100%;
        padding: 16px 18px;
        border: none;
        border-bottom: 2px solid transparent;
        background: transparent;
        color: var(--on-surface);
        font-family: var(--mono);
        font-size: 14px;
        outline: none;
        border-radius: 0;
        transition: border-color 150ms ease;
    }

    .command-palette-input:focus {
        border-bottom-color: var(--primary);
    }

    .command-palette-input::placeholder {
        color: var(--on-surface-variant);
        opacity: 0.5;
    }

    .command-palette-list {
        max-height: 360px;
        overflow-y: auto;
        padding: 6px;
        list-style: none;
        margin: 0;
    }

    .command-palette-list li {
        margin: 0;
        padding: 0;
    }

    .command-palette-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        border-radius: 0;
        color: var(--on-surface);
        font-size: 13px;
        cursor: pointer;
        border: none;
        background: transparent;
        text-align: left;
        font: inherit;
        transition: background 150ms ease, color 150ms ease;
    }

    .command-palette-item:hover {
        background: var(--surface-container-low);
    }

    .command-palette-item-active {
        background: var(--primary);
        color: var(--on-primary);
    }

    .command-palette-item-active:hover {
        background: var(--primary);
        color: var(--on-primary);
    }

    .command-palette-label {
        flex: 1;
    }

    .command-palette-kbd {
        display: inline-flex;
        align-items: center;
        padding: 2px 6px;
        border-radius: 0;
        background: var(--surface-container-high);
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
    }

    .command-palette-item-active .command-palette-kbd {
        background: rgba(255, 255, 255, 0.15);
        color: var(--on-primary);
    }

    .command-palette-empty {
        padding: 28px 16px;
        text-align: center;
        color: var(--on-surface-variant);
        font-size: 12px;
        font-family: var(--mono);
    }

    /* ================================================================
       15. PROGRESS BARS
       ================================================================ */

    .progress-track {
        height: 2px;
        border-radius: 0;
        background: var(--surface-container-high);
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        border-radius: 0;
        background: linear-gradient(90deg, var(--primary), var(--primary-container));
        transition: width 300ms ease;
    }

    /* ================================================================
       16. CATALOG VIEW
       Two-panel agent + tool browser
       ================================================================ */

    .catalog-search {
        width: 100%;
        padding: 12px 14px;
        border: none;
        border-bottom: 2px solid transparent;
        border-radius: 0;
        background: var(--surface-container-high);
        color: var(--on-surface);
        font-family: var(--sans);
        font-size: 13px;
        outline: none;
        display: block;
        transition: border-color 150ms ease;
    }

    .catalog-search:focus {
        border-bottom-color: var(--primary);
    }

    .catalog-filters {
        display: flex;
        gap: 4px;
        padding: 8px 0;
    }

    .catalog-filter-chip {
        padding: 4px 12px;
        border-radius: 0;
        border: none;
        background: var(--surface-container);
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        cursor: pointer;
        transition: background 150ms ease, color 150ms ease;
    }

    .catalog-filter-chip:hover {
        background: var(--surface-container-high);
    }

    .catalog-filter-chip-active {
        background: var(--primary);
        color: var(--on-primary);
    }

    .catalog-item {
        width: 100%;
        padding: 14px 16px;
        cursor: pointer;
        transition: background 150ms ease, box-shadow 150ms ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: transparent;
        border: none;
        text-align: left;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
    }

    .catalog-item:hover {
        background: var(--surface-container-low);
    }

    .catalog-item-active {
        background: rgba(170, 54, 24, 0.06);
        box-shadow: inset 3px 0 0 var(--primary);
    }

    .catalog-item-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
    }

    .catalog-item-type {
        display: inline-block;
        padding: 1px 6px;
        background: var(--on-surface);
        color: var(--surface);
        font-family: var(--mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        border-radius: 0;
    }

    .catalog-item-desc {
        font-size: 12px;
        color: var(--on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin: 0;
    }

    .catalog-detail {
        padding: 20px;
    }

    .catalog-detail-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--on-surface);
        margin: 0 0 4px 0;
        display: inline;
        font-family: var(--sans);
    }

    .catalog-detail-badge {
        display: inline-block;
        padding: 2px 8px;
        background: var(--on-surface);
        color: var(--surface);
        font-family: var(--mono);
        font-size: 10px;
        text-transform: uppercase;
        border-radius: 0;
        margin-left: 8px;
        vertical-align: middle;
    }

    .catalog-detail-desc {
        font-size: 13px;
        line-height: 1.6;
        color: var(--on-surface-variant);
        margin: 12px 0 20px;
    }

    .catalog-detail-section {
        margin-bottom: 16px;
    }

    .catalog-detail-section-title {
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--on-surface);
        margin: 0 0 8px 0;
    }

    .catalog-code-block {
        padding: 14px;
        background: var(--on-surface);
        color: var(--surface-container-lowest);
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.7;
        border-radius: 0;
        overflow-x: auto;
    }

    .catalog-kv-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .catalog-kv-list li {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        font-size: 12px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
    }

    .catalog-kv-list li span:first-child {
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 11px;
    }

    .catalog-kv-list li strong {
        color: var(--on-surface);
    }
"#;
