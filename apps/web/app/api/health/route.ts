import { createControlClient } from "../../../lib/server";
import { cloudAgentCatalog } from "../../../lib/cloud-agents";
import { getSafeServerEnv } from "../../../lib/env";

export async function GET() {
  const env = getSafeServerEnv();

  try {
    const schema = await createControlClient().schema();
    return Response.json({
      ok: true,
      plane: "cloud",
      environment: env,
      edgeAgents: cloudAgentCatalog,
      schema
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        environment: env,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
