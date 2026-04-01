# AI Agent Desktop/Native Application UI/UX Research (2026)

Comprehensive analysis of 14 major AI agent and productivity applications, covering layout, navigation, chat patterns, agent features, data inspection, settings, design language, and unique differentiators.

---

## Table of Contents

1. [Claude Desktop (Anthropic)](#1-claude-desktop-anthropic)
2. [ChatGPT Desktop (OpenAI)](#2-chatgpt-desktop-openai)
3. [Cursor (AI IDE)](#3-cursor-ai-ide)
4. [Windsurf (Codeium)](#4-windsurf-codeium)
5. [Devin (Cognition)](#5-devin-cognition)
6. [Factory Droids](#6-factory-droids)
7. [Hermes Agent (Nous Research)](#7-hermes-agent-nous-research)
8. [Warp Terminal](#8-warp-terminal)
9. [Cline / Roo Code](#9-cline--roo-code)
10. [Aider](#10-aider)
11. [Codex CLI (OpenAI)](#11-codex-cli-openai)
12. [Linear](#12-linear)
13. [Raycast](#13-raycast)
14. [Arc Browser](#14-arc-browser)
15. [Cross-Product Pattern Analysis](#15-cross-product-pattern-analysis)

---

## 1. Claude Desktop (Anthropic)

**Product type:** Conversational AI assistant (macOS/Windows/Web)
**URL:** https://claude.ai

### Layout & Navigation

- **Window structure:** Two-column layout. Collapsible left sidebar for conversation history and Projects. Main area is the chat view. Artifacts open as a right-side panel, creating a three-column layout when active.
- **Navigation model:** Sidebar-driven. Projects act as folders containing multiple chat threads and reference documents. Clicking a Project opens a sub-view with all associated chats and uploaded documents.
- **Default view on launch:** Empty chat composer with model selector, ready for input. Sidebar shows recent conversations and Projects.
- **Pages/views:** Chat view, Artifact preview panel, Project detail view, Settings/Preferences modal, API usage dashboard (web).

### Chat/Conversation

- **Chat layout:** Vertically scrolling message thread. User messages right-aligned (or left with indentation), Claude responses left-aligned with the Claude logo avatar. Wide content area with comfortable max-width constraint.
- **Message rendering:** Full markdown with syntax-highlighted code blocks (copy button on hover), LaTeX math rendering, inline images, tables. Long responses have a "Continue" button.
- **Tool calls / function results:** Tool use is displayed inline within the response as collapsible sections showing the tool name and result. MCP tool calls show the server name and tool invoked.
- **Conversation sidebar:** Chronological list of conversations grouped by date (Today, Yesterday, Previous 7 days, etc.). Search bar at top. Projects section above individual conversations.
- **Input/composer:** Multi-line text area with attachment button (files, images), model selector dropdown above the input, and send button. Supports drag-and-drop file uploads. No native @-mention or slash command system in the web/desktop app (those exist in Claude Code CLI).
- **Model/agent selector:** Dropdown at top of composer showing available models (Claude Sonnet 4, Claude Opus 4, Haiku, etc.) with capability badges.
- **Streaming display:** Token-by-token streaming with a pulsing cursor indicator. Artifacts render progressively in the side panel.

### Agent/Automation Features

- **Agent progress/status:** Thinking indicator with animated dots. Tool use steps shown sequentially as they execute. No persistent task queue or timeline.
- **Task management:** Not applicable in the chat app (Claude Code CLI has task management).
- **Approval gates:** None in the chat app. Claude Code CLI has approval for file edits and command execution.
- **Cost/usage tracking:** Usage dashboard in account settings showing token consumption per model tier. Pro/Team plan usage meters.
- **Multi-agent coordination:** Not exposed in the desktop app UI.

### Data & Inspection

- **Logs/history:** Conversation history is the primary audit trail. No dedicated log viewer.
- **Memory/context visualization:** Projects show uploaded documents and their sizes. No token-level context visualization in the UI.
- **File browser / code diff:** Artifacts panel shows rendered output. Code artifacts have a code view and rendered view toggle. No native diff display.

### Settings & Configuration

- **Model selection:** Dropdown in composer area. Plan-gated (some models only on Pro/Team).
- **API key management:** Separate console at console.anthropic.com.
- **Theme/appearance:** Light and dark mode toggle. Clean, minimal theme with no deep customization.
- **Keyboard shortcuts:** Cmd+K for search, Cmd+N for new chat, standard text editing shortcuts.
- **Plugin/extension management:** Not in the desktop app (Claude Code CLI has plugins/skills).

### Design Language

- **Color scheme:** Light mode: white/warm off-white background, dark text. Dark mode: near-black background (#1a1a2e range), light text. Accent color: warm amber/orange for the Claude logo, subtle purple tints for interactive elements.
- **Typography:** Clean sans-serif (likely Inter or a custom Anthropic font). Generous line-height. Code blocks use monospace (likely JetBrains Mono or similar).
- **Border radius:** Medium (8-12px on cards and panels), rounded pill shapes on buttons.
- **Shadows:** Minimal, subtle drop shadows on floating elements. Flat design overall.
- **Icons:** Custom icon set, minimal and geometric.
- **Animations:** Smooth fade-in for messages. Pulsing indicator during streaming. Slide-in for artifacts panel. Subtle and purposeful.
- **Information density:** Low to medium. Generous whitespace. Prioritizes readability over density.

### Unique Differentiators

- **Artifacts:** The live side-panel that renders interactive web apps, documents, SVGs, and code previews inline with the conversation. No other chat product has this level of in-conversation app rendering.
- **Best UX idea:** Artifacts as a persistent, editable workspace next to the chat. Turns a conversation into a collaborative creation environment.

---

## 2. ChatGPT Desktop (OpenAI)

**Product type:** Conversational AI assistant (macOS/Windows/Web)
**URL:** https://chatgpt.com

### Layout & Navigation

- **Window structure:** Two-column layout. Left sidebar for conversation history, Custom GPTs, and search. Main area is the chat. Canvas opens as a right-side panel (similar to Claude's Artifacts).
- **Navigation model:** Sidebar-driven with conversation list. GPT Store is accessible from sidebar. Search (Cmd+K) for finding past conversations.
- **Default view on launch:** Centered chat composer with model selector and greeting text. "What can I help with?" prompt.
- **Pages/views:** Chat view, Canvas panel, GPT Store/Explorer, Custom GPT builder, Settings modal, Voice mode overlay, Image generation view.

### Chat/Conversation

- **Chat layout:** Centered message thread with generous max-width. User messages in a light/dark bubble, assistant messages without a bubble (just text on background). ChatGPT avatar icon on assistant messages.
- **Message rendering:** Markdown with syntax-highlighted code blocks (copy + run buttons). Image generation renders inline. Web search results show as citation cards with source links. Tables, LaTeX math rendering.
- **Tool calls / function results:** Browsing/search results appear as expandable source cards. Code Interpreter shows a collapsible code execution section with input/output. DALL-E image generation appears inline. "View Tools" button between attachment and search buttons shows active tool status.
- **Conversation sidebar:** Chronological list grouped by date. Search bar. Pinned conversations section. Recent and pinned Custom GPTs section below conversations. Folders for organization.
- **Input/composer:** Multi-line text area with attachment button (files, images, audio), web search toggle, voice input button, and send button. @-mention for Custom GPTs. "+" button for quick actions.
- **Model/agent selector:** Simplified model picker at top of composer. Shows reasoning level (e.g., "4o", "o1", "o3") with capability indicators. Plan-gated options grayed out.
- **Streaming display:** Token-by-token with a blinking cursor. Reasoning models show a "Thinking..." phase with expandable reasoning trace before the response.

### Agent/Automation Features

- **Agent progress/status:** "Thinking..." with elapsed time for reasoning models. Tool execution shows step-by-step progress (browsing, code execution).
- **Task management:** No persistent task queue. ChatGPT Tasks (scheduled recurring prompts) accessible from settings.
- **Approval gates:** None for standard use. Code Interpreter runs automatically.
- **Cost/usage tracking:** Usage limits shown in settings. Rate limit warnings inline.
- **Multi-agent coordination:** Not exposed. Custom GPTs are single-agent.

### Data & Inspection

- **Logs/history:** Full conversation history searchable via Cmd+K. Export to JSON available.
- **Memory/context visualization:** "Memory" feature shows stored facts about the user (viewable/editable in settings). No token-level context visualization.
- **File browser / code diff:** Canvas provides a full editing environment for code and documents. Code Interpreter shows file outputs. No native diff view.

### Settings & Configuration

- **Model selection:** Dropdown in composer. "Temporary Chat" toggle for conversations that won't be saved.
- **API key management:** Separate platform at platform.openai.com.
- **Theme/appearance:** System/Light/Dark mode. Minimal customization.
- **Keyboard shortcuts:** Cmd+K search, Cmd+Shift+N new chat, Enter to send.
- **Plugin/extension management:** GPT Store for browsing/installing Custom GPTs. Apps SDK for building ChatGPT apps.

### Design Language

- **Color scheme:** Light mode: clean white with subtle gray borders. Dark mode: deep charcoal (#212121 range). Accent: green (#10a37f) for the ChatGPT logo and primary actions. Subtle teal tints.
- **Typography:** Sans-serif (Soehne or similar). Clean, medium-weight. Monospace for code.
- **Border radius:** Medium (8-12px). Rounded buttons and input fields. Pill-shaped action buttons.
- **Shadows:** Minimal. Card shadows on source citations and floating elements.
- **Icons:** Custom icon set, slightly rounded/friendly style.
- **Animations:** Smooth streaming animation. Reasoning "thinking" animation with pulsing dots. Canvas slide-in transition.
- **Information density:** Low. Very generous spacing. Mobile-first feel even on desktop.

### Unique Differentiators

- **Canvas:** A collaborative editing workspace that pops out for writing and coding projects. Supports inline comments, suggestions, and targeted edits on selected text.
- **Reasoning traces:** The visible "thinking" step for o1/o3 models, showing the reasoning chain before the final answer.
- **Best UX idea:** The simplified model picker that abstracts away model names in favor of capability levels (speed vs. reasoning depth). Makes model selection accessible to non-technical users.

---

## 3. Cursor (AI IDE)

**Product type:** AI-native code editor (fork of VS Code)
**URL:** https://cursor.com

### Layout & Navigation

- **Window structure:** VS Code-derived three-panel layout: left sidebar (file explorer, search, git, extensions), central code editor area with tabs, right sidebar for AI Chat/Composer. Agent mode introduces a dedicated agent-centric layout where agents, plans, and runs are first-class sidebar objects.
- **Navigation model:** File tabs (VS Code style), file explorer tree, Cmd+P fuzzy file finder, breadcrumbs. Agent runs are navigable like tabs/branches.
- **Default view on launch:** Welcome view or last open workspace. File explorer + empty editor + AI sidebar collapsed.
- **Pages/views:** Code editor, AI Chat panel, Composer (inline + full), Diff review, Terminal, Mission Control (agent grid overview), Settings, Extensions marketplace.

### Chat/Conversation

- **Chat layout (Cmd+L):** Right sidebar panel. Conversational thread with user queries and AI responses. Context-aware: automatically includes current file, selection, and referenced files.
- **Message rendering:** Markdown with syntax-highlighted code blocks. Code suggestions show as diffs with accept/reject buttons. File references are clickable.
- **Tool calls / function results:** Agent actions show as expandable steps: file reads, edits, terminal commands. Each step has a status indicator (running, complete, error).
- **Conversation sidebar:** Chat history accessible from the AI panel header. Searchable conversation list.
- **Input/composer:** The Composer (Cmd+I) is the primary interaction mode. It accepts natural language, can reference files with @-mentions (@file, @folder, @codebase, @docs, @web), attach images, and execute multi-file edits. Inline mode appears as a floating input at the cursor position.
- **Model/agent selector:** Model dropdown in the composer header (Claude Sonnet 4, GPT-4o, etc.). "Agent" mode toggle vs. "Normal" and "Ask" modes.
- **Streaming display:** Token-by-token in chat. Diffs appear progressively with green/red highlighting. Inline suggestions appear as ghost text.

### Agent/Automation Features

- **Agent progress/status:** Agent runs show a step-by-step execution log: planning, file reading, editing, command execution. Each step is expandable. Running agents show a live indicator.
- **Mission Control (F3):** Grid view of all active agents, similar to macOS Expose. Each agent card shows its current state, last action, and progress. Enables quick switching between parallel agent sessions.
- **Approval gates:** Configurable. Agents can auto-apply edits or require approval for each file change and terminal command. Diff review before accepting changes.
- **Cost/usage tracking:** Token usage shown per request in the AI panel footer. Monthly usage tracked in settings.
- **Multi-agent coordination:** Run multiple agents in parallel on the same project. Each agent operates in its own context. Mission Control provides the coordination view.

### Data & Inspection

- **Logs/history:** Agent run logs with full action trace. Git integration shows diffs.
- **File browser / code diff:** Full VS Code diff viewer. Composer shows multi-file diffs with accept/reject per file or per hunk. Green/red inline diff highlighting.
- **Context visualization:** @-mentions show which files/folders are in context. Token count indicators.

### Settings & Configuration

- **Model selection:** Settings page with model provider configuration. Multiple providers supported (Anthropic, OpenAI, custom). API key entry per provider.
- **API key management:** Settings > Models. Supports own API keys or Cursor Pro subscription.
- **Theme/appearance:** Full VS Code theme compatibility. Imports themes from Open VSX registry. Dark/light modes.
- **Keyboard shortcuts:** VS Code-compatible. Cmd+L (chat), Cmd+I (composer), Cmd+K (inline edit), F3 (Mission Control), Tab (accept inline suggestion).
- **Plugin/extension management:** VS Code extension marketplace (Open VSX). .cursorrules and .cursor/ directory for project-level AI configuration.

### Design Language

- **Color scheme:** VS Code-inherited. Default dark theme with blue accent tones. Customizable via themes. Agent UI uses branded accent colors.
- **Typography:** VS Code defaults. Editor font customizable (common: JetBrains Mono, Fira Code). UI uses system sans-serif.
- **Border radius:** VS Code standard (small, 4-6px). Agent cards may use larger radius.
- **Shadows:** Minimal, VS Code standard. Floating composer has subtle shadow.
- **Icons:** VS Code Codicons + custom Cursor icons for AI features.
- **Animations:** Smooth diff application. Spring-based layout animations in Mission Control. Ghost text fade-in for inline suggestions.
- **Information density:** High (IDE standard). Code editor maximizes visible lines. Agent panel is more spacious.

### Unique Differentiators

- **Mission Control:** The Expose-like grid view for managing multiple parallel AI agents. No other IDE has this.
- **Inline Composer (Cmd+K):** Floating natural-language input directly at the cursor position in the code editor for targeted edits.
- **Best UX idea:** Mission Control. Treating AI agents as parallel workers you can oversee from a bird's-eye view fundamentally changes the coding workflow from sequential to parallel.

---

## 4. Windsurf (Codeium)

**Product type:** AI-native code editor (VS Code fork)
**URL:** https://windsurf.com

### Layout & Navigation

- **Window structure:** VS Code-derived three-panel layout. Left sidebar (file explorer, search, git), central code editor, right panel houses the "Cascade" AI assistant. New in Wave 13: side-by-side Cascade panes for parallel agent sessions.
- **Navigation model:** File tabs, explorer tree, Cmd+P file finder, breadcrumbs. Cascade panel is toggled with Cmd+Shift+L.
- **Default view on launch:** Home screen panel with quick actions, recent projects, and getting started tips. Then transitions to workspace view.
- **Pages/views:** Code editor, Cascade panel (Chat/Code/Plan/Ask modes), Terminal, Home screen, Settings panel, Extensions marketplace.

### Chat/Conversation

- **Chat layout:** Cascade panel on the right side. Thread-based conversation with the AI. Context-aware with automatic codebase understanding.
- **Message rendering:** Markdown, syntax-highlighted code blocks. File change proposals shown as diffs. Step-by-step execution plans in Plan mode.
- **Tool calls / function results:** Cascade shows each action (file reads, edits, terminal commands) as sequential steps with status indicators. File modifications show as inline diffs.
- **Conversation sidebar:** Cascade history accessible from panel header. Previous sessions listed chronologically.
- **Input/composer:** Text input at bottom of Cascade panel. Supports @-mentions for file references. Attachment support for images/context.
- **Model/agent selector:** Model selector in Cascade panel header. Arena Mode lets users compare models by running the same prompt against different models or curated model groups ("fast models" vs. "smart models"). Admin-controlled model availability for teams.
- **Streaming display:** Token-by-token streaming in Cascade. Real-time context window usage meter in the footer showing how much context is consumed.

### Agent/Automation Features

- **Agent progress/status:** Cascade displays step-by-step progress. Activity tracking shows all user actions (edits, commands, clipboard, terminal) that Cascade monitors to infer intent.
- **Task management:** Plan mode creates structured implementation plans before execution. Plans are reviewable and modifiable.
- **Approval gates:** Code mode executes directly. Plan mode requires approval before transitioning to execution. Configurable autonomy level.
- **Cost/usage tracking:** Context window usage meter in real-time. Credit/token consumption tracked in account settings.
- **Multi-agent coordination:** Wave 13 introduced parallel multi-agent sessions with Git worktrees and side-by-side Cascade panes. Dedicated terminal profile for reliable agent execution.

### Data & Inspection

- **Logs/history:** Cascade conversation history. Git integration for file change tracking.
- **Context visualization:** Real-time context window meter. Shows which files are loaded into Cascade's context.
- **File browser / code diff:** VS Code diff viewer. Cascade shows proposed changes as inline diffs before applying.

### Settings & Configuration

- **Model selection:** Windsurf Settings panel (bottom right) or profile dropdown. Advanced settings for model configuration. Arena Mode for A/B testing models.
- **API key management:** Account-based. Team admins control model access.
- **Theme/appearance:** VS Code theme compatibility. Color theme picker during initial setup. Dark mode default. Imported VS Code themes override defaults.
- **Keyboard shortcuts:** VS Code-compatible. Cmd+Shift+L (focus Cascade), standard editor shortcuts.
- **Plugin/extension management:** VS Code extension compatibility. Windsurf-specific Cascade configuration.

### Design Language

- **Color scheme:** Dark mode by default. Deep charcoal backgrounds. Teal/blue accent colors (Windsurf brand). Light mode available.
- **Typography:** VS Code standard. System sans-serif for UI, monospace for code.
- **Border radius:** VS Code standard (small, 4-6px).
- **Shadows:** Minimal, VS Code standard.
- **Icons:** VS Code Codicons + Windsurf custom icons for Cascade.
- **Animations:** Cascade panel slide-in. Streaming text animation. Context meter fills progressively.
- **Information density:** High (IDE standard). Cascade panel is conversational/medium density.

### Unique Differentiators

- **Cascade's activity awareness:** Tracks all user actions (edits, terminal commands, clipboard, browsing) to infer intent and adapt responses in real-time. No other IDE passively monitors user behavior this comprehensively.
- **Arena Mode:** Built-in A/B model comparison. Pick two models or model groups and compare outputs side by side.
- **Best UX idea:** The real-time context window usage meter. Makes the invisible (context consumption) visible, giving users control over a critical resource.

---

## 5. Devin (Cognition)

**Product type:** Autonomous cloud-based AI software engineer
**URL:** https://devin.ai

### Layout & Navigation

- **Window structure:** Two-panel layout. Left: chat/conversation thread. Right: Workspace with 4 tabbed views — Shell (terminal), Browser (web testing), Editor (code with diffs), Planner (modified files overview). Grid layout alternative shows all 4 workspace views simultaneously.
- **Navigation model:** Tab-based workspace navigation. Session list for managing multiple agent sessions. Timeline scrubber at bottom of workspace to replay agent activity.
- **Default view on launch:** Dashboard showing active/recent sessions, ACU usage, and session creation options.
- **Pages/views:** Dashboard, Session view (chat + workspace), Devin Review (PR review), Settings/Admin, Billing/ACU dashboard, Secrets management.

### Chat/Conversation

- **Chat layout:** Left panel of the session view. Conversational thread between user and Devin. Messages correlate with workspace activity — clicking a chat message scrolls the workspace to the relevant state.
- **Message rendering:** Markdown with code blocks. Devin explains its actions, reasoning, and decisions in natural language.
- **Tool calls / function results:** Actions are visible in the workspace tabs. Shell tab shows terminal output. Browser tab shows web pages Devin visits. Editor tab shows file changes with diffs. All actions are replayable via the timeline scrubber.
- **Conversation sidebar:** Session list on the dashboard. Sessions can be started from Slack, GitHub, or the dashboard.
- **Input/composer:** Chat input at bottom of the left panel. Users can give instructions, course-correct, ask questions, or provide feedback during execution.
- **Model/agent selector:** Not user-configurable — Devin uses its own proprietary model stack.
- **Streaming display:** Real-time updates in workspace tabs as Devin executes. Chat messages appear as Devin reports progress.

### Agent/Automation Features

- **Agent progress/status:** The Planner view shows a structured task list with checkboxes. The timeline scrubber at the bottom of the workspace allows scrubbing through the entire session history to see exactly what Devin did at each step. Previous/Next buttons navigate between actions.
- **Task management:** Structured planning with the Planner tab. Devin breaks tasks into steps, checks them off, and reports status. Multiple sessions can run in parallel.
- **Approval gates:** Devin 2.2 introduced Interactive Planning Checkpoints — surfaces a plan with relevant files before ACUs are consumed. Users modify the plan before committing resources. Code changes are submitted as PRs for human review.
- **Cost/usage tracking:** ACU (Agent Compute Unit) consumption displayed per session and in the dashboard. Auto-recharge limits configurable to prevent runaway costs. $2.00-$2.25 per ACU depending on plan. ACU accounts for VM time, model inference, and networking.
- **Multi-agent coordination:** Devin 2.0 supports running multiple Devin instances simultaneously. Each operates in its own cloud sandbox.

### Data & Inspection

- **Logs/history:** Full session replay via timeline scrubber. Every terminal command, browser visit, and file edit is recorded and replayable.
- **Devin Review:** A dedicated interface for understanding complex PRs. Groups related changes logically, detects copied code and bugs, includes embedded PR chat.
- **File browser / code diff:** Editor tab shows full file diffs. PR review interface shows grouped, annotated diffs.

### Settings & Configuration

- **Model selection:** Not user-configurable (Devin manages its own model stack).
- **API key management:** Secrets manager in the dashboard for injecting environment variables (API keys, credentials) into Devin's sandbox.
- **Theme/appearance:** Web-based dashboard. Standard light/dark mode.
- **Keyboard shortcuts:** Minimal — web-based interface relies on mouse interaction.
- **Plugin/extension management:** GitHub, Slack, Jira integrations. MCP server support for extending Devin's tool access.

### Design Language

- **Color scheme:** Clean white/light gray dashboard. Purple accent color (Cognition brand). Dark mode available.
- **Typography:** Modern sans-serif. Clean and readable.
- **Border radius:** Medium (8-12px). Rounded cards and panels.
- **Shadows:** Subtle card shadows on the dashboard. Clean elevation hierarchy.
- **Icons:** Custom icon set. Minimal and functional.
- **Animations:** Smooth workspace tab transitions. Timeline scrubber provides fluid replay. Real-time terminal and browser updates.
- **Information density:** Medium. Dashboard is spacious. Workspace views are dense (terminal, code editor).

### Unique Differentiators

- **Full workspace replay:** The timeline scrubber that lets you replay every action Devin took — every terminal command, every browser visit, every file edit — like rewinding a video of a developer working. No other product offers this level of session forensics.
- **Interactive Planning Checkpoints:** Surfacing the execution plan and estimated cost before consuming resources.
- **Best UX idea:** The timeline scrubber. It transforms opaque agent work into a transparent, auditable, replayable history. Essential for trust in autonomous agents.

---

## 6. Factory Droids

**Product type:** Enterprise autonomous coding agent platform
**URL:** https://factory.ai

### Layout & Navigation

- **Window structure:** Multi-surface: CLI (terminal), IDE extension (VS Code/JetBrains), and Web Dashboard. The web dashboard is the primary management interface with project list, agent status, and diff review.
- **Navigation model:** Dashboard-driven. Project/repository list, active Droid sessions, PR queue. CLI uses slash commands. IDE extension integrates into the editor sidebar.
- **Default view on launch:** Dashboard showing active Droid sessions, pending reviews, and project overview.
- **Pages/views:** Dashboard overview, Droid session detail, Diff review, PR review, Settings, Team management, Billing.

### Chat/Conversation

- **Chat layout:** Conversational thread within each Droid session. Instructions given via natural language in the CLI, IDE, or dashboard.
- **Message rendering:** Markdown with code blocks. Droid explains its reasoning and actions.
- **Tool calls / function results:** Actions shown as structured steps: file changes, test runs, deployments. @droid review leaves inline comments directly on diffs.
- **Conversation sidebar:** Session history in the dashboard. Multiple Droid types listed (CodeDroid, Review Droid, QA Droid, Knowledge Droid, Reliability Droid, Product Droid).
- **Input/composer:** CLI: natural language commands with slash commands. IDE: sidebar chat input. Dashboard: session creation form with task description and configuration.
- **Model/agent selector:** Droid type selection (specialized agents). Model selection is abstracted — Factory manages the model stack.
- **Streaming display:** Real-time progress updates in the dashboard and CLI.

### Agent/Automation Features

- **Agent progress/status:** Dashboard shows real-time status of all active Droids. Each session has a progress view with completed/pending steps.
- **Task management:** Droids can be assigned tasks from tickets (Jira, Linear, GitHub Issues). Batch processing of multiple tasks.
- **Approval gates:** Configurable autonomy spectrum from fully supervised to autonomous. Some changes auto-approved, others require human review. Diff review interface for accept/reject per change.
- **Cost/usage tracking:** Enterprise billing dashboard. Usage metrics per team/project.
- **Multi-agent coordination:** Multiple specialized Droids work on different aspects: CodeDroid implements, Review Droid reviews, QA Droid tests. Orchestrated pipeline.

### Data & Inspection

- **Logs/history:** Full session logs. Audit trail of all Droid actions.
- **File browser / code diff:** Web dashboard diff viewer with line-by-line inspection. Inline comments from Review Droid. Accept/reject per diff hunk.
- **Memory/context:** Knowledge Droid maintains documentation and codebase understanding.

### Settings & Configuration

- **Model selection:** Abstracted. Custom Droids can be configured with specific models, prompts, and tool access via YAML configuration.
- **API key management:** Enterprise SSO/SAML. Repository access via GitHub/GitLab OAuth.
- **Theme/appearance:** Standard web dashboard. Professional enterprise design.
- **Plugin/extension management:** Custom Droids (subagents) configurable via YAML. GitHub Actions integration. Integrations with Slack, Jira, Datadog.

### Design Language

- **Color scheme:** Dark mode primary. Professional enterprise aesthetic. Muted accent colors.
- **Typography:** Modern sans-serif. Clean enterprise style.
- **Border radius:** Medium. Card-based layout.
- **Shadows:** Subtle elevation. Clean hierarchy.
- **Icons:** Functional, minimal icon set.
- **Animations:** Minimal. Focus on data clarity over visual flair.
- **Information density:** High. Enterprise dashboards prioritize information density.

### Unique Differentiators

- **Specialized Droid pipeline:** Different agent types for different workflow stages (Code, Review, QA, Knowledge, Reliability, Product). No other platform has this level of agent role specialization with a coordinated pipeline.
- **Custom Droids:** User-definable subagents with specific prompts, tool access, and model configurations via YAML.
- **Best UX idea:** The review-first workflow. Every Droid output goes through a structured diff review before merging, building trust through systematic human oversight.

---

## 7. Hermes Agent (Nous Research)

**Product type:** Open-source autonomous AI agent (CLI/TUI + multi-platform)
**URL:** https://hermes-agent.nousresearch.com

### Layout & Navigation

- **Window structure:** Full-screen TUI (Terminal User Interface). Single-pane conversational view with status bar. Web workspace alternative (community-built) provides multi-panel layout: chat, terminal, memory browser, skills manager, inspector.
- **Navigation model:** Slash commands (/help, /model, /memory, /skills, /rollback, /voice). Tab completion for commands. Session history navigation.
- **Default view on launch:** TUI with banner (customizable per skin), model info, and ready prompt.
- **Pages/views (TUI):** Chat view (primary), Memory inspector (/memory), Skills list (/skills), Model switcher (/model), Plugin manager. Web workspace adds: terminal panel, file browser, inspector panel.

### Chat/Conversation

- **Chat layout:** Scrolling conversation in the terminal. User input at bottom with multiline editing support. Agent responses stream with styled formatting.
- **Message rendering:** Terminal-styled markdown. Syntax-highlighted code blocks. Colored response boxes with customizable labels per skin.
- **Tool calls / function results:** Streaming tool output displayed inline with activity prefix (customizable per skin — e.g., spinner animation). Tool results shown in formatted blocks.
- **Conversation sidebar:** Not applicable in TUI. Web workspace has conversation history panel. /sessions command lists previous sessions.
- **Input/composer:** Multiline editing with readline-style keybindings. @-syntax for injecting files, folders, diffs, URLs. /voice command for speech input. Clipboard image pasting for vision input.
- **Model/agent selector:** /model command with interactive picker. Provider routing with priority controls. Automatic fallback across LLM providers.
- **Streaming display:** Token-by-token with customizable spinner animation. Interruptible — user can redirect mid-stream.

### Agent/Automation Features

- **Agent progress/status:** Spinner with customizable face/verb per skin. Tool execution shown in real-time. Checkpoint system snapshots working directory state.
- **Task management:** Subagent delegation spawning child instances with isolated contexts. Batch processing across thousands of prompts. Cron-based scheduled tasks with natural language scheduling.
- **Approval gates:** Configurable per tool. Some tools auto-approved, others require confirmation.
- **Cost/usage tracking:** Token usage displayed per request. Provider cost tracking.
- **Multi-agent coordination:** Subagent delegation with isolated contexts. Event hooks for lifecycle management. API server for external orchestration.

### Data & Inspection

- **Logs/history:** FTS5 session search with LLM summarization for cross-session recall. /sessions for session management.
- **Memory/context visualization:** MEMORY.md and USER.md files viewable/editable. /memory command inspects the agent's persistent memory. Memory is agent-curated with periodic nudges for consolidation.
- **File browser / code diff:** Terminal-based file operations. /diff for showing changes. Checkpoint /rollback for reverting to previous states.

### Settings & Configuration

- **Model selection:** /model command. YAML configuration for provider routing, fallback chains, and priority.
- **API key management:** .env file or environment variables. Multi-provider support.
- **Theme/appearance:** 7 built-in skins (default, ares, mono, slate, poseidon, sisyphus, charizard) plus custom YAML skins. Skins control banner colors, spinner faces, response-box labels, branding text, and activity prefixes.
- **Keyboard shortcuts:** Standard terminal keybindings. Ctrl+C to interrupt. Multiline editing shortcuts.
- **Plugin/extension management:** Drop-in plugins via ~/.hermes/plugins/. Skills following agentskills.io open standard. 40+ bundled skills. Autonomous skill creation after complex tasks.

### Design Language

- **Color scheme:** Skin-dependent. Default skin uses terminal colors. Skins range from minimal monochrome (mono) to vibrant colored themes (charizard).
- **Typography:** Terminal monospace. Skin-customizable banner text and response styling.
- **Border radius:** N/A (terminal). Box-drawing characters for response containers.
- **Shadows:** N/A (terminal).
- **Icons:** Emoji and Unicode characters for status indicators. Spinner faces customizable.
- **Animations:** Terminal spinner animation during processing. Streaming text output.
- **Information density:** High (terminal standard). Dense text output with structured formatting.

### Unique Differentiators

- **Self-improving skills:** The agent autonomously creates new skills after completing complex tasks, and existing skills self-improve during use. No other agent learns and grows this organically.
- **SOUL.md personality system:** Fully customizable agent identity/personality as a primary configuration file.
- **Multi-platform gateway:** Single agent instance accessible from CLI, Telegram, Discord, Slack, WhatsApp, Signal, and Email simultaneously.
- **Best UX idea:** The skin/theme engine. Making a CLI tool visually customizable with 7 distinct personalities gives users ownership over their agent's identity — something typically impossible in terminal tools.

---

## 8. Warp Terminal

**Product type:** AI-native terminal emulator and agentic development environment
**URL:** https://warp.dev

### Layout & Navigation

- **Window structure:** Single-pane terminal with block-based output organization. Warp 2.0 has four integrated capabilities: Code, Agents, Terminal, and Drive — accessible from a universal input.
- **Navigation model:** Block-based — each command+output pair is a discrete, navigable "block" with a permalink. Command palette (Cmd+P). Tab-based session management. Warp Drive for shared workflows.
- **Default view on launch:** Terminal prompt with universal input. Recent commands and Warp Drive accessible.
- **Pages/views:** Terminal (primary), Code view (Warp Code), Agent sessions, Warp Drive (shared workflows), Settings, Theme picker.

### Chat/Conversation

- **Chat layout:** AI chat integrated directly into the terminal. Type "#" to switch from command mode to natural language mode. AI responses appear inline as blocks.
- **Message rendering:** Syntax-highlighted code suggestions. Explanations in formatted text. Commands rendered as copyable/executable blocks.
- **Tool calls / function results:** Agent actions shown as terminal blocks. Live diff view shows file changes in real-time.
- **Conversation sidebar:** Agent session history. Warp Drive stores and shares command workflows.
- **Input/composer:** Universal input that accepts both terminal commands and natural language (prefix with #). @-syntax for file references, image uploads, URL attachments. Rich autocompletion with syntax highlighting.
- **Model/agent selector:** Configurable in settings. Supports multiple model providers.
- **Streaming display:** Real-time agent output in terminal blocks. Live diff view during file modifications.

### Agent/Automation Features

- **Agent progress/status:** Live diff view showing real-time file changes. Agents are "steerable" in-flight — you can redirect while they execute.
- **Task management:** Warp Drive: save, share, and replay command workflows. Team collaboration on shared workflows.
- **Approval gates:** Agents show diffs before applying changes. User can approve, modify, or reject.
- **Cost/usage tracking:** Account-based usage tracking.
- **Multi-agent coordination:** Multiple agent sessions can run in parallel terminal tabs.

### Data & Inspection

- **Logs/history:** Block-based command history with permalinks. Searchable. Blocks can be bookmarked and shared.
- **File browser / code diff:** Live diff view during agent edits. Warp Code provides a code editing environment.
- **Memory/context:** Agent sessions maintain context across interactions.

### Settings & Configuration

- **Model selection:** Settings > AI configuration.
- **API key management:** Account-based authentication. Team management for enterprise.
- **Theme/appearance:** Extensive theme system. Settings > Appearance > Themes. 16+ built-in themes + custom YAML themes. Accent color system for wide customization. Community theme repository on GitHub.
- **Keyboard shortcuts:** Customizable keybindings. Command palette. Standard terminal shortcuts plus IDE-like shortcuts (Cmd+P, Cmd+K).
- **Plugin/extension management:** Warp Drive for shared workflows/scripts. Extension points for customization.

### Design Language

- **Color scheme:** Dark mode primary. Multiple built-in themes. Accent color system where a single color change ripples through the entire theme. Support for both dark and light base themes.
- **Typography:** Custom font rendering engine (Rust-based). Supports ligatures. Default monospace with configurable font family and size.
- **Border radius:** Blocks have subtle rounded corners. Modern, polished feel for a terminal.
- **Shadows:** Subtle block separation. Clean layering.
- **Icons:** Custom icon set for UI controls. Minimal and functional.
- **Animations:** Smooth block transitions. Autocompletion dropdown animations. Live diff animations.
- **Information density:** High (terminal standard) but organized by blocks for visual parsing. Higher readability than traditional terminals.

### Unique Differentiators

- **Block-based terminal:** Output organized into discrete, navigable, shareable blocks instead of a wall of text. Fundamentally reimagines terminal output.
- **Universal input:** Single input that seamlessly handles both terminal commands and natural language AI prompts.
- **Live diff view:** Real-time visualization of file changes as agents work, making AI a transparent collaborator rather than a black box.
- **Warp Drive:** Cloud-synced, team-shareable command workflows.
- **Best UX idea:** Block-based output. Treating each command+output as an addressable, selectable, shareable unit solves the oldest problem in terminals: finding and referencing past output.

---

## 9. Cline / Roo Code

**Product type:** VS Code AI agent extensions
**URL:** https://cline.bot / https://roocode.com

### Layout & Navigation

- **Window structure:** VS Code sidebar extension. Primary panel in the VS Code sidebar (typically left or right). All interaction happens within the VS Code chrome — no separate windows.
- **Navigation model:** VS Code native navigation (file explorer, tabs, Cmd+P). Extension panel activated from sidebar icon. Conversation history within the panel.
- **Default view on launch:** Extension panel with empty chat/prompt input and mode selector.
- **Pages/views:** Chat/task panel (primary), Settings panel, Conversation history, Mode selector.

### Chat/Conversation

- **Chat layout:** Scrolling conversation thread in the sidebar panel. User messages and agent responses in a linear thread. Action steps shown inline.
- **Message rendering:** Markdown with syntax-highlighted code blocks. File diffs shown as expandable sections. Terminal commands shown as executable blocks.
- **Tool calls / function results:** Each tool call (file read, file edit, terminal command, browser action) shown as a discrete step requiring approval. Expandable to show details. Color-coded: amber for Plan mode (read-only), blue for Act mode (execution).
- **Conversation sidebar:** History of past task sessions. Searchable within the extension.
- **Input/composer (Cline):** Text input at bottom of panel. Supports file attachments. Plan/Act mode toggle.
- **Input/composer (Roo Code):** Text input with mode-specific context. Five distinct modes: Code, Architect, Debug, Ask, and custom modes. Each mode limits tool access appropriately.
- **Model/agent selector:** Dropdown for selecting API provider (Anthropic, OpenAI, local models, etc.) and specific model. Configurable per mode in Roo Code.
- **Streaming display:** Token-by-token streaming. Tool execution shown step-by-step with approval prompts.

### Agent/Automation Features

- **Agent progress/status:** Step-by-step execution log. Each step shows the tool being used, the file/command affected, and status. Pending approval steps are highlighted.
- **Task management (Cline):** Plan mode creates a full execution plan before any action. Plan includes file diffs, commands, and browser actions. Must be approved before Act mode executes.
- **Task management (Roo Code):** Architect mode (read-only planning), Coder mode (implementation), Debugger mode (fixing). Each mode restricts available tools.
- **Approval gates:** Every file edit, terminal command, and browser action requires explicit user approval by default. YOLO mode (Cline) auto-approves. Configurable auto-approval rules.
- **Cost/usage tracking:** Token usage displayed per conversation. API cost estimates.
- **Multi-agent coordination:** Roo Code supports team features via Roo Cloud for enterprise.

### Data & Inspection

- **Logs/history:** Full conversation/task history with all tool calls and results.
- **File browser / code diff:** VS Code native diff viewer. Extension shows proposed diffs inline in the conversation with accept/reject.
- **Context visualization:** Shows which files are in context. Token usage indicator.

### Settings & Configuration

- **Model selection:** Extension settings panel. Multiple providers supported. Per-mode model selection in Roo Code.
- **API key management:** Extension settings. Supports multiple API providers with individual key configuration.
- **Theme/appearance:** Inherits VS Code theme. Extension panels use VS Code color tokens.
- **Keyboard shortcuts:** VS Code keybindings for opening the panel. Custom keybindings configurable.
- **Plugin/extension management:** MCP server support for extending tool capabilities. Custom modes (Roo Code) via YAML configuration.

### Design Language

- **Color scheme:** Inherits VS Code theme. Extension-specific: amber/warning for Plan mode, blue/focus for Act mode. Status indicators use semantic colors (green/red/yellow).
- **Typography:** VS Code standard. Monospace for code, system sans-serif for UI.
- **Border radius:** VS Code standard (small).
- **Shadows:** VS Code standard.
- **Icons:** VS Code Codicons. Custom extension icons for modes and actions.
- **Animations:** Minimal. Step-by-step reveal of tool executions. Streaming text.
- **Information density:** Medium-high. Sidebar panels are information-dense. Each tool call step is compact but expandable.

### Unique Differentiators

- **Cline's Plan/Act duality:** The hard separation between planning (read-only analysis) and acting (execution) with a mandatory approval gate between them. Creates a safety-first workflow for autonomous coding.
- **Roo Code's mode system:** Five specialized modes (Code, Architect, Debug, Ask, Custom) each with restricted tool access. Prevents the agent from doing things outside its current role.
- **Best UX idea (Cline):** The Plan/Act split. Making planning a read-only phase where the agent cannot modify anything builds enormous trust. You see the full plan before anything happens.
- **Best UX idea (Roo Code):** Custom modes with tool restrictions. Users define agent personalities with specific capabilities, creating a "team of agents" rather than one omnipotent agent.

---

## 10. Aider

**Product type:** Terminal-based AI pair programmer
**URL:** https://aider.chat

### Layout & Navigation

- **Window structure:** Terminal-based chat interface. Also available as a browser-based UI (localhost web server). Single-pane conversational view.
- **Navigation model:** Chat commands (/add, /model, /diff, /voice, /web, etc.). Mode switching between code, architect, ask, and help modes.
- **Default view on launch:** Terminal prompt showing the active model, repository info, and files in context. Ready for input.
- **Pages/views:** Chat view (primary), Browser view (when running --browser flag), Diff view (/diff).

### Chat/Conversation

- **Chat layout:** Linear conversation in the terminal. User input at bottom. AI responses with code changes highlighted. Colored output for different message types.
- **Message rendering:** Terminal-colored text. Code changes shown as diffs (green/red). File names highlighted. Markdown-lite formatting.
- **Tool calls / function results:** Code changes applied directly and committed to git. Terminal shows which files were modified and the diff. Lint/test results shown after changes.
- **Conversation sidebar:** Not applicable (terminal). Chat history scrollable. Browser mode may have session management.
- **Input/composer:** Text input with multiline support. /add to add files to context. /voice for speech input. Image and URL pasting for visual context. Drag-and-drop files.
- **Model/agent selector:** /model command to switch models. Supports all major providers (OpenAI, Anthropic, local models via ollama). Architect mode uses a separate "editor model" for translating proposals into edits.
- **Streaming display:** Token-by-token with colored output. Diff changes appear as they're generated.

### Agent/Automation Features

- **Agent progress/status:** Shows which files are being edited. Commit messages generated automatically. Lint/test runners execute post-change and results displayed.
- **Task management:** Architect mode: planning model proposes changes, editor model executes them. Two-phase approach to complex changes.
- **Approval gates:** Changes are auto-committed to git (easily revertable). User can /undo the last change. Interactive confirmation for sensitive operations.
- **Cost/usage tracking:** Token usage displayed per interaction. Cost estimates per model.
- **Multi-agent coordination:** Architect + Editor model pair is a form of two-agent coordination.

### Data & Inspection

- **Logs/history:** Git history as the primary audit trail. Every AI change is a discrete commit. /diff shows all changes since last message.
- **File browser / code diff:** /diff command. Git diff integration. Changes visible in any git tool.
- **Context visualization:** Shows which files are in context (/add'd files). Token usage per request.

### Settings & Configuration

- **Model selection:** CLI flags or /model command. .aider.conf.yml for persistent configuration.
- **API key management:** Environment variables or .env file.
- **Theme/appearance:** Terminal-native. Colored output. Configurable via terminal emulator theme.
- **Keyboard shortcuts:** Standard terminal shortcuts. /voice for hands-free input.
- **Plugin/extension management:** Not applicable. Editor integrations available (VS Code, Emacs, Vim).

### Design Language

- **Color scheme:** Terminal colors. Green for additions, red for deletions. Colored labels for different message types (user, assistant, system).
- **Typography:** Terminal monospace.
- **Border radius:** N/A (terminal).
- **Shadows:** N/A (terminal).
- **Icons:** N/A. Text labels and Unicode characters.
- **Animations:** Streaming text. No graphical animations.
- **Information density:** High (terminal standard). Efficient, no wasted space.

### Unique Differentiators

- **Git-native workflow:** Every AI change is automatically committed to git with a descriptive message. The version control system IS the undo/review mechanism. No other tool is this tightly integrated with git.
- **Voice coding:** /voice command for speaking instructions that get transcribed and executed. Hands-free pair programming.
- **Architect/Editor two-model pattern:** Using one model for strategic planning and a different model for precise code editing. Each model does what it's best at.
- **Best UX idea:** Auto-committing every change to git. It's brilliantly simple — git already solves undo, history, diffing, and review. Why reinvent those wheels?

---

## 11. Codex CLI (OpenAI)

**Product type:** Terminal-based coding agent
**URL:** https://github.com/openai/codex

### Layout & Navigation

- **Window structure:** Full-screen TUI (Terminal User Interface). Conversational view with embedded code blocks and diffs. To-do list panel for complex tasks.
- **Navigation model:** Slash commands (/theme, /plugins, /title, etc.). Approval mode selector. Tab-based navigation for parallel sessions.
- **Default view on launch:** TUI with model info, approval mode indicator, and ready prompt.
- **Pages/views:** Chat/conversation view (primary), Plugin browser (/plugins), Theme picker (/theme), To-do list (auto-generated for complex tasks).

### Chat/Conversation

- **Chat layout:** Scrolling conversation in the TUI. User prompts at bottom. Codex responses with explanations, plans, and code changes.
- **Message rendering:** Syntax-highlighted markdown code blocks and diffs in the TUI. Formatted explanations.
- **Tool calls / function results:** Actions shown inline: file reads, edits, terminal commands. Each action subject to the current approval mode. Results displayed as formatted output.
- **Conversation sidebar:** /title for naming sessions. Multiple parallel sessions distinguishable by title.
- **Input/composer:** Text input accepting prompts, code snippets, and screenshots. Context references. Inline approval/rejection for proposed changes.
- **Model/agent selector:** Configurable via settings. Supports OpenAI models as default, potentially other providers.
- **Streaming display:** Token-by-token with syntax highlighting. Plans explained before execution.

### Agent/Automation Features

- **Agent progress/status:** To-do list auto-generated for complex tasks. Each step tracked. Codex explains its plan before acting.
- **Task management:** Auto-generated to-do list. Web search and MCP tools for external information gathering.
- **Approval gates:** Three distinct modes — 'suggest' (approval for everything), 'auto-edit' (auto-approves file edits, confirms commands), 'full-auto' (autonomous execution). Clearly labeled and switchable.
- **Cost/usage tracking:** Token usage per request. Cost awareness built into the CLI output.
- **Multi-agent coordination:** Sub-agents with readable path-based addresses (e.g., /root/agent_a). Structured inter-agent messaging. Agent listing for multi-agent v2 workflows.

### Data & Inspection

- **Logs/history:** Conversation history. Git integration for tracking changes.
- **File browser / code diff:** Inline diffs in the TUI with syntax highlighting. Sandbox isolation for safe experimentation.
- **Context visualization:** Shows which files are in context. Sandbox boundaries visible.

### Settings & Configuration

- **Model selection:** Configuration file. CLI flags.
- **API key management:** Environment variables or config file.
- **Theme/appearance:** /theme command with visual theme picker. Preview and save preferred themes. Works in both classic TUI and app-server TUI.
- **Keyboard shortcuts:** Standard terminal shortcuts. Approval mode shortcuts.
- **Plugin/extension management:** First-class plugin system. /plugins browser for browsing, installing, removing. Product-scoped plugins sync at startup. Suggestion allowlist for auto-install.

### Design Language

- **Color scheme:** TUI theme-dependent. Multiple themes available via /theme picker.
- **Typography:** Terminal monospace. Syntax-highlighted code.
- **Border radius:** N/A (terminal). Box-drawing characters for structure.
- **Shadows:** N/A (terminal).
- **Icons:** Unicode/emoji for status indicators.
- **Animations:** Streaming text. Spinner during processing.
- **Information density:** High (terminal standard).

### Unique Differentiators

- **Three-tier approval modes:** The suggest/auto-edit/full-auto spectrum gives users a clear, named safety dial. Simpler and more intuitive than per-tool configuration.
- **Sub-agent addressing:** Readable path-based addresses (/root/agent_a) for multi-agent coordination, with structured inter-agent messaging.
- **First-class plugin system:** Plugins sync at startup, browseable in /plugins, with managed auth/setup — more polished than other CLI tools' extension systems.
- **Best UX idea:** Named approval modes. Instead of configuring individual tool permissions, you pick a named trust level. It's the right abstraction for the "how much autonomy?" question.

---

## 12. Linear

**Product type:** Project management / issue tracking
**URL:** https://linear.app

### Layout & Navigation

- **Window structure:** Three-column layout: left sidebar (navigation/teams), center list view (issues/projects), right detail panel (issue detail). The detail panel opens on issue selection and can be expanded to full width.
- **Navigation model:** Sidebar-driven with team/project hierarchy. Keyboard-first: virtually everything accessible without a mouse. Cmd+K command palette. Breadcrumbs for location context. Views: List, Board (kanban), Timeline (Gantt-like), Calendar.
- **Default view on launch:** Team's active issues view or personal "My Issues" filtered view.
- **Pages/views:** My Issues, Team views (Backlog, Active, Cycles), Project views, Cycle views, Roadmap, Settings, Inbox (notifications), Initiative views.

### Chat/Conversation

- **Not a chat product.** Issues have threaded comments. @-mentions for team members. Activity log per issue showing all changes.

### Agent/Automation Features

- **AI-powered features:** AI-generated issue summaries, auto-categorization, duplicate detection. AI-powered semantic search across all issues.
- **Automation:** Workflow automations triggered by state changes (e.g., auto-assign when moved to "In Progress"). Cycle automations.
- **Task management:** Issues organized by team, project, and cycle. Priority levels (Urgent, High, Medium, Low, No Priority). Labels, estimates, due dates. Sub-issues for task decomposition.

### Data & Inspection

- **Activity logs:** Per-issue activity trail showing every state change, comment, assignment, and label change with timestamps.
- **Analytics:** Cycle reports with burn-down charts. Project progress tracking. Team velocity metrics.
- **Filtering:** Advanced filter system with boolean operators, saved views, and AI-powered semantic search.

### Settings & Configuration

- **Theme/appearance:** Light and dark mode. Custom theme generator using LCH color space (not HSL) for perceptually uniform colors. Accent color customization.
- **Keyboard shortcuts:** Extensive. Hover any element to see its shortcut in a contextual banner. C (create issue), X (select), D (mark done), 1-4 (set priority). Full shortcut reference.
- **Integrations:** GitHub, GitLab, Slack, Figma, Sentry, Zendesk. Built-in Git branch creation from issues.

### Design Language

- **Color scheme:** Dark mode primary (near-black background). Light mode also polished. Custom themes via LCH color space. Muted, desaturated accent colors. Priority and status use semantic colors.
- **Typography:** Inter Display for headings. Inter for body text. Clean, professional. High contrast for readability. Consistent type scale.
- **Border radius:** Small to medium (4-8px). Subtle rounding on cards, inputs, and buttons. Not overly rounded.
- **Shadows:** Minimal. Almost flat design. Subtle depth through background color differentiation rather than shadows.
- **Icons:** Custom icon set — geometric, consistent stroke weight, minimal. Status icons are distinctively designed (circle outline, half-circle, checkmark).
- **Animations:** Buttery smooth. List reordering animations. State change transitions. Keyboard navigation feels instant. Performance is a core design principle — updates sync in milliseconds.
- **Information density:** High. Dense issue lists with compact rows. Multi-column views maximize information per screen. No wasted space. Yet never feels cluttered due to careful typography and spacing.

### Unique Differentiators

- **Speed as a feature:** Linear is fanatically optimized for performance. Everything feels instant. Real-time sync in milliseconds. This isn't just engineering — it's a design decision that shapes the entire UX.
- **Keyboard-first interaction:** The most comprehensive keyboard-driven UX of any project management tool. Contextual shortcut hints appear on hover.
- **LCH color space themes:** Using perceptually uniform color math for theme generation. Technical sophistication in the service of aesthetics.
- **Opinionated workflows:** Cycles, not sprints. States, not statuses. Linear removes complexity by making choices for you.
- **Best UX idea:** Contextual keyboard shortcut banners that appear on hover. They teach the keyboard shortcuts organically, gradually converting mouse users into keyboard users without a learning cliff.

---

## 13. Raycast

**Product type:** Keyboard-driven launcher and productivity platform
**URL:** https://raycast.com

### Layout & Navigation

- **Window structure:** Floating overlay window activated by hotkey (default: Option+Space). Appears as a centered, floating panel over the current workspace. Dismisses when focus leaves. No persistent window.
- **Navigation model:** Command-line-style text input with fuzzy search. Results list below input. Action panels on selected items. Nested navigation (drill into extensions, then into actions). Back navigation via Escape.
- **Default view on launch:** Empty search field with recent commands/favorites below. Quick-access section for pinned items.
- **Pages/views:** Search/command view (primary), AI Chat (persistent window), Extension store, Clipboard history, Snippets manager, Window management, Quicklinks, Settings.

### Chat/Conversation (Raycast AI)

- **Chat layout:** Dedicated AI Chat window (separate from the launcher overlay). Conversational thread with user/assistant messages.
- **Message rendering:** Markdown with code blocks. Copy/insert actions on code.
- **Tool calls / function results:** AI can use context from active window, selected area, or focused browser tab via dedicated commands.
- **Input/composer:** Text input. "Send Active Window to AI Chat," "Send Selected Area to AI Chat," and "Send Focused Browser Tab to AI Chat" commands capture context automatically.
- **Model/agent selector:** Configurable. Faster model option for speed, smarter model option for complex tasks.
- **Streaming display:** Token-by-token streaming in the AI Chat window.

### Agent/Automation Features

- **Glaze:** New platform for building native macOS apps via natural language prompts. Uses Claude Code and Codex as underlying models.
- **Scripts:** Custom scripts runnable as Raycast commands.
- **Quicklinks:** Parameterized URL templates for rapid access.

### Data & Inspection

- **Clipboard history:** Visual clipboard manager with search and preview. Text, images, files, colors.
- **Snippet manager:** Template system with dynamic placeholders.
- **Extension data:** Each extension manages its own data (e.g., GitHub extension shows PRs, Linear extension shows issues).

### Settings & Configuration

- **Model selection:** AI settings with model preference (speed vs. capability).
- **API key management:** Raycast Pro subscription for AI features. Individual extension settings for API keys.
- **Theme/appearance:** Custom themes (Pro feature). Dark/light mode. Accent color customization. Community themes.
- **Keyboard shortcuts:** Deeply configurable. Every command can have a custom hotkey. Nested action panels each with their own shortcuts.
- **Plugin/extension management:** 1,500+ open-source extensions in the Raycast Store. Extensions built with TypeScript/React. One-click install. Auto-updates. Community-driven.

### Design Language

- **Color scheme:** Translucent/vibrancy effect (macOS blur). Dark/light mode matching system preference. Subtle accent colors. Extension icons provide color variety.
- **Typography:** macOS system font (SF Pro). Clean, readable at small sizes. Monospace for code/commands.
- **Border radius:** Large (12-16px) on the main window. Medium (8px) on list items and cards. Rounded, friendly feel.
- **Shadows:** Large, diffuse shadow on the floating window. Creates strong elevation over desktop.
- **Icons:** Colorful, consistent style. Each extension has a branded icon. Action icons are monochrome and minimal.
- **Animations:** Smooth open/close transitions. List item hover effects. Section expand/collapse. Fast and responsive — never blocks interaction.
- **Information density:** Medium. Clean list views with icons, titles, and subtitles. Action panels provide additional detail on demand.

### Unique Differentiators

- **Keyboard-driven overlay UX:** The launcher paradigm — a floating overlay that appears instantly, accepts natural input, and dismisses when done. No persistent window management needed.
- **Extension ecosystem (React/TypeScript):** 1,500+ community extensions built with familiar web technologies, rendering to native macOS UI. The best developer experience for building launcher plugins.
- **Context injection commands:** "Send Active Window/Selection/Browser Tab to AI Chat" — capturing context from anywhere on the OS with a single command.
- **Glaze:** Building native macOS apps from natural language prompts.
- **Best UX idea:** The Action Panel pattern. Select an item, then see all available actions with keyboard shortcuts. It's a discoverable, keyboard-driven context menu that makes complex workflows feel simple.

---

## 14. Arc Browser

**Product type:** Web browser with workspace management
**URL:** https://arc.net (Note: development paused in May 2025, team shifted to Dia browser)

### Layout & Navigation

- **Window structure:** Vertical sidebar on the left replaces the traditional horizontal tab bar. Main content area takes full width to the right. Split View allows 2-4 pages side by side. Sidebar collapses with a hotkey for distraction-free browsing.
- **Navigation model:** Sidebar-driven with vertical tabs. Spaces provide workspace separation (each Space has its own tabs, pinned sites, and theme color). Pinned tabs at top (persistent), regular tabs below (auto-archive after 12 hours by default).
- **Default view on launch:** Last active Space with pinned tabs visible. New Tab page with recent bookmarks and Easel shortcuts.
- **Pages/views:** Browsing view (primary), Easels (whiteboard/notes), Split View (multi-pane), Spaces (workspace switcher), Library (downloads, history), Boosts (custom CSS/JS for sites).

### Chat/Conversation

- **Not a chat product.** Max (AI assistant) provided search and summarization within the sidebar.

### Agent/Automation Features

- **Boosts:** User-created CSS/JS injections for customizing any website's appearance or behavior.
- **Auto-archiving:** Tabs automatically archive after a configurable period to prevent tab hoarding.
- **Little Arc:** Minimal floating window for quick link previews without opening a full tab.

### Data & Inspection

- **Library:** Centralized view of downloads, history, and Easel creations.
- **Easels:** Built-in whiteboard/note-taking. Freehand drawing, text, shapes, web page screenshots (clickable, linking back to source). Visual collection and organization tool.

### Settings & Configuration

- **Theme/appearance:** Each Space gets its own theme color, providing visual context switching. Gradient backgrounds on the sidebar. Customizable per-Space icons and names.
- **Keyboard shortcuts:** Cmd+T (new tab), Cmd+S (toggle sidebar), Cmd+Shift+D (split view), Cmd+Option+Arrow (switch Spaces), Cmd+Shift+C (toggle developer tools).
- **Plugin/extension management:** Chrome extension compatibility. Boost system for custom CSS/JS.

### Design Language

- **Color scheme:** Per-Space color theming. Soft gradients on the sidebar. Clean white content area. Muted, purposeful colors.
- **Typography:** Clean sans-serif (likely SF Pro on macOS). Readable tab labels. Minimal text in sidebar.
- **Border radius:** Large (12-16px) on sidebar elements. Rounded tab pills. Soft, modern feel.
- **Shadows:** Subtle. Clean elevation between sidebar and content. Little Arc windows have floating shadows.
- **Icons:** Custom icon set. Minimal and geometric. Each Space can have a custom icon.
- **Animations:** Smooth sidebar expand/collapse. Space-switching transitions. Split View resize animations. Polished, spring-physics feel.
- **Information density:** Low in the sidebar (generous spacing, large touch targets). Content area defers to the website. Clean and uncluttered.

### Unique Differentiators

- **Spaces:** Color-coded, icon-customizable workspace containers that separate browsing contexts. Switch your entire tab environment with a keystroke.
- **Easels:** Built-in whiteboard for visual note-taking with live web page screenshots. Blends browsing with visual thinking.
- **Vertical sidebar tabs with auto-archiving:** Fundamentally different tab model from every other browser. Tabs are temporary by default.
- **Split View:** Native multi-pane browsing (up to 4 pages) without extensions.
- **Boosts:** User-level CSS/JS injection for customizing any website.
- **Best UX idea:** Spaces with per-Space theming. The color change on Space switch provides an instant, visceral context switch. You "feel" the workspace change through color, not just through different tabs appearing.

---

## 15. Cross-Product Pattern Analysis

### Universal Patterns

| Pattern | Products Using It | Notes |
|---------|------------------|-------|
| **Left sidebar + main area** | Claude, ChatGPT, Cursor, Windsurf, Linear, Arc | The dominant layout pattern. Sidebar contains navigation/history. |
| **Dark mode as default** | Cursor, Windsurf, Linear, Warp, Hermes, Arc | Developer tools overwhelmingly default to dark mode. |
| **Cmd+K command palette** | Linear, Raycast, Cursor, Windsurf, ChatGPT | Universal "go anywhere" pattern borrowed from Spotlight/Alfred. |
| **Token-by-token streaming** | All chat products | Standard for AI responses. No product batches responses. |
| **@-mention context injection** | Cursor, Windsurf, Warp, Hermes, Codex CLI | Reference files, folders, URLs inline in prompts. |
| **Markdown + syntax-highlighted code** | All products | Universal rendering standard for AI-generated content. |
| **Model/provider selector** | Claude, ChatGPT, Cursor, Windsurf, Roo Code, Aider, Hermes | Users want model choice. Some abstract it (Devin, Factory). |
| **Git integration** | All coding tools | Git is the universal undo/audit mechanism for code agents. |

### Emerging Patterns (2026)

| Pattern | Products | Significance |
|---------|----------|-------------|
| **Parallel multi-agent sessions** | Cursor (Mission Control), Windsurf (Wave 13), Devin 2.0, Warp | The shift from "one conversation" to "team of agents working in parallel." |
| **Plan-then-execute workflow** | Cline (Plan/Act), Windsurf (Plan mode), Devin (Interactive Planning), Codex CLI (suggest mode) | Mandatory planning phase before execution for trust and safety. |
| **Named approval/autonomy levels** | Codex CLI (suggest/auto-edit/full-auto), Cline (Plan/Act/YOLO), Factory (supervised/autonomous) | Clear, named trust levels instead of per-tool permission matrices. |
| **Timeline/replay** | Devin (timeline scrubber), Warp (blocks), Factory (session logs) | Making agent work auditable and replayable after the fact. |
| **Context budget visualization** | Windsurf (context meter), Cursor (token counter), Cline (token display) | Making the invisible (context window consumption) visible to users. |
| **Specialized agent modes/roles** | Roo Code (5 modes), Factory (6 Droid types), Hermes (SOUL.md personalities) | Moving from one general agent to specialized role-based agents. |
| **Skin/theme systems for CLI tools** | Hermes (7 skins + custom YAML), Warp (16+ themes + custom YAML), Codex CLI (/theme picker) | Terminal tools investing in visual identity and personalization. |

### Navigation Model Comparison

| Model | Products | Best For |
|-------|----------|----------|
| **Sidebar + tabs** | Claude, ChatGPT, Cursor, Windsurf, Linear | Content-heavy applications with many items |
| **Command palette overlay** | Raycast, Linear (Cmd+K), Cursor (Cmd+P) | Power users, keyboard-first workflows |
| **Slash commands** | Hermes, Aider, Codex CLI, Cline | Terminal/CLI tools with discoverable commands |
| **Spaces/workspaces** | Arc (Spaces), Cursor (workspaces), Devin (sessions) | Context separation and task isolation |

### Chat/Input Pattern Comparison

| Pattern | Products | Innovation |
|---------|----------|------------|
| **Rich composer (files + @mentions + images)** | Cursor, Windsurf, Codex CLI, Hermes | Multi-modal context injection |
| **Dual-purpose input (commands + chat)** | Warp (#), Aider (/commands + chat), Hermes (/ + chat) | Seamless switching between action and conversation |
| **Canvas/Artifact side panel** | Claude (Artifacts), ChatGPT (Canvas) | In-conversation creation workspace |
| **Voice input** | Aider (/voice), ChatGPT (voice mode), Hermes (voice mode) | Hands-free interaction |

### Agent Status Display Patterns

| Pattern | Products | Approach |
|---------|----------|----------|
| **Step-by-step action log** | Cursor, Cline, Roo Code, Factory | Expandable list of tool calls with status icons |
| **Workspace replay** | Devin (timeline scrubber) | Full session recording with scrubbing |
| **Block-based output** | Warp (blocks) | Each action as an addressable, navigable unit |
| **Planning document** | Cline (Plan mode), Devin (Planner), Codex CLI (to-do list) | Structured plan before execution |
| **Grid overview** | Cursor (Mission Control) | Bird's-eye view of all parallel agents |

### Design Language Trends

| Trend | Examples | Notes |
|-------|----------|-------|
| **Translucent/vibrancy effects** | Raycast, Arc | macOS native blur effects for floating windows |
| **Large border radius (12-16px)** | Raycast, Arc, Claude | Modern, friendly, approachable |
| **Small border radius (4-6px)** | Cursor, Windsurf, Linear | Professional, dense, IDE-appropriate |
| **Custom rendering engines** | Warp (Rust), Linear (optimized React) | Performance-critical apps invest in custom rendering |
| **LCH/perceptually uniform color** | Linear | Technically sophisticated approach to theming |
| **Accent color systems** | Warp, Arc (per-Space), Linear (custom themes) | Single color change ripples through the entire UI |

### Key Takeaways for Building an AI Agent UI

1. **The sidebar is mandatory.** Every product has one. Use it for navigation, history, and agent/session management.

2. **Plan before act.** The best agent UIs separate planning from execution. Show the plan, get approval, then execute. This is the trust-building pattern of 2026.

3. **Make agent work transparent.** Timeline scrubbers (Devin), block-based output (Warp), step-by-step logs (Cline/Cursor) — users need to see and audit what agents did.

4. **Support parallel agents.** The shift from "one conversation" to "team of agents" is happening. Cursor's Mission Control is the reference implementation.

5. **Named autonomy levels.** Don't make users configure per-tool permissions. Give them named trust levels: supervised, semi-autonomous, fully autonomous.

6. **Visualize the context budget.** Windsurf's real-time context meter is becoming essential as context windows are a scarce resource users need to manage.

7. **Dark mode first, theme system second.** Developer tools default dark. But invest in a real theme system (YAML-based, accent color propagation) for personalization.

8. **Keyboard-first, discoverable.** Linear's "shortcut banner on hover" pattern is the gold standard for teaching keyboard shortcuts without documentation.

9. **@-mention for context injection.** Universal pattern for referencing files, folders, URLs, and other context in prompts.

10. **Git as the universal undo.** For coding agents, auto-committing to git (Aider's pattern) or working in branches/worktrees is the expected safety net.

---

## Sources

- [Claude Artifacts Guide (2026)](https://albato.com/blog/publications/how-to-use-claude-artifacts-guide)
- [Claude Code Desktop Quickstart](https://code.claude.com/docs/en/desktop-quickstart)
- [ChatGPT Canvas Guide (2026)](https://www.glbgpt.com/hub/how-to-use-chatgpt-canvas-the-ultimate-guide-for-writing-coding-2026/)
- [ChatGPT Sidebar Redesign](https://www.ai-toolbox.co/chatgpt-management-and-productivity/chatgpt-sidebar-redesign-guide)
- [OpenAI Canvas Introduction](https://openai.com/index/introducing-canvas/)
- [ChatGPT Release Notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- [Cursor 2.0 and Composer](https://cursor.com/blog/2-0)
- [Cursor Features](https://cursor.com/features)
- [Cursor AI Review (2026)](https://prismic.io/blog/cursor-ai)
- [Cursor Keyboard Shortcuts (2026)](https://thinkpeak.ai/cursor-keyboard-shortcuts-cheat-sheet-2026/)
- [Windsurf Editor](https://windsurf.com/editor)
- [Windsurf Cascade](https://windsurf.com/cascade)
- [Windsurf AI Review (2026)](https://www.nxcode.io/resources/news/windsurf-ai-review-2026-best-ide-for-beginners)
- [Cursor vs Windsurf vs Claude Code (2026)](https://dev.to/pockit_tools/cursor-vs-windsurf-vs-claude-code-in-2026-the-honest-comparison-after-using-all-three-3gof)
- [Devin AI Guide (2026)](https://aitoolsdevpro.com/ai-tools/devin-guide/)
- [Devin 2026 Release Notes](https://docs.devin.ai/release-notes/2026)
- [Devin Pricing](https://devin.ai/pricing)
- [Devin Review (2026)](https://vibecoding.app/blog/devin-review)
- [Factory AI](https://factory.ai)
- [Factory AI Review (2026)](https://fritz.ai/factory-ai-review/)
- [Factory Custom Droids Docs](https://docs.factory.ai/cli/configuration/custom-droids)
- [Factory CodeDroid Analysis](https://hyperdev.matsuoka.com/p/factory-ai-codedroid-promising-concept)
- [Hermes Agent Documentation](https://hermes-agent.nousresearch.com/docs/)
- [Hermes Agent Features Overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)
- [Hermes Agent CLI Interface](https://hermes-agent.nousresearch.com/docs/user-guide/cli/)
- [Hermes Agent GitHub](https://github.com/NousResearch/hermes-agent)
- [Warp Terminal](https://www.warp.dev/)
- [Warp 2.0 Introduction](https://www.warp.dev/blog/reimagining-coding-agentic-development-environment)
- [Warp Themes](https://docs.warp.dev/terminal/appearance/themes)
- [Warp Theme Design Blog](https://www.warp.dev/blog/how-we-designed-themes-for-the-terminal-a-peek-into-our-process)
- [Cline](https://cline.bot)
- [Roo Code vs Cline (2026)](https://www.qodo.ai/blog/roo-code-vs-cline/)
- [Roo Code GitHub](https://github.com/RooCodeInc/Roo-Code)
- [Cline Plan and Act Modes (DeepWiki)](https://deepwiki.com/cline/cline/3.4-plan-and-act-modes)
- [Aider](https://aider.chat/)
- [Aider Chat Modes](https://aider.chat/docs/usage/modes.html)
- [Aider Voice Coding](https://aider.chat/docs/usage/voice.html)
- [Aider Git Integration](https://aider.chat/docs/git.html)
- [Codex CLI Features](https://developers.openai.com/codex/cli/features)
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference)
- [Codex CLI Changelog](https://developers.openai.com/codex/changelog)
- [Codex Sandbox Configuration](https://inventivehq.com/knowledge-base/openai/how-to-configure-sandbox-modes)
- [Linear](https://linear.app)
- [Linear UI Redesign (Part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Linear Design System (Figma)](https://www.figma.com/community/file/1222872653732371433/linear-design-system)
- [Linear Design Trend Analysis](https://blog.logrocket.com/ux-design/linear-design/)
- [Linear Keyboard Shortcuts](https://shortcuts.design/tools/toolspage-linear/)
- [Raycast](https://www.raycast.com/)
- [Raycast API / User Interface](https://developers.raycast.com/api-reference/user-interface)
- [Raycast Developer Program](https://www.raycast.com/developer-program)
- [Raycast Glaze Launch](https://www.implicator.ai/raycast-launches-glaze-a-platform-for-building-desktop-apps-through-ai-prompts/)
- [Arc Browser Review (2026)](https://dockshare.io/apps/arc)
- [Arc Spaces Documentation](https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas)
- [Arc Browser Design Analysis](https://medium.com/design-bootcamp/arc-browser-rethinking-the-web-through-a-designers-lens-f3922ef2133e)
- [Arc Browser Alternatives (2026)](https://www.niftybuttons.com/blog/best-arc-browser-alternatives)
- [Conversational AI UI Comparison (2025)](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025)
