import { parseSessionFromRequest } from "@/lib/auth";
import { apiError, apiUnauthorized } from "@/lib/api-response";
import { isRepoScanned, scanAndSeedRepo, scanSandboxRepo } from "@/lib/agent-runtime/repo-scanner";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  const scanned = await isRepoScanned(session.operatorId);
  return Response.json({ ok: true, scanned });
}

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  try {
    const body = await request.json();

    // If sandbox credentials provided, scan from sandbox
    if (body.sandboxId && body.vercelAccessToken) {
      const result = await scanSandboxRepo(
        session.operatorId,
        body.sandboxId,
        body.vercelAccessToken,
      );
      return Response.json({ ok: true, ...result });
    }

    // Otherwise scan from provided files map
    if (body.files && typeof body.files === "object") {
      const result = await scanAndSeedRepo(session.operatorId, body.files);
      return Response.json({ ok: true, ...result });
    }

    return Response.json({ ok: false, error: "Provide sandboxId+vercelAccessToken or files map" }, { status: 400 });
  } catch (error) {
    return apiError(error, 500);
  }
}
