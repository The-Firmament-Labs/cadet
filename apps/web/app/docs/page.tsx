import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

type GuideSection = {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  body: React.ReactNode;
};

const navGroups = [
  {
    title: "Getting Started",
    items: [
      { href: "#overview", label: "Overview" },
      { href: "#deployments", label: "Deployment targets" },
      { href: "#dioxus", label: "Dioxus integration" },
      { href: "#commands", label: "CLI & commands" }
    ]
  },
  {
    title: "Core Fabric",
    items: [
      { href: "#architecture", label: "Architecture" },
      { href: "#workflow", label: "Workflow graph" },
      { href: "#browser", label: "Browser tasks" },
      { href: "#memory", label: "Memory & retrieval" }
    ]
  },
  {
    title: "Agent Authoring",
    items: [
      { href: "#manifests", label: "Manifest model" },
      { href: "#dynamic-ui", label: "Dynamic UI" },
      { href: "#github", label: "GitHub automation" }
    ]
  },
  {
    title: "Reference",
    items: [
      { href: "#links", label: "Docs map" },
      { href: "#next", label: "Next build steps" }
    ]
  }
];

const sections: GuideSection[] = [
  {
    id: "overview",
    eyebrow: "Introduction",
    title: "Cadet turns agent demos into a durable operating fabric.",
    intro:
      "Cadet is not just a prompt shell. It is a control plane, worker runtime, and state fabric that keeps local agents, edge ingress, browser work, and semantic memory in one event-driven graph.",
    body: (
      <>
        <div className="docsFeatureGrid">
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">⚡</div>
            <h4>Event-driven workers</h4>
            <p>Rust workers claim durable workflow and browser tasks from SpacetimeDB instead of running inline in HTTP requests.</p>
          </article>
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">🌐</div>
            <h4>Deployment-agnostic ingress</h4>
            <p>Vercel, Cloudflare Workers, and self-hosted adapters all feed the same tables and reducers.</p>
          </article>
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">🛰️</div>
            <h4>Browser-capable agents</h4>
            <p>Browser use is a typed task contract with artifacts, approvals, and retryable execution.</p>
          </article>
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">🧠</div>
            <h4>Spacetime-first memory</h4>
            <p>Documents, chunks, embeddings, and retrieval traces live in the same canonical system as runs and steps.</p>
          </article>
        </div>
        <div className="docsCallout docsCalloutInfo">
          <strong>Design intent</strong>
          Cadet uses the strongest ideas from Eliza, Hermes, and OpenClaw, but replaces their weakest point: transient runtime state spread across prompts, processes, and adapters.
        </div>
      </>
    )
  },
  {
    id: "deployments",
    eyebrow: "Deployment",
    title: "One workflow model, multiple runtimes.",
    intro:
      "Cadet is designed to keep the control graph stable while the ingress and execution layer change. That means you can move between local, Vercel, Cloudflare, and container cloud without forking the state model.",
    body: (
      <>
        <div className="docsTableWrap">
          <table>
            <thead>
              <tr>
                <th>Target</th>
                <th>Role</th>
                <th>Best use</th>
              </tr>
            </thead>
            <tbody>
              <tr className="docsPlatformRow">
                <td><code>Local</code></td>
                <td>Bun control plane + Rust worker</td>
                <td>Heavy iteration, trusted browser sessions, local coding and research agents</td>
              </tr>
              <tr className="docsPlatformRow">
                <td><code>Vercel</code></td>
                <td>Operator UI + ingress + cron + lightweight route stages</td>
                <td>Chat surfaces, approvals, inbox, protected operational APIs</td>
              </tr>
              <tr className="docsPlatformRow">
                <td><code>Cloudflare Workers</code></td>
                <td>Alternative edge ingress</td>
                <td>Provider-neutral webhook and chat ingestion against the same Spacetime fabric</td>
              </tr>
              <tr className="docsPlatformRow">
                <td><code>Containers</code></td>
                <td>Long-running workers</td>
                <td>Browser workers, learning workers, heavy execution runners</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="docsCodeBlock">
          <span className="docsCodeLabel">Cadet deployment rule</span>
          <pre><code>{`channel event -> message_event -> workflow_run -> workflow_step
                      -> browser_task / approval_request / tool_call_record
                      -> delivery_attempt + memory_document + retrieval_trace`}</code></pre>
        </div>
      </>
    )
  },
  {
    id: "dioxus",
    eyebrow: "UI Stack",
    title: "Dioxus fits Cadet best as a Rust-first operator surface.",
    intro:
      "Dioxus and SpacetimeDB work well together. For Cadet, the strongest shapes are Dioxus desktop for mission control, or Dioxus fullstack if you want a Rust-first web control plane.",
    body: (
      <>
        <div className="docsTableWrap">
          <table>
            <thead>
              <tr>
                <th>Shape</th>
                <th>Recommendation</th>
                <th>Cadet role</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>Dioxus desktop</code></td>
                <td>Best fit</td>
                <td>Mission control, inbox, approvals, browser-worker supervision</td>
              </tr>
              <tr>
                <td><code>Dioxus fullstack</code></td>
                <td>Strong option</td>
                <td>Rust-first web control plane using server functions and Axum-side Spacetime access</td>
              </tr>
              <tr>
                <td><code>Dioxus WASM only</code></td>
                <td>Possible, not preferred</td>
                <td>Browser-only UI with a thinner bridge at the data boundary</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="docsCallout docsCalloutTip">
          <strong>Cadet recommendation</strong>
          Keep the current Next/Vercel shell for channel and product surfaces, and add Dioxus desktop as the serious Rust-native operator app. That gives the most leverage with the least churn.
        </div>
        <p>
          The detailed integration guide lives in{" "}
          <a href="https://github.com/Dexploarer/cadet/blob/main/docs/DIOXUS_SPACETIMEDB.md">docs/DIOXUS_SPACETIMEDB.md</a>.
        </p>
      </>
    )
  },
  {
    id: "commands",
    eyebrow: "Operations",
    title: "The CLI stays the operator front door.",
    intro:
      "The main CLI remains the fastest way to inspect manifests, dispatch work, and bootstrap local control-plane state.",
    body: (
      <>
        <div className="docsCodeBlock">
          <span className="docsCodeLabel">Common commands</span>
          <pre><code>{`bun run cli -- agents list --dir ./examples/agents
bun run cli -- job submit --agent researcher --goal "Audit the treasury policy" --api http://localhost:3010 --dir ./examples/agents
bun run dev:local-control
bun run dev:web
bun run spacetime:bootstrap:local
curl -H "authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/reconcile`}</code></pre>
        </div>
        <p>The CLI does not bypass the architecture. It exercises the same manifest contracts and control-plane entrypoints the operator UI uses.</p>
      </>
    )
  },
  {
    id: "architecture",
    eyebrow: "Core Fabric",
    title: "The architecture is state-first, not route-first.",
    intro:
      "SpacetimeDB is the canonical system of record. The web app is the product shell. Rust workers are the execution kernel. That separation is the main reason Cadet can stay simple while doing more than the original example-agent repos.",
    body: (
      <>
        <div className="docsDiagram">
          <span className="docsLayerLabel">Operator Surfaces</span><br />
          CLI · Local control plane · Web inbox · Slack/GitHub/Cloudflare ingress<br /><br />
          <span className="docsLayerLabel">Shared Control Plane</span><br />
          SpacetimeDB reducers + tables: thread_record · message_event · workflow_run · workflow_step · browser_task · memory_embedding<br /><br />
          <span className="docsLayerLabel">Execution</span><br />
          Rust local-runner-worker · container-runner-worker · browser-worker · learning-worker
        </div>
        <div className="docsCallout docsCalloutTip">
          <strong>Boundary rule</strong>
          Heavy or browser-heavy work never depends on a Vercel request staying alive. Routes ingest, normalize, and enqueue. Workers claim and execute.
        </div>
      </>
    )
  },
  {
    id: "workflow",
    eyebrow: "Workflow",
    title: "Typed stages replace prompt spaghetti.",
    intro:
      "Cadet’s core workflow is explicit and durable. Each stage has an owner, status, retries, input/output payloads, and dependencies.",
    body: (
      <>
        <div className="docsHookGrid">
          {[
            ["route", "Edge-safe triage and workflow template selection."],
            ["plan", "Structured decomposition and handoff decisions."],
            ["gather", "Reads from tools, browser tasks, and memory retrieval."],
            ["act", "Mutating or side-effecting work under policy."],
            ["verify", "Browser or runtime validation before the final answer."],
            ["summarize", "Operator-facing and user-facing output packaging."],
            ["learn", "Background synthesis into durable memory."]
          ].map(([name, desc]) => (
            <div className="docsHookItem" key={name}>
              <span className="docsHookName">{name}</span>
              <span className="docsHookDesc">{desc}</span>
            </div>
          ))}
        </div>
        <div className="docsCodeBlock">
          <span className="docsCodeLabel">Workflow step shape</span>
          <pre><code>{`{
  "stage": "gather",
  "ownerExecution": "browser-worker",
  "status": "ready",
  "inputJson": { "goal": "collect competitor pricing" },
  "attemptCount": 0,
  "dependsOnStepId": "route-1"
}`}</code></pre>
        </div>
      </>
    )
  },
  {
    id: "browser",
    eyebrow: "Browser",
    title: "Browser use is a first-class capability, not a hidden prompt trick.",
    intro:
      "Agents declare browser capability in the manifest. Execution is routed through typed browser tasks with policy, artifacts, and approval gates.",
    body: (
      <>
        <div className="docsTableWrap">
          <table>
            <thead>
              <tr>
                <th>Mode</th>
                <th>Default risk</th>
                <th>Typical use</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>read</code></td>
                <td>Low</td>
                <td>Navigation, page reading, capture, and observation</td>
              </tr>
              <tr>
                <td><code>extract</code></td>
                <td>Low</td>
                <td>Structured page extraction, scraping, document parsing</td>
              </tr>
              <tr>
                <td><code>navigate</code></td>
                <td>Medium</td>
                <td>Multi-step flows across dashboards and search surfaces</td>
              </tr>
              <tr>
                <td><code>form</code></td>
                <td>High</td>
                <td>Data entry, submissions, authenticated interactions</td>
              </tr>
              <tr>
                <td><code>download</code></td>
                <td>High</td>
                <td>Reports, exports, and file capture</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="docsCallout docsCalloutWarn">
          <strong>Approval posture</strong>
          Read-only browsing and safe extraction can run automatically. Form submission, auth mutation, downloads, external posting, and destructive actions must cross manifest policy and approval checks.
        </div>
      </>
    )
  },
  {
    id: "memory",
    eyebrow: "Memory",
    title: "Semantic memory lives inside the same control fabric.",
    intro:
      "Cadet stores documents, chunks, embeddings, and retrieval traces in its own model. The retrieval API can use native vector support later, but the public contract stays stable either way.",
    body: (
      <>
        <div className="docsFeatureGrid">
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">📄</div>
            <h4>memory_document</h4>
            <p>Canonical source records from runs, conversations, or imported sources.</p>
          </article>
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">✂️</div>
            <h4>memory_chunk</h4>
            <p>Retrieval-sized units derived from documents and runtime outputs.</p>
          </article>
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">🧬</div>
            <h4>memory_embedding</h4>
            <p>Embedding vector payload plus provider/model metadata.</p>
          </article>
          <article className="docsFeatureCard">
            <div className="docsFeatureIcon">🧾</div>
            <h4>retrieval_trace</h4>
            <p>Auditable proof of which chunks influenced a run or step.</p>
          </article>
        </div>
        <div className="docsCodeBlock">
          <span className="docsCodeLabel">Retrieval interface</span>
          <pre><code>{`embed(content) -> embedding
upsertMemory(document, chunks, embeddings)
searchMemory(queryEmbedding, filters, topK) -> chunkRefs
recordRetrievalTrace(runId, chunkRefs)`}</code></pre>
        </div>
      </>
    )
  },
  {
    id: "manifests",
    eyebrow: "Agent Authoring",
    title: "Agents are manifests with typed workflows, not plugin folders with side effects.",
    intro:
      "Cadet takes the programmable strength of Eliza-style agents and makes it stricter: manifests define runtime, deployment, browser policy, workflow templates, handoff rules, and learning behavior.",
    body: (
      <>
        <div className="docsCodeBlock">
          <span className="docsCodeLabel">Manifest shape</span>
          <pre><code>{`{
  "id": "researcher",
  "runtime": "rust-core",
  "deployment": {
    "controlPlane": "local",
    "execution": "local-runner",
    "workflow": "research"
  },
  "tools": {
    "allowExec": true,
    "allowBrowser": true,
    "browser": {
      "enabled": true,
      "allowedDomains": ["github.com"],
      "defaultMode": "extract",
      "requiresApprovalFor": ["form", "download"]
    }
  },
  "workflowTemplates": [{ "id": "research-default", "stages": ["route", "plan", "gather", "act", "verify", "summarize", "learn"] }]
}`}</code></pre>
        </div>
        <p>
          The full authoring reference lives in{" "}
          <a href="https://github.com/Dexploarer/cadet/blob/main/docs/AGENT_MANIFESTS.md">docs/AGENT_MANIFESTS.md</a>, while the app route here is the operator-facing summary.
        </p>
      </>
    )
  },
  {
    id: "dynamic-ui",
    eyebrow: "Dynamic UI",
    title: "Agent-specific UI should be generated from manifests and state, not arbitrary code.",
    intro:
      "The correct Cadet pattern is manifest + workflow state + operator context -> constrained UI spec -> registry-backed React components. The Dioxus example you dropped is the right shape: sidebar docs, rich sections, code blocks, and dense operator reference.",
    body: (
      <>
        <div className="docsCodeBlock">
          <span className="docsCodeLabel">UI generation path</span>
          <pre><code>{`agent manifest + workflow state + operator context
-> UI intent
-> constrained json-render spec
-> registry-backed React UI`}</code></pre>
        </div>
        <div className="docsCallout docsCalloutInfo">
          <strong>Reverse-engineering rule</strong>
          Cadet should infer the right UI from the agent definition and live state, then map it to approved components. The generated spec is a view layer, never the system of record.
        </div>
      </>
    )
  },
  {
    id: "github",
    eyebrow: "Automation",
    title: "GitHub automation is part of the operator surface.",
    intro:
      "Cadet now ships a compact Milady-style GitHub automation layer: multi-job CI, label sync, Claude review/triage, issue-to-PR automation, and CI repair loops without trust scoring.",
    body: (
      <>
        <div className="docsTableWrap">
          <table>
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>ci.yml</code></td><td>Actionlint, docs link checks, Bun, Rust, and Spacetime validation</td></tr>
              <tr><td><code>sync-labels.yml</code></td><td>Bootstraps and updates repository labels from source control</td></tr>
              <tr><td><code>auto-label.yml</code></td><td>Path and keyword labeling for PRs and issues</td></tr>
              <tr><td><code>agent-review.yml</code></td><td>Claude review on PRs and issue triage</td></tr>
              <tr><td><code>agent-fix-ci.yml</code></td><td>Attempts same-repo PR CI repair up to three times</td></tr>
              <tr><td><code>agent-implement.yml</code></td><td>Turns <code>agent-ready</code> issues into draft PRs</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          The detailed repo-facing guide lives in{" "}
          <a href="https://github.com/Dexploarer/cadet/blob/main/docs/GITHUB_AUTOMATION.md">docs/GITHUB_AUTOMATION.md</a>.
        </p>
      </>
    )
  },
  {
    id: "links",
    eyebrow: "Reference",
    title: "Cadet docs map",
    intro:
      "The docs set now has both operator-facing app docs and repo-root markdown docs. Use the app route for navigation and the markdown docs for source-controlled architecture detail.",
    body: (
      <div className="docsHookGrid">
        {[
          ["docs/README.md", "Index of the architecture, manifests, automation, and planning pages."],
          ["docs/ARCHITECTURE_GUIDE.md", "Long-form architecture and runtime explanation."],
          ["docs/DIOXUS_SPACETIMEDB.md", "Where Dioxus fits in Cadet and which integration shape to choose."],
          ["docs/AGENT_MANIFESTS.md", "Manifest schema and authoring rules."],
          ["docs/DYNAMIC_AGENT_UI.md", "json-render style dynamic UI strategy."],
          ["docs/GITHUB_AUTOMATION.md", "GitHub workflows, labels, and branch conventions."],
          ["IMPLEMENTATION_PHASES.md", "Current atomic plan and phased roadmap."],
          ["SESSION.md", "Live execution tracker and current next steps."]
        ].map(([name, desc]) => (
          <div className="docsHookItem" key={name}>
            <span className="docsHookName">{name}</span>
            <span className="docsHookDesc">{desc}</span>
          </div>
        ))}
      </div>
    )
  },
  {
    id: "next",
    eyebrow: "Next",
    title: "What gets built after this docs surface.",
    intro:
      "The next high-leverage engineering steps are still runtime work, not more prose.",
    body: (
      <>
        <ol className="docsOrderedList">
          <li>Extract the provider-neutral ingress adapter and add Cloudflare Worker parity.</li>
          <li>Move Slack and GitHub ingress from scaffold to verified Chat SDK adapters.</li>
          <li>Stand up a dedicated browser worker deployment path for long-lived cloud browser tasks.</li>
          <li>Route operator retry, approval, and replay actions through the web inbox.</li>
          <li>Use manifest + run state to render per-agent dashboards dynamically.</li>
        </ol>
        <div className="docsCallout docsCalloutTip">
          <strong>Practical rule</strong>
          Build product depth on top of the event fabric, not beside it. Every new operator surface should write to the same threads, runs, steps, browser tasks, and retrieval traces.
        </div>
      </>
    )
  }
];

export const metadata: Metadata = {
  title: "Cadet Docs | Event-Driven Agent Fabric Guide",
  description:
    "Cadet documentation for architecture, manifests, browser tasks, semantic memory, deployment targets, and GitHub automation."
};

export default function DocsPage() {
  return (
    <main className="docsPageShell">
      <div className="docsLayout">
        <nav aria-label="Cadet docs navigation" className="docsSidebar">
          <div className="docsSidebarLogo">
            <h1>Cadet</h1>
            <span>Operator Guide · v0.1</span>
          </div>

          {navGroups.map((group) => (
            <div key={group.title}>
              <div className="docsSidebarSection">{group.title}</div>
              {group.items.map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="docsMain">
          <section className="docsHero">
            <div className="docsHeroTitle">Cadet <span>Operator Guide</span></div>
            <p className="docsHeroSub">
              Durable agents, browser tasks, semantic memory, and GitHub automation in one control fabric.
            </p>
            <div className="docsBadgeRow">
              <span className="docsBadge docsBadgePurple">SpacetimeDB v2</span>
              <span className="docsBadge docsBadgeTeal">Rust workers</span>
              <span className="docsBadge docsBadgeOrange">Browser tasks</span>
              <span className="docsBadge docsBadgeAmber">Vercel + Cloudflare</span>
              <span className="docsBadge docsBadgeGreen">Manifest-driven</span>
            </div>
            <div className="docsHeroActions">
              <Link className="docsPrimaryLink" href="/">
                Back to landing
              </Link>
              <a className="docsSecondaryLink" href="https://github.com/Dexploarer/cadet">
                Open repository
              </a>
            </div>
          </section>

          {sections.map((section) => (
            <section className="docsSection" id={section.id} key={section.id}>
              <div className="docsSectionEyebrow">{section.eyebrow}</div>
              <h2>{section.title}</h2>
              <p className="docsSectionIntro">{section.intro}</p>
              {section.body}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
