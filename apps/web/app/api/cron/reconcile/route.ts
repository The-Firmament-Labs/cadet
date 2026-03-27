import { getServerEnv } from "../../../../lib/env";
import { reconcileCloudControlPlane } from "../../../../lib/server";

export async function GET(request: Request) {
  const env = getServerEnv();
  const authorization = request.headers.get("authorization");

  if (!env.cronSecret || authorization !== `Bearer ${env.cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    return Response.json({
      ok: true,
      action: "reconcile",
      database: env.database,
      ...(await reconcileCloudControlPlane())
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown reconcile error"
      },
      { status: 500 }
    );
  }
}
