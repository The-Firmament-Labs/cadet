pub const APP_STYLES: &str = r#"
    /* ================================================================
       1. RESET + TOKENS
       D350 Orbital Operations Theme
       Values sourced from design-tokens.json at repo root
       ================================================================ */

    :root {
        color-scheme: light;

        /* Color tokens */
        --bg-canvas:       #c8d1c0;
        --bg-sidebar:      #2a2a2a;
        --bg-topbar:       rgba(190, 200, 182, 0.96);
        --bg-panel:        #3a3a3a;
        --bg-panel-strong: #2e2e2e;
        --bg-elevated:     rgba(58, 58, 58, 0.96);
        --bg-hover:        rgba(255, 255, 255, 0.05);

        --border:          rgba(0, 0, 0, 0.12);
        --border-strong:   rgba(0, 0, 0, 0.22);
        --border-on-dark:  rgba(255, 255, 255, 0.1);

        --primary:         #e07b5a;
        --primary-soft:    rgba(224, 123, 90, 0.15);

        --accent:          #e07b5a;
        --accent-soft:     rgba(224, 123, 90, 0.12);

        --destructive:     #c94a4a;
        --destructive-soft: rgba(201, 74, 74, 0.12);

        --success:         #5a8a5a;
        --success-soft:    rgba(90, 138, 90, 0.12);

        --warning:         #c98a3a;
        --warning-soft:    rgba(201, 138, 58, 0.12);

        --text:            #1a1a1a;
        --text-strong:     #0d0d0d;
        --text-on-dark:    #e8e4df;
        --muted:           rgba(26, 26, 26, 0.55);
        --muted-subtle:    rgba(26, 26, 26, 0.35);
        --muted-on-dark:   rgba(255, 255, 255, 0.5);

        /* Typography — D350 Orbital */
        --sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        --mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", ui-monospace, monospace;

        /* Effects */
        --shadow:    0 1px 3px rgba(0, 0, 0, 0.08);
        --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);

        /* Grid */
        --grid-dot:  rgba(0, 0, 0, 0.08);
        --grid-size: 24px;
    }

    * {
        box-sizing: border-box;
    }

    /* Live indicator pulse */
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.5; }
    }

    /* Connection dot ring pulse */
    @keyframes connection-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(90, 138, 90, 0.5); }
        60%  { box-shadow: 0 0 0 5px rgba(90, 138, 90, 0); }
        100% { box-shadow: 0 0 0 0 rgba(90, 138, 90, 0); }
    }

    html, body, #main {
        margin: 0;
        height: 100%;
        min-height: 100%;
        color: #1a1a1a;
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        line-height: 1.5;
    }

    body {
        background: #c8d1c0;
        background-image: radial-gradient(circle, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
        background-size: 24px 24px;
        overflow: hidden;
    }

    #main {
        background: transparent;
    }

    button,
    textarea {
        font: inherit;
    }

    /* ================================================================
       2. SHELL LAYOUT
       app-shell, sidebar (collapsed + expanded), topbar, page-shell
       ================================================================ */

    .app-shell {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr);
        height: 100vh;
        max-height: 100vh;
        min-height: 0;
        overflow: hidden;
        transition: grid-template-columns 0.2s ease;
    }

    /* Collapsed sidebar: 48px, icons only */
    .sidebar {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 0;
        width: 48px;
        min-width: 48px;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        background: #2a2a2a;
        overflow: hidden;
        transition: width 0.2s ease, min-width 0.2s ease, padding 0.2s ease;
        position: relative;
        z-index: 20;
    }

    /* Expanded sidebar: 200px, full labels */
    .sidebar.sidebar-expanded {
        width: 200px;
        min-width: 200px;
        padding: 12px 10px;
        gap: 6px;
    }

    .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        white-space: nowrap;
    }

    .sidebar:not(.sidebar-expanded) .sidebar-brand {
        padding: 4px 0 10px;
        justify-content: center;
    }

    .brand-mark {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid rgba(224, 123, 90, 0.5);
        background: linear-gradient(180deg, rgba(224, 123, 90, 0.2) 0%, rgba(224, 123, 90, 0.1) 100%);
        color: #e07b5a;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.04em;
        box-shadow: var(--shadow);
    }

    .sidebar-title {
        margin: 0;
        color: #e8e4df;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.01em;
        opacity: 0;
        overflow: hidden;
        transition: opacity 0.15s ease;
    }

    .sidebar.sidebar-expanded .sidebar-title {
        opacity: 1;
    }

    .sidebar-section {
        margin: 8px 10px 2px;
        color: rgba(255, 255, 255, 0.4);
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0;
        white-space: nowrap;
        overflow: hidden;
        transition: opacity 0.15s ease;
    }

    .sidebar.sidebar-expanded .sidebar-section {
        opacity: 1;
    }

    .sidebar-nav,
    .list-stack,
    .panel-stack,
    .inspector-stack,
    .surface-node-stack {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .nav-button,
    .list-item {
        width: 100%;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 8px 6px;
        background: transparent;
        color: rgba(232, 228, 223, 0.8);
        text-align: left;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
        overflow: hidden;
    }

    .sidebar:not(.sidebar-expanded) .nav-button {
        justify-content: center;
        padding: 8px 0;
    }

    .nav-button:hover,
    .list-item:hover {
        border-color: rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.05);
    }

    .nav-button-active,
    .list-item-active {
        border-color: rgba(224, 123, 90, 0.3);
        background: rgba(224, 123, 90, 0.15);
        color: #e07b5a;
    }

    .nav-label,
    .list-item-title,
    .card-title,
    .topbar-title,
    .empty-state h3 {
        color: var(--text-strong);
        font-weight: 650;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .nav-label {
        opacity: 0;
        transition: opacity 0.15s ease;
        font-size: 12px;
        color: #e8e4df;
    }

    .sidebar.sidebar-expanded .nav-label {
        opacity: 1;
    }

    /* Active nav label gets coral */
    .nav-button-active .nav-label {
        color: #e07b5a;
    }

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

    .nav-count {
        min-width: 22px;
        padding: 1px 5px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.5);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-align: center;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .sidebar.sidebar-expanded .nav-count {
        opacity: 1;
    }

    .sidebar-metrics {
        display: grid;
        gap: 6px;
    }

    .sidebar-footer {
        margin-top: auto;
        padding: 8px 0 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: center;
    }

    .sidebar.sidebar-expanded .sidebar-footer {
        padding: 8px 10px 4px;
        align-items: flex-start;
    }

    .sidebar-footnote {
        margin: 0;
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.15s ease;
    }

    .sidebar.sidebar-expanded .sidebar-footnote {
        opacity: 1;
    }

    .page-shell {
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        height: 100vh;
        overflow: hidden;
    }

    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 16px;
        height: 48px;
        min-height: 48px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        background: rgba(190, 200, 182, 0.96);
        backdrop-filter: blur(8px);
    }

    .topbar-title {
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: -0.01em;
        color: #1a1a1a;
    }

    .topbar-copy {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
    }

    .topbar-meta,
    .chip-row,
    .sidebar-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    .topbar-eyebrow,
    .sidebar-eyebrow,
    .section-eyebrow {
        margin: 0;
        color: var(--accent);
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .topbar-subtitle {
        margin: 0;
        color: rgba(26, 26, 26, 0.55);
        font-size: 11px;
    }

    /* Live indicator pill dot */
    .live-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #e07b5a;
        animation: pulse 2s ease-in-out infinite;
        flex-shrink: 0;
    }

    .page-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 16px 20px 20px;
    }

    .page-grid {
        display: grid;
        gap: 12px;
        align-items: start;
        min-width: 0;
        min-height: 100%;
    }

    /* ================================================================
       3. PANEL PRIMITIVES
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
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        background: linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .metric-tile,
    .inspector-card,
    .row-card,
    .surface-node,
    .document-viewer {
        padding: 12px;
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
        padding: 12px 14px;
        min-height: 0;
    }

    .panel-head,
    .detail-hero,
    .thread-header {
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
        padding: 14px 14px 12px;
    }

    .detail-summary {
        margin: 6px 0 0;
        color: rgba(255, 255, 255, 0.5);
        max-width: 70ch;
        font-size: 12px;
        line-height: 1.55;
    }

    .detail-body,
    .chat-body {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    /* ================================================================
       4. TYPOGRAPHY
       eyebrow, titles, copy, mono, meta
       ================================================================ */

    /* Section eyebrow — mono, uppercase, muted */
    .card-eyebrow,
    .panel-eyebrow,
    .metric-eyebrow {
        margin: 0;
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
    }

    /* Card titles — 13px semi-bold on dark */
    .card-title,
    .panel-title,
    .inspector-title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #e8e4df;
    }

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
        color: rgba(255, 255, 255, 0.65);
        font-size: 12px;
        line-height: 1.55;
    }

    .list-item-meta,
    .thread-sub,
    .message-channel,
    .row-copy,
    .message-meta {
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
    }

    /* Metric values — large mono */
    .metric-value,
    .surface-node-value {
        font-size: 18px;
        line-height: 1;
        letter-spacing: -0.03em;
        color: #e8e4df;
        font-family: var(--mono);
    }

    /* Large hero metric */
    .metric-value-hero {
        font-size: 48px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.03em;
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        color: #e8e4df;
    }

    .metric-value-primary {
        color: #e07b5a;
    }

    .metric-value-accent {
        color: #e07b5a;
    }

    .simple-list,
    .key-value-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .key-value-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
    }

    .key-value-list strong {
        color: #e8e4df;
        font-weight: 600;
    }

    /* ================================================================
       5. INTERACTIVE
       buttons, segmented, pills, inputs, textarea
       ================================================================ */

    /* Segmented control */
    .segmented {
        display: inline-flex;
        padding: 3px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.05);
        gap: 2px;
    }

    .segmented-button,
    .secondary-button,
    .primary-button {
        border-radius: 4px;
        border: 1px solid transparent;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .segmented-button {
        background: transparent;
        color: rgba(255, 255, 255, 0.5);
    }

    .segmented-button-active {
        background: #e07b5a;
        color: #ffffff;
        border-color: transparent;
    }

    .primary-button {
        border-color: rgba(224, 123, 90, 0.4);
        background: rgba(224, 123, 90, 0.15);
        color: var(--text-strong);
    }

    .primary-button:hover {
        background: rgba(224, 123, 90, 0.25);
        box-shadow: var(--shadow);
    }

    .secondary-button {
        border-color: var(--border);
        background: rgba(0, 0, 0, 0.04);
        color: var(--text);
    }

    .secondary-button:hover {
        background: rgba(0, 0, 0, 0.08);
    }

    .secondary-button:disabled,
    .primary-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    /* Pills / badges */
    .pill {
        display: inline-flex;
        align-items: center;
        padding: 2px 7px;
        border-radius: 999px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        color: var(--text);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .pill-live,
    .pill-accent {
        border-color: rgba(224, 123, 90, 0.4);
        background: rgba(224, 123, 90, 0.12);
        color: #e07b5a;
    }

    .pill-success {
        border-color: rgba(90, 138, 90, 0.35);
        background: rgba(90, 138, 90, 0.12);
        color: #5a8a5a;
    }

    .pill-warn {
        border-color: rgba(201, 138, 58, 0.35);
        background: rgba(201, 138, 58, 0.12);
        color: #c98a3a;
    }

    .pill-danger {
        border-color: rgba(201, 74, 74, 0.35);
        background: rgba(201, 74, 74, 0.12);
        color: #c94a4a;
    }

    .pill-subtle {
        background: rgba(255, 255, 255, 0.08);
        border-color: transparent;
        color: rgba(255, 255, 255, 0.3);
    }

    textarea {
        width: 100%;
        min-height: 80px;
        resize: vertical;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        background: rgba(42, 42, 42, 0.9);
        color: #e8e4df;
        padding: 10px 12px;
        outline: none;
        font-size: 12px;
        font-family: var(--sans);
    }

    textarea:focus {
        border-color: rgba(224, 123, 90, 0.45);
        box-shadow: 0 0 0 1px rgba(224, 123, 90, 0.2);
    }

    textarea::placeholder {
        color: rgba(255, 255, 255, 0.3);
    }

    /* ================================================================
       6. STATUS INDICATORS
       connection dot, status badges, callouts, empty state
       ================================================================ */

    /* Connection dot — green = connected, red = disconnected */
    .connection-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #5a8a5a;
        box-shadow: 0 0 0 0 rgba(90, 138, 90, 0.5);
        animation: connection-pulse 2.4s ease-in-out infinite;
        flex-shrink: 0;
    }

    .connection-dot.disconnected {
        background: #c94a4a;
        box-shadow: none;
        animation: none;
    }

    /* Status badge color helpers */
    .status-running   { color: #5a8a5a; }
    .status-queued    { color: #c98a3a; }
    .status-pending   { color: #c98a3a; }
    .status-failed    { color: #c94a4a; }
    .status-blocked   { color: #c94a4a; }
    .status-completed { color: #5a8a5a; }
    .status-draft     { color: rgba(255, 255, 255, 0.3); }

    .callout {
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 11px;
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
        color: rgba(255, 255, 255, 0.65);
    }

    .callout-info {
        border-color: rgba(224, 123, 90, 0.25);
        background: rgba(224, 123, 90, 0.15);
    }

    .callout-info strong { color: #e07b5a; }

    .callout-tip {
        border-color: rgba(90, 138, 90, 0.25);
        background: rgba(90, 138, 90, 0.12);
    }

    .callout-tip strong { color: #5a8a5a; }

    .callout-warn {
        border-color: rgba(201, 138, 58, 0.28);
        background: rgba(201, 138, 58, 0.12);
    }

    .callout-warn strong { color: #c98a3a; }

    .callout-danger {
        border-color: rgba(201, 74, 74, 0.28);
        background: rgba(201, 74, 74, 0.12);
    }

    .callout-danger strong { color: #c94a4a; }

    .empty-state {
        padding: 20px 16px;
        border: 1px dashed rgba(0, 0, 0, 0.22);
        border-radius: 6px;
        text-align: center;
    }

    .empty-state h3 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 600;
        color: #e8e4df;
    }

    .empty-state p {
        font-size: 12px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.5);
    }

    /* ================================================================
       7. VIEW-SPECIFIC
       Overview, Chat, Memory, Workflow, Surfaces, Command Palette
       ================================================================ */

    /* --- Overview grid --- */
    .page-grid-overview {
        grid-template-columns: 300px minmax(0, 1fr) 280px;
    }

    /* --- Chat grid --- */
    .page-grid-chat {
        grid-template-columns: 260px minmax(0, 1fr) 280px;
    }

    /* --- Workflow grid --- */
    .page-grid-workflow {
        grid-template-columns: minmax(0, 1fr) 280px;
    }

    /* --- Surfaces grid --- */
    .page-grid-surfaces {
        grid-template-columns: 440px minmax(0, 1fr) 280px;
    }

    .page-grid-surfaces.preview-only {
        grid-template-columns: minmax(0, 1fr) 280px;
    }

    .surfaces-toolbar {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        padding: 8px 12px 0;
    }

    /* --- Memory grid --- */
    .page-grid-memory {
        grid-template-columns: 260px minmax(0, 1fr) 300px;
    }

    /* --- Chat view --- */
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
        padding: 10px 12px 8px;
    }

    /* Inbound: dark bg, left-aligned */
    .message-bubble-inbound {
        align-self: flex-start;
        border-bottom-left-radius: 4px;
        background: linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
    }

    /* Outbound: coral tint, right-aligned */
    .message-bubble-outbound {
        align-self: flex-end;
        border-color: rgba(224, 123, 90, 0.2);
        background: linear-gradient(180deg, rgba(224, 123, 90, 0.12) 0%, rgba(224, 123, 90, 0.08) 100%);
        border-bottom-right-radius: 4px;
    }

    .message-body {
        margin: 6px 0 0;
        white-space: pre-wrap;
        font-size: 12px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.85);
    }

    .composer {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    /* --- Workflow board --- */
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
        padding: 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
    }

    .workflow-lane-active {
        border-color: rgba(224, 123, 90, 0.35);
        background: linear-gradient(180deg, rgba(58, 58, 58, 0.96) 0%, rgba(46, 46, 46, 1) 100%);
    }

    .lane-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }

    .lane-copy {
        margin: 0 0 8px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
    }

    /* Workflow cards — draggable */
    .workflow-card {
        padding: 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        cursor: grab;
        font-size: 11px;
        transition: background 0.15s, border-color 0.15s;
    }

    .workflow-card + .workflow-card {
        margin-top: 6px;
    }

    .workflow-card:active {
        cursor: grabbing;
        background: rgba(255, 255, 255, 0.07);
    }

    /* --- Code / editor --- */
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
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: #2e2e2e;
        color: #e8e4df;
        white-space: pre-wrap;
        overflow: auto;
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.65;
    }

    /* --- Surfaces / preview --- */
    .surface-preview {
        min-height: 540px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
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

    /* --- Memory view --- */
    .memory-stage-panel {
        min-height: 0;
    }

    .memory-stage-head {
        align-items: start;
    }

    .memory-stage-body,
    .memory-detail-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    /* Memory field — dark canvas with dot grid */
    .memory-field-shell {
        min-height: 420px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background:
            radial-gradient(circle, rgba(0, 0, 0, 0.08) 1px, transparent 1px),
            linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
        background-size: 24px 24px, auto;
        border-radius: 6px;
        padding: 12px;
    }

    .memory-field {
        position: relative;
        min-height: 380px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: linear-gradient(180deg, #2e2e2e 0%, #262626 100%);
        overflow: hidden;
    }

    .memory-field-grid,
    .memory-field-axis {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .memory-field-grid {
        background:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
        background-size: 48px 48px;
    }

    .memory-field-axis.axis-x::before,
    .memory-field-axis.axis-y::before {
        content: "";
        position: absolute;
        background: rgba(255, 255, 255, 0.1);
    }

    .memory-field-axis.axis-x::before {
        left: 8%;
        right: 8%;
        top: 50%;
        height: 1px;
    }

    .memory-field-axis.axis-y::before {
        top: 10%;
        bottom: 10%;
        left: 50%;
        width: 1px;
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

    .memory-point-core {
        display: block;
        width: 14px;
        height: 14px;
        border: 1px solid rgba(224, 123, 90, 0.5);
        background: rgba(224, 123, 90, 0.15);
        box-shadow: 0 0 0 1px rgba(46, 46, 46, 0.6);
    }

    .memory-point-active .memory-point-core {
        border-color: rgba(224, 123, 90, 0.9);
        background: rgba(224, 123, 90, 0.3);
        box-shadow: 0 0 0 2px rgba(224, 123, 90, 0.15);
    }

    .memory-point-label {
        position: absolute;
        top: 18px;
        left: -6px;
        padding: 1px 5px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(46, 46, 46, 0.95);
        color: #e8e4df;
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.05em;
        white-space: nowrap;
    }

    .memory-query-marker {
        width: 22px;
        height: 22px;
        border: 1px solid rgba(224, 123, 90, 0.7);
        box-shadow: 0 0 0 1px rgba(224, 123, 90, 0.15);
    }

    .memory-query-marker::before,
    .memory-query-marker::after {
        content: "";
        position: absolute;
        background: rgba(224, 123, 90, 0.75);
    }

    .memory-query-marker::before {
        left: 50%;
        top: 2px;
        bottom: 2px;
        width: 1px;
        transform: translateX(-50%);
    }

    .memory-query-marker::after {
        top: 50%;
        left: 2px;
        right: 2px;
        height: 1px;
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
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
    }

    .memory-stat-value {
        display: block;
        margin-top: 4px;
        font-size: 18px;
        line-height: 1;
        letter-spacing: -0.04em;
        color: #e8e4df;
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
        min-height: 4px;
        background: linear-gradient(180deg, rgba(224, 123, 90, 0.85) 0%, rgba(201, 138, 58, 0.65) 100%);
    }

    .dimension-index {
        color: rgba(255, 255, 255, 0.5);
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        writing-mode: vertical-rl;
        text-orientation: mixed;
    }

    .memory-json {
        margin: 0;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        background: #2e2e2e;
        color: #e8e4df;
        font-family: var(--mono);
        font-size: 10px;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow: auto;
    }

    /* --- Command palette (Cmd+K overlay) --- */
    .command-palette {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 18vh;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(6px);
    }

    .command-palette-panel {
        width: 560px;
        max-width: calc(100vw - 32px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        background: #2a2a2a;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    .command-palette-input {
        width: 100%;
        padding: 14px 16px;
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        background: transparent;
        color: #e8e4df;
        font-family: var(--sans);
        font-size: 14px;
        outline: none;
    }

    .command-palette-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
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
        padding: 8px 10px;
        border-radius: 6px;
        color: #e8e4df;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid transparent;
        border-left-width: 2px;
        background: transparent;
        text-align: left;
        font: inherit;
        transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .command-palette-item:hover,
    .command-palette-item-active {
        border-left-color: #e07b5a;
        background: rgba(224, 123, 90, 0.1);
        color: #ffffff;
    }

    .command-palette-label {
        flex: 1;
    }

    .command-palette-kbd {
        display: inline-flex;
        align-items: center;
        padding: 1px 5px;
        border-radius: 3px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.5);
        font-family: var(--mono);
        font-size: 10px;
    }

    .command-palette-empty {
        padding: 24px 16px;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
    }

    /* --- Nav icon (always visible in sidebar regardless of expanded state) --- */
    .nav-icon {
        flex-shrink: 0;
        width: 20px;
        text-align: center;
        font-size: 13px;
        line-height: 1;
    }
"#;
