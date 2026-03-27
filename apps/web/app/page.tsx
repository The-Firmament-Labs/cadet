import React from "react";
import { CadetLanding } from "./cadet-landing";
import { getServerEnv } from "../lib/env";
import { cloudAgentCatalog } from "../lib/cloud-agents";

export default function HomePage() {
  const env = getServerEnv();
  const landingEnv = {
    controlPlaneUrl: env.controlPlaneUrl,
    spacetimeUrl: env.spacetimeUrl,
    database: env.database,
    hasCronSecret: Boolean(env.cronSecret)
  };
  const cloudAgents = cloudAgentCatalog.map((agent) => ({
    id: agent.id,
    name: agent.name,
    runtime: agent.runtime,
    execution: agent.deployment.execution,
    scheduleCount: agent.schedules.length
  }));

  return (
    <main className="cosmosShell">
      <CadetLanding cloudAgents={cloudAgents} env={landingEnv} />
    </main>
  );
}
