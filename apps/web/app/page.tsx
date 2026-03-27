import { getServerEnv } from "../lib/env";
import { cloudAgentCatalog } from "../lib/cloud-agents";

const surfaces = [
  {
    title: "Main CLI",
    body: "Operator-first flows for manifest inspection, prompt composition, and dispatch into either control plane."
  },
  {
    title: "Local Control Plane",
    body: "Bun HTTP service for laptop-side agents with runner heartbeats and scheduled local dispatch."
  },
  {
    title: "Cloud Control Plane",
    body: "Next.js on Vercel with an edge dispatch path, secure cron reconcile, and scheduled cloud agents."
  },
  {
    title: "Rust Runner + SpacetimeDB",
    body: "Stateful execution and shared control data for queues, memory notes, runner presence, and schedules."
  }
];

const commands = [
  "bun run dev:local-control",
  "bun run cli -- agents list --dir ./examples/agents",
  "bun run cli -- job submit --agent researcher --goal \"Audit the treasury policy\" --api http://localhost:3010 --dir ./examples/agents",
  "curl -X POST http://localhost:3010/schedules/reconcile",
  "curl -X POST http://localhost:3001/api/agents/edge/dispatch -H 'content-type: application/json' -d '{\"agentId\":\"operator\",\"goal\":\"Triage the deploy incident\"}'",
  "curl -H 'authorization: Bearer $CRON_SECRET' http://localhost:3001/api/cron/reconcile"
];

export default function HomePage() {
  const env = getServerEnv();

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Starbridge</p>
          <h1 className="headline">Cloud agents without the polling tax.</h1>
        </div>

        <p className="lede">
          This control plane keeps Vercel in charge of stateless orchestration, pushes long-running
          execution into Rust runners, and uses SpacetimeDB v2 as the shared event fabric between
          them. It is designed to take the strongest ideas from ElizaOS, Hermes, and OpenClaw
          without inheriting their tight coupling.
        </p>

        <div className="heroGrid">
          {surfaces.map((surface) => (
            <article className="card" key={surface.title}>
              <h2>{surface.title}</h2>
              <p className="muted">{surface.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h3>Control planes</h3>
          <ul className="list">
            <li>`http://localhost:3010` hosts the local Bun control plane for local-runner agents.</li>
            <li>`/api/jobs/dispatch` remains the cloud queue entrypoint on the Next.js app.</li>
            <li>`/api/agents/edge/dispatch` runs on the Vercel Edge Runtime for edge-hosted agents.</li>
            <li>`/schedules/reconcile` runs the local scheduler wakeup and stale-heartbeat reconciliation.</li>
            <li>`/api/cron/reconcile` is the secure cloud wakeup hook for schedules and stale-heartbeat cleanup.</li>
          </ul>
        </article>

        <article className="card">
          <h3>Current cloud environment</h3>
          <ul className="list">
            <li>Control plane URL: {env.controlPlaneUrl}</li>
            <li>SpacetimeDB URL: {env.spacetimeUrl}</li>
            <li>Database: {env.database}</li>
            <li>Cron secret configured: {env.cronSecret ? "yes" : "no"}</li>
          </ul>
        </article>

        <article className="card">
          <h3>Cloud agents</h3>
          <ul className="list">
            {cloudAgentCatalog.map((agent) => (
              <li key={agent.id}>
                {agent.name}: {agent.deployment.execution} via {agent.runtime} with{" "}
                {agent.schedules.length} schedule{agent.schedules.length === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="panel">
        <h3>CLI flow</h3>
        <div className="code">
          <pre>{commands.join("\n")}</pre>
        </div>
      </section>
    </main>
  );
}
