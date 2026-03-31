export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type ApiCategory = "auth" | "agents" | "runs" | "sandboxes" | "chat" | "memory" | "approvals" | "threads" | "webhooks" | "usage" | "infra" | "bots";
export type ApiAuth = "none" | "session" | "cron" | "internal";

export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  description: string;
  category: ApiCategory;
  auth: ApiAuth;
  params?: ApiParam[];
  body?: ApiParam[];
  response?: string;
}

export const API_REGISTRY: ApiEndpoint[] = [
  // ── Auth ───────────────────────────────────────────────────────────
  { method: "POST", path: "/api/auth/register", description: "Register a new operator account with WebAuthn passkey", category: "auth", auth: "none", body: [{ name: "step", type: "string", required: true, description: "'options' or 'verify'" }, { name: "email", type: "string", required: true, description: "Operator email" }] },
  { method: "POST", path: "/api/auth/login", description: "Sign in with WebAuthn passkey", category: "auth", auth: "none", body: [{ name: "step", type: "string", required: true, description: "'options' or 'verify'" }, { name: "email", type: "string", required: true, description: "Operator email" }] },
  { method: "POST", path: "/api/auth/logout", description: "Sign out and clear session", category: "auth", auth: "session" },
  { method: "POST", path: "/api/auth/ssh-key", description: "Generate an ed25519 SSH key pair", category: "auth", auth: "session" },
  { method: "GET", path: "/api/auth/vercel/authorize", description: "Redirect to Vercel OAuth (Sign in with Vercel)", category: "auth", auth: "none", params: [{ name: "returnTo", type: "string", required: false, description: "URL to redirect after auth" }] },
  { method: "GET", path: "/api/auth/vercel/callback", description: "Vercel OAuth callback — exchanges code for tokens", category: "auth", auth: "none" },
  { method: "POST", path: "/api/auth/vercel/refresh", description: "Refresh expired Vercel access token", category: "auth", auth: "session" },
  { method: "GET", path: "/api/auth/me", description: "Current operator session info", category: "auth", auth: "session", response: '{ ok: true, operator: { operatorId, displayName, email, role, hasVercelToken } }' },

  // ── Agents ─────────────────────────────────────────────────────────
  { method: "GET", path: "/api/catalog", description: "List built-in agent catalog (public)", category: "agents", auth: "none", response: '{ ok: true, agents: AgentManifest[] }' },
  { method: "POST", path: "/api/agents/register", description: "Register an agent manifest in SpacetimeDB", category: "agents", auth: "session", body: [{ name: "manifest", type: "AgentManifest", required: true, description: "Full agent manifest JSON" }] },
  { method: "GET", path: "/api/agents/config", description: "List agent configs for current operator", category: "agents", auth: "session" },
  { method: "POST", path: "/api/agents/config", description: "Save custom agent configuration", category: "agents", auth: "session", body: [{ name: "agentId", type: "string", required: true, description: "Agent to configure" }, { name: "displayName", type: "string", required: true, description: "Display name" }, { name: "modelOverride", type: "string", required: false, description: "Model override (provider/model)" }, { name: "repoUrl", type: "string", required: false, description: "Default repository URL" }] },
  { method: "GET", path: "/api/agents/{agentId}", description: "Get single agent details", category: "agents", auth: "session" },
  { method: "PATCH", path: "/api/agents/{agentId}", description: "Update agent manifest", category: "agents", auth: "session" },
  { method: "DELETE", path: "/api/agents/{agentId}", description: "Delete agent registration", category: "agents", auth: "session" },
  { method: "POST", path: "/api/agents/{agentId}/invoke", description: "Invoke an agent directly with a goal", category: "agents", auth: "session", body: [{ name: "goal", type: "string", required: true, description: "Task for the agent" }, { name: "context", type: "object", required: false, description: "Additional context" }], response: '{ ok: true, runId: string }' },
  { method: "POST", path: "/api/agents/edge/dispatch", description: "Dispatch to an edge agent", category: "agents", auth: "session", body: [{ name: "agentId", type: "string", required: true, description: "Agent ID" }, { name: "goal", type: "string", required: true, description: "Goal" }] },

  // ── Jobs & Runs ────────────────────────────────────────────────────
  { method: "POST", path: "/api/jobs/dispatch", description: "Dispatch a new workflow job", category: "runs", auth: "session", body: [{ name: "agentId", type: "string", required: true, description: "Agent to dispatch" }, { name: "goal", type: "string", required: true, description: "Mission goal" }], response: '{ ok: true, result: { job, workflow? } }' },
  { method: "GET", path: "/api/runs", description: "List all workflow runs", category: "runs", auth: "session", params: [{ name: "limit", type: "number", required: false, description: "Max results (default 50)" }, { name: "status", type: "string", required: false, description: "Filter by status" }] },
  { method: "GET", path: "/api/runs/{runId}", description: "Get run detail with steps, messages, approvals", category: "runs", auth: "session" },
  { method: "POST", path: "/api/runs/{runId}/retry", description: "Retry a failed or blocked run", category: "runs", auth: "session" },
  { method: "GET", path: "/api/runs/{runId}/output", description: "Get the final output of a completed run", category: "runs", auth: "session" },

  // ── Chat ───────────────────────────────────────────────────────────
  { method: "GET", path: "/api/chat", description: "Load conversation history", category: "chat", auth: "session" },
  { method: "POST", path: "/api/chat", description: "Send a message to the Cadet router agent (streaming)", category: "chat", auth: "session", body: [{ name: "messages", type: "UIMessage[]", required: true, description: "Conversation messages" }], response: "SSE stream (AI SDK UIMessage format)" },

  // ── Sandboxes ──────────────────────────────────────────────────────
  { method: "GET", path: "/api/sandboxes", description: "List sandboxes for current operator", category: "sandboxes", auth: "session" },
  { method: "POST", path: "/api/sandboxes", description: "Create a new Vercel Sandbox", category: "sandboxes", auth: "session", body: [{ name: "agentId", type: "string", required: true, description: "Agent to run" }, { name: "runId", type: "string", required: false, description: "Associated run" }] },
  { method: "GET", path: "/api/sandboxes/{sandboxId}", description: "Get sandbox details", category: "sandboxes", auth: "session" },
  { method: "POST", path: "/api/sandboxes/{sandboxId}", description: "Sandbox lifecycle action", category: "sandboxes", auth: "session", body: [{ name: "action", type: "string", required: true, description: "'snapshot' | 'sleep' | 'wake' | 'stop'" }] },
  { method: "DELETE", path: "/api/sandboxes/{sandboxId}", description: "Stop and delete sandbox", category: "sandboxes", auth: "session" },
  { method: "POST", path: "/api/sandboxes/{sandboxId}/exec", description: "Execute a command inside sandbox", category: "sandboxes", auth: "session", body: [{ name: "command", type: "string", required: true, description: "Command to run" }, { name: "args", type: "string[]", required: false, description: "Command arguments" }] },
  { method: "GET", path: "/api/sandboxes/{sandboxId}/logs", description: "Get sandbox execution logs", category: "sandboxes", auth: "session" },

  // ── Memory ─────────────────────────────────────────────────────────
  { method: "GET", path: "/api/memory", description: "List memory documents", category: "memory", auth: "session", params: [{ name: "namespace", type: "string", required: false, description: "Filter by namespace" }, { name: "agent", type: "string", required: false, description: "Filter by agent" }] },
  { method: "POST", path: "/api/memory", description: "Create or update a memory document", category: "memory", auth: "session", body: [{ name: "title", type: "string", required: true, description: "Document title" }, { name: "content", type: "string", required: true, description: "Document content" }, { name: "namespace", type: "string", required: false, description: "Namespace" }] },
  { method: "GET", path: "/api/memory/{documentId}", description: "Get single memory document", category: "memory", auth: "session" },
  { method: "DELETE", path: "/api/memory/{documentId}", description: "Delete memory document", category: "memory", auth: "session" },

  // ── Approvals ──────────────────────────────────────────────────────
  { method: "GET", path: "/api/approvals", description: "List approval requests", category: "approvals", auth: "session", params: [{ name: "status", type: "string", required: false, description: "Filter: 'pending' | 'approved' | 'rejected'" }] },
  { method: "POST", path: "/api/approvals/{approvalId}/resolve", description: "Approve or reject an approval gate", category: "approvals", auth: "session", body: [{ name: "status", type: "string", required: true, description: "'approved' or 'rejected'" }, { name: "note", type: "string", required: false, description: "Resolution note" }] },

  // ── Threads ────────────────────────────────────────────────────────
  { method: "GET", path: "/api/threads", description: "List conversation threads", category: "threads", auth: "session" },
  { method: "GET", path: "/api/threads/{threadId}", description: "Get thread detail with messages", category: "threads", auth: "session" },

  // ── Inbox ──────────────────────────────────────────────────────────
  { method: "GET", path: "/api/inbox", description: "Load inbox (threads, runs, approvals, browser tasks)", category: "infra", auth: "session" },
  { method: "POST", path: "/api/inbox", description: "Accept bot mention payloads for dispatch", category: "infra", auth: "internal" },

  // ── Webhooks ───────────────────────────────────────────────────────
  { method: "GET", path: "/api/webhooks", description: "List registered outbound webhooks", category: "webhooks", auth: "session" },
  { method: "POST", path: "/api/webhooks", description: "Register an outbound webhook", category: "webhooks", auth: "session", body: [{ name: "url", type: "string", required: true, description: "Webhook URL" }, { name: "events", type: "string[]", required: true, description: "Events to subscribe: run.completed, approval.requested, sandbox.stopped" }] },

  // ── Usage ──────────────────────────────────────────────────────────
  { method: "GET", path: "/api/usage", description: "Usage metrics for current operator", category: "usage", auth: "session", response: '{ ok: true, runs, sandboxHours, toolCalls, memoryDocs }' },

  // ── Bots ───────────────────────────────────────────────────────────
  { method: "POST", path: "/api/bot/slack", description: "Slack bot webhook handler", category: "bots", auth: "none" },
  { method: "POST", path: "/api/bot/discord", description: "Discord bot webhook handler", category: "bots", auth: "none" },
  { method: "POST", path: "/api/bot/telegram", description: "Telegram bot webhook handler", category: "bots", auth: "none" },
  { method: "POST", path: "/api/slack/events", description: "Slack Events API handler", category: "bots", auth: "none" },
  { method: "POST", path: "/api/github/events", description: "GitHub webhook event handler", category: "bots", auth: "none" },

  // ── Infrastructure ─────────────────────────────────────────────────
  { method: "GET", path: "/api/health", description: "Health check — returns platform status", category: "infra", auth: "none", response: '{ ok: true, status: "healthy", agentCount, schemaOk, queuesEnabled, workflowEnabled }' },
  { method: "GET", path: "/api/stream", description: "Server-Sent Events live update stream", category: "infra", auth: "session" },
  { method: "GET", path: "/api/browser/tasks/{taskId}", description: "Browser task status", category: "infra", auth: "session" },
  { method: "GET", path: "/api/cron/reconcile", description: "Cron: reconcile cloud schedules", category: "infra", auth: "cron" },
  { method: "GET", path: "/api/cron/sandbox-watchdog", description: "Cron: auto-sleep idle sandboxes", category: "infra", auth: "cron" },

  // ── Workflows ──────────────────────────────────────────────────────
  { method: "POST", path: "/api/workflows/agent", description: "Start a durable agent workflow", category: "runs", auth: "session", body: [{ name: "jobId", type: "string", required: true, description: "Job ID" }, { name: "agentId", type: "string", required: true, description: "Agent ID" }, { name: "goal", type: "string", required: true, description: "Goal" }] },
  { method: "POST", path: "/api/workflows/agent/approval", description: "Resume a paused workflow via approval", category: "runs", auth: "session", body: [{ name: "approvalId", type: "string", required: true, description: "Approval ID (hook token)" }, { name: "approved", type: "boolean", required: true, description: "Decision" }] },

  // ── Queues (internal) ──────────────────────────────────────────────
  { method: "POST", path: "/api/queues/agent-launch", description: "Queue consumer: async agent launch", category: "infra", auth: "internal" },
  { method: "POST", path: "/api/queues/agent-lifecycle", description: "Queue consumer: sandbox lifecycle events", category: "infra", auth: "internal" },
];

export const CATEGORY_LABELS: Record<ApiCategory, string> = {
  auth: "Authentication",
  agents: "Agents",
  runs: "Runs & Jobs",
  sandboxes: "Sandboxes",
  chat: "Chat",
  memory: "Memory",
  approvals: "Approvals",
  threads: "Threads",
  webhooks: "Webhooks",
  usage: "Usage",
  infra: "Infrastructure",
  bots: "Bot Integrations",
};

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-primary",
  POST: "text-blue-400",
  PATCH: "text-yellow-400",
  DELETE: "text-destructive",
};
