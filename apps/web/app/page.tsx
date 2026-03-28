import React from "react";
import { CadetLanding } from "./cadet-landing";
import { getSafeServerEnv } from "../lib/env";
import { cloudAgentCatalog } from "../lib/cloud-agents";

export default function HomePage() {
  const env = getSafeServerEnv();
  const landingEnv = {
    controlPlaneUrl: env.controlPlaneUrl,
    spacetimeUrl: env.spacetimeUrl,
    database: env.database,
    hasCronSecret: env.hasCronSecret,
    hasOperatorAuth: env.hasOperatorAuth
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
