import { cloudAgentCatalog } from "../../../lib/cloud-agents";

export async function GET() {
  return Response.json({
    ok: true,
    plane: "cloud",
    agents: cloudAgentCatalog
  });
}

