# Spec 004 — Terminal + Local Agent Execution

**Status:** Not Started
**Effort:** Large
**Depends on:** None (can start in parallel with 001/002)
**Produces:** `rust/starbridge-dioxus/src/ui/views/terminal.rs`, `rust/starbridge-dioxus/src/local_agent.rs`

---

## Context

Cadet Desktop needs an embedded terminal for local shell access and local agent execution (Claude Code, Codex CLI, Aider, etc.). Currently there is no terminal view. The target is Warp Terminal quality: a full PTY shell with agent quick-launch buttons, output parsing, and mission brief auto-injection.

The terminal uses `portable-pty` to spawn a real PTY subprocess. Agent launches inject API keys from `AuthProviderRegistry`, write a CLAUDE.md mission brief to the working directory, and parse the agent's stdout for thinking blocks, tool calls, and diffs.

**Key dependency:** The `portable-pty` crate provides cross-platform PTY management. It must be behind the `desktop-ui` feature gate since it only works in native builds.

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ app-shell                                                            │
├────────┬─────────────────────────────────────────────────────────────┤
│sidebar │  Terminal View                                              │
│        │                                                             │
│  Chat  │  ┌─ Toolbar ──────────────────────────────────────────────┐ │
│  Ovw   │  │ [Claude Code] [Codex] [Aider] [zsh]  | cwd: ~/code   │ │
│  Runs  │  └────────────────────────────────────────────────────────┘ │
│  ...   │                                                             │
│ [Term] │  ┌─ PTY ─────────────────────────────────────────────────┐ │
│  ...   │  │ $ claude --yes --print "fix the auth bug"             │ │
│        │  │                                                       │ │
│        │  │ ┌─ thinking ──────────────────────────────────────┐   │ │
│        │  │ │ I'll look at the auth module first...           │   │ │
│        │  │ └─────────────────────────────────────────────────┘   │ │
│        │  │                                                       │ │
│        │  │ ┌─ tool: read_file ───────────────────────────────┐   │ │
│        │  │ │ src/auth.ts (lines 42-80)                       │   │ │
│        │  │ └─────────────────────────────────────────────────┘   │ │
│        │  │                                                       │ │
│        │  │ ┌─ diff ──────────────────────────────────────────┐   │ │
│        │  │ │ - const token = getToken()                      │   │ │
│        │  │ │ + const token = await getToken()                │   │ │
│        │  │ └─────────────────────────────────────────────────┘   │ │
│        │  │                                                       │ │
│        │  │ $ _                                                   │ │
│        │  └───────────────────────────────────────────────────────┘ │
│        │                                                             │
│        │  ┌─ Status Bar ───────────────────────────────────────────┐ │
│        │  │ PID: 12345 | Running | 2m 14s | [Kill] [Ctrl+C]      │ │
│        │  └────────────────────────────────────────────────────────┘ │
├────────┴─────────────────────────────────────────────────────────────┤
```

---

## Requirements

### R1 — Embedded PTY Terminal
- Spawn a real PTY shell (zsh or bash) using `portable-pty`.
- Render terminal output in a scrollable monospace `div` (not a full terminal emulator — we render plain text with ANSI color stripping for v1).
- Support keyboard input forwarded to the PTY stdin.
- Auto-scroll to bottom on new output.

### R2 — Agent Quick-Launch Toolbar
- Toolbar with buttons for known agents: "Claude Code", "Codex", "Aider", "Custom".
- Click opens a goal dialog (text input + "Launch" button).
- On launch: kill any running PTY process, inject environment, write mission brief, spawn agent command.

### R3 — Agent Command Templates
- Claude Code: `claude --yes --print "{goal}"`
- Codex: `codex --full-auto "{goal}"`
- Aider: `aider --message "{goal}"`
- Custom: user-provided command with `{goal}` placeholder.
- Commands stored in a `Vec<AgentTemplate>` in the view state.

### R4 — Environment Injection
- Before spawning, read `AuthProviderRegistry::discover()` and set relevant env vars in the PTY child process.
- Keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, and any others with `Discovered` or `Configured` status.

### R5 — Mission Brief Auto-Write
- Before launching a coding agent, write a `.cadet/CLAUDE.md` file in the working directory.
- Content: operator name, current goal, relevant memory context, standing orders from the Mission Journal.
- Read mission brief from web server `/api/journal` if available, else use a minimal template.

### R6 — Output Parsing (v1 — simple)
- Parse stdout for patterns indicating thinking blocks, tool calls, and diffs.
- Thinking: text between `<thinking>` and `</thinking>` markers, or `> ` prefixed lines.
- Tool calls: lines matching `Tool: ` or `Reading ` or `Writing `.
- Diffs: lines starting with `+` or `-` after a `---`/`+++` header.
- Wrap detected blocks in styled `div` containers for visual distinction.

### R7 — Process Management
- "Kill" button sends SIGKILL to the PTY child process.
- "Ctrl+C" button sends interrupt signal.
- Status bar shows: PID, running/exited status, elapsed time.
- On process exit, show exit code and "Restart" button.

### R8 — Working Directory
- Default cwd: user's home directory.
- "cwd" display in toolbar shows the current directory.
- Agent launch inherits the cwd.

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `rust/starbridge-dioxus/src/local_agent.rs` | **Create** | PTY spawning, env injection, process management |
| `rust/starbridge-dioxus/src/output_parser.rs` | **Create** | Detect thinking, tool calls, diffs in output |
| `rust/starbridge-dioxus/src/ui/views/terminal.rs` | **Create** | Terminal view component |
| `rust/starbridge-dioxus/src/ui/views/mod.rs` | **Modify** | Add `mod terminal;` |
| `rust/starbridge-dioxus/src/ui/models.rs` | **Modify** | Add `WorkspacePage::Terminal` variant |
| `rust/starbridge-dioxus/src/ui/styles.rs` | **Modify** | Add terminal-specific CSS |
| `rust/starbridge-dioxus/Cargo.toml` | **Modify** | Add `portable-pty` dependency behind `desktop-ui` feature |

---

## Implementation Steps

### Step 1 — Add portable-pty dependency and feature gate

**Commit:** `build(terminal): add portable-pty dependency behind desktop-ui feature`

```toml
# In Cargo.toml [dependencies]
portable-pty = { version = "0.8", optional = true }

# In [features]
desktop-ui = ["dioxus/desktop", "dep:dioxus-desktop", "dep:arboard", "dep:toml", "dep:reqwest", "dep:portable-pty"]
```

**Test:** `cargo build --features desktop-ui` succeeds.

---

### Step 2 — Output parser module

**Commit:** `feat(terminal): add output parser for thinking blocks, tool calls, and diffs`

```rust
// rust/starbridge-dioxus/src/output_parser.rs

#[derive(Debug, Clone, PartialEq)]
pub enum OutputBlock {
    PlainText(String),
    Thinking(String),
    ToolCall { tool: String, detail: String },
    Diff(String),
}

/// Parse a chunk of terminal output into classified blocks.
pub fn parse_output(raw: &str) -> Vec<OutputBlock> {
    let mut blocks = Vec::new();
    let mut current_plain = String::new();
    let mut in_thinking = false;
    let mut thinking_buf = String::new();
    let mut in_diff = false;
    let mut diff_buf = String::new();

    for line in raw.lines() {
        // Thinking block detection
        if line.contains("<thinking>") {
            if !current_plain.is_empty() {
                blocks.push(OutputBlock::PlainText(std::mem::take(&mut current_plain)));
            }
            in_thinking = true;
            thinking_buf.clear();
            continue;
        }
        if line.contains("</thinking>") {
            in_thinking = false;
            blocks.push(OutputBlock::Thinking(std::mem::take(&mut thinking_buf)));
            continue;
        }
        if in_thinking {
            thinking_buf.push_str(line);
            thinking_buf.push('\n');
            continue;
        }

        // Diff detection
        if line.starts_with("---") || line.starts_with("+++") {
            if !current_plain.is_empty() {
                blocks.push(OutputBlock::PlainText(std::mem::take(&mut current_plain)));
            }
            in_diff = true;
            diff_buf.push_str(line);
            diff_buf.push('\n');
            continue;
        }
        if in_diff && (line.starts_with('+') || line.starts_with('-') || line.starts_with('@') || line.starts_with(' ')) {
            diff_buf.push_str(line);
            diff_buf.push('\n');
            continue;
        }
        if in_diff {
            blocks.push(OutputBlock::Diff(std::mem::take(&mut diff_buf)));
            in_diff = false;
        }

        // Tool call detection
        if line.starts_with("Tool: ") || line.starts_with("Reading ") || line.starts_with("Writing ") {
            if !current_plain.is_empty() {
                blocks.push(OutputBlock::PlainText(std::mem::take(&mut current_plain)));
            }
            let (tool, detail) = if let Some(rest) = line.strip_prefix("Tool: ") {
                (rest.to_string(), String::new())
            } else {
                let parts: Vec<&str> = line.splitn(2, ' ').collect();
                (parts[0].to_string(), parts.get(1).unwrap_or(&"").to_string())
            };
            blocks.push(OutputBlock::ToolCall { tool, detail });
            continue;
        }

        // Plain text
        current_plain.push_str(line);
        current_plain.push('\n');
    }

    // Flush remaining buffers
    if in_thinking && !thinking_buf.is_empty() {
        blocks.push(OutputBlock::Thinking(thinking_buf));
    }
    if in_diff && !diff_buf.is_empty() {
        blocks.push(OutputBlock::Diff(diff_buf));
    }
    if !current_plain.is_empty() {
        blocks.push(OutputBlock::PlainText(current_plain));
    }

    blocks
}
```

**Test:** Unit tests for thinking blocks, diff blocks, tool call lines, plain text, and interleaved content.

---

### Step 3 — Local agent spawner with PTY management

**Commit:** `feat(terminal): add local_agent module for PTY spawn and env injection`

```rust
// rust/starbridge-dioxus/src/local_agent.rs

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};

pub struct AgentTemplate {
    pub name: String,
    pub command_template: String, // e.g. "claude --yes --print \"{goal}\""
}

impl AgentTemplate {
    pub fn builtin_templates() -> Vec<Self> {
        vec![
            AgentTemplate {
                name: "Claude Code".into(),
                command_template: "claude --yes --print \"{goal}\"".into(),
            },
            AgentTemplate {
                name: "Codex".into(),
                command_template: "codex --full-auto \"{goal}\"".into(),
            },
            AgentTemplate {
                name: "Aider".into(),
                command_template: "aider --message \"{goal}\"".into(),
            },
        ]
    }

    pub fn build_command(&self, goal: &str) -> String {
        self.command_template.replace("{goal}", goal)
    }
}

pub struct PtyHandle {
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
    pub writer: Box<dyn Write + Send>,
    pub reader: Box<dyn Read + Send>,
}

/// Spawn a PTY shell with the given command, cwd, and environment overrides.
pub fn spawn_pty(
    command: &str,
    cwd: &str,
    env_overrides: Vec<(String, String)>,
) -> Result<PtyHandle, String> {
    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: 40,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-c");
    cmd.arg(command);
    cmd.cwd(cwd);

    for (key, val) in env_overrides {
        cmd.env(key, val);
    }

    let child = pair.slave.spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn: {e}"))?;
    let reader = pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {e}"))?;
    let writer = pair.master.take_writer()
        .map_err(|e| format!("Failed to take writer: {e}"))?;

    Ok(PtyHandle { child, writer, reader })
}
```

**Test:** Spawn `echo hello`, read output, verify it contains "hello". Spawn `false`, verify non-zero exit code.

---

### Step 4 — Terminal view component

**Commit:** `feat(terminal): add TerminalView with PTY rendering and agent toolbar`

```rust
// rust/starbridge-dioxus/src/ui/views/terminal.rs (skeleton)

use dioxus::prelude::*;
use crate::local_agent::{AgentTemplate, spawn_pty};
use crate::output_parser::{parse_output, OutputBlock};
use crate::auth_provider::AuthProviderRegistry;

#[component]
pub fn TerminalView() -> Element {
    let mut output_lines = use_signal(String::new);
    let mut is_running = use_signal(|| false);
    let mut elapsed_secs = use_signal(|| 0u64);
    let mut show_goal_dialog = use_signal(|| None::<String>); // agent name
    let mut goal_input = use_signal(String::new);
    let templates = AgentTemplate::builtin_templates();
    let cwd = use_signal(|| {
        std::env::var("HOME").unwrap_or_else(|_| "/tmp".into())
    });

    let blocks = parse_output(&output_lines());

    rsx! {
        div { class: "page-grid page-grid-terminal",
            section { class: "panel", style: "grid-column: 1 / -1;",
                // Toolbar
                div { class: "terminal-toolbar",
                    for tpl in templates.iter() {
                        button {
                            class: "secondary-button",
                            disabled: is_running(),
                            onclick: {
                                let name = tpl.name.clone();
                                move |_| show_goal_dialog.set(Some(name.clone()))
                            },
                            "{tpl.name}"
                        }
                    }
                    span { class: "pill pill-subtle", "cwd: {cwd}" }
                }

                // Goal dialog (modal-like overlay)
                if let Some(agent_name) = show_goal_dialog() {
                    div { class: "goal-dialog-overlay",
                        div { class: "goal-dialog",
                            h3 { "Launch {agent_name}" }
                            textarea {
                                class: "composer-input",
                                placeholder: "Describe the task...",
                                value: goal_input(),
                                oninput: move |e| goal_input.set(e.value()),
                            }
                            div { class: "chip-row",
                                button {
                                    class: "secondary-button",
                                    onclick: move |_| show_goal_dialog.set(None),
                                    "Cancel"
                                }
                                button {
                                    class: "primary-button",
                                    onclick: move |_| {
                                        // Spawn PTY with the agent template
                                        show_goal_dialog.set(None);
                                        is_running.set(true);
                                        // ... spawn logic in async task
                                    },
                                    "Launch"
                                }
                            }
                        }
                    }
                }

                // Terminal output
                div { class: "terminal-output",
                    for block in blocks.iter() {
                        match block {
                            OutputBlock::PlainText(text) => rsx! {
                                pre { class: "term-plain", "{text}" }
                            },
                            OutputBlock::Thinking(text) => rsx! {
                                div { class: "term-thinking",
                                    span { class: "term-block-label", "thinking" }
                                    pre { "{text}" }
                                }
                            },
                            OutputBlock::ToolCall { tool, detail } => rsx! {
                                div { class: "term-tool",
                                    span { class: "term-block-label", "{tool}" }
                                    span { "{detail}" }
                                }
                            },
                            OutputBlock::Diff(text) => rsx! {
                                pre { class: "term-diff", "{text}" }
                            },
                        }
                    }
                }

                // Status bar
                div { class: "terminal-status",
                    if is_running() {
                        span { class: "status-dot status-dot-running" }
                        span { "Running | {elapsed_secs}s" }
                        button { class: "secondary-button", "Ctrl+C" }
                        button { class: "secondary-button", "Kill" }
                    } else {
                        span { class: "status-dot status-dot-idle" }
                        span { "Idle" }
                    }
                }
            }
        }
    }
}
```

**Test:** Build the app, navigate to Terminal, verify toolbar renders with agent buttons, verify empty terminal area displays.

---

### Step 5 — Wire PTY output to the view via async reader

**Commit:** `feat(terminal): wire PTY stdout to terminal output signal via async reader`

Add a background Tokio task that reads from the PTY reader and pushes chunks into the `output_lines` signal.

```rust
// Inside the launch button onclick handler:
spawn(async move {
    let registry = AuthProviderRegistry::discover();
    let env_vars: Vec<(String, String)> = registry.providers.iter()
        .filter(|p| p.token.is_some())
        .filter_map(|p| {
            let env_key = match p.provider_id.as_str() {
                "anthropic" => Some("ANTHROPIC_API_KEY"),
                "openai" => Some("OPENAI_API_KEY"),
                "github" => Some("GITHUB_TOKEN"),
                _ => None,
            };
            env_key.map(|k| (k.to_string(), p.token.clone().unwrap()))
        })
        .collect();

    match spawn_pty(&command, &cwd(), env_vars) {
        Ok(mut handle) => {
            let mut buf = [0u8; 4096];
            loop {
                match handle.reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]);
                        output_lines.write().push_str(&text);
                    }
                    Err(_) => break,
                }
            }
            is_running.set(false);
        }
        Err(err) => {
            output_lines.write().push_str(&format!("\nError: {err}\n"));
            is_running.set(false);
        }
    }
});
```

**Test:** Launch `echo hello && sleep 1 && echo world`, verify both lines appear in the terminal output with a gap.

---

### Step 6 — Terminal CSS and navigation integration

**Commit:** `style(terminal): add terminal styles and wire into navigation`

Add `WorkspacePage::Terminal` to `models.rs` and add CSS to `styles.rs`:

```css
.page-grid-terminal {
    grid-template-columns: 1fr;
}
.terminal-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--outline-variant);
    background: var(--surface-container-low);
}
.terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    background: #1a1a1f;
    color: #e8e6e3;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.6;
    min-height: 400px;
}
.term-plain { margin: 0; white-space: pre-wrap; }
.term-thinking {
    border-left: 2px solid var(--tertiary-container);
    padding: 4px 10px;
    margin: 6px 0;
    opacity: 0.8;
}
.term-tool {
    background: rgba(82, 98, 88, 0.15);
    padding: 4px 10px;
    margin: 4px 0;
    display: flex;
    gap: 8px;
}
.term-diff {
    margin: 4px 0;
    white-space: pre-wrap;
}
.term-diff > *:first-child { color: #e55; }  /* removed lines */
.term-block-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tertiary-container);
}
.terminal-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-top: 1px solid var(--outline-variant);
    font-size: 11px;
    background: var(--surface-container-low);
}
.status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot-running { background: #4a7; animation: pulse 1.5s infinite; }
.status-dot-idle { background: var(--secondary); }
.goal-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
}
.goal-dialog {
    background: var(--surface);
    padding: 24px;
    min-width: 400px;
    box-shadow: var(--shadow);
}
```

**Test:** Navigate to Terminal via sidebar, verify all style elements render correctly. Build succeeds.

---

## Regression Tests

| # | Test | Validates |
|---|------|-----------|
| 1 | `test_parse_output_thinking` | `<thinking>...` parsed into `Thinking` block |
| 2 | `test_parse_output_diff` | `---/+++` lines parsed into `Diff` block |
| 3 | `test_parse_output_tool_call` | `Tool: read_file` parsed into `ToolCall` |
| 4 | `test_parse_output_mixed` | Interleaved plain + thinking + diff produces correct block sequence |
| 5 | `test_parse_output_plain_only` | Plain text input produces single `PlainText` block |
| 6 | `test_agent_template_build_command` | `{goal}` placeholder replaced correctly |
| 7 | `test_builtin_templates_count` | 3 built-in templates exist |
| 8 | `test_spawn_pty_echo` | `echo hello` returns output containing "hello" |
| 9 | `test_spawn_pty_exit_code` | `false` command produces non-zero exit |
| 10 | `cargo build --features desktop-ui` | Full app compiles with portable-pty |

---

## Definition of Done

- [ ] Terminal view accessible via sidebar navigation (Cmd+T shortcut)
- [ ] PTY shell spawns and renders output in monospace area
- [ ] Agent toolbar shows Claude Code, Codex, Aider buttons
- [ ] Click agent button opens goal dialog
- [ ] Agent launch injects API keys from AuthProviderRegistry
- [ ] Output parser detects thinking blocks and renders with styled border
- [ ] Output parser detects diffs and renders with color coding
- [ ] Output parser detects tool calls and renders as labeled blocks
- [ ] Kill and Ctrl+C buttons terminate the running process
- [ ] Status bar shows running/idle state with elapsed time
- [ ] All 10 regression tests pass
- [ ] `cargo build --features desktop-ui` succeeds

---

## PR Template

```markdown
## Summary
- Added embedded PTY terminal view with `portable-pty` crate
- Built agent quick-launch toolbar (Claude Code, Codex, Aider)
- Implemented output parser for thinking blocks, tool calls, and diffs
- Added process management (kill, Ctrl+C, status bar)
- Integrated env injection from AuthProviderRegistry

## Test plan
- [ ] Open Terminal view, verify zsh prompt appears
- [ ] Click "Claude Code", enter a goal, verify agent launches
- [ ] Verify thinking blocks render with styled border
- [ ] Verify diff output renders with color coding
- [ ] Click "Kill" during a running process, verify it stops
- [ ] Run `cargo test` — all 10 tests pass
- [ ] Run `cargo build --features desktop-ui` — builds clean
```
