# Cadet Augmentation System

Custom skills, agents, and commands for the Cadet autonomous agent platform.

## Structure

```
.cadet/
├── skills/          Autonomous helpers — activate on file patterns
│   ├── agent-manifest.md    Agent manifest validation & authoring
│   ├── workflow-ops.md      Workflow stages, steps, approval gates
│   ├── control-plane.md     Dual control plane API patterns
│   └── memory-system.md     Vector memory pipeline
├── agents/          Specialized sub-agents — named after US launch programs
│   ├── apollo.md    Apollo — Mission control debugger
│   ├── mercury.md   Mercury — Pre-flight manifest validator
│   ├── atlas.md     Atlas — Launch vehicle deployment operator
│   └── titan.md     Titan — Heavy data analyst for SpacetimeDB
└── commands/        Slash commands — invoke with /name
    ├── dispatch.md          Dispatch a job to an agent
    ├── workflow-status.md   Check workflow run status
    ├── agent-catalog.md     List registered agents
    └── spacetime-query.md   Run SpacetimeDB SQL queries
```

## Usage

Skills activate automatically when editing matching files.

```bash
# Agents (named after US launch programs)
@apollo Why is run_01 stuck?
@mercury Check saturn.agent.json
@atlas Deploy to production
@titan Show active runs

# Commands
/dispatch saturn "Triage the deploy incident"
/workflow-status run_01
/agent-catalog
/spacetime-query SELECT * FROM workflow_run WHERE status = 'running'
```

## Tools

The agent tool registry lives in `packages/core/src/tools.ts`. All 30 tools are documented in [`docs/TOOLS_REFERENCE.md`](../docs/TOOLS_REFERENCE.md). See [`docs/AGENT_TOOLS_GUIDE.md`](../docs/AGENT_TOOLS_GUIDE.md) for how tools are filtered, formatted, and approved at runtime.

### Context (5 tools — always available)
| Tool | Description |
|------|-------------|
| `query_memory` | Search vector memory for relevant prior knowledge |
| `store_memory` | Persist a document with embeddings to agent's namespace |
| `load_context` | Load a prompt/knowledge file from `.cadet/prompts/` |
| `get_trajectory` | Review recent execution history for continuity |
| `log_step` | Log a completed step as a trajectory entry |

### State (3 tools — always available)
| Tool | Description |
|------|-------------|
| `query_state` | Run a SQL SELECT against the SpacetimeDB control database |
| `create_approval` | Create a human-in-the-loop approval gate |
| `handoff` | Hand off work to another execution runner |

### Browser (2 tools — requires `allowBrowser`)
| Tool | Description |
|------|-------------|
| `browse` | Extract content from a URL using agent-browser |
| `screenshot` | Take a screenshot of a web page |

### Crypto (8 tools — requires `allowNetwork`)
| Tool | Description |
|------|-------------|
| `dex_search` | Search for token pairs on DexScreener |
| `dex_pairs` | Get pair data by chain and pair address |
| `dex_tokens` | Get all pairs for a token address |
| `jup_quote` | Get a swap quote from Jupiter aggregator |
| `jup_price` | Get token price from Jupiter |
| `jup_portfolio` | View wallet portfolio via Jupiter |
| `coingecko_price` | Get token price and 24h change from CoinGecko |
| `coingecko_trending` | Get trending coins from CoinGecko |

### Platform (4 tools — requires `allowNetwork`)
| Tool | Description |
|------|-------------|
| `vercel_deploy` | Deploy the web app to Vercel [APPROVAL] |
| `vercel_logs` | View Vercel function logs |
| `github_issue` | Create a GitHub issue [APPROVAL] |
| `github_search` | Search GitHub code, issues, or repos |

### Communication (4 tools — requires `allowNetwork`)
| Tool | Description |
|------|-------------|
| `send_email` | Send an email via himalaya CLI [APPROVAL] |
| `list_emails` | List emails in a mailbox folder via himalaya |
| `read_email` | Read a specific email by ID via himalaya |
| `post_message` | Send to Slack/Discord/GitHub/Telegram via Chat SDK [APPROVAL] |

### Execution (4 tools — requires `allowExec` or `allowNetwork`)
| Tool | Description |
|------|-------------|
| `spotify_now_playing` | Get currently playing track from Spotify Web API |
| `spotify_search` | Search Spotify for tracks, albums, or artists |
| `search_web` | Search the web via Serper API |
| `run_code` | Execute code in an E2B sandbox [APPROVAL] |

## Integration with Agent Manifests

The `.cadet/` augmentation system works alongside Cadet's `.agent.json` manifests in `examples/agents/`. Skills validate manifest structure, agents debug runtime issues, and commands interact with the control plane.
