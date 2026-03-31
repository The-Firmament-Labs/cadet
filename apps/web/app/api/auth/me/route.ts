import { parseSessionFromRequest } from "@/lib/auth";
import { apiUnauthorized } from "@/lib/api-response";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  return Response.json({
    ok: true,
    operator: {
      operatorId: session.operatorId,
      displayName: session.displayName,
      email: session.email,
      role: session.role,
      hasVercelToken: Boolean(session.vercelAccessToken),
      vercelUserId: session.vercelUserId ?? null,
    },
  });
}
