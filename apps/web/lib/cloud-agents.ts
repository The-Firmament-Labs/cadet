import type { AgentManifest } from "@starbridge/core/agent-manifest";

export const cloudAgentCatalog: AgentManifest[] = [
  {
    id: "cadet",
    name: "Cadet",
    description: "Your personal AI assistant. Handles conversations, delegates complex tasks to specialist agents.",
    prompts: {
      system: "system/core.md",
      personality: "agents/cadet.md",
      stages: {
        route: "system/autonomy.md",
        summarize: "system/user-experience.md",
      },
    },
    system:
      `You are Cadet, a personal AI assistant and mission control operator for a software development platform.

TOOLS: Use your tools for quick lookups — deploy status, run status, memory search, reminders, skills, PRs, agent listing. Only use handoff_to_agent when the task requires sustained agent execution.

DELEGATION: Use handoff_to_agent with 'voyager' for coding (write code, fix bugs, debug, refactor, tests). Use handoff_to_agent with 'saturn' for operations (run deployments, rollback production, incident triage, infrastructure). For compound instructions ("fix AND deploy", "refactor then test"), use chain_tasks to execute steps in sequence. Everything else — handle directly with your tools.

STYLE: Concise, professional. When you delegate, briefly explain why. When using tools, report results clearly. Reference specific IDs (@run:xxx) so the user can follow up.

RESULTS: When you see <context source="delegated-agent-results"> in your context, an agent has completed a task. Report this to the user immediately — tell them what was done, whether it succeeded, and include the PR URL if one was created. Do not wait for the user to ask.

APPROVALS: When the user mentions approvals, use list_approvals first, then resolve_approval to act on them. Do not delegate approval decisions to other agents.`,
    model: "anthropic/claude-sonnet-4.5",
    runtime: "edge-function",
    deployment: {
      controlPlane: "cloud",
      execution: "vercel-edge",
      workflow: "chat"
    },
    tags: ["assistant", "router", "chat"],
    tools: {
      allowExec: false,
      allowBrowser: true,
      allowNetwork: true,
      allowMcp: true,
      browser: {
        enabled: true,
        allowedDomains: ["*"],
        blockedDomains: [],
        maxConcurrentSessions: 1,
        allowDownloads: false,
        defaultMode: "extract",
        requiresApprovalFor: []
      }
    },
    memory: {
      namespace: "assistant",
      maxNotes: 1000,
      summarizeAfter: 8
    },
    workflowTemplates: [
      {
        id: "chat-default",
        description: "Conversational router with specialist handoff.",
        stages: ["route", "act", "summarize", "learn"]
      }
    ],
    toolProfiles: [
      {
        id: "chat-tools",
        description: "Conversational tools: memory search, agent handoff, run status, reminders."
      }
    ],
    handoffRules: [
      {
        id: "code-to-sandbox",
        whenGoalIncludes: ["code", "write", "fix", "debug", "refactor", "test", "implement", "function", "component", "api endpoint"],
        to: "vercel-sandbox",
        reason: "Coding tasks require isolated sandbox execution with Claude Code."
      },
      {
        id: "ops-to-edge",
        whenGoalIncludes: ["deploy", "rollback", "incident", "infrastructure", "monitoring", "ci/cd", "pipeline", "release"],
        to: "vercel-edge",
        reason: "Operations tasks require edge execution with deployment access."
      }
    ],
    learningPolicy: {
      enabled: true,
      summarizeEveryRuns: 2,
      embedMemory: true,
      maxRetrievedChunks: 16
    },
    schedules: []
  },
  {
    id: "saturn",
    name: "Saturn",
    description: "Control-plane agent for deployments, incident response, and job routing.",
    prompts: {
      system: "system/core.md",
      personality: "agents/saturn.md",
      stages: {
        route: "system/autonomy.md",
        summarize: "system/user-experience.md",
        learn: "workflows/autonomous-loop.md",
      },
    },
    system:
      "You are an operations-focused agent. Prioritize safe changes, explicit rollouts, and typed incident records.",
    model: "openai/gpt-5.4-mini",
    runtime: "edge-function",
    deployment: {
      controlPlane: "cloud",
      execution: "vercel-edge",
      workflow: "ops"
    },
    tags: ["ops", "deployments", "routing"],
    tools: {
      allowExec: false,
      allowBrowser: true,
      allowNetwork: true,
      allowMcp: true,
      browser: {
        enabled: true,
        allowedDomains: ["github.com", "vercel.com", "spacetimedb.com", "status.openai.com"],
        blockedDomains: [],
        maxConcurrentSessions: 1,
        allowDownloads: false,
        defaultMode: "extract",
        requiresApprovalFor: ["form", "download"]
      }
    },
    memory: {
      namespace: "operations",
      maxNotes: 250,
      summarizeAfter: 16
    },
    workflowTemplates: [
      {
        id: "ops-default",
        description: "Edge triage followed by durable ops execution and verification.",
        stages: ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
      }
    ],
    toolProfiles: [
      {
        id: "ops-browser",
        description: "Operational browsing for deployment and incident verification."
      }
    ],
    handoffRules: [
      {
        id: "edge-to-container",
        whenGoalIncludes: ["incident", "deploy", "browser", "triage", "verify"],
        to: "container-runner",
        reason:
          "Cloud edge should route long-lived and browser-heavy ops work to durable workers."
      }
    ],
    learningPolicy: {
      enabled: true,
      summarizeEveryRuns: 4,
      embedMemory: true,
      maxRetrievedChunks: 8
    },
    schedules: [
      {
        id: "incident-sweep",
        goal: "Sweep the latest deployment and incident surface for operator regressions.",
        intervalMinutes: 10,
        priority: "high",
        enabled: true,
        requestedBy: "scheduler-cloud"
      }
    ]
  },
  {
    id: "voyager",
    name: "Voyager",
    description: "Coding agent that runs inside a Vercel Sandbox for isolated code execution.",
    prompts: {
      system: "system/core.md",
      personality: "agents/voyager.md",
      stages: {
        route: "system/autonomy.md",
        act: "workflows/coding-loop.md",
        summarize: "system/user-experience.md",
        learn: "workflows/autonomous-loop.md",
      },
    },
    system:
      "You are a coding agent. You run inside an isolated sandbox environment. Write, test, and verify code changes before reporting results.",
    model: "anthropic/claude-sonnet-4.5",
    runtime: "sandbox",
    deployment: {
      controlPlane: "cloud",
      execution: "vercel-sandbox",
      workflow: "coding",
      sandbox: {
        runtime: "node24",
        systemPackages: ["git", "jq", "ripgrep"],
        packages: ["typescript", "tsx", "prettier", "eslint"],
        setupCommands: [
          "git config --global user.name 'Cadet Agent'",
          "git config --global user.email 'agent@cadet.dev'",
          "git config --global init.defaultBranch main",
        ],
        env: {
          NODE_ENV: "development",
          TERM: "xterm-256color",
        },
        vcpus: 2,
        idleTimeoutMs: 300_000,
      },
    },
    tags: ["coding", "sandbox", "development"],
    tools: {
      allowExec: true,
      allowBrowser: true,
      allowNetwork: true,
      allowMcp: true,
      browser: {
        enabled: true,
        allowedDomains: ["github.com", "vercel.com", "npmjs.com", "docs.rs"],
        blockedDomains: [],
        maxConcurrentSessions: 1,
        allowDownloads: true,
        defaultMode: "extract",
        requiresApprovalFor: ["form"]
      }
    },
    memory: {
      namespace: "coding",
      maxNotes: 500,
      summarizeAfter: 8
    },
    workflowTemplates: [
      {
        id: "coding-default",
        description: "Sandbox-based coding workflow with plan, execute, and verify stages.",
        stages: ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
      }
    ],
    toolProfiles: [
      {
        id: "sandbox-exec",
        description: "Full code execution inside an isolated Vercel Sandbox."
      }
    ],
    handoffRules: [],
    learningPolicy: {
      enabled: true,
      summarizeEveryRuns: 4,
      embedMemory: true,
      maxRetrievedChunks: 12
    },
    schedules: []
  }
];
