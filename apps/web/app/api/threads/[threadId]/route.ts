import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError, apiNotFound } from "@/lib/api-response";

export async function GET(
  request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { threadId } = await context.params;
  try {
    const client = createControlClient();
    const [threads, messages] = await Promise.all([
      client.sql(`SELECT * FROM thread_record WHERE thread_id = '${sqlEscape(threadId)}'`) as Promise<Record<string, unknown>[]>,
      client.sql(`SELECT * FROM message_event WHERE thread_id = '${sqlEscape(threadId)}' ORDER BY created_at_micros ASC`) as Promise<Record<string, unknown>[]>,
    ]);

    if (threads.length === 0) return apiNotFound("Thread not found");
    return Response.json({ ok: true, thread: threads[0], messages });
  } catch (error) {
    return apiError(error, 500);
  }
}
