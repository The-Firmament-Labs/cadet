import { loadBrowserTask } from "../../../../../lib/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;
  const result = await loadBrowserTask(taskId);
  return Response.json({ ok: true, result });
}
