import { requireOperatorApiSession } from "../../../lib/auth";
import { loadInbox } from "../../../lib/server";

export async function GET(request: Request) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await loadInbox(authToken);
  return Response.json({ ok: true, result });
}
