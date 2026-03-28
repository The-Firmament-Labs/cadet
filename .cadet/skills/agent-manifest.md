---
name: agent-manifest
description: Validate and author Cadet agent manifest JSON files (.agent.json)
triggers:
  - file_pattern: "**/*.agent.json"
  - file_pattern: "examples/agents/**"
---

# Agent Manifest Skill

Activate when editing `.agent.json` files. Enforce the Cadet manifest schema.

## Required Fields

```json
{
  "id": "string — kebab-case identifier",
  "name": "string — display name",
  "description": "string — one-line purpose",
  "system": "string — system prompt for the agent",
  "model": "string — model identifier (gpt-5.4, gpt-5.4-mini, etc.)",
  "runtime": "edge-function | rust-core | bun-worker",
  "deployment": {
    "controlPlane": "cloud | local",
    "execution": "vercel-edge | local-runner | container-runner",
    "workflow": "string — workflow template name"
  },
  "tags": ["string[]"],
  "tools": {
    "allowExec": "boolean",
    "allowBrowser": "boolean",
    "allowNetwork": "boolean",
    "allowMcp": "boolean",
    "browser": {
      "enabled": "boolean",
      "allowedDomains": ["string[]"],
      "blockedDomains": ["string[]"],
      "maxConcurrentSessions": "number",
      "allowDownloads": "boolean",
      "defaultMode": "extract | interact | form",
      "requiresApprovalFor": ["form | download | navigate"]
    }
  },
  "memory": {
    "namespace": "string — memory namespace for this agent",
    "maxNotes": "number",
    "summarizeAfter": "number — runs before auto-summarize"
  },
  "workflowTemplates": [{
    "id": "string",
    "description": "string",
    "stages": ["route", "plan", "gather", "act", "verify", "summarize", "learn"]
  }],
  "toolProfiles": [{ "id": "string", "description": "string" }],
  "handoffRules": [{
    "id": "string",
    "whenGoalIncludes": ["string[]"],
    "to": "string — target execution",
    "reason": "string"
  }],
  "learningPolicy": {
    "enabled": "boolean",
    "summarizeEveryRuns": "number",
    "embedMemory": "boolean",
    "maxRetrievedChunks": "number"
  },
  "schedules": [{
    "id": "string",
    "goal": "string",
    "intervalMinutes": "number",
    "priority": "high | normal | low",
    "enabled": "boolean",
    "requestedBy": "string"
  }]
}
```

## Validation Rules

1. `id` must be kebab-case, unique across all manifests
2. `runtime` must match `deployment.execution` (edge-function → vercel-edge, rust-core → local-runner/container-runner)
3. `deployment.controlPlane` determines which control plane dispatches: `cloud` = Next.js on Vercel, `local` = Bun on localhost:3010
4. `workflowTemplates[].stages` must be a subset of: route, plan, gather, act, verify, summarize, learn
5. `schedules[].intervalMinutes` minimum is 1, maximum is 1440 (24 hours)
6. `memory.namespace` should match the agent's domain (e.g., "operations", "research")
7. `browser.requiresApprovalFor` creates ApprovalRequest records in SpacetimeDB when those actions are attempted
8. File must be named `{id}.agent.json` and placed in `examples/agents/`

## SpacetimeDB Registration

When an agent manifest is loaded, it creates/updates an `AgentRecord` row:
- `agent_id` = manifest `id`
- `display_name` = manifest `name`
- `runtime` = manifest `runtime`
- `control_plane` = manifest `deployment.controlPlane`
- `execution_target` = manifest `deployment.execution`
- `workflow` = first workflow template id
- `tags_json` = JSON serialized tags array
