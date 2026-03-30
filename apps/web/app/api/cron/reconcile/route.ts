import { verifyCronAuth, cronUnauthorized } from "@/lib/cron-auth";
import { getServerEnv } from "@/lib/env";
import { reconcileCloudControlPlane } from "@/lib/server";
import { apiError } from "@/lib/api-response";

async function handle(request: Request): Promise<Response> {
  const { authorized } = verifyCronAuth(request);
  if (!authorized) return cronUnauthorized();

  try {
    const env = getServerEnv();
    return Response.json({
      ok: true,
      action: "reconcile",
      database: env.database,
      ...(await reconcileCloudControlPlane()),
    });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
