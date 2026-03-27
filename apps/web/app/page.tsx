import React from "react";
import { SpaceParallax } from "./space-parallax";
import { getServerEnv } from "../lib/env";
import { cloudAgentCatalog } from "../lib/cloud-agents";

const flightDeck = [
  {
    title: "Flight CLI",
    body: "Operator-first launch flows for manifest inspection, prompt composition, and dispatch into local or edge orbit."
  },
  {
    title: "Local command deck",
    body: "A Bun control surface for laptop-side agents, heartbeat supervision, and deterministic local schedule wakes."
  },
  {
    title: "Cloud rendezvous",
    body: "Next.js on Vercel for edge dispatch, protected cron wakes, and cloud-side schedule reconciliation."
  },
  {
    title: "Shared event fabric",
    body: "Rust runners and SpacetimeDB v2 keep queues, memory notes, runner presence, and schedules in one event-driven graph."
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

const missionStats = [
  { label: "Control planes", value: "2" },
  { label: "Cloud agents", value: String(cloudAgentCatalog.length) },
  {
    label: "Active schedules",
    value: String(cloudAgentCatalog.reduce((total, agent) => total + agent.schedules.length, 0))
  }
];

export default function HomePage() {
  const env = getServerEnv();

  return (
    <main className="cosmosShell">
      <section className="poster">
        <div className="posterCopy">
          <p className="eyebrow">Cadet // orbital agent control</p>
          <h1 className="headline">Put local and edge agents into the same event horizon.</h1>

          <p className="lede">
            Cadet is the command layer for event-driven operators: a local Bun control plane, an
            edge-hosted cloud lane on Vercel, Rust runners for heavy execution, and SpacetimeDB v2
            as the live mission fabric between them.
          </p>

          <div className="posterActions">
            <a className="primaryAction" href="#flight-stack">
              Explore the flight stack
            </a>
            <a className="secondaryAction" href="#mission-log">
              Open the mission log
            </a>
          </div>

          <dl className="missionStats">
            {missionStats.map((stat) => (
              <div className="missionStat" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>

          <p className="posterNote">
            Local runners keep the heavy state. Edge agents answer fast. Heartbeats and schedules
            stay synchronized across both control planes.
          </p>
        </div>

        <SpaceParallax />
      </section>

      <section className="section" id="flight-stack">
        <div className="sectionHeader">
          <p className="sectionTag">Flight stack</p>
          <h2>One launch surface, four orbital layers.</h2>
          <p className="sectionCopy">
            The page leads with atmosphere, but the stack stays literal: where commands start, where
            cloud wakeups happen, and where durable execution lives.
          </p>
        </div>

        <div className="flightGrid">
          {flightDeck.map((surface) => (
            <article className="flightPanel" key={surface.title}>
              <p className="panelIndex">{surface.title}</p>
              <h3>{surface.title}</h3>
              <p>{surface.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section telemetryGrid">
        <article className="telemetryPanel">
          <p className="sectionTag">Cloud telemetry</p>
          <h2>Current runtime coordinates.</h2>
          <ul className="telemetryList">
            <li>`http://localhost:3010` hosts the local Bun control plane for local-runner agents.</li>
            <li>`/api/jobs/dispatch` remains the cloud queue entrypoint on the Next.js app.</li>
            <li>`/api/agents/edge/dispatch` runs on the Vercel Edge Runtime for edge-hosted agents.</li>
            <li>`/schedules/reconcile` runs the local scheduler wakeup and stale-heartbeat reconciliation.</li>
            <li>`/api/cron/reconcile` is the secure cloud wakeup hook for schedules and stale-heartbeat cleanup.</li>
          </ul>
        </article>

        <article className="telemetryPanel">
          <p className="sectionTag">Mission state</p>
          <h2>Live control-plane settings.</h2>
          <ul className="telemetryList">
            <li>Control plane URL: {env.controlPlaneUrl}</li>
            <li>SpacetimeDB URL: {env.spacetimeUrl}</li>
            <li>Database: {env.database}</li>
            <li>Cron secret configured: {env.cronSecret ? "yes" : "no"}</li>
          </ul>
        </article>

        <article className="telemetryPanel">
          <p className="sectionTag">Cloud roster</p>
          <h2>Agents already in orbit.</h2>
          <ul className="telemetryList">
            {cloudAgentCatalog.map((agent) => (
              <li key={agent.id}>
                {agent.name}: {agent.deployment.execution} via {agent.runtime} with{" "}
                {agent.schedules.length} schedule{agent.schedules.length === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section missionSection" id="mission-log">
        <div className="missionBackdrop" aria-hidden="true" />

        <div className="missionCopy">
          <p className="sectionTag">Mission log</p>
          <h2>From local ignition to edge-side reconcile.</h2>
          <p className="sectionCopy">
            The CLI remains the first switchboard. Local commands can wake the Bun plane, cloud
            agents can dispatch from the edge, and the same schedule graph keeps both sides in sync.
          </p>
        </div>

        <div className="commandDeck">
          <pre>{commands.join("\n")}</pre>
        </div>
      </section>

      <section className="section finalSection">
        <p className="sectionTag">Launch condition</p>
        <h2>Built for operators who want the poster and the proof.</h2>
        <p className="sectionCopy">
          Cadet keeps the visual language cinematic, but the contract is still operational: stateful
          runners, heartbeat supervision, scheduled wakeups, and a direct command path from terminal
          to edge.
        </p>

        <div className="posterActions">
          <a className="primaryAction" href="#mission-log">
            Review launch commands
          </a>
          <a className="secondaryAction" href="#flight-stack">
            Return to stack overview
          </a>
        </div>
      </section>
    </main>
  );
}
