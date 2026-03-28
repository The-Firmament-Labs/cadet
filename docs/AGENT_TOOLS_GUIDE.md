# Agent Tools Guide

How tools are registered, filtered, formatted, and executed in the Cadet agent system.

---

## 1. How agents get their tool list

Tools are defined in `packages/core/src/tools.ts` as the `AGENT_TOOLS` array.

When an agent step is about to execute, `getAgentTools(manifest)` filters the global array based on the agent's manifest permissions:

```
manifest.tools.allowBrowser  → unlocks: browse, screenshot
manifest.tools.allowNetwork  → unlocks: crypto, platform, communication tools
manifest.tools.allowExec     → unlocks: execution tools (run_code, search_web, spotify_*)
```

Context and state tools (`query_memory`, `store_memory`, `query_state`, etc.) are **always included** regardless of permissions — every agent needs memory and workflow access.

```typescript
// packages/core/src/tools.ts
export function getAgentTools(manifest): ToolDefinition[] {
  return AGENT_TOOLS.filter((tool) => {
    if (tool.category === "context" || tool.category === "state") return true;
    if (tool.category === "browser")       return manifest.tools.allowBrowser;
    if (tool.category === "crypto")        return manifest.tools.allowNetwork;
    if (tool.category === "platform")      return manifest.tools.allowNetwork;
    if (tool.category === "communication") return manifest.tools.allowNetwork;
    if (tool.category === "execution")     return manifest.tools.allowExec;
    return false;
  });
}
```

---

## 2. How tools are exposed in the agent prompt

`formatToolsForPrompt(tools)` converts the filtered tool list into a markdown section injected into the agent's runtime prompt by `composeRuntimePrompt()`.

Output format (one line per tool):

```
## COMMUNICATION
- **send_email**(to: string, subject: string, body: string) [APPROVAL]
  Send an email via himalaya CLI
- **list_emails**(folder?: string)
  List emails in a mailbox folder via himalaya
```

The `[APPROVAL]` suffix signals to the agent that it must call `create_approval` before executing the tool. The agent is not trusted to auto-execute approval-gated tools.

Tools are grouped by category in the order they appear in `AGENT_TOOLS`.

---

## 3. Approval flow for high-risk tools

Tools with `requiresApproval: true` follow a two-phase pattern:

1. **Agent proposes** — the agent calls `create_approval` (a state tool) with `title`, `detail`, and `risk` level (`low | medium | high | critical`).
2. **Operator decides** — the approval appears in the Cadet control plane UI. The operator approves or rejects.
3. **Agent resumes** — on approval, the workflow step is unblocked and the agent executes the original tool.
4. **Rejection** — the agent is notified and must either try an alternative or halt.

Approval-gated tools include: `send_email`, `post_message`, `vercel_deploy`, `github_issue`, `run_code`.

The approval gate is enforced at the workflow orchestration layer — it is **not** a suggestion in the prompt. If an agent attempts to call a gated tool without a prior approval record, the execution runner rejects it.

---

## 4. TOON encoding for efficient tool results

TOON (Token-Optimized Object Notation) is a compact format used at the **model/data boundary** to reduce token consumption when returning large structured results (e.g., DB query results, memory chunks, manifest payloads).

TOON is useful for:
- Prompt packs and batch DB read payloads
- Compact model-facing context injected into agent prompts
- Memory compaction summaries
- Manifest serialization for inter-agent handoffs

TOON is **not** the primary UI rendering format — the operator UI uses `json-render` specs derived from structured state instead.

---

## 5. Adding new tools to the registry

To register a new tool:

1. **Define it** in the `AGENT_TOOLS` array in `packages/core/src/tools.ts`:
   ```typescript
   {
     name: "my_tool",
     description: "One-line description for the agent prompt",
     category: "execution",          // context | state | browser | crypto | platform | communication | execution
     cli: "mytool run {arg}",        // OR api: "GET https://..." OR reducer: "reducer_name"
     params: [
       { name: "arg", type: "string", required: true, description: "What arg does" },
     ],
     requiresApproval: false,
   }
   ```

2. **Pick the right category** — this controls which agents can use it (see §1).

3. **Set `requiresApproval: true`** for any tool that modifies external state, sends messages, deploys code, or runs arbitrary code.

4. **Document it** in `docs/TOOLS_REFERENCE.md` under the appropriate category section.

5. **Run the typecheck**: `bun run typecheck` from the repo root to verify the addition compiles.

No registration beyond adding to the array is needed — `getAgentTools` and `formatToolsForPrompt` pick it up automatically.
