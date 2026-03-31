import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const client = createControlClient();
    const rows = await client.sql(
      "SELECT thread_id, channel, channel_thread_id, title, updated_at_micros FROM thread_record ORDER BY updated_at_micros DESC LIMIT 50",
    );
    return Response.json({ ok: true, threads: rows });
  } catch (error) {
    return apiError(error, 500);
  }
}
