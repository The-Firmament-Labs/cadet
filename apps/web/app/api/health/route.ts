import { createControlClient } from "../../../lib/server";
import { cloudAgentCatalog } from "../../../lib/cloud-agents";
import { getSafeServerEnv } from "../../../lib/env";

export async function GET() {
  const env = getSafeServerEnv();

  try {
    const schema = await createControlClient().schema();
    return Response.json({
      ok: true,
      status: "healthy",
      plane: "cloud",
      authMode: env.hasSpacetimeConfig ? "spacetimeauth" : env.hasOperatorAuth ? "auth0" : "none",
      storeBackend: "spacetimedb",
      hasAuthToken: env.hasAuthToken,
      hasCronSecret: env.hasCronSecret,
      hasVercelOAuth: env.hasVercelOAuth,
      queuesEnabled: env.queuesEnabled,
      workflowEnabled: env.workflowEnabled,
      agentCount: cloudAgentCatalog.length,
      schemaOk: Boolean(schema),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
