import type { AgentManifest } from "@starbridge/core/agent-manifest";

export const cloudAgentCatalog: AgentManifest[] = [
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
