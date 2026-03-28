pub const APP_STYLES: &str = r#"
    /* ================================================================
       1. RESET + TOKENS
       Values sourced from design-tokens.json at repo root
       ================================================================ */

    :root {
        color-scheme: dark;

        /* Color tokens */
        --bg-canvas:       #02050d;
        --bg-sidebar:      rgba(2, 5, 13, 0.98);
        --bg-topbar:       rgba(2, 5, 13, 0.94);
        --bg-panel:        rgba(8, 12, 26, 0.72);
        --bg-panel-strong: rgba(7, 10, 22, 0.88);
        --bg-elevated:     rgba(12, 18, 36, 0.92);
        --bg-hover:        rgba(0, 229, 255, 0.04);

        --border:          rgba(100, 180, 255, 0.14);
        --border-strong:   rgba(100, 180, 255, 0.28);

        --primary:         #00e5ff;
        --primary-soft:    rgba(0, 229, 255, 0.12);

        --accent:          #ffd66b;
        --accent-soft:     rgba(255, 214, 107, 0.12);

        --destructive:     #ff4d4d;
        --destructive-soft: rgba(255, 77, 77, 0.12);

        --success:         #4dff88;
        --success-soft:    rgba(77, 255, 136, 0.12);

        --warning:         #ffaa33;
        --warning-soft:    rgba(255, 170, 51, 0.12);

        --text:            #f5f7ff;
        --text-strong:     #ffffff;
        --muted:           rgba(220, 228, 255, 0.6);
        --muted-subtle:    rgba(220, 228, 255, 0.36);

        /* Typography */
        --sans: "Inter", "SF Pro Display", system-ui, sans-serif;
        --mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", ui-monospace, monospace;

        /* Effects */
        --glow-primary: 0 0 12px rgba(0, 229, 255, 0.15);
        --glow-accent:  0 0 12px rgba(255, 214, 107, 0.12);
        --shadow:       0 14px 28px rgba(0, 0, 0, 0.24);

        /* Grid */
        --grid-line: rgba(100, 180, 255, 0.04);
        --grid-size: 28px;
    }

    * {
        box-sizing: border-box;
    }

    html, body, #main {
        margin: 0;
        height: 100%;
        min-height: 100%;
        background:
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
            var(--bg-canvas);
        background-size: var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size), auto;
        color: var(--text);
        font-family: var(--sans);
        font-size: 12px;
        line-height: 1.5;
    }

    body {
        overflow: hidden;
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
        border-right: 1px solid var(--border);
        background: linear-gradient(180deg, var(--bg-sidebar) 0%, rgba(2, 5, 13, 1) 100%);
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
        border-bottom: 1px solid var(--border);
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
        border: 1px solid rgba(0, 229, 255, 0.35);
        background: linear-gradient(180deg, rgba(0, 229, 255, 0.14) 0%, rgba(0, 229, 255, 0.06) 100%);
        color: var(--primary);
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.04em;
        box-shadow: var(--glow-primary);
    }

    .sidebar-title {
        margin: 0;
        color: var(--text-strong);
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
        color: var(--muted-subtle);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
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
        color: var(--text);
        text-align: left;
        cursor: pointer;
        transition: border-color 0.18s ease, background 0.18s ease;
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
        border-color: var(--border-strong);
        background: var(--bg-hover);
    }

    .nav-button-active,
    .list-item-active {
        border-color: rgba(0, 229, 255, 0.28);
        background: var(--primary-soft);
        box-shadow: inset 2px 0 0 var(--primary);
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
    }

    .sidebar.sidebar-expanded .nav-label {
        opacity: 1;
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
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-family: var(--mono);
        font-size: 10px;
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
        border-top: 1px solid var(--border);
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
        color: var(--muted);
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
        border-bottom: 1px solid var(--border);
        background: var(--bg-topbar);
        backdrop-filter: blur(8px);
    }

    .topbar-title {
        margin: 0;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: -0.01em;
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
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .topbar-subtitle {
        margin: 0;
        color: var(--muted);
        font-size: 11px;
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
        border: 1px solid var(--border);
        border-radius: 6px;
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel-strong) 100%);
        box-shadow: var(--shadow);
    }

    .metric-tile,
    .inspector-card,
    .row-card,
    .surface-node,
    .document-viewer {
        padding: 12px 12px 10px;
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
        border-bottom: 1px solid var(--border);
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
        color: var(--muted);
        max-width: 70ch;
        font-size: 11px;
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
        color: var(--muted);
        font-size: 11px;
    }

    .list-item-meta,
    .thread-sub,
    .message-channel,
    .row-copy,
    .message-meta {
        color: var(--muted);
        font-size: 11px;
    }

    .metric-value,
    .surface-node-value {
        font-size: 18px;
        line-height: 1;
        letter-spacing: -0.03em;
        color: var(--text-strong);
        font-family: var(--mono);
    }

    .metric-value-primary {
        color: var(--primary);
        text-shadow: var(--glow-primary);
    }

    .metric-value-accent {
        color: var(--accent);
        text-shadow: var(--glow-accent);
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
        color: var(--muted);
        font-size: 11px;
    }

    .key-value-list strong {
        color: var(--text);
        font-weight: 600;
    }

    /* ================================================================
       5. INTERACTIVE
       buttons, segmented, pills, inputs, textarea
       ================================================================ */

    .segmented {
        display: inline-flex;
        padding: 3px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.02);
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
        transition: background 0.18s ease, border-color 0.18s ease;
    }

    .segmented-button {
        background: transparent;
        color: var(--muted);
    }

    .segmented-button-active {
        border-color: rgba(0, 229, 255, 0.28);
        background: var(--primary-soft);
        color: var(--text);
    }

    .primary-button {
        border-color: rgba(0, 229, 255, 0.28);
        background: rgba(0, 229, 255, 0.12);
        color: var(--text-strong);
    }

    .primary-button:hover {
        background: rgba(0, 229, 255, 0.2);
        box-shadow: var(--glow-primary);
    }

    .secondary-button {
        border-color: var(--border);
        background: rgba(255, 255, 255, 0.03);
        color: var(--text);
    }

    .secondary-button:hover {
        background: rgba(255, 255, 255, 0.06);
    }

    .secondary-button:disabled,
    .primary-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .pill {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid var(--border);
        color: var(--text);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }

    .pill-live,
    .pill-accent {
        border-color: rgba(0, 229, 255, 0.28);
        background: var(--primary-soft);
        color: var(--primary);
    }

    .pill-success {
        border-color: rgba(77, 255, 136, 0.28);
        background: var(--success-soft);
        color: var(--success);
    }

    .pill-warn {
        border-color: rgba(255, 170, 51, 0.28);
        background: var(--warning-soft);
        color: var(--warning);
    }

    .pill-danger {
        border-color: rgba(255, 77, 77, 0.28);
        background: var(--destructive-soft);
        color: var(--destructive);
    }

    .pill-subtle {
        background: rgba(255, 255, 255, 0.03);
        color: var(--muted);
    }

    textarea {
        width: 100%;
        min-height: 80px;
        resize: vertical;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: rgba(2, 5, 13, 0.72);
        color: var(--text);
        padding: 10px 12px;
        outline: none;
        font-size: 12px;
    }

    textarea:focus {
        border-color: rgba(0, 229, 255, 0.35);
        box-shadow: 0 0 0 1px rgba(0, 229, 255, 0.15);
    }

    /* ================================================================
       6. STATUS INDICATORS
       connection dot, badges, callouts, empty state
       ================================================================ */

    /* Pulsing connection dot — green = connected, red = disconnected */
    .connection-dot {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 0 0 rgba(77, 255, 136, 0.5);
        animation: connection-pulse 2.4s ease-in-out infinite;
        flex-shrink: 0;
    }

    .connection-dot.disconnected {
        background: var(--destructive);
        box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.4);
        animation: none;
    }

    @keyframes connection-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(77, 255, 136, 0.5); }
        60%  { box-shadow: 0 0 0 5px rgba(77, 255, 136, 0); }
        100% { box-shadow: 0 0 0 0 rgba(77, 255, 136, 0); }
    }

    .callout {
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid var(--border);
        font-size: 11px;
    }

    .callout strong {
        display: block;
        margin-bottom: 4px;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .callout p {
        margin: 0;
        color: var(--muted);
    }

    .callout-info {
        border-color: rgba(0, 229, 255, 0.18);
        background: var(--primary-soft);
    }

    .callout-info strong { color: var(--primary); }

    .callout-tip {
        border-color: rgba(77, 255, 136, 0.18);
        background: var(--success-soft);
    }

    .callout-tip strong { color: var(--success); }

    .callout-warn {
        border-color: rgba(255, 170, 51, 0.22);
        background: var(--warning-soft);
    }

    .callout-warn strong { color: var(--warning); }

    .callout-danger {
        border-color: rgba(255, 77, 77, 0.22);
        background: var(--destructive-soft);
    }

    .callout-danger strong { color: var(--destructive); }

    .empty-state {
        padding: 20px 16px;
        border: 1px dashed var(--border-strong);
        border-radius: 6px;
        text-align: center;
    }

    .empty-state h3 {
        margin: 0 0 4px;
        font-size: 13px;
    }

    .empty-state p {
        font-size: 11px;
    }

    /* ================================================================
       7. VIEW-SPECIFIC
       Overview, Chat, Memory, Workflow, Surfaces, Command Palette
       ================================================================ */

    /* --- Overview grid --- */
    .page-grid-overview {
        grid-template-columns: 260px minmax(0, 1fr) 280px;
    }

    /* --- Chat grid --- */
    .page-grid-chat {
        grid-template-columns: 240px minmax(0, 1fr) 280px;
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

    .message-bubble-inbound {
        align-self: flex-start;
        border-bottom-left-radius: 4px;
    }

    .message-bubble-outbound {
        align-self: flex-end;
        border-color: rgba(0, 229, 255, 0.18);
        background: linear-gradient(180deg, rgba(0, 22, 40, 0.92) 0%, rgba(0, 14, 26, 0.96) 100%);
        border-bottom-right-radius: 4px;
    }

    .message-body {
        margin: 6px 0 0;
        white-space: pre-wrap;
        font-size: 12px;
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
        border: 1px solid var(--border);
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel-strong) 100%);
    }

    .workflow-lane-active {
        border-color: rgba(0, 229, 255, 0.24);
        background: linear-gradient(180deg, rgba(0, 20, 36, 0.88) 0%, rgba(0, 12, 24, 0.96) 100%);
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
        color: var(--muted);
        font-size: 11px;
    }

    .workflow-card {
        padding: 10px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.02);
        cursor: grab;
        font-size: 11px;
    }

    .workflow-card + .workflow-card {
        margin-top: 6px;
    }

    .workflow-card:active {
        cursor: grabbing;
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
        border: 1px solid var(--border);
        background: rgba(2, 5, 13, 0.92);
        color: #edf3f8;
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
        border: 1px solid var(--border);
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel-strong) 100%);
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

    .memory-field-shell {
        min-height: 420px;
        border: 1px solid var(--border);
        background:
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
            linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel-strong) 100%);
        background-size: var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size), auto;
        border-radius: 6px;
        padding: 12px;
    }

    .memory-field {
        position: relative;
        min-height: 380px;
        border: 1px solid rgba(0, 229, 255, 0.1);
        background: linear-gradient(180deg, rgba(2, 5, 13, 0.96) 0%, rgba(2, 5, 13, 1) 100%);
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
            linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
        background-size: 48px 48px;
    }

    .memory-field-axis.axis-x::before,
    .memory-field-axis.axis-y::before {
        content: "";
        position: absolute;
        background: rgba(0, 229, 255, 0.1);
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
        border: 1px solid rgba(0, 229, 255, 0.5);
        background: rgba(0, 229, 255, 0.14);
        box-shadow: 0 0 0 1px rgba(2, 5, 13, 0.6);
    }

    .memory-point-active .memory-point-core {
        border-color: rgba(255, 214, 107, 0.8);
        background: rgba(255, 214, 107, 0.22);
        box-shadow: 0 0 0 2px rgba(255, 214, 107, 0.12);
    }

    .memory-point-label {
        position: absolute;
        top: 18px;
        left: -6px;
        padding: 1px 5px;
        border: 1px solid rgba(0, 229, 255, 0.14);
        background: rgba(2, 5, 13, 0.92);
        color: var(--text);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.05em;
        white-space: nowrap;
    }

    .memory-query-marker {
        width: 22px;
        height: 22px;
        border: 1px solid rgba(255, 214, 107, 0.6);
        box-shadow: 0 0 0 1px rgba(255, 214, 107, 0.15);
    }

    .memory-query-marker::before,
    .memory-query-marker::after {
        content: "";
        position: absolute;
        background: rgba(255, 214, 107, 0.7);
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
        border: 1px solid var(--border);
        background: linear-gradient(180deg, var(--bg-panel) 0%, var(--bg-panel-strong) 100%);
    }

    .memory-stat-value {
        display: block;
        margin-top: 4px;
        font-size: 18px;
        line-height: 1;
        letter-spacing: -0.04em;
        color: var(--text-strong);
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
        background: linear-gradient(180deg, rgba(0, 229, 255, 0.85) 0%, rgba(255, 214, 107, 0.65) 100%);
    }

    .dimension-index {
        color: var(--muted);
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        writing-mode: vertical-rl;
        text-orientation: mixed;
    }

    .memory-json {
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: rgba(2, 5, 13, 0.92);
        color: #eef3f8;
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
        background: rgba(2, 5, 13, 0.72);
        backdrop-filter: blur(6px);
    }

    .command-palette-panel {
        width: 560px;
        max-width: calc(100vw - 32px);
        border: 1px solid var(--border-strong);
        border-radius: 8px;
        background: var(--bg-panel-strong);
        box-shadow: var(--shadow), var(--glow-primary);
        overflow: hidden;
    }

    .command-palette-input {
        width: 100%;
        padding: 14px 16px;
        border: none;
        border-bottom: 1px solid var(--border);
        background: transparent;
        color: var(--text-strong);
        font-family: var(--sans);
        font-size: 14px;
        outline: none;
    }

    .command-palette-input::placeholder {
        color: var(--muted-subtle);
    }

    .command-palette-list {
        max-height: 360px;
        overflow-y: auto;
        padding: 6px;
    }

    .command-palette-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 8px 10px;
        border-radius: 6px;
        color: var(--text);
        font-size: 12px;
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        text-align: left;
        font: inherit;
    }

    .command-palette-item:hover,
    .command-palette-item-active {
        border-color: var(--border);
        background: var(--primary-soft);
        color: var(--text-strong);
    }

    .command-palette-label {
        flex: 1;
    }

    .command-palette-kbd {
        display: inline-flex;
        align-items: center;
        padding: 1px 5px;
        border-radius: 3px;
        border: 1px solid var(--border-strong);
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-family: var(--mono);
        font-size: 10px;
    }

    .command-palette-empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--muted);
        font-size: 12px;
    }

    /* Reset list styling inside command palette */
    .command-palette-list {
        list-style: none;
        margin: 0;
    }

    .command-palette-list li {
        margin: 0;
        padding: 0;
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
