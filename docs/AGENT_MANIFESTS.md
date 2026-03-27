# Agent Manifests Guide

Cadet agents are defined by manifests. The manifest is the source of truth for:

- identity
- runtime selection
- deployment target
- workflow template
- tool permissions
- browser policy
- handoff rules
- memory policy
- schedules
- learning behavior

This guide explains how manifests are made, how Cadet uses them, and how to author new agents safely.

## 1. What a manifest is

A manifest is a typed JSON document that Cadet parses and validates before the agent is registered or run.

The current TypeScript source of truth is [packages/core/src/agent-manifest.ts](../packages/core/src/agent-manifest.ts).

The current Rust runtime mirror is [rust/starbridge-core/src/lib.rs](../rust/starbridge-core/src/lib.rs).

## 2. Minimal manifest shape

```json
{
  "id": "researcher",
  "name": "Researcher",
  "description": "Long-horizon research agent.",
  "system": "You are a senior research agent.",
  "model": "gpt-5.4",
  "runtime": "rust-core",
  "deployment": {
    "controlPlane": "local",
    "execution": "local-runner",
    "workflow": "research"
  },
  "tags": ["research"],
  "tools": {
    "allowExec": true,
    "allowBrowser": true,
    "allowNetwork": true,
    "allowMcp": true,
    "browser": {
      "enabled": true,
      "allowedDomains": ["github.com"],
      "blockedDomains": [],
      "maxConcurrentSessions": 2,
      "allowDownloads": false,
      "defaultMode": "extract",
      "requiresApprovalFor": ["form", "download"]
    }
  },
  "memory": {
    "namespace": "research",
    "maxNotes": 400,
    "summarizeAfter": 32
  },
  "workflowTemplates": [
    {
      "id": "research-default",
      "description": "Standard research flow.",
      "stages": ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
    }
  ],
  "toolProfiles": [],
  "handoffRules": [],
  "learningPolicy": {
    "enabled": true,
    "summarizeEveryRuns": 3,
    "embedMemory": true,
    "maxRetrievedChunks": 8
  },
  "schedules": []
}
```

## 3. Top-level fields

### Identity and prompting

- `id`: stable internal identifier
- `name`: human-friendly name
- `description`: operator-facing description
- `system`: system prompt or agent posture
- `model`: model identifier

### Runtime

- `runtime`: how the agent logic is primarily implemented

Allowed values today:

- `rust-core`
- `bun-sidecar`
- `edge-function`

This does not decide where the agent is deployed by itself. It tells Cadet what execution style the agent expects.

### Deployment

`deployment` answers three questions:

- which control plane owns the agent
- what execution target it starts on
- which named workflow family it belongs to

Fields:

- `controlPlane`: `local` or `cloud`
- `execution`: `local-runner`, `vercel-edge`, `container-runner`, or `maincloud-runner`
- `workflow`: a short workflow family identifier such as `research` or `ops`

## 4. Tool policy

The `tools` block controls the agent’s tool surface.

### Boolean policies

- `allowExec`
- `allowBrowser`
- `allowNetwork`
- `allowMcp`

### Browser policy

`tools.browser` is the durable browser contract:

- `enabled`
- `allowedDomains`
- `blockedDomains`
- `maxConcurrentSessions`
- `allowDownloads`
- `defaultMode`
- `requiresApprovalFor`

Current browser modes:

- `read`
- `extract`
- `navigate`
- `form`
- `download`
- `monitor`

### Backward compatibility

Cadet still accepts the older boolean `allowBrowser` shape. During parsing, it normalizes that into `tools.browser.enabled`.

## 5. Memory policy

The `memory` block scopes how the agent uses durable memory.

- `namespace`: logical memory partition
- `maxNotes`: rough cap for retained notes/documents
- `summarizeAfter`: threshold for compaction or summarization behavior

This policy is the bridge between one agent’s working memory and the shared semantic memory plane.

## 6. Workflow templates

`workflowTemplates` declare the typed workflow shape an agent expects.

Each template has:

- `id`
- `description`
- `stages`

Cadet’s canonical stages are:

- `route`
- `plan`
- `gather`
- `act`
- `verify`
- `summarize`
- `learn`

Why this matters:

- the runtime does not have to infer stage order from prompt text
- the UI can render a graph
- workers can claim stage-appropriate work

## 7. Tool profiles

`toolProfiles` are named tool bundles. They let one agent expose multiple operational postures without redefining the entire agent.

Example uses:

- safe browsing only
- networked research
- no-exec audit mode
- elevated local coding mode

## 8. Handoff rules

`handoffRules` tell Cadet when a run should move from one execution target to another.

Each rule has:

- `id`
- `whenGoalIncludes`
- `to`
- `reason`

Example:

- edge route step sees `browser` or `incident`
- handoff rule sends work to `container-runner` or `browser-worker`
- the reason is stored and inspectable

This is one of the key ways Cadet stays durable: the manifest can express when edge work must not stay on the edge.

## 9. Learning policy

`learningPolicy` defines how much the agent learns from completed runs.

Fields:

- `enabled`
- `summarizeEveryRuns`
- `embedMemory`
- `maxRetrievedChunks`

This lets different agents learn at different rates and with different retrieval budgets.

## 10. Schedules

`schedules` declare recurring work for the agent.

Each schedule includes:

- `id`
- `goal`
- `intervalMinutes`
- `priority`
- `enabled`
- `requestedBy`

Schedules are registered into SpacetimeDB and reconciled into workflow runs by the control plane.

## 11. How Cadet uses a manifest

### In the CLI

The CLI loads manifests to:

- list available agents
- compose prompts
- submit jobs

### In the control planes

The local and cloud control planes use manifests to:

- register agent metadata
- register schedules
- normalize jobs
- seed workflow runs and route steps

### In the worker runtime

Rust workers use manifests to:

- decide which runner owns a stage
- apply browser policy
- apply handoff rules
- decide memory namespace and learning behavior
- shape prompts and execution logic

### In the web product layer

The product shell can use manifests to:

- label agents
- render typed dashboards
- drive workflow editors
- expose safe controls and actions per agent

## 12. How to author a new agent

### Step 1: pick the deployment posture

Choose:

- `local` + `local-runner` for private/local agents
- `cloud` + `vercel-edge` for edge-triaged cloud agents
- `cloud` + `container-runner` for durable cloud workers

### Step 2: define the workflow family

Decide whether the agent is:

- research-heavy
- coding-heavy
- ops-heavy
- browser-heavy
- conversational router

Then set:

- `deployment.workflow`
- at least one `workflowTemplate`
- appropriate `handoffRules`

### Step 3: define tools conservatively

Prefer:

- explicit browser allowlists
- clear exec/network permissions
- approval gating for risky browser modes

### Step 4: define memory and learning policy

Choose:

- namespace
- retrieval size
- learning cadence

### Step 5: add schedules only if the agent truly has recurring work

Do not overload schedules for user-triggered behavior.

## 13. Current examples

See:

- [examples/agents/researcher.agent.json](../examples/agents/researcher.agent.json)
- [examples/agents/operator.agent.json](../examples/agents/operator.agent.json)

### Researcher

- local control plane
- local runner
- browser-backed research and verification
- research namespace

### Operator

- cloud control plane
- edge triage first
- durable handoff to container or browser work for longer tasks
- operations namespace

## 14. Recommended authoring pattern

When creating a new manifest:

1. copy the closest existing example
2. change deployment/runtime first
3. change tool policy second
4. add workflow template and handoff rules third
5. tune memory and learning policy last

This keeps the manifest shaped around execution reality rather than prompt wording.

## 15. Future extension: UI metadata

The next natural manifest extension is UI metadata:

- preferred dashboard layout
- component hints
- workflow editor hints
- agent-specific panels

That keeps the manifest as the contract for both execution and operator experience.

See [docs/DYNAMIC_AGENT_UI.md](DYNAMIC_AGENT_UI.md).
