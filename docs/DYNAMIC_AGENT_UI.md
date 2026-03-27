# Dynamic Agent UI

Cadet should be able to generate new operator UIs per agent without turning UI generation into arbitrary code execution.

The right model is:

- manifests provide the typed source of truth
- workflow/run state provides live data
- `json-render` provides the constrained UI generation contract
- Cadet maps the generated UI spec to a safe internal component registry

This document explains that design and how to “reverse engineer” it into a Cadet-native implementation.

## 1. Why use `json-render`

`json-render` is built around a safe generative UI model:

- a **catalog** defines what AI is allowed to generate
- a **registry** maps those catalog items to real React components/actions
- AI outputs a **spec** in JSON
- the renderer turns the spec into native UI

That is a strong fit for Cadet because Cadet already has:

- typed manifests
- typed workflow state
- typed actions such as retry, approve, open artifact, enqueue goal

Source references:

- [Introduction](https://json-render.dev/docs)
- [Catalog](https://json-render.dev/docs/catalog)
- [Registry](https://json-render.dev/docs/components)
- [AI SDK integration](https://json-render.dev/docs/ai-sdk)

## 2. The Cadet version of the model

Cadet should treat dynamic UI generation as a transformation:

```text
agent manifest + workflow state + operator context
-> UI intent
-> constrained json-render spec
-> registry-backed React UI
```

The important point is that the manifest and runtime state are canonical. The generated UI is a view layer, not the system of record.

## 3. Reverse-engineering the agent into UI

“Reverse engineering” here means reading the agent definition and runtime state to infer the right UI surface.

### Inputs

From the manifest:

- tags
- deployment target
- workflow templates
- tool profiles
- browser policy
- handoff rules
- memory namespace
- schedules

From runtime state:

- workflow runs
- steps
- browser tasks
- browser artifacts
- approvals
- delivery attempts
- retrieval traces

From operator context:

- current thread/run
- current surface, such as inbox vs agent home
- current user role

### Output

A typed UI intent object, for example:

```ts
{
  surface: "agent-home",
  emphasis: ["workflow", "browser", "memory"],
  actions: ["enqueueGoal", "retryRun", "resolveApproval"],
  components: ["AgentHeader", "WorkflowGraph", "BrowserArtifacts", "MemoryPanel"]
}
```

The UI generator should never infer components from raw prompt text alone. It should infer them from typed agent and runtime state.

## 4. The safe generation chain

### Step 1: define a Cadet UI catalog

The catalog is the guardrail. It should include components such as:

- `AgentHeader`
- `MetricGrid`
- `WorkflowGraph`
- `RunTimeline`
- `ApprovalQueue`
- `BrowserArtifactList`
- `ScheduleTable`
- `MemoryPanel`
- `PromptPackPreview`
- `ActionBar`

And actions such as:

- `enqueueGoal`
- `retryRun`
- `resolveApproval`
- `openArtifact`
- `jumpToRun`
- `toggleSchedule`

### Step 2: define a registry

The registry maps catalog items to real React components in `apps/web`.

Example categories:

- display components
- workflow graph components
- browser inspection components
- action handlers backed by Cadet API routes

### Step 3: generate a spec

The spec is generated from:

- manifest
- workflow data
- operator request

The spec should be validated before render.

### Step 4: render with Cadet state

Render against live Cadet data, not embedded data snapshots where possible.

That gives dynamic composition while keeping state binding in the platform.

## 5. What should come from the manifest

The manifest should be the seed for UI composition.

Manifest-derived signals:

- `deployment.workflow` -> default workflow panels
- `workflowTemplates` -> graph layout and step emphasis
- `tools.browser.enabled` -> browser task/artifact panels
- `handoffRules` -> routing and execution ownership indicators
- `learningPolicy` -> memory/retrieval panels
- `schedules` -> schedule controls
- future UI metadata -> layout hints and custom panel declarations

This is how each agent gets “its own UI” without per-agent hardcoded pages.

## 6. What should come from runtime state

Runtime state turns the static manifest intent into a live surface.

Examples:

- active runs -> timeline widgets
- failed steps -> error callouts
- approvals -> queue panels
- browser artifacts -> evidence panel
- retrieval traces -> memory provenance panel
- delivery attempts -> outbound status widgets

The manifest decides what kind of dashboard the agent can have. The runtime state fills it with live data.

## 7. UI surfaces Cadet should generate

### Agent home

The main per-agent dashboard:

- identity
- workflow graph
- schedules
- recent runs
- memory summary

### Thread view

Conversation and run context:

- messages
- current run
- current pending action
- linked browser artifacts

### Incident / browser view

Useful for ops or verification agents:

- current browser tasks
- artifact gallery
- extracted content
- retry/approval controls

### Workflow editor

Visual composition of:

- stages
- default transitions
- handoff rules
- actions and controls

## 8. Where `json-render` fits in the stack

### Good fit

- safe component composition
- agent-specific dashboards
- per-run layouts
- progressive streaming of generated UI
- data-bound widgets

### Bad fit

- canonical workflow/state storage
- arbitrary code execution
- replacing the manifest as the source of truth
- replacing normal route/actions for sensitive operations

Cadet should use `json-render` as a safe projection layer, not as the system architecture.

## 9. How TOON fits

TOON should not be the main UI format.

TOON is still useful for:

- prompt packs
- batch DB read payloads
- compact model-facing context
- memory compaction summaries

But for dynamic operator UI:

- manifest and runtime state should become structured UI intent
- UI intent should become a `json-render` spec

That keeps UI generation aligned with existing safe web tooling.

## 10. Suggested Cadet implementation plan

### Loop A: Manifest UI hints

Add optional manifest metadata such as:

- preferred dashboard sections
- preferred workflow lens
- display priority for browser/memory/schedules

### Loop B: Cadet catalog

Define a web catalog and registry around a constrained set of components and actions.

### Loop C: UI intent translator

Build a translator:

```text
manifest + run state + operator request -> UI intent -> validated spec
```

### Loop D: Agent home rendering

Start with one surface:

- agent home
- no arbitrary per-message generation yet

### Loop E: Workflow editor and thread surfaces

Expand the same model to thread views and workflow editing.

## 11. Practical safety rules

- never allow arbitrary component names
- never allow arbitrary action names
- never let generated UI invoke raw privileged code
- always validate specs against the catalog
- bind generated actions to existing Cadet APIs only
- keep manifest-driven UI metadata typed and versioned

## 12. Result

If implemented this way, Cadet can generate different UIs per agent while keeping:

- typed manifests
- durable state
- safe rendering
- inspectable actions
- cross-platform portability

That is the right “reverse engineered” version of dynamic agent UI for this architecture.
