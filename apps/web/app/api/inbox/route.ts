import { requireOperatorApiSession } from "../../../lib/auth";
import { loadInbox, dispatchJobFromPayload } from "../../../lib/server";
import { apiError } from "../../../lib/api-response";

export async function GET(request: Request) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await loadInbox(authToken);
  return Response.json({ ok: true, result });
}

export async function POST(request: Request) {
  // Accept bot mention payloads — no session required (server-to-server)
  try {
    const payload = await request.json();
    const result = await dispatchJobFromPayload(payload);
    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 400);
  }
}
