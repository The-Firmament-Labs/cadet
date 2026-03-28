/**
 * Cadet Agent Tool Registry
 *
 * Every tool is a direct API call or CLI invocation — no MCP overhead.
 * Tools are defined here and exposed to agents via composeRuntimePrompt().
 *
 * Categories:
 * - Context: memory, prompts, trajectories
 * - State: SpacetimeDB queries and reducers
 * - Browser: web extraction and automation
 * - Crypto: DexScreener, Jupiter, CoinGecko
 * - Platform: Vercel, GitHub
 * - Communication: email (himalaya), multi-platform messaging (Chat SDK)
 * - Execution: Spotify Web API, web search, code sandboxes
 */

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  /** CLI command pattern (for CLI-backed tools) */
  cli?: string | undefined;
  /** HTTP endpoint pattern (for API-backed tools) */
  api?: string | undefined;
  /** SpacetimeDB reducer name (for state tools) */
  reducer?: string | undefined;
  /** Input parameters */
  params: ToolParam[];
  /** Whether this tool requires approval before execution */
  requiresApproval: boolean;
}

export interface ToolParam {
  name: string;
  type: "string" | "number" | "boolean" | "object";
  required: boolean;
  description: string;
}

export type ToolCategory =
  | "context"
  | "state"
  | "browser"
  | "crypto"
  | "platform"
  | "communication"
  | "execution";

// ── Tool Definitions ────────────────────────────────────────────────

export const AGENT_TOOLS: ToolDefinition[] = [
  // ── Context Tools ───────────────────────────────────────────────
  {
    name: "query_memory",
    description: "Search vector memory for relevant prior knowledge in agent's namespace",
    category: "context",
    api: "POST /api/memory/query",
    params: [
      { name: "namespace", type: "string", required: true, description: "Memory namespace (e.g., 'operations', 'research')" },
      { name: "query", type: "string", required: true, description: "Natural language search query" },
      { name: "max_chunks", type: "number", required: false, description: "Max chunks to return (default: 8)" },
    ],
    requiresApproval: false,
  },
  {
    name: "store_memory",
    description: "Persist a document with chunks and embeddings to agent's memory namespace",
    category: "context",
    reducer: "insert_memory_document",
    params: [
      { name: "title", type: "string", required: true, description: "Document title" },
      { name: "content", type: "string", required: true, description: "Document content" },
      { name: "source_kind", type: "string", required: true, description: "run-summary | web-extract | user-note | api-response" },
      { name: "namespace", type: "string", required: true, description: "Memory namespace" },
    ],
    requiresApproval: false,
  },
  {
    name: "load_context",
    description: "Load a prompt or knowledge file from .cadet/prompts/",
    category: "context",
    params: [
      { name: "path", type: "string", required: true, description: "File path relative to .cadet/prompts/ (e.g., 'agents/saturn.md')" },
    ],
    requiresApproval: false,
  },
  {
    name: "get_trajectory",
    description: "Review recent execution history for continuity",
    category: "context",
    params: [
      { name: "run_id", type: "string", required: true, description: "Workflow run ID" },
      { name: "last_n_steps", type: "number", required: false, description: "Number of recent steps (default: 5)" },
    ],
    requiresApproval: false,
  },
  {
    name: "log_step",
    description: "Log a completed step as a trajectory entry for training data",
    category: "context",
    reducer: "log_trajectory",
    params: [
      { name: "run_id", type: "string", required: true, description: "Workflow run ID" },
      { name: "step_id", type: "string", required: true, description: "Step ID" },
      { name: "output", type: "string", required: true, description: "Step output/result" },
      { name: "success", type: "boolean", required: true, description: "Whether the step succeeded" },
    ],
    requiresApproval: false,
  },

  // ── State Tools (SpacetimeDB) ───────────────────────────────────
  {
    name: "query_state",
    description: "Run a SQL query against the SpacetimeDB control database",
    category: "state",
    api: "POST /api/spacetime/sql",
    params: [
      { name: "sql", type: "string", required: true, description: "SQL query (SELECT only)" },
    ],
    requiresApproval: false,
  },
  {
    name: "create_approval",
    description: "Create a human-in-the-loop approval gate",
    category: "state",
    reducer: "create_approval_request",
    params: [
      { name: "title", type: "string", required: true, description: "What needs approval" },
      { name: "detail", type: "string", required: true, description: "Context for the operator" },
      { name: "risk", type: "string", required: true, description: "low | medium | high | critical" },
    ],
    requiresApproval: false,
  },
  {
    name: "handoff",
    description: "Hand off work to another execution runner",
    category: "state",
    reducer: "create_workflow_step",
    params: [
      { name: "target", type: "string", required: true, description: "Target runner: container-runner | browser-worker | local-runner" },
      { name: "stage", type: "string", required: true, description: "Workflow stage for the new step" },
      { name: "input", type: "object", required: true, description: "Context to pass to the target" },
    ],
    requiresApproval: false,
  },

  // ── Browser Tools ───────────────────────────────────────────────
  {
    name: "browse",
    description: "Extract content from a URL using agent-browser",
    category: "browser",
    cli: "agent-browser open {url} && agent-browser wait --load networkidle && agent-browser snapshot -i",
    params: [
      { name: "url", type: "string", required: true, description: "URL to browse" },
      { name: "extract", type: "string", required: false, description: "What to extract (text, links, data)" },
    ],
    requiresApproval: false,
  },
  {
    name: "screenshot",
    description: "Take a screenshot of a web page",
    category: "browser",
    cli: "agent-browser open {url} && agent-browser wait --load networkidle && agent-browser screenshot {output}",
    params: [
      { name: "url", type: "string", required: true, description: "URL to screenshot" },
      { name: "output", type: "string", required: false, description: "Output file path" },
    ],
    requiresApproval: false,
  },

  // ── Crypto Tools ────────────────────────────────────────────────
  {
    name: "dex_search",
    description: "Search for token pairs on DexScreener (free API, no key needed)",
    category: "crypto",
    api: "GET https://api.dexscreener.com/latest/dex/search?q={query}",
    params: [
      { name: "query", type: "string", required: true, description: "Token name, symbol, or address" },
    ],
    requiresApproval: false,
  },
  {
    name: "dex_pairs",
    description: "Get pair data from DexScreener by chain and pair address",
    category: "crypto",
    api: "GET https://api.dexscreener.com/latest/dex/pairs/{chain}/{address}",
    params: [
      { name: "chain", type: "string", required: true, description: "Chain ID (solana, ethereum, etc.)" },
      { name: "address", type: "string", required: true, description: "Pair contract address" },
    ],
    requiresApproval: false,
  },
  {
    name: "dex_tokens",
    description: "Get all pairs for a token address on DexScreener",
    category: "crypto",
    api: "GET https://api.dexscreener.com/latest/dex/tokens/{address}",
    params: [
      { name: "address", type: "string", required: true, description: "Token contract address" },
    ],
    requiresApproval: false,
  },
  {
    name: "jup_quote",
    description: "Get a swap quote from Jupiter aggregator (Solana)",
    category: "crypto",
    cli: "jup spot quote --input-mint {input_mint} --output-mint {output_mint} --amount {amount} --format json",
    params: [
      { name: "input_mint", type: "string", required: true, description: "Input token mint address" },
      { name: "output_mint", type: "string", required: true, description: "Output token mint address" },
      { name: "amount", type: "string", required: true, description: "Amount in base units" },
    ],
    requiresApproval: false,
  },
  {
    name: "jup_price",
    description: "Get token price from Jupiter",
    category: "crypto",
    cli: "jup spot price {token} --format json",
    params: [
      { name: "token", type: "string", required: true, description: "Token symbol or mint address" },
    ],
    requiresApproval: false,
  },
  {
    name: "jup_portfolio",
    description: "View wallet portfolio via Jupiter",
    category: "crypto",
    cli: "jup spot portfolio --format json",
    params: [],
    requiresApproval: false,
  },
  {
    name: "coingecko_price",
    description: "Get token price and 24h change from CoinGecko (free, 10k calls/mo)",
    category: "crypto",
    api: "GET https://api.coingecko.com/api/v3/simple/price?ids={coin}&vs_currencies=usd&include_24hr_change=true",
    params: [
      { name: "coin", type: "string", required: true, description: "CoinGecko coin ID (e.g., 'solana', 'bitcoin')" },
    ],
    requiresApproval: false,
  },
  {
    name: "coingecko_trending",
    description: "Get trending coins from CoinGecko",
    category: "crypto",
    api: "GET https://api.coingecko.com/api/v3/search/trending",
    params: [],
    requiresApproval: false,
  },

  // ── Platform Tools ──────────────────────────────────────────────
  {
    name: "vercel_deploy",
    description: "Deploy the web app to Vercel",
    category: "platform",
    cli: "vercel deploy {prod ? '--prod' : ''}",
    params: [
      { name: "prod", type: "boolean", required: false, description: "Deploy to production (default: preview)" },
    ],
    requiresApproval: true,
  },
  {
    name: "vercel_logs",
    description: "View Vercel function logs",
    category: "platform",
    cli: "vercel logs {deployment_url}",
    params: [
      { name: "deployment_url", type: "string", required: true, description: "Deployment URL to inspect" },
    ],
    requiresApproval: false,
  },
  {
    name: "github_issue",
    description: "Create or comment on a GitHub issue",
    category: "platform",
    api: "POST https://api.github.com/repos/{repo}/issues",
    params: [
      { name: "repo", type: "string", required: true, description: "owner/repo format" },
      { name: "title", type: "string", required: true, description: "Issue title" },
      { name: "body", type: "string", required: true, description: "Issue body (markdown)" },
    ],
    requiresApproval: true,
  },
  {
    name: "github_search",
    description: "Search GitHub code, issues, or repos",
    category: "platform",
    api: "GET https://api.github.com/search/{type}?q={query}",
    params: [
      { name: "type", type: "string", required: true, description: "code | issues | repositories" },
      { name: "query", type: "string", required: true, description: "Search query" },
    ],
    requiresApproval: false,
  },

  // ── Communication Tools ─────────────────────────────────────────
  // EMAIL (himalaya CLI — installed at /opt/homebrew/bin/himalaya)
  {
    name: "send_email",
    description: "Send an email via himalaya CLI",
    category: "communication",
    cli: "himalaya send --to {to} --subject \"{subject}\" --body \"{body}\"",
    params: [
      { name: "to", type: "string", required: true, description: "Recipient email" },
      { name: "subject", type: "string", required: true, description: "Email subject" },
      { name: "body", type: "string", required: true, description: "Email body" },
    ],
    requiresApproval: true,
  },
  {
    name: "list_emails",
    description: "List emails in a mailbox folder via himalaya",
    category: "communication",
    cli: "himalaya list --folder {folder}",
    params: [
      { name: "folder", type: "string", required: false, description: "Folder name (default: INBOX)" },
    ],
    requiresApproval: false,
  },
  {
    name: "read_email",
    description: "Read a specific email by ID via himalaya",
    category: "communication",
    cli: "himalaya read {id}",
    params: [
      { name: "id", type: "string", required: true, description: "Email ID" },
    ],
    requiresApproval: false,
  },
  // CHAT SDK (unified multi-platform messaging — replaces post_slack + post_github_comment)
  {
    name: "post_message",
    description: "Send message to any connected platform via Chat SDK (Slack, Discord, GitHub, Telegram)",
    category: "communication",
    api: "POST /api/bot/{platform}/send",
    params: [
      { name: "platform", type: "string", required: true, description: "slack | discord | github | telegram" },
      { name: "channel", type: "string", required: true, description: "Channel or thread ID" },
      { name: "text", type: "string", required: true, description: "Message text" },
    ],
    requiresApproval: true,
  },

  // ── Execution Tools ─────────────────────────────────────────────
  // SPOTIFY (Web API — spotify-tui doesn't compile, use API directly)
  {
    name: "spotify_now_playing",
    description: "Get currently playing track from Spotify Web API",
    category: "execution",
    api: "GET https://api.spotify.com/v1/me/player/currently-playing",
    params: [],
    requiresApproval: false,
  },
  {
    name: "spotify_search",
    description: "Search Spotify for tracks, albums, or artists",
    category: "execution",
    api: "GET https://api.spotify.com/v1/search?q={query}&type={type}",
    params: [
      { name: "query", type: "string", required: true, description: "Search query" },
      { name: "type", type: "string", required: false, description: "track | album | artist (default: track)" },
    ],
    requiresApproval: false,
  },
  {
    name: "search_web",
    description: "Search the web for information",
    category: "execution",
    api: "GET https://api.serper.dev/search",
    params: [
      { name: "query", type: "string", required: true, description: "Search query" },
      { name: "num", type: "number", required: false, description: "Number of results (default: 5)" },
    ],
    requiresApproval: false,
  },
  {
    name: "run_code",
    description: "Execute code in a sandboxed environment (E2B)",
    category: "execution",
    api: "POST https://api.e2b.dev/sandboxes",
    params: [
      { name: "code", type: "string", required: true, description: "Code to execute" },
      { name: "language", type: "string", required: true, description: "typescript | python | rust" },
    ],
    requiresApproval: true,
  },
];

/** Get tools available for a specific agent based on manifest permissions */
export function getAgentTools(manifest: {
  tools: {
    allowExec: boolean;
    allowBrowser: boolean;
    allowNetwork: boolean;
    allowMcp: boolean;
  };
  tags: string[];
}): ToolDefinition[] {
  return AGENT_TOOLS.filter((tool) => {
    // Context and state tools are always available
    if (tool.category === "context" || tool.category === "state") return true;

    // Browser tools require allowBrowser
    if (tool.category === "browser") return manifest.tools.allowBrowser;

    // Crypto tools require allowNetwork
    if (tool.category === "crypto") return manifest.tools.allowNetwork;

    // Platform tools require allowNetwork
    if (tool.category === "platform") return manifest.tools.allowNetwork;

    // Communication tools require allowNetwork
    if (tool.category === "communication") return manifest.tools.allowNetwork;

    // Execution tools require allowExec
    if (tool.category === "execution") return manifest.tools.allowExec;

    return false;
  });
}

/** Format tools list for inclusion in agent prompt */
export function formatToolsForPrompt(tools: ToolDefinition[]): string {
  const byCategory = new Map<ToolCategory, ToolDefinition[]>();
  for (const tool of tools) {
    const list = byCategory.get(tool.category) ?? [];
    list.push(tool);
    byCategory.set(tool.category, list);
  }

  const sections: string[] = [];
  for (const [category, categoryTools] of byCategory) {
    sections.push(`## ${category.toUpperCase()}`);
    for (const tool of categoryTools) {
      const params = tool.params
        .map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`)
        .join(", ");
      sections.push(`- **${tool.name}**(${params})${tool.requiresApproval ? " [APPROVAL]" : ""}`);
      sections.push(`  ${tool.description}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}
