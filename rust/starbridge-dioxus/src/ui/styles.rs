pub const APP_STYLES: &str = r#"
    :root {
        color-scheme: dark;
        --bg-canvas: #101111;
        --bg-sidebar: #151715;
        --bg-sidebar-2: #121412;
        --bg-topbar: rgba(17, 19, 17, 0.94);
        --bg-panel: rgba(22, 24, 22, 0.98);
        --bg-panel-strong: rgba(29, 32, 28, 0.98);
        --bg-elevated: rgba(35, 39, 33, 0.98);
        --bg-hover: rgba(208, 227, 201, 0.06);
        --border: rgba(211, 225, 207, 0.16);
        --border-strong: rgba(211, 225, 207, 0.3);
        --text: #e8eee2;
        --text-strong: #f8fbf2;
        --muted: #98a292;
        --accent: #d7e5cf;
        --accent-soft: rgba(215, 229, 207, 0.08);
        --success: #cbe1c1;
        --warn: #ff7a4d;
        --danger: #ff7a4d;
        --signal: #ff7a4d;
        --signal-soft: rgba(255, 122, 77, 0.16);
        --mono: "JetBrains Mono", "SFMono-Regular", "Cascadia Code", monospace;
        --sans: "Inter", "SF Pro Display", system-ui, sans-serif;
        --shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
    }

    * {
        box-sizing: border-box;
    }

    html, body, #main {
        margin: 0;
        height: 100%;
        min-height: 100%;
        background:
            linear-gradient(rgba(215, 229, 207, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(215, 229, 207, 0.03) 1px, transparent 1px),
            linear-gradient(180deg, #121412 0%, #0e100f 100%);
        background-size: 28px 28px, 28px 28px, auto;
        color: var(--text);
        font-family: var(--sans);
        font-size: 13px;
        line-height: 1.5;
    }

    body {
        overflow: hidden;
    }

    button,
    textarea {
        font: inherit;
    }

    .app-shell {
        display: grid;
        grid-template-columns: 292px minmax(0, 1fr);
        height: 100vh;
        max-height: 100vh;
        min-height: 0;
        overflow: hidden;
    }

    .sidebar {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 18px 14px;
        border-right: 1px solid var(--border);
        background: linear-gradient(180deg, var(--bg-sidebar) 0%, var(--bg-sidebar-2) 100%);
        overflow-y: auto;
    }

    .sidebar-brand {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        padding: 8px 6px 18px;
        border-bottom: 1px solid var(--border);
    }

    .brand-mark {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 6px;
        border: 1px solid rgba(255, 122, 77, 0.4);
        background: linear-gradient(180deg, rgba(255, 122, 77, 0.16) 0%, rgba(255, 122, 77, 0.08) 100%);
        color: var(--signal);
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    .sidebar-eyebrow,
    .section-eyebrow,
    .topbar-eyebrow {
        margin: 0;
        color: var(--accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .sidebar-title {
        margin: 4px 0 6px;
        color: var(--text-strong);
        font-size: 19px;
        line-height: 1.15;
    }

    .sidebar-copy,
    .nav-detail,
    .metric-detail,
    .topbar-subtitle,
    .list-item-copy,
    .row-copy,
    .empty-state p,
    .callout p,
    .composer-help,
    .message-meta {
        margin: 0;
        color: var(--muted);
    }

    .sidebar-section {
        margin: 4px 6px 0;
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }

    .sidebar-nav,
    .list-stack,
    .panel-stack,
    .inspector-stack,
    .surface-node-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .nav-button,
    .list-item {
        width: 100%;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 12px 14px;
        background: transparent;
        color: var(--text);
        text-align: left;
        cursor: pointer;
        transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
    }

    .nav-button:hover,
    .list-item:hover {
        border-color: var(--border-strong);
        background: rgba(255, 255, 255, 0.02);
    }

    .nav-button-active,
    .list-item-active {
        border-color: rgba(255, 122, 77, 0.36);
        background: var(--accent-soft);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
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
        gap: 10px;
    }

    .nav-label,
    .list-item-title,
    .card-title,
    .topbar-title,
    .empty-state h3 {
        color: var(--text-strong);
        font-weight: 650;
    }

    .nav-count {
        min-width: 28px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: var(--muted);
        font-family: var(--mono);
        font-size: 11px;
        text-align: center;
    }

    .sidebar-metrics {
        display: grid;
        gap: 10px;
    }

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
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(28, 31, 27, 0.98) 0%, rgba(18, 20, 18, 1) 100%);
        box-shadow: var(--shadow);
    }

    .metric-tile,
    .inspector-card,
    .row-card,
    .surface-node,
    .document-viewer {
        padding: 18px 18px 16px;
    }

    .metric-value,
    .surface-node-value {
        font-size: 24px;
        line-height: 1;
        letter-spacing: -0.03em;
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
        align-items: flex-end;
        justify-content: space-between;
        gap: 18px;
        padding: 18px 24px 16px;
        border-bottom: 1px solid var(--border);
        background: var(--bg-topbar);
        backdrop-filter: blur(8px);
    }

    .topbar-title {
        margin: 6px 0 6px;
        font-size: 32px;
        letter-spacing: -0.04em;
    }

    .topbar-meta,
    .chip-row,
    .sidebar-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .page-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 20px 24px 24px;
    }

    .page-grid {
        display: grid;
        gap: 20px;
        align-items: start;
        min-width: 0;
        min-height: 100%;
    }

    .page-grid-overview {
        grid-template-columns: 340px minmax(0, 1fr) 340px;
    }

    .page-grid-chat {
        grid-template-columns: 320px minmax(0, 1fr) 340px;
    }

    .page-grid-workflow {
        grid-template-columns: minmax(0, 1fr) 340px;
    }

    .page-grid-surfaces {
        grid-template-columns: 440px minmax(0, 1fr) 320px;
    }

    .page-grid-surfaces.preview-only {
        grid-template-columns: minmax(0, 1fr) 320px;
    }

    .page-grid-memory {
        grid-template-columns: 340px minmax(0, 1fr) 360px;
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
        padding: 18px 20px;
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
        gap: 12px;
        flex-wrap: wrap;
    }

    .segmented {
        display: inline-flex;
        padding: 4px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.03);
        gap: 4px;
    }

    .segmented-button,
    .secondary-button,
    .primary-button {
        border-radius: 4px;
        border: 1px solid transparent;
        padding: 9px 12px;
        cursor: pointer;
        transition: background 0.18s ease, border-color 0.18s ease;
    }

    .segmented-button {
        background: transparent;
        color: var(--muted);
    }

    .segmented-button-active {
        border-color: rgba(255, 122, 77, 0.3);
        background: var(--accent-soft);
        color: var(--text);
    }

    .primary-button {
        border-color: rgba(255, 122, 77, 0.3);
        background: rgba(255, 122, 77, 0.14);
        color: var(--text-strong);
    }

    .primary-button:hover {
        background: rgba(255, 122, 77, 0.2);
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
        padding: 5px 10px;
        border-radius: 4px;
        border: 1px solid var(--border);
        color: var(--text);
        font-family: var(--mono);
        font-size: 11px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
    }

    .pill-live,
    .pill-accent {
        border-color: rgba(215, 229, 207, 0.28);
        background: rgba(215, 229, 207, 0.08);
        color: #eff7ea;
    }

    .pill-success {
        border-color: rgba(203, 225, 193, 0.24);
        background: rgba(203, 225, 193, 0.08);
        color: #eef8e8;
    }

    .pill-warn {
        border-color: rgba(255, 122, 77, 0.3);
        background: rgba(255, 122, 77, 0.14);
        color: #ffd9cb;
    }

    .pill-danger {
        border-color: rgba(255, 122, 77, 0.3);
        background: rgba(255, 122, 77, 0.14);
        color: #ffd9cb;
    }

    .pill-subtle {
        background: rgba(255, 255, 255, 0.03);
        color: var(--muted);
    }

    .detail-hero {
        padding: 22px 22px 18px;
    }

    .detail-summary {
        margin: 8px 0 0;
        color: var(--muted);
        max-width: 70ch;
    }

    .list-item-meta,
    .thread-sub,
    .message-channel,
    .row-copy,
    .message-meta {
        color: var(--muted);
        font-size: 12px;
    }

    .detail-body,
    .chat-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .message-stream {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
        max-height: 100%;
        overflow-y: auto;
    }

    .message-bubble {
        max-width: 78%;
        padding: 14px 16px 12px;
    }

    .message-bubble-inbound {
        align-self: flex-start;
        border-bottom-left-radius: 8px;
    }

    .message-bubble-outbound {
        align-self: flex-end;
        border-color: rgba(138, 164, 255, 0.24);
        background: linear-gradient(180deg, rgba(26, 38, 68, 0.96) 0%, rgba(16, 25, 46, 0.98) 100%);
        border-bottom-right-radius: 8px;
    }

    .message-body {
        margin: 8px 0 0;
        white-space: pre-wrap;
    }

    .composer {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    textarea {
        width: 100%;
        min-height: 148px;
        resize: vertical;
        border: 1px solid var(--border);
        border-radius: 16px;
        background: rgba(3, 8, 18, 0.55);
        color: var(--text);
        padding: 14px 16px;
        outline: none;
    }

    textarea:focus {
        border-color: rgba(138, 164, 255, 0.35);
        box-shadow: 0 0 0 1px rgba(138, 164, 255, 0.2);
    }

    .workflow-board {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(240px, 1fr);
        gap: 16px;
        overflow: auto;
        padding-bottom: 4px;
    }

    .workflow-lane {
        min-height: 520px;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(24, 27, 24, 0.98) 0%, rgba(17, 19, 17, 1) 100%);
    }

    .workflow-lane-active {
        border-color: rgba(255, 122, 77, 0.3);
        background: linear-gradient(180deg, rgba(32, 30, 26, 0.98) 0%, rgba(18, 19, 17, 1) 100%);
    }

    .lane-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
    }

    .lane-copy {
        margin: 0 0 14px;
        color: var(--muted);
        font-size: 12px;
    }

    .workflow-card {
        padding: 14px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.03);
        cursor: grab;
    }

    .workflow-card + .workflow-card {
        margin-top: 10px;
    }

    .workflow-card:active {
        cursor: grabbing;
    }

    .editor-body,
    .preview-body,
    .document-body {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .code-block,
    .document-content {
        margin: 0;
        padding: 14px 16px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: rgba(12, 14, 12, 0.92);
        color: #edf3e8;
        white-space: pre-wrap;
        overflow: auto;
        font-family: var(--mono);
        font-size: 12px;
        line-height: 1.65;
    }

    .surface-preview {
        min-height: 540px;
        border-radius: 8px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(24, 27, 24, 0.98) 0%, rgba(17, 19, 17, 1) 100%);
        padding: 18px;
    }

    .surface-node + .surface-node,
    .callout + .surface-node,
    .surface-node + .callout {
        margin-top: 12px;
    }

    .surface-node-metric {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
    }

    .simple-list,
    .key-value-list {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .key-value-list li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        color: var(--muted);
    }

    .key-value-list strong {
        color: var(--text);
        font-weight: 600;
    }

    .callout {
        padding: 14px 16px;
        border-radius: 6px;
        border: 1px solid var(--border);
    }

    .callout strong {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .callout-info {
        border-color: rgba(215, 229, 207, 0.24);
        background: rgba(215, 229, 207, 0.06);
    }

    .callout-info strong { color: var(--accent); }

    .callout-tip {
        border-color: rgba(203, 225, 193, 0.24);
        background: rgba(203, 225, 193, 0.06);
    }

    .callout-tip strong { color: var(--success); }

    .callout-warn {
        border-color: rgba(255, 122, 77, 0.28);
        background: rgba(255, 122, 77, 0.08);
    }

    .callout-warn strong { color: var(--warn); }

    .callout-danger {
        border-color: rgba(255, 122, 77, 0.28);
        background: rgba(255, 122, 77, 0.08);
    }

    .callout-danger strong { color: var(--danger); }

    .empty-state {
        padding: 36px 22px;
        border: 1px dashed var(--border-strong);
        border-radius: 6px;
        text-align: center;
    }

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
        gap: 16px;
    }

    .memory-field-shell {
        min-height: 420px;
        border: 1px solid var(--border);
        background:
            linear-gradient(rgba(215, 229, 207, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(215, 229, 207, 0.05) 1px, transparent 1px),
            linear-gradient(180deg, rgba(29, 32, 28, 0.98) 0%, rgba(18, 20, 18, 1) 100%);
        background-size: 32px 32px, 32px 32px, auto;
        border-radius: 8px;
        padding: 18px;
    }

    .memory-field {
        position: relative;
        min-height: 380px;
        border: 1px solid rgba(215, 229, 207, 0.12);
        background: linear-gradient(180deg, rgba(14, 16, 14, 0.96) 0%, rgba(18, 20, 18, 1) 100%);
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
            linear-gradient(rgba(215, 229, 207, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(215, 229, 207, 0.04) 1px, transparent 1px);
        background-size: 48px 48px;
    }

    .memory-field-axis.axis-x::before,
    .memory-field-axis.axis-y::before {
        content: "";
        position: absolute;
        background: rgba(215, 229, 207, 0.12);
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
        width: 18px;
        height: 18px;
        border: 1px solid rgba(215, 229, 207, 0.5);
        background: rgba(215, 229, 207, 0.18);
        box-shadow: 0 0 0 1px rgba(15, 16, 15, 0.6);
    }

    .memory-point-active .memory-point-core {
        border-color: rgba(255, 122, 77, 0.8);
        background: rgba(255, 122, 77, 0.28);
        box-shadow: 0 0 0 2px rgba(255, 122, 77, 0.14);
    }

    .memory-point-label {
        position: absolute;
        top: 22px;
        left: -8px;
        padding: 2px 6px;
        border: 1px solid rgba(215, 229, 207, 0.14);
        background: rgba(18, 20, 18, 0.92);
        color: var(--text);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.05em;
        white-space: nowrap;
    }

    .memory-query-marker {
        width: 28px;
        height: 28px;
        border: 1px solid rgba(255, 122, 77, 0.6);
        box-shadow: 0 0 0 1px rgba(255, 122, 77, 0.18);
    }

    .memory-query-marker::before,
    .memory-query-marker::after {
        content: "";
        position: absolute;
        background: rgba(255, 122, 77, 0.7);
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

    .memory-stage-stat-grid,
    .memory-detail-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
    }

    .memory-detail-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .memory-stat-card,
    .memory-detail-card {
        padding: 16px;
        border: 1px solid var(--border);
        background: linear-gradient(180deg, rgba(31, 35, 30, 0.98) 0%, rgba(18, 20, 18, 1) 100%);
    }

    .memory-stat-value {
        display: block;
        margin-top: 8px;
        font-size: 32px;
        line-height: 1;
        letter-spacing: -0.05em;
        color: var(--text-strong);
    }

    .dimension-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(18px, 1fr));
        gap: 8px;
        align-items: end;
        min-height: 168px;
        padding: 14px 0 4px;
    }

    .dimension-cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .dimension-bar {
        width: 100%;
        min-height: 8px;
        background: linear-gradient(180deg, rgba(255, 122, 77, 0.92) 0%, rgba(215, 229, 207, 0.72) 100%);
    }

    .dimension-index {
        color: var(--muted);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.04em;
        writing-mode: vertical-rl;
        text-orientation: mixed;
    }

    .memory-json {
        margin: 0;
        padding: 14px 16px;
        border: 1px solid var(--border);
        background: rgba(12, 14, 12, 0.92);
        color: #eef3e9;
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.7;
        white-space: pre-wrap;
        overflow: auto;
    }

    .sidebar-footer {
        margin-top: auto;
        padding: 14px 6px 6px;
        border-top: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .sidebar-footnote {
        margin: 0;
        color: var(--muted);
        font-size: 12px;
    }
"#;
