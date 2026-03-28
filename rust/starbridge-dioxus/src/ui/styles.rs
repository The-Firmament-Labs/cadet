pub const APP_STYLES: &str = r#"
    /* ================================================================
       1. RESET + TOKENS
       Orbital Data System Design Language
       ================================================================ */

    :root {
        color-scheme: light;

        /* Material You / Orbital Data System color tokens */
        --primary:                   #AA3618;
        --primary-container:         #EF6745;
        --on-primary:                #FFFFFF;
        --on-primary-container:      #1C1B1B;
        --secondary:                 #5F5E5E;
        --secondary-container:       #E4E2E1;
        --tertiary:                  #526258;
        --tertiary-container:        #D4E8D9;
        --surface:                   #F7F5F4;
        --surface-container-lowest:  #FFFFFF;
        --surface-container-low:     #F0EDED;
        --surface-container:         #EAE7E6;
        --surface-container-high:    #E4E1E0;
        --surface-dim:               #DCD9D9;
        --on-surface:                #1C1B1B;
        --on-surface-variant:        #58413C;
        --outline-variant:           #E0BFB8;
        --background-sage:           #c8d1c0;

        /* Typography */
        --sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        --mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", ui-monospace, monospace;

        /* Effects */
        --shadow:      0 24px 48px rgba(28, 27, 27, 0.06);
        --ghost-border: inset 0 0 0 1px rgba(224, 191, 184, 0.15);

        /* Grid */
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

    html, body, #main {
        margin: 0;
        height: 100%;
        min-height: 100%;
        color: var(--on-surface);
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        line-height: 1.5;
    }

    body {
        background: var(--background-sage);
        background-image: radial-gradient(circle, rgba(28, 27, 27, 0.06) 1px, transparent 1px);
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
        background: var(--on-surface);
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
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
        border-radius: 0;
        border: 1px solid rgba(170, 54, 24, 0.5);
        background: linear-gradient(180deg, rgba(170, 54, 24, 0.2) 0%, rgba(170, 54, 24, 0.1) 100%);
        color: var(--primary-container);
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.04em;
        box-shadow: var(--shadow);
    }

    .sidebar-title {
        margin: 0;
        color: var(--surface-container-lowest);
        font-size: 13px;
        font-weight: 600;
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
        gap: 2px;
    }

    .nav-button,
    .list-item {
        width: 100%;
        border: none;
        border-radius: 0;
        padding: 8px 6px;
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        text-align: left;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
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
        background: rgba(255, 255, 255, 0.06);
    }

    .nav-button-active,
    .list-item-active {
        background: var(--primary);
        color: var(--on-primary);
    }

    .nav-label,
    .list-item-title,
    .card-title,
    .topbar-title,
    .empty-state h3 {
        color: var(--on-surface);
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .nav-label {
        opacity: 0;
        transition: opacity 0.15s ease;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
    }

    .sidebar.sidebar-expanded .nav-label {
        opacity: 1;
    }

    /* Active nav label gets white */
    .nav-button-active .nav-label {
        color: var(--on-primary);
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
        border-radius: 0;
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

    .nav-button-active .nav-count {
        background: rgba(255, 255, 255, 0.2);
        color: var(--on-primary);
    }

    .sidebar-metrics {
        display: grid;
        gap: 6px;
    }

    .sidebar-footer {
        margin-top: auto;
        padding: 8px 0 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
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
        color: rgba(255, 255, 255, 0.4);
        font-family: var(--mono);
        font-size: 9px;
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
        background: var(--surface-container-low);
    }

    .topbar-title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--on-surface);
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
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
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .topbar-subtitle {
        margin: 0;
        color: var(--on-surface-variant);
        font-size: 11px;
    }

    /* Live indicator dot */
    .live-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 0;
        background: var(--primary);
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
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
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
        border-bottom: 1px solid rgba(224, 191, 184, 0.15);
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
        color: var(--on-surface-variant);
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
        color: var(--on-surface-variant);
    }

    /* Card titles — 13px semi-bold */
    .card-title,
    .panel-title,
    .inspector-title {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
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
        color: var(--on-surface-variant);
        font-size: 12px;
        line-height: 1.55;
    }

    .list-item-meta,
    .thread-sub,
    .message-channel,
    .row-copy,
    .message-meta {
        color: var(--on-surface-variant);
        font-size: 11px;
    }

    /* Metric values — mono data display */
    .metric-value,
    .surface-node-value {
        font-size: 18px;
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
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        color: var(--on-surface);
    }

    .metric-value-primary {
        color: var(--primary);
    }

    .metric-value-accent {
        color: var(--primary);
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
        color: var(--on-surface-variant);
        font-size: 11px;
        font-family: var(--mono);
    }

    .key-value-list strong {
        color: var(--on-surface);
        font-weight: 600;
    }

    /* ================================================================
       5. INTERACTIVE
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
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
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
    }

    .primary-button:hover {
        background: var(--primary-container);
        transform: scale(1.02);
        box-shadow: var(--shadow);
    }

    .secondary-button {
        background: var(--secondary-container);
        color: var(--primary);
    }

    .secondary-button:hover {
        background: var(--surface-container-high);
        transform: scale(1.02);
    }

    .secondary-button:disabled,
    .primary-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        transform: none;
    }

    /* Pills / status badges — sharp rectangles */
    .pill {
        display: inline-flex;
        align-items: center;
        padding: 2px 7px;
        border-radius: 0;
        border: none;
        background: var(--surface-container-high);
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .pill-live,
    .pill-accent {
        background: var(--primary-container);
        color: var(--on-primary-container);
    }

    .pill-success {
        background: var(--tertiary-container);
        color: var(--tertiary);
    }

    .pill-warn {
        background: var(--secondary-container);
        color: var(--secondary);
    }

    .pill-danger {
        background: var(--primary);
        color: var(--on-primary);
    }

    .pill-subtle {
        background: var(--surface-dim);
        color: var(--on-surface-variant);
    }

    textarea {
        width: 100%;
        min-height: 80px;
        resize: vertical;
        border: none;
        border-bottom: 2px solid var(--outline-variant);
        border-radius: 0;
        background: var(--surface-container-low);
        color: var(--on-surface);
        padding: 10px 12px;
        outline: none;
        font-size: 12px;
        font-family: var(--sans);
        transition: border-color 0.15s;
    }

    textarea:focus {
        border-bottom-color: var(--primary);
    }

    textarea::placeholder {
        color: var(--on-surface-variant);
        opacity: 0.6;
    }

    /* ================================================================
       6. STATUS INDICATORS
       connection dot, status badges, callouts, empty state
       ================================================================ */

    /* Connection dot — tertiary green = connected, primary red = disconnected */
    .connection-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 0;
        background: var(--tertiary);
        flex-shrink: 0;
    }

    .connection-dot.disconnected {
        background: var(--primary);
    }

    /* Status badge color helpers */
    .status-running   { color: var(--tertiary); }
    .status-queued    { color: var(--secondary); }
    .status-pending   { color: var(--secondary); }
    .status-failed    { color: var(--primary); }
    .status-blocked   { color: var(--primary); }
    .status-completed { color: var(--tertiary); }
    .status-draft     { color: var(--on-surface-variant); }

    .callout {
        padding: 10px 12px;
        border-radius: 0;
        border: none;
        box-shadow: var(--ghost-border);
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
        color: var(--on-surface-variant);
    }

    .callout-info {
        background: rgba(170, 54, 24, 0.08);
    }

    .callout-info strong { color: var(--primary); }

    .callout-tip {
        background: var(--tertiary-container);
    }

    .callout-tip strong { color: var(--tertiary); }

    .callout-warn {
        background: var(--secondary-container);
    }

    .callout-warn strong { color: var(--secondary); }

    .callout-danger {
        background: var(--primary);
    }

    .callout-danger strong { color: var(--on-primary); }
    .callout-danger p { color: var(--on-primary); }

    .empty-state {
        padding: 20px 16px;
        border: 1px dashed var(--outline-variant);
        border-radius: 0;
        text-align: center;
    }

    .empty-state h3 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
    }

    .empty-state p {
        font-size: 12px;
        line-height: 1.55;
        color: var(--on-surface-variant);
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
        border-radius: 0;
    }

    /* Inbound: surface-container-low, left-aligned, sharp corners */
    .message-bubble-inbound {
        align-self: flex-start;
        background: var(--surface-container-low);
    }

    /* Outbound: primary 10% tint, right-aligned, sharp corners */
    .message-bubble-outbound {
        align-self: flex-end;
        background: rgba(170, 54, 24, 0.10);
    }

    .message-body {
        margin: 6px 0 0;
        white-space: pre-wrap;
        font-size: 12px;
        line-height: 1.55;
        color: var(--on-surface);
    }

    .composer {
        display: flex;
        flex-direction: column;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
        border-radius: 0;
        overflow: hidden;
    }

    .composer-input {
        width: 100%;
        padding: 12px 14px;
        border: none;
        border-bottom: 1px solid var(--outline-variant);
        border-radius: 0;
        background: transparent;
        color: var(--on-surface);
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
        min-height: 40px;
        outline: none;
    }

    .composer-input:focus {
        border-bottom-color: var(--primary);
    }

    .composer-input::placeholder {
        color: var(--on-surface-variant);
    }

    .composer-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
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
        border: 1px solid var(--outline-variant);
        border-radius: 0;
        background: transparent;
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .composer-chip:hover {
        background: var(--surface-container-high);
        color: var(--on-surface);
    }

    .composer-chip-active {
        background: var(--surface-container-high);
        color: var(--on-surface);
        border-color: var(--on-surface-variant);
    }

    .composer-chip-help {
        padding: 3px 8px;
    }

    /* --- Workflow board (Kanban) --- */
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
        margin-bottom: 8px;
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

    /* Workflow cards — draggable, white on sage */
    .workflow-card {
        padding: 10px;
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border);
        cursor: grab;
        font-size: 11px;
        transition: background 0.15s;
    }

    .workflow-card + .workflow-card {
        margin-top: 6px;
    }

    .workflow-card:active {
        cursor: grabbing;
        background: var(--surface-container-low);
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
        border-radius: 0;
        border: none;
        box-shadow: var(--ghost-border);
        background: var(--on-surface);
        color: var(--surface-container-lowest);
        white-space: pre-wrap;
        overflow: auto;
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.65;
    }

    /* --- Surfaces / preview --- */
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

    /* Memory field — dark canvas, aerospace */
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

    /* Memory point — primary-container #EF6745 */
    .memory-point-core {
        display: block;
        width: 14px;
        height: 14px;
        background: var(--primary-container);
        opacity: 0.7;
        border-radius: 0;
    }

    .memory-point-active .memory-point-core {
        background: var(--primary-container);
        opacity: 1;
        box-shadow: 0 0 0 2px rgba(239, 103, 69, 0.3);
    }

    .memory-point-label {
        position: absolute;
        top: 18px;
        left: -6px;
        padding: 1px 5px;
        border-radius: 0;
        background: rgba(28, 27, 27, 0.95);
        color: var(--surface-container-lowest);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.05em;
        white-space: nowrap;
    }

    /* Memory query marker — primary #AA3618 */
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
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
    }

    .memory-stat-value {
        display: block;
        margin-top: 4px;
        font-size: 18px;
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
        padding: 10px 12px;
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

    /* --- Command palette (Cmd+K overlay) --- */
    .command-palette {
        position: fixed;
        inset: 0;
        z-index: 100;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 18vh;
        background: rgba(28, 27, 27, 0.5);
    }

    .command-palette-panel {
        width: 560px;
        max-width: calc(100vw - 32px);
        border-radius: 0;
        background: var(--surface-container-lowest);
        box-shadow: 0 24px 48px rgba(28, 27, 27, 0.2);
        overflow: hidden;
    }

    .command-palette-input {
        width: 100%;
        padding: 14px 16px;
        border: none;
        border-bottom: 2px solid var(--primary);
        background: transparent;
        color: var(--on-surface);
        font-family: var(--sans);
        font-size: 14px;
        outline: none;
        border-radius: 0;
        transition: border-color 0.15s;
    }

    .command-palette-input::placeholder {
        color: var(--on-surface-variant);
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
        border-radius: 0;
        color: var(--on-surface);
        font-size: 12px;
        cursor: pointer;
        border: none;
        background: transparent;
        text-align: left;
        font: inherit;
        transition: background 0.15s, color 0.15s;
    }

    .command-palette-item:hover,
    .command-palette-item-active {
        background: var(--primary);
        color: var(--on-primary);
    }

    .command-palette-label {
        flex: 1;
    }

    .command-palette-kbd {
        display: inline-flex;
        align-items: center;
        padding: 1px 5px;
        border-radius: 0;
        border: 1px solid var(--outline-variant);
        background: var(--surface-container-high);
        color: var(--on-surface-variant);
        font-family: var(--mono);
        font-size: 10px;
    }

    .command-palette-empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--on-surface-variant);
        font-size: 12px;
        font-family: var(--mono);
    }

    /* --- Nav icon (always visible in sidebar regardless of expanded state) --- */
    .nav-icon {
        flex-shrink: 0;
        width: 20px;
        text-align: center;
        font-size: 13px;
        line-height: 1;
    }

    /* --- Progress bars --- */
    .progress-track {
        height: 2px;
        border-radius: 0;
        background: var(--outline-variant);
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        border-radius: 0;
        background: linear-gradient(90deg, var(--primary), var(--primary-container));
    }
"#;
