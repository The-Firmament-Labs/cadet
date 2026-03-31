import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const client = createControlClient();
    const rows = await client.sql(
      `SELECT document_id, title, content FROM memory_document WHERE namespace = 'webhooks' AND agent_id = '${sqlEscape(operatorId ?? "")}'`,
    );
    const webhooks = (rows as Record<string, unknown>[]).map((r) => {
      try { return { id: r.document_id, ...JSON.parse(String(r.content)) }; }
      catch { return { id: r.document_id, url: String(r.title) }; }
    });
    return Response.json({ ok: true, webhooks });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const { url, events } = (await request.json()) as { url: string; events: string[] };
    if (!url || !events?.length) return apiError("url and events are required", 400);

    const client = createControlClient();
    const id = `wh_${Date.now().toString(36)}`;
    await client.callReducer("upsert_memory_document", [
      id, operatorId ?? "", "webhooks", url, JSON.stringify({ url, events, active: true }), "webhook", "{}",
    ]);
    return Response.json({ ok: true, webhookId: id });
  } catch (error) {
    return apiError(error, 400);
  }
}
