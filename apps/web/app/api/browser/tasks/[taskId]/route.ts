import { requireOperatorApiSession } from "../../../../../lib/auth";
import { loadBrowserTask } from "../../../../../lib/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { taskId } = await context.params;
  const result = await loadBrowserTask(taskId, authToken);
  return Response.json({ ok: true, result });
}
