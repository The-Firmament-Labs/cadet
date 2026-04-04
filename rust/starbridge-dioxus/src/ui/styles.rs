pub const APP_STYLES: &str = r#"
    /* ================================================================
       ORBITAL DATA SYSTEM -- Complete Design Language
       Claude Desktop Cowork-inspired layout
       Aerospace-grade operator dashboard
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
        --surface-raised:           #FFFFFF;
        --surface-container-lowest: #FFFFFF;
        --surface-container-low:    #F0EDED;
        --surface-container:        #EAE7E6;
        --surface-container-high:   #E4E1E0;
        --surface-container-highest:#DCD9D9;
        --surface-dim:              #DCD9D9;
        --surface-border:           rgba(224, 191, 184, 0.20);
        --on-surface:               #1C1B1B;
        --on-surface-dim:           #58413C;
        --on-surface-faint:         rgba(28, 27, 27, 0.35);
        --on-surface-variant:       #58413C;
        --outline-variant:          #E0BFB8;
        --background-sage:          #c8d1c0;

        --mint:                     #D4E8D9;
        --mint-dim:                 #526258;
        --sage:                     #c8d1c0;

        --success:                  #526258;
        --success-container:        #D4E8D9;
        --warning:                  #5F5E5E;
        --warning-container:        #E4E2E1;
        --error:                    #AA3618;
        --error-container:          rgba(170, 54, 24, 0.10);

        /* Typography stacks */
        --sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        --mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", ui-monospace, monospace;

        /* Effects -- subtle, close shadows; ghost borders, no radius */
        --shadow:       0 4px 12px rgba(28, 27, 27, 0.06);
        --shadow-lg:    0 8px 24px rgba(28, 27, 27, 0.10);
        --ghost-border: inset 0 0 0 1px var(--surface-border);

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

    @keyframes spin {
        to { transform: rotate(360deg); }
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

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
        background: rgba(28, 27, 27, 0.12);
        border-radius: 0;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(28, 27, 27, 0.22); }

    /* ================================================================
       3. APP SHELL — mode tabs + sidebar + content
       ================================================================ */

    .app-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        max-height: 100vh;
        overflow: hidden;
    }

    /* ── Title bar with mode tabs ──────────────────────────────────── */

    .title-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 44px;
        min-height: 44px;
        padding: 0 12px;
        background: var(--on-surface);
        color: var(--surface);
        border-bottom: none;
        -webkit-app-region: drag;
        user-select: none;
    }

    .title-bar-left {
        display: flex;
        align-items: center;
        gap: 16px;
        -webkit-app-region: no-drag;
    }

    .brand-compact {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        color: var(--on-surface);
    }

    .brand-compact img {
        width: 20px;
        height: 20px;
        filter: invert(1);
    }

    .mode-tabs {
        display: flex;
        gap: 0;
        -webkit-app-region: no-drag;
    }

    .mode-tab {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        padding: 6px 20px 4px;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.50);
        cursor: pointer;
        transition: color 120ms ease, background 120ms ease;
        position: relative;
    }

    .mode-tab:hover {
        color: rgba(255, 255, 255, 0.85);
        background: rgba(255, 255, 255, 0.06);
    }

    .mode-tab-active {
        color: #FFFFFF;
    }

    .mode-tab-active::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 12px;
        right: 12px;
        height: 2px;
        background: var(--primary);
    }

    .mode-tab-name {
        font-size: 13px;
        font-weight: 600;
        font-family: var(--sans);
        letter-spacing: -0.01em;
        color: inherit;
    }

    .mode-tab-sub {
        font-size: 9px;
        font-family: var(--mono);
        color: rgba(255, 255, 255, 0.30);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .mode-tab-active .mode-tab-sub {
        color: var(--primary-container);
    }

    .title-bar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        -webkit-app-region: no-drag;
    }

    .title-btn {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.50);
        cursor: pointer;
        font-size: 13px;
        transition: color 120ms, background 120ms;
    }

    .title-btn:hover {
        color: #FFFFFF;
        background: rgba(255, 255, 255, 0.08);
    }

    /* ── Main body (sidebar + content) ─────────────────────────────── */

    .main-body {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    /* ── Sidebar ───────────────────────────────────────────────────── */

    .sidebar {
        display: flex;
        flex-direction: column;
        background: var(--on-surface);
        border-right: none;
        overflow: hidden;
    }

    .sidebar-actions {
        padding: 12px 12px 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .sidebar-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: var(--tertiary-container);
        cursor: pointer;
        font-size: 13px;
        font-family: var(--sans);
        text-align: left;
        transition: background 100ms, color 100ms;
    }

    .sidebar-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.90);
    }

    .sidebar-btn-icon {
        width: 18px;
        text-align: center;
        flex-shrink: 0;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.35);
    }

    .sidebar-btn-primary {
        background: rgba(170, 54, 24, 0.12);
        color: #EF6745;
        font-weight: 500;
    }

    .sidebar-btn-primary:hover {
        background: rgba(170, 54, 24, 0.20);
    }

    .sidebar-btn-primary .sidebar-btn-icon {
        color: #EF6745;
    }

    .sidebar-divider {
        height: 1px;
        margin: 4px 12px;
        background: rgba(255, 255, 255, 0.06);
    }

    .sidebar-section-label {
        padding: 12px 12px 4px;
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.30);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .sidebar-list {
        flex: 1;
        overflow-y: auto;
        padding: 0 4px;
    }

    .sidebar-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 7px 12px;
        border: none;
        background: transparent;
        color: var(--tertiary-container);
        cursor: pointer;
        font-size: 12px;
        font-family: var(--sans);
        text-align: left;
        transition: background 100ms, color 100ms;
        white-space: nowrap;
        overflow: hidden;
    }

    .sidebar-item:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.90);
    }

    .sidebar-item-active {
        background: rgba(170, 54, 24, 0.12);
        color: #EF6745;
    }

    .sidebar-item-dot {
        width: 6px;
        height: 6px;
        flex-shrink: 0;
        background: var(--primary);
    }

    .sidebar-item-dot-scheduled {
        background: var(--mint-dim);
    }

    .sidebar-item-dot-active {
        background: var(--success);
        animation: pulse 2s ease-in-out infinite;
    }

    .sidebar-item-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .sidebar-item-badge {
        font-family: var(--mono);
        font-size: 10px;
        color: rgba(255, 255, 255, 0.35);
        flex-shrink: 0;
    }

    .sidebar-footer {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .connection-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 4px rgba(74, 222, 128, 0.4);
        flex-shrink: 0;
    }

    .connection-dot.disconnected {
        background: var(--primary);
        box-shadow: 0 0 4px rgba(170, 54, 24, 0.4);
    }

    .connection-dot.connecting {
        background: #fbbf24;
        box-shadow: 0 0 4px rgba(251, 191, 36, 0.4);
        animation: pulse 2s ease-in-out infinite;
    }

    .sidebar-footnote {
        margin: 0;
        color: rgba(255, 255, 255, 0.35);
        font-family: var(--mono);
        font-size: 10px;
    }

    /* ── Content area ──────────────────────────────────────────────── */

    .content-area {
        flex: 1;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: transparent;
    }

    /* ================================================================
       4. TASK HOME (Voyager mode default)
       Composer + Active Tasks + Scheduled
       ================================================================ */

    .task-home {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 24px 24px;
    }

    .task-home-inner {
        width: 100%;
        max-width: 680px;
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .task-home-greeting {
        font-size: 24px;
        font-weight: 600;
        color: var(--on-surface);
        margin: 0;
        font-family: var(--sans);
    }

    .task-home-sub {
        font-size: 14px;
        color: var(--on-surface-dim);
        margin: 4px 0 0;
    }

    /* Task composer (like Claude's cowork composer) */
    .task-composer {
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
        overflow: hidden;
    }

    .task-composer-input {
        width: 100%;
        min-height: 64px;
        max-height: 200px;
        padding: 16px;
        border: none;
        background: transparent;
        color: var(--on-surface);
        font-family: var(--sans);
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        outline: none;
    }

    .task-composer-input::placeholder {
        color: var(--on-surface-faint);
    }

    .task-composer-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-top: 1px solid rgba(224, 191, 184, 0.12);
    }

    .task-composer-left {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .task-composer-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border: 1px solid var(--surface-border);
        background: transparent;
        color: var(--on-surface-dim);
        font-family: var(--mono);
        font-size: 10px;
        cursor: pointer;
        transition: border-color 120ms, color 120ms;
    }

    .task-composer-chip:hover {
        border-color: var(--on-surface-dim);
        color: var(--on-surface);
    }

    /* Task sections */
    .task-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .task-section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .task-section-title {
        font-size: 12px;
        font-weight: 600;
        font-family: var(--mono);
        color: var(--on-surface-dim);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0;
    }

    .task-section-count {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--on-surface-faint);
    }

    /* Task cards */
    .task-card {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
        cursor: pointer;
        transition: background 100ms;
        border: none;
        width: 100%;
        text-align: left;
    }

    .task-card:hover {
        background: var(--surface-container-low);
    }

    .task-card-dot {
        width: 8px;
        height: 8px;
        flex-shrink: 0;
        margin-top: 5px;
    }

    .task-card-dot-active {
        background: var(--success);
        animation: pulse 2s ease-in-out infinite;
    }

    .task-card-dot-scheduled {
        background: var(--mint-dim);
    }

    .task-card-dot-complete {
        background: var(--on-surface-faint);
    }

    .task-card-dot-failed {
        background: var(--error);
    }

    .task-card-body {
        flex: 1;
        min-width: 0;
    }

    .task-card-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .task-card-meta {
        font-size: 11px;
        color: var(--on-surface-dim);
        margin: 2px 0 0;
    }

    .task-card-agent {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--primary);
        background: var(--primary-container);
        flex-shrink: 0;
    }

    /* Get to work section */
    .get-to-work {
        padding: 20px;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .get-to-work-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
        margin: 0;
    }

    .get-to-work-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .suggestion-chip {
        padding: 8px 14px;
        border: 1px solid var(--surface-border);
        background: transparent;
        color: var(--on-surface-dim);
        font-size: 12px;
        cursor: pointer;
        transition: border-color 120ms, color 120ms, background 120ms;
    }

    .suggestion-chip:hover {
        border-color: var(--primary);
        color: var(--on-surface);
        background: var(--primary-container);
    }

    /* ================================================================
       5. TASK DETAIL VIEW
       Description + Instructions + History panels
       ================================================================ */

    .task-detail {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .task-detail-header {
        padding: 20px 24px 16px;
        border-bottom: 1px solid var(--surface-border);
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
    }

    .task-detail-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--on-surface);
        margin: 0;
    }

    .task-detail-agent {
        font-size: 12px;
        color: var(--on-surface-dim);
        margin: 4px 0 0;
    }

    .task-detail-body {
        flex: 1;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        min-height: 0;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border);
    }

    .task-detail-main {
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .task-detail-aside {
        overflow-y: auto;
        padding: 24px;
        border-left: 1px solid rgba(224, 191, 184, 0.12);
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .detail-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .detail-section-title {
        font-size: 11px;
        font-weight: 600;
        font-family: var(--mono);
        color: var(--on-surface-dim);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0;
    }

    .detail-section-content {
        font-size: 13px;
        line-height: 1.7;
        color: var(--on-surface);
    }

    .detail-section-content p {
        margin: 0 0 8px;
    }

    /* Detail key-value rows */
    .detail-kv {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
        font-size: 12px;
    }

    .detail-kv-label {
        color: var(--on-surface-variant);
    }

    .detail-kv-value {
        color: var(--on-surface);
        font-weight: 500;
    }

    /* History timeline */
    .history-list {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .history-item {
        display: flex;
        gap: 10px;
        padding: 8px 0;
        font-size: 12px;
    }

    .history-time {
        flex-shrink: 0;
        width: 60px;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--on-surface-faint);
    }

    .history-text {
        color: var(--on-surface-dim);
    }

    /* ================================================================
       6. TASK EXECUTION VIEW
       Tool log + progress checklist + reply composer
       ================================================================ */

    .task-exec {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 280px;
        grid-template-rows: 1fr auto;
    }

    .task-exec-log {
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        grid-row: 1;
        grid-column: 1;
    }

    .task-exec-sidebar {
        overflow-y: auto;
        padding: 16px;
        border-left: 1px solid var(--surface-border);
        grid-row: 1 / 3;
        grid-column: 2;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .task-exec-composer {
        grid-row: 2;
        grid-column: 1;
        padding: 12px 16px;
        border-top: 1px solid var(--surface-border);
    }

    /* Tool log entries */
    .tool-entry {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 12px;
        transition: background 100ms;
        cursor: pointer;
    }

    .tool-entry:hover {
        background: var(--surface-container);
    }

    .tool-entry-icon {
        width: 18px;
        height: 18px;
        display: grid;
        place-items: center;
        flex-shrink: 0;
        font-size: 11px;
        color: var(--on-surface-dim);
    }

    .tool-entry-icon-success { color: var(--success); }
    .tool-entry-icon-error { color: var(--error); }
    .tool-entry-icon-running { color: var(--primary); animation: pulse 1.5s ease-in-out infinite; }

    .tool-entry-body {
        flex: 1;
        min-width: 0;
    }

    .tool-entry-name {
        font-size: 12px;
        font-weight: 500;
        color: var(--on-surface);
    }

    .tool-entry-summary {
        font-size: 11px;
        color: var(--on-surface-dim);
        margin: 2px 0 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .tool-entry-time {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--on-surface-faint);
        flex-shrink: 0;
    }

    /* Progress checklist */
    .progress-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .progress-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--on-surface-dim);
    }

    .progress-check {
        width: 14px;
        height: 14px;
        display: grid;
        place-items: center;
        font-size: 10px;
        flex-shrink: 0;
    }

    .progress-check-done {
        color: var(--success);
    }

    .progress-check-pending {
        color: var(--on-surface-faint);
    }

    .progress-item-done {
        color: var(--on-surface);
    }

    /* Context/files list */
    .context-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .context-file {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-dim);
        padding: 4px 0;
    }

    /* ================================================================
       7. CHAT VIEW (Cadet mode)
       ================================================================ */

    .chat-layout {
        display: grid;
        grid-template-columns: 260px minmax(0, 1fr);
        height: 100%;
        min-height: 0;
    }

    .chat-sidebar {
        display: flex;
        flex-direction: column;
        border-right: 1px solid rgba(224, 191, 184, 0.12);
        background: var(--surface-container-low);
        overflow: hidden;
    }

    .chat-sidebar-head {
        padding: 12px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
    }

    .search-input {
        width: 100%;
        padding: 6px 10px;
        font-size: 12px;
        font-family: var(--sans);
        border: 1px solid var(--outline-variant);
        background: var(--surface-container-lowest);
        color: var(--on-surface);
        outline: none;
    }

    .search-input:focus {
        border-color: var(--primary);
    }

    .chat-sidebar-list {
        flex: 1;
        overflow-y: auto;
    }

    .chat-sidebar-group {
        padding: 4px 0;
    }

    .chat-sidebar-date {
        padding: 8px 12px 4px;
        font-size: 10px;
        font-weight: 600;
        font-family: var(--mono);
        color: var(--on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    .chat-sidebar-item {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 12px;
        border: none;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 100ms;
    }

    .chat-sidebar-item:hover {
        background: var(--surface-container);
    }

    .chat-sidebar-item-active {
        background: rgba(170, 54, 24, 0.08);
        box-shadow: inset 3px 0 0 var(--primary);
    }

    .chat-sidebar-title {
        font-size: 12px;
        font-family: var(--sans);
        color: var(--on-surface);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .chat-sidebar-meta {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--on-surface-faint);
    }

    .chat-main {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }

    .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
    }

    .chat-error {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(170, 54, 24, 0.06);
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .chat-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 12px;
        text-align: center;
    }

    .chat-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-top: 8px;
    }

    .chat-suggestion {
        padding: 6px 12px;
        font-size: 11px;
        font-family: var(--sans);
        border: 1px solid var(--outline-variant);
        background: var(--surface-container-lowest);
        color: var(--on-surface-variant);
        cursor: pointer;
        transition: background 100ms, border-color 100ms;
    }

    .chat-suggestion:hover {
        background: var(--surface-container);
        border-color: var(--primary);
        color: var(--on-surface);
    }

    .chat-msg {
        max-width: 85%;
    }

    .chat-msg-user { align-self: flex-end; }
    .chat-msg-assistant { align-self: flex-start; }

    .chat-msg-head {
        margin-bottom: 4px;
    }

    .chat-msg-actor {
        font-size: 10px;
        font-weight: 600;
        font-family: var(--mono);
        color: var(--on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }

    .chat-msg-body {
        padding: 10px 14px;
        font-size: 13px;
        line-height: 1.5;
    }

    .chat-msg-user .chat-msg-body {
        background: var(--primary);
        color: var(--on-primary);
    }

    .chat-msg-assistant .chat-msg-body {
        background: var(--surface-container);
        color: var(--on-surface);
    }

    .chat-text { margin: 0; }

    .chat-tool-card {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 8px 10px;
        background: var(--surface-container-low);
        border: 1px solid var(--outline-variant);
        font-size: 11px;
    }

    .chat-tool-output {
        width: 100%;
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--on-surface-variant);
    }

    .chat-composer {
        border-top: 1px solid rgba(224, 191, 184, 0.12);
        padding: 12px 16px;
    }

    .chat-composer-input {
        width: 100%;
        min-height: 56px;
        max-height: 200px;
        padding: 10px;
        font-size: 13px;
        font-family: var(--sans);
        border: 1px solid var(--outline-variant);
        background: var(--surface-container-lowest);
        color: var(--on-surface);
        resize: vertical;
        outline: none;
    }

    .chat-composer-input:focus {
        border-color: var(--primary);
    }

    .chat-composer-input:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .chat-composer-bar {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 8px;
    }

    .pulse-text {
        animation: pulse 1.5s ease-in-out infinite;
        color: var(--on-surface-dim);
    }

    /* ================================================================
       8. OPS HOME (Saturn mode)
       Run queue + approvals + metrics
       ================================================================ */

    .ops-home {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .ops-metrics {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
    }

    .ops-metric {
        padding: 14px 16px;
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
    }

    .ops-metric-label {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--on-surface-dim);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0;
    }

    .ops-metric-value {
        font-size: 24px;
        font-weight: 700;
        font-family: var(--mono);
        color: var(--on-surface);
        margin: 4px 0 0;
    }

    .ops-metric-value-accent { color: var(--primary); }
    .ops-metric-value-success { color: var(--success); }
    .ops-metric-value-warning { color: var(--warning); }

    .ops-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 16px;
        min-height: 0;
    }

    .ops-panel {
        background: var(--surface-container-lowest);
        box-shadow: var(--ghost-border), var(--shadow);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .ops-panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
    }

    .ops-panel-title {
        font-size: 12px;
        font-weight: 600;
        font-family: var(--mono);
        color: var(--on-surface-dim);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0;
    }

    .ops-panel-body {
        flex: 1;
        overflow-y: auto;
    }

    /* Run list items */
    .run-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
        cursor: pointer;
        transition: background 100ms;
        border-left: none;
        border-right: none;
        border-top: none;
        width: 100%;
        text-align: left;
        background: transparent;
    }

    .run-item:hover {
        background: var(--surface-container-low);
    }

    .run-item-status {
        width: 8px;
        height: 8px;
        flex-shrink: 0;
        margin-top: 5px;
    }

    .run-item-body {
        flex: 1;
        min-width: 0;
    }

    .run-item-goal {
        font-size: 13px;
        font-weight: 500;
        color: var(--on-surface);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .run-item-meta {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-dim);
        margin: 2px 0 0;
    }

    .run-item-stage {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--on-surface-faint);
        flex-shrink: 0;
    }

    /* Approval items */
    .approval-item {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
    }

    .approval-item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }

    .approval-item-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--on-surface);
    }

    .approval-actions {
        display: flex;
        gap: 6px;
    }

    /* ================================================================
       9. SHARED UI PRIMITIVES
       Buttons, pills, inputs, cards
       ================================================================ */

    .primary-button,
    .secondary-button,
    .danger-button {
        padding: 7px 14px;
        border: none;
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 120ms, color 120ms;
    }

    .primary-button {
        background: var(--primary);
        color: var(--on-primary);
    }

    .primary-button:hover {
        background: var(--primary-container);
        box-shadow: var(--shadow);
    }

    .secondary-button {
        background: var(--surface-container-high);
        color: var(--on-surface);
    }

    .secondary-button:hover {
        background: var(--surface-container);
    }

    .danger-button {
        background: rgba(170, 54, 24, 0.10);
        color: var(--primary);
    }

    .danger-button:hover {
        background: rgba(170, 54, 24, 0.18);
    }

    .primary-button:disabled,
    .secondary-button:disabled,
    .danger-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* Pills */
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

    .pill-accent {
        background: rgba(170, 54, 24, 0.10);
        color: var(--primary);
    }

    .pill-subtle {
        background: #E4E2E1;
        color: #5F5E5E;
    }

    /* Card title */
    .card-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--on-surface);
        font-family: var(--sans);
    }

    .row-copy {
        margin: 0;
        font-size: 12px;
        color: var(--on-surface-dim);
        line-height: 1.6;
    }

    .section-eyebrow {
        margin: 0 0 4px;
        color: var(--on-surface-dim);
        font-family: var(--mono);
        font-size: 10px;
        font-weight: 400;
        letter-spacing: 0.10em;
        text-transform: uppercase;
    }

    /* Segmented control */
    .segmented {
        display: inline-flex;
        gap: 0;
        background: var(--surface-container);
    }

    .segmented-button {
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: var(--on-surface-dim);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background 120ms, color 120ms;
    }

    .segmented-button-active {
        background: var(--primary);
        color: var(--on-primary);
    }

    /* General textarea */
    textarea {
        width: 100%;
        min-height: 56px;
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

    /* Empty state */
    .empty-state {
        padding: 24px 16px;
        border: 1px dashed var(--surface-border);
        text-align: center;
    }

    .empty-state h3 {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--on-surface);
    }

    .empty-state p {
        font-size: 12px;
        color: var(--on-surface-dim);
    }

    /* Code blocks */
    .code-block {
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
       10. COMMAND PALETTE
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

    .command-palette-list li { margin: 0; padding: 0; }

    .command-palette-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        color: var(--on-surface);
        font-size: 13px;
        cursor: pointer;
        border: none;
        background: transparent;
        text-align: left;
        font: inherit;
        transition: background 100ms;
    }

    .command-palette-item:hover {
        background: var(--surface-container-low);
    }

    .command-palette-item-active {
        background: var(--primary);
        color: var(--on-primary);
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
       11. LEGACY VIEW SUPPORT
       Styles needed by existing views during migration
       ================================================================ */

    .page-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 16px;
    }

    .page-grid {
        display: grid;
        gap: 12px;
        align-items: start;
        animation: fade-in 200ms ease;
    }

    .page-grid-overview  { grid-template-columns: 300px minmax(0, 1fr) 280px; }
    .page-grid-chat      { grid-template-columns: 260px minmax(0, 1fr) 280px; }
    .page-grid-workflow  { grid-template-columns: minmax(0, 1fr) 280px; }
    .page-grid-memory    { grid-template-columns: 260px minmax(0, 1fr) 300px; }
    .page-grid-catalog   { grid-template-columns: 360px minmax(0, 1fr); }

    /* Panel primitives for legacy views */
    .metric-tile,
    .inspector-card,
    .panel,
    .row-card,
    .surface-node {
        background: var(--surface-container);
        box-shadow: var(--ghost-border);
    }

    .metric-tile,
    .inspector-card,
    .row-card,
    .surface-node {
        padding: 16px;
    }

    .panel { min-width: 0; min-height: 0; padding: 0; overflow: hidden; }
    .panel-head { padding: 14px 16px 12px; border-bottom: 1px solid var(--surface-border); }
    .panel-body { padding: 14px 16px; }

    .metric-tile-top,
    .row-top,
    .surface-node-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 6px;
    }

    .metric-tile-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
    }

    .metric-value {
        font-size: 20px;
        line-height: 1;
        letter-spacing: -0.03em;
        color: var(--on-surface);
        font-family: var(--mono);
    }

    .metric-detail {
        margin: 0;
        color: var(--on-surface-dim);
        font-size: 12px;
    }

    .list-item {
        width: 100%;
        border: none;
        background: transparent;
        color: var(--on-surface);
        text-align: left;
        cursor: pointer;
        padding: 14px 16px;
        border-bottom: 1px solid var(--surface-border);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: background 100ms;
    }

    .list-item:hover { background: var(--surface-container); }
    .list-item-active { background: var(--primary-container); }

    .list-item-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 6px;
    }

    .list-item-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .list-item-meta,
    .list-item-copy {
        font-size: 11px;
        color: var(--on-surface-dim);
        margin: 0;
    }

    .list-item-copy {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .chip-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
    }

    .key-value-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
    }

    .key-value-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        color: var(--on-surface-dim);
        font-size: 11px;
        font-family: var(--mono);
        padding: 8px 0;
        border-bottom: 1px solid var(--surface-border);
    }

    .key-value-list strong {
        color: var(--on-surface);
        font-weight: 600;
    }

    /* Callouts */
    .callout {
        padding: 12px 14px;
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

    .callout p { margin: 0; color: var(--on-surface-dim); }
    .callout-info  { background: var(--primary-container); }
    .callout-info strong { color: var(--primary); }
    .callout-tip   { background: var(--success-container); }
    .callout-tip strong { color: var(--success); }
    .callout-warn  { background: var(--warning-container); }
    .callout-warn strong { color: var(--warning); }
    .callout-danger { background: var(--error-container); }
    .callout-danger strong { color: var(--error); }

    /* Workflow board */
    .workflow-board {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(220px, 1fr);
        gap: 10px;
        overflow: auto;
    }

    .workflow-lane {
        min-height: 400px;
        padding: 12px;
        background: var(--surface-container);
    }

    .workflow-lane-active {
        background: var(--surface-container-high);
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
        color: var(--on-surface-dim);
    }

    .lane-copy {
        margin: 0 0 8px;
        color: var(--on-surface-dim);
        font-size: 11px;
    }

    .workflow-card {
        padding: 12px;
        background: var(--surface-raised);
        box-shadow: var(--ghost-border);
        cursor: grab;
        font-size: 12px;
        transition: background 100ms;
    }

    .workflow-card + .workflow-card { margin-top: 6px; }
    .workflow-card:hover { background: var(--surface-container); }

    /* Memory view */
    .memory-field-shell {
        min-height: 420px;
        background: var(--surface);
        background-image: radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
        background-size: 24px 24px;
        padding: 12px;
    }

    .memory-field {
        position: relative;
        min-height: 380px;
        background: var(--surface);
        overflow: hidden;
    }

    .memory-point-core {
        display: block;
        width: 14px;
        height: 14px;
        background: var(--primary);
        opacity: 0.7;
        transition: opacity 150ms;
    }

    .memory-point:hover .memory-point-core {
        opacity: 1;
        box-shadow: 0 0 8px rgba(239, 103, 69, 0.5);
    }

    .memory-point-label {
        position: absolute;
        top: 18px;
        left: -6px;
        padding: 2px 6px;
        background: var(--surface-container);
        color: var(--on-surface);
        font-family: var(--mono);
        font-size: 10px;
        white-space: nowrap;
    }

    .memory-stat-card,
    .memory-detail-card {
        padding: 12px 14px;
        background: var(--surface-container);
        box-shadow: var(--ghost-border);
    }

    .memory-stat-value {
        display: block;
        margin-top: 4px;
        font-size: 20px;
        line-height: 1;
        font-family: var(--mono);
        color: var(--on-surface);
    }

    .memory-json {
        margin: 0;
        padding: 12px 14px;
        background: var(--surface);
        color: var(--mint);
        font-family: var(--mono);
        font-size: 10px;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow: auto;
    }

    /* Status helpers */
    .status-running, .status-completed { background: var(--success-container); color: var(--success); }
    .status-queued, .status-pending { background: var(--surface-container-high); color: var(--on-surface-dim); }
    .status-failed, .status-blocked { background: var(--error-container); color: var(--error); }

    /* Catalog (legacy) */
    .catalog-search {
        width: 100%;
        padding: 12px 14px;
        border: none;
        border-bottom: 1px solid var(--surface-border);
        background: var(--surface-container);
        color: var(--on-surface);
        font-size: 13px;
        outline: none;
    }

    .catalog-search:focus { border-bottom-color: var(--primary); }

    .catalog-item {
        width: 100%;
        padding: 14px 16px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: transparent;
        border: none;
        text-align: left;
        border-bottom: 1px solid var(--surface-border);
        transition: background 100ms;
    }

    .catalog-item:hover { background: var(--surface-container); }
    .catalog-item-active { background: var(--primary-container); }

    .catalog-item-name { font-size: 13px; font-weight: 600; color: var(--on-surface); }
    .catalog-item-desc { font-size: 12px; color: var(--on-surface-dim); margin: 0; }
    .catalog-item-type {
        display: inline-block;
        padding: 1px 6px;
        background: var(--surface-container-high);
        color: var(--on-surface-dim);
        font-family: var(--mono);
        font-size: 9px;
        text-transform: uppercase;
    }

    .catalog-detail { padding: 20px; }
    .catalog-detail-title { font-size: 18px; font-weight: 700; color: var(--on-surface); margin: 0; display: inline; }
    .catalog-detail-badge {
        display: inline-block;
        padding: 2px 8px;
        background: var(--surface-container-high);
        color: var(--on-surface-dim);
        font-family: var(--mono);
        font-size: 10px;
        text-transform: uppercase;
        margin-left: 8px;
        vertical-align: middle;
    }
    .catalog-detail-desc { font-size: 13px; color: var(--on-surface-dim); margin: 12px 0 20px; }
    .catalog-detail-section { margin-bottom: 16px; }
    .catalog-detail-section-title {
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--on-surface);
        margin: 0 0 8px;
    }
    .catalog-code-block {
        padding: 14px;
        background: var(--surface);
        color: var(--mint);
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.7;
        overflow-x: auto;
    }

    /* Nav button (legacy sidebar support) */
    .nav-button {
        width: 100%;
        border: none;
        background: transparent;
        color: var(--on-surface-dim);
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 12px;
        transition: background 100ms, color 100ms;
    }

    .nav-button:hover { background: var(--surface-container); color: var(--on-surface); }
    .nav-button-active { background: var(--primary-container); color: var(--primary); }

    .nav-icon { flex-shrink: 0; width: 20px; text-align: center; font-size: 14px; }
    .nav-label { font-size: 12px; font-weight: 500; font-family: var(--sans); }
    .nav-count {
        min-width: 22px;
        padding: 1px 5px;
        background: var(--surface-container-high);
        color: var(--on-surface-faint);
        font-family: var(--mono);
        font-size: 10px;
        text-align: center;
        flex-shrink: 0;
    }

    .nav-button-active .nav-icon,
    .nav-button-active .nav-label { color: var(--primary); }
    .nav-button-active .nav-count { background: var(--primary-container); color: var(--primary); }

    /* Message bubble (legacy) */
    .message-bubble {
        max-width: 78%;
        padding: 14px 16px;
        margin-bottom: 4px;
    }

    .message-bubble-inbound {
        align-self: flex-start;
        background: var(--surface-container);
    }

    .message-bubble-outbound {
        align-self: flex-end;
        background: var(--primary-container);
    }

    .message-head {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 6px;
    }

    .message-body {
        margin: 6px 0 0;
        white-space: pre-wrap;
        font-size: 13px;
        color: var(--on-surface);
    }

    .message-channel,
    .message-meta {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-dim);
    }

    /* Composer (legacy) */
    .composer {
        display: flex;
        flex-direction: column;
        background: var(--surface-container);
        box-shadow: var(--ghost-border);
    }

    .composer-input {
        width: 100%;
        padding: 14px 16px;
        border: none;
        background: transparent;
        color: var(--on-surface);
        font-size: 13px;
        resize: vertical;
        min-height: 48px;
        outline: none;
    }

    .composer-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        gap: 6px;
    }

    /* Surface/preview (legacy) */
    .surface-preview {
        min-height: 540px;
        background: var(--surface-container);
        padding: 12px;
    }

    .surface-node + .surface-node { margin-top: 8px; }

    /* Dimension strip (memory view) */
    .dimension-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(14px, 1fr));
        gap: 4px;
        align-items: end;
        min-height: 140px;
        padding: 10px 0 4px;
    }

    .dimension-bar {
        width: 100%;
        min-height: 2px;
        background: linear-gradient(90deg, var(--primary), #ff7a5c);
    }

    .dimension-index {
        color: var(--on-surface-faint);
        font-family: var(--mono);
        font-size: 9px;
        writing-mode: vertical-rl;
    }

    /* Progress bars */
    .progress-track {
        height: 2px;
        background: var(--surface-container-high);
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary), #ff7a5c);
        transition: width 300ms ease;
    }
    /* ================================================================
       NEW: Adaptive sidebar components
       ================================================================ */

    .sidebar-scroll {
        flex: 1;
        overflow-y: auto;
        padding: 0 4px;
    }

    .sidebar-search-wrap {
        padding: 4px 12px 8px;
    }

    .sidebar-search {
        width: 100%;
        padding: 6px 10px;
        font-size: 12px;
        font-family: var(--sans);
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        color: var(--surface);
        outline: none;
        border-radius: 0;
    }

    .sidebar-search:focus {
        border-color: var(--primary-container);
    }

    .sidebar-search::placeholder {
        color: rgba(255, 255, 255, 0.25);
    }

    .sidebar-group {
        padding: 2px 0 6px;
    }

    .sidebar-group-label {
        padding: 8px 12px 4px;
        font-family: var(--mono);
        font-size: 9px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.30);
        text-transform: uppercase;
        letter-spacing: 0.10em;
        margin: 0;
    }

    .sidebar-empty {
        padding: 16px 12px;
        text-align: center;
    }

    .sidebar-empty p {
        color: rgba(255, 255, 255, 0.30);
        font-size: 12px;
        margin: 0;
    }

    .sidebar-empty-hint {
        color: rgba(255, 255, 255, 0.20) !important;
        font-size: 11px !important;
        margin-top: 4px !important;
    }

    .sidebar-item-body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
    }

    .sidebar-item-sub {
        font-size: 10px;
        font-family: var(--mono);
        color: rgba(255, 255, 255, 0.25);
    }

    .sidebar-item-dim {
        opacity: 0.6;
    }

    /* Saturn nav buttons */
    .sidebar-nav-section {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 8px 4px;
    }

    .sidebar-nav-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 9px 12px;
        border: none;
        background: transparent;
        color: var(--tertiary-container);
        cursor: pointer;
        font-size: 13px;
        font-family: var(--sans);
        text-align: left;
        transition: background 100ms, color 100ms;
    }

    .sidebar-nav-btn:hover {
        background: rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.90);
    }

    .sidebar-nav-btn-active {
        background: rgba(170, 54, 24, 0.12);
        color: #EF6745;
    }

    .sidebar-nav-btn-active:hover {
        background: rgba(170, 54, 24, 0.18);
    }

    .sidebar-nav-label {
        flex: 1;
    }

    .sidebar-badge {
        min-width: 18px;
        padding: 1px 5px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.40);
        font-family: var(--mono);
        font-size: 10px;
        text-align: center;
        flex-shrink: 0;
    }

    .sidebar-badge-warn {
        background: rgba(170, 54, 24, 0.15);
        color: #EF6745;
    }

    /* Sidebar error */
    .sidebar-error {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        margin: 0 8px 4px;
        background: rgba(170, 54, 24, 0.15);
    }

    .sidebar-error p {
        margin: 0;
        color: #EF6745;
        font-size: 11px;
        flex: 1;
    }

    .sidebar-error-dismiss {
        border: none;
        background: transparent;
        color: #EF6745;
        cursor: pointer;
        padding: 2px;
        display: grid;
        place-items: center;
    }

    /* Status dots */
    .status-dot {
        width: 6px;
        height: 6px;
        flex-shrink: 0;
    }

    .status-dot-active {
        background: #4ade80;
        animation: pulse 2s ease-in-out infinite;
    }

    .status-dot-scheduled {
        background: var(--tertiary);
    }

    .status-dot-complete {
        background: rgba(255, 255, 255, 0.20);
    }

    .status-dot-failed {
        background: var(--primary);
    }

    /* View content wrapper (fade-in transitions) */
    .view-content {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        animation: fade-in 150ms ease;
    }

    .view-empty {
        margin: 40px 24px;
    }

    /* Icon base styles */
    .icon {
        display: inline-block;
        vertical-align: middle;
        flex-shrink: 0;
    }

    .icon-spin {
        animation: spin 1s linear infinite;
    }

    /* ================================================================
       NEW: Chat view (single column, no embedded sidebar)
       ================================================================ */

    .chat-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .chat-view .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .chat-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 12px;
        text-align: center;
        padding: 40px;
    }

    .chat-empty-title {
        font-size: 20px;
        font-weight: 600;
        color: var(--on-surface);
        margin: 0;
        font-family: var(--sans);
    }

    .chat-empty-sub {
        font-size: 13px;
        color: var(--on-surface-variant);
        margin: 0;
    }

    .chat-view .chat-composer {
        border-top: 1px solid rgba(224, 191, 184, 0.12);
        padding: 12px 24px;
        flex-shrink: 0;
    }

    .chat-view .chat-composer-input {
        width: 100%;
        min-height: 48px;
        max-height: 200px;
        padding: 10px 14px;
        font-size: 13px;
        font-family: var(--sans);
        border: 1px solid var(--outline-variant);
        background: var(--surface-container-lowest);
        color: var(--on-surface);
        resize: none;
        outline: none;
        border-radius: 0;
    }

    .chat-view .chat-composer-input:focus {
        border-color: var(--primary);
    }

    .chat-view .chat-composer-input:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .chat-composer-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 8px;
    }

    .chat-composer-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .chat-composer-hint {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-variant);
        opacity: 0.5;
    }

    .chat-error {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 24px;
        background: rgba(170, 54, 24, 0.06);
        border-top: 1px solid rgba(224, 191, 184, 0.12);
        flex-shrink: 0;
    }

    .chat-error-text {
        flex: 1;
        color: var(--primary);
        font-size: 12px;
        margin: 0;
    }

    .chat-error-dismiss {
        border: none;
        background: transparent;
        color: var(--primary);
        font-size: 11px;
        font-family: var(--mono);
        cursor: pointer;
        padding: 4px 8px;
    }

    .chat-error-dismiss:hover {
        background: rgba(170, 54, 24, 0.08);
    }

    /* ================================================================
       NEW: Task view (composer at bottom)
       ================================================================ */

    .task-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .task-view-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .task-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
        gap: 12px;
        text-align: center;
        padding: 40px;
    }

    .task-empty-title {
        font-size: 20px;
        font-weight: 600;
        color: var(--on-surface);
        margin: 0;
    }

    .task-empty-sub {
        font-size: 13px;
        color: var(--on-surface-variant);
        margin: 0;
    }

    .task-empty-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        margin-top: 8px;
        max-width: 600px;
    }

    .task-view .task-composer {
        border-top: 1px solid rgba(224, 191, 184, 0.12);
        padding: 12px 24px;
        flex-shrink: 0;
        background: var(--surface-container-lowest);
    }

    /* ================================================================
       NEW: Shared component styles
       ================================================================ */

    /* Error banner */
    .error-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: rgba(170, 54, 24, 0.06);
        border-bottom: 1px solid rgba(224, 191, 184, 0.12);
        flex-shrink: 0;
    }

    .error-banner-text {
        flex: 1;
        color: var(--primary);
        font-size: 12px;
        margin: 0;
    }

    .error-banner-dismiss {
        border: none;
        background: transparent;
        color: var(--primary);
        font-size: 11px;
        font-family: var(--mono);
        cursor: pointer;
        padding: 4px 8px;
    }

    .error-banner-dismiss:hover {
        background: rgba(170, 54, 24, 0.08);
    }

    /* Agent badge */
    .agent-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--primary);
        background: rgba(170, 54, 24, 0.08);
    }

    /* Stage pipeline (horizontal 7-stage bar) */
    .stage-pipeline {
        display: flex;
        gap: 2px;
    }

    .stage-pip {
        flex: 1;
        padding: 4px 0;
        text-align: center;
        background: var(--surface-container);
        transition: background 150ms;
    }

    .stage-pip-done {
        background: var(--tertiary-container);
    }

    .stage-pip-active {
        background: var(--primary);
    }

    .stage-pip-active .stage-pip-label {
        color: var(--on-primary);
    }

    .stage-pip-label {
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--on-surface-variant);
    }

    .stage-pip-done .stage-pip-label {
        color: var(--tertiary);
    }

    /* Run card */
    .run-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        padding: 10px 16px;
        border: none;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 100ms;
    }

    .run-card:hover {
        background: var(--surface-container-low);
    }

    .run-card-active {
        background: rgba(170, 54, 24, 0.04);
    }

    .run-card .status-dot {
        margin-top: 5px;
    }

    .run-card-body {
        flex: 1;
        min-width: 0;
    }

    .run-card-goal {
        font-size: 13px;
        font-weight: 500;
        color: var(--on-surface);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .run-card-meta {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-variant);
        margin: 2px 0 0;
    }

    .run-card-right {
        flex-shrink: 0;
    }

    .run-card-stage {
        font-size: 10px;
        font-family: var(--mono);
        color: var(--on-surface-variant);
    }

    /* Approval card */
    .approval-card {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(224, 191, 184, 0.08);
    }

    .approval-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 4px;
    }

    .approval-card-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--on-surface);
    }

    .approval-card-meta {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-variant);
        margin: 0;
    }

    .approval-card-detail {
        font-size: 12px;
        color: var(--on-surface-variant);
        margin: 4px 0 0;
    }

    .approval-card-actions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
    }

    /* Tool call card (collapsible) */
    .tool-call-card {
        border: 1px solid rgba(224, 191, 184, 0.12);
        margin-top: 6px;
        overflow: hidden;
    }

    .tool-call-card-head {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 6px 10px;
        border: none;
        background: var(--surface-container-low);
        cursor: pointer;
        text-align: left;
        font: inherit;
        transition: background 100ms;
    }

    .tool-call-card-head:hover {
        background: var(--surface-container);
    }

    .tool-call-card-name {
        font-size: 11px;
        font-weight: 500;
        color: var(--on-surface);
        flex: 1;
    }

    .tool-call-card-chevron {
        font-size: 10px;
        color: var(--on-surface-variant);
        font-family: var(--mono);
    }

    .tool-call-card-body {
        padding: 8px 10px;
        background: var(--surface-container-lowest);
        border-top: 1px solid rgba(224, 191, 184, 0.08);
    }

    .tool-call-card-output {
        font-size: 11px;
        font-family: var(--mono);
        color: var(--on-surface-variant);
        margin: 0;
        white-space: pre-wrap;
        line-height: 1.6;
    }

    /* Markdown body styles */
    .markdown-body {
        font-size: 13px;
        line-height: 1.7;
        color: var(--on-surface);
    }

    .markdown-body .md-p {
        margin: 0 0 8px;
    }

    .markdown-body .md-heading {
        margin: 16px 0 8px;
        font-family: var(--sans);
        font-weight: 600;
        color: var(--on-surface);
    }

    .markdown-body h1.md-heading { font-size: 18px; }
    .markdown-body h2.md-heading { font-size: 15px; }
    .markdown-body h3.md-heading { font-size: 14px; }
    .markdown-body h4.md-heading { font-size: 13px; }

    .markdown-body .md-code-block {
        margin: 8px 0;
        padding: 12px 14px;
        background: var(--on-surface);
        color: var(--surface-container-lowest);
        font-family: var(--mono);
        font-size: 12px;
        line-height: 1.6;
        overflow-x: auto;
        border-radius: 0;
    }

    .markdown-body .md-code-block code {
        font-family: inherit;
        font-size: inherit;
    }

    .markdown-body .md-inline-code {
        padding: 1px 5px;
        background: var(--surface-container);
        font-family: var(--mono);
        font-size: 12px;
        color: var(--primary);
    }

    .markdown-body .md-list {
        margin: 4px 0 8px 20px;
        padding: 0;
    }

    .markdown-body .md-list li {
        margin: 2px 0;
    }

    .markdown-body .md-blockquote {
        margin: 8px 0;
        padding: 8px 14px;
        border-left: 3px solid var(--primary);
        background: rgba(170, 54, 24, 0.04);
        color: var(--on-surface-variant);
    }

    .markdown-body strong {
        font-weight: 600;
        color: var(--on-surface);
    }

    .markdown-body em {
        font-style: italic;
    }

    /* ── RL Pipeline Components ────────────────────────────────── */

    .quality-gauge {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .quality-gauge-label {
        display: flex;
        align-items: baseline;
        gap: 8px;
    }

    .quality-gauge-score {
        font: 600 14px/1 var(--mono);
        color: var(--on-surface);
    }

    .quality-gauge-delight {
        font: 500 10px/1 var(--mono);
        color: var(--primary);
        letter-spacing: 0.02em;
    }

    .quality-gauge-track {
        height: 6px;
        width: 100%;
        overflow: hidden;
    }

    .quality-gauge-fill {
        height: 100%;
        transition: width 0.3s ease;
    }

    .sparkline {
        display: inline-block;
        vertical-align: middle;
    }

    .sparkline-empty {
        font: 400 12px/1 var(--mono);
        color: var(--on-surface-faint);
    }

    .feedback-buttons {
        display: inline-flex;
        gap: 2px;
        margin-left: 8px;
        opacity: 0;
        transition: opacity 0.15s;
    }

    .chat-msg:hover .feedback-buttons {
        opacity: 1;
    }

    .feedback-btn {
        background: none;
        border: 1px solid var(--surface-border);
        color: var(--on-surface-faint);
        font: 500 11px/1 var(--mono);
        padding: 2px 6px;
        cursor: pointer;
        transition: all 0.1s;
    }

    .feedback-btn:hover {
        color: var(--success);
        border-color: var(--success);
    }

    .feedback-btn-down:hover {
        color: var(--error);
        border-color: var(--error);
    }

    .feedback-btn-active {
        color: var(--on-primary);
        background: var(--success);
        border-color: var(--success);
    }

    .feedback-btn-active.feedback-btn-down {
        background: var(--error);
        border-color: var(--error);
    }

    .training-buffer-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        font: 600 10px/1 var(--mono);
        color: var(--on-primary);
        background: var(--primary);
        letter-spacing: 0.02em;
    }

    .sidebar-learning {
        padding: 8px 12px;
        border-left: 2px solid var(--primary);
        margin: 4px 0;
    }

    .sidebar-learning-agent {
        font: 600 10px/1 var(--mono);
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .sidebar-learning-text {
        font: 400 11px/1.4 var(--sans);
        color: var(--on-surface-dim);
        margin: 4px 0 0;
    }

    /* Platform connectors */
    .ops-connectors { margin-top: 8px; }
    .ops-section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--on-surface-variant); margin-bottom: 6px; }
    .connector-grid { display: flex; gap: 8px; flex-wrap: wrap; }
    .connector-chip { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 12px; background: var(--surface-container); color: var(--on-surface-variant); opacity: 0.5; transition: opacity 0.2s; }
    .connector-active { opacity: 1; background: var(--surface-container-high); color: var(--on-surface); }
    .connector-icon { font-size: 14px; }
    .connector-name { font-weight: 500; text-transform: capitalize; }
    .connector-count { font-size: 10px; background: var(--tertiary-container); color: var(--on-tertiary-container); padding: 0 5px; border-radius: 10px; font-weight: 600; }

/* RL Dashboard */
.rl-dashboard { display: flex; flex-direction: column; gap: 16px; padding: 16px; height: 100%; overflow-y: auto; }
.rl-stats { display: flex; gap: 12px; flex-wrap: wrap; }
.rl-stat { background: var(--surface-container); border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 120px; }
.rl-stat-label { font-size: 11px; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; }
.rl-stat-value { font-size: 24px; font-weight: 600; color: var(--on-surface); }
.rl-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1; min-height: 0; }
.rl-panel { background: var(--surface-container); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.rl-panel-head { padding: 12px 16px; border-bottom: 1px solid var(--outline-variant); font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
.rl-panel-body { flex: 1; overflow-y: auto; padding: 8px; }
.rl-score-row { padding: 8px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; }
.rl-score-row:hover { background: var(--surface-container-high); }
.rl-score-row-selected { background: var(--surface-container-highest); }
.rl-score-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--on-surface-variant); }
.rl-score-bar { height: 4px; border-radius: 2px; margin-top: 4px; }
.rl-score-detail { padding: 12px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.rl-score-detail dt { color: var(--on-surface-variant); }
.rl-score-detail dd { font-weight: 500; margin: 0; }
.rl-signal-grid { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.rl-signal { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.rl-signal-pass { background: var(--tertiary-container); color: var(--on-tertiary-container); }
.rl-signal-fail { background: #fdd; color: #a00; }
.rl-signal-null { background: var(--surface-container-high); color: var(--on-surface-variant); }
.rl-buffer-row { padding: 8px 12px; border-radius: 6px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.rl-buffer-consumed { opacity: 0.5; }
.rl-cluster-group { margin-bottom: 12px; }
.rl-cluster-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--on-surface-variant); padding: 4px 12px; }
.rl-reasoning { margin-top: 8px; padding: 8px; background: var(--surface-container); border-radius: 6px; font-size: 12px; color: var(--on-surface-variant); white-space: pre-wrap; }
.rl-platform-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: var(--surface-container-highest); }

/* Channel color system — orbital palette tones */
.channel-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; border: 2px solid transparent; }
.channel-web { background: var(--primary); border-color: var(--primary); }
.channel-slack { background: #4A154B; border-color: #4A154B; }
.channel-discord { background: #5865F2; border-color: #5865F2; }
.channel-telegram { background: #229ED9; border-color: #229ED9; }
.channel-github { background: #24292F; border-color: #24292F; }

/* Channel border on sidebar items */
.sidebar-item { display: flex; align-items: center; gap: 8px; }
.sidebar-item .channel-dot { margin-right: 2px; }

/* Chat message channel indicator */
.chat-channel-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.chat-channel-badge.channel-web { background: rgba(170, 54, 24, 0.1); color: var(--primary); }
.chat-channel-badge.channel-slack { background: rgba(74, 21, 75, 0.1); color: #4A154B; }
.chat-channel-badge.channel-discord { background: rgba(88, 101, 242, 0.1); color: #5865F2; }
.chat-channel-badge.channel-telegram { background: rgba(34, 158, 217, 0.1); color: #229ED9; }
.chat-channel-badge.channel-github { background: rgba(36, 41, 47, 0.1); color: #24292F; }

/* Chat message actor line */
.chat-actor { font-size: 11px; font-weight: 600; color: var(--on-surface-variant); margin-bottom: 2px; display: flex; align-items: center; gap: 6px; }
.chat-user-id { font-size: 10px; font-weight: 400; color: var(--on-surface-faint); }
"#;


