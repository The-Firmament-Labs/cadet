/**
 * Cadet Agent Registry
 *
 * Maps agent identifiers to their configuration: how to spawn them inside
 * a Vercel Sandbox, what they can do, and what model they default to.
 * Inspired by ACPX's agent registry but platform-native.
 */

export interface AgentConfig {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Command to run the agent inside a sandbox */
  command: string;
  /** npm install command to set up the agent (run once per snapshot) */
  installCommand: string;
  /** Check command to see if agent is already installed */
  checkCommand: string;
  /** What the agent can do */
  capabilities: readonly string[];
  /** Default AI model (AI Gateway format) */
  defaultModel: string;
  /** Whether the agent speaks ACP JSON-RPC natively */
  supportsAcp: boolean;
  /** Env var name for the agent's API key */
  apiKeyEnvVar: string;
  /** Description shown in the UI */
  description: string;
}

export const AGENT_REGISTRY: readonly AgentConfig[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude --yes --print",
    installCommand: "npm install -g @anthropic-ai/claude-code",
    checkCommand: "which claude",
    capabilities: ["code", "debug", "test", "refactor", "review", "explain", "architect"],
    defaultModel: "anthropic/claude-sonnet-4.5",
    supportsAcp: false,
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    description: "Anthropic's coding agent. Full codebase understanding, multi-file edits, test generation.",
  },
  {
    id: "codex",
    name: "Codex CLI",
    command: "codex --quiet",
    installCommand: "npm install -g @openai/codex",
    checkCommand: "which codex",
    capabilities: ["code", "debug", "test", "explain"],
    defaultModel: "openai/gpt-5.4",
    supportsAcp: true,
    apiKeyEnvVar: "OPENAI_API_KEY",
    description: "OpenAI's coding CLI. Fast code generation and debugging.",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    command: "gemini",
    installCommand: "npm install -g @google/gemini-cli",
    checkCommand: "which gemini",
    capabilities: ["code", "debug", "research", "explain"],
    defaultModel: "google/gemini-3.1-flash",
    supportsAcp: true,
    apiKeyEnvVar: "GOOGLE_API_KEY",
    description: "Google's Gemini agent. Strong at research and multi-modal tasks.",
  },
  {
    id: "aider",
    name: "Aider",
    command: "aider --yes --no-auto-commits --message",
    installCommand: "pip install aider-chat",
    checkCommand: "which aider",
    capabilities: ["code", "refactor", "debug"],
    defaultModel: "anthropic/claude-sonnet-4.5",
    supportsAcp: false,
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    description: "AI pair programming in the terminal. Git-aware multi-file edits.",
  },
  {
    id: "cursor-agent",
    name: "Cursor Agent",
    command: "cursor-agent",
    installCommand: "npm install -g cursor-agent",
    checkCommand: "which cursor-agent",
    capabilities: ["code", "debug", "refactor"],
    defaultModel: "anthropic/claude-sonnet-4.5",
    supportsAcp: true,
    apiKeyEnvVar: "CURSOR_API_KEY",
    description: "Cursor's headless coding agent.",
  },
  {
    id: "copilot",
    name: "GitHub Copilot CLI",
    command: "copilot --acp --stdio",
    installCommand: "npm install -g @github/copilot-cli",
    checkCommand: "which copilot",
    capabilities: ["code", "explain", "test"],
    defaultModel: "openai/gpt-5.4",
    supportsAcp: true,
    apiKeyEnvVar: "GITHUB_TOKEN",
    description: "GitHub Copilot in the terminal.",
  },
];

/** Look up an agent by ID. Returns undefined if not found. */
export function getAgentConfig(agentId: string): AgentConfig | undefined {
  return AGENT_REGISTRY.find((a) => a.id === agentId);
}

/** Get all agents that have a specific capability. */
export function getAgentsByCapability(capability: string): AgentConfig[] {
  return AGENT_REGISTRY.filter((a) => a.capabilities.includes(capability));
}

/** All unique capabilities across all agents. */
export function getAllCapabilities(): string[] {
  const caps = new Set<string>();
  for (const agent of AGENT_REGISTRY) {
    for (const cap of agent.capabilities) caps.add(cap);
  }
  return Array.from(caps).sort();
}
