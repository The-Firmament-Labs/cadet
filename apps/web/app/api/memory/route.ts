import { requireOperatorApiSession } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError } from "@/lib/api-response";

export async function GET(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const namespace = searchParams.get("namespace");
  const agent = searchParams.get("agent");

  try {
    const client = createControlClient();
    const conditions: string[] = [];
    if (namespace) conditions.push(`namespace = '${sqlEscape(namespace)}'`);
    if (agent) conditions.push(`agent_id = '${sqlEscape(agent)}'`);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await client.sql(
      `SELECT document_id, agent_id, namespace, title, content, source_kind, updated_at_micros FROM memory_document ${where} ORDER BY updated_at_micros DESC LIMIT 100`,
    );
    return Response.json({ ok: true, documents: rows });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function POST(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const { title, content, namespace, agentId } = (await request.json()) as {
      title: string; content: string; namespace?: string; agentId?: string;
    };
    if (!title || !content) return apiError("title and content are required", 400);

    const client = createControlClient();
    const docId = `doc_${Date.now().toString(36)}`;
    await client.callReducer("upsert_memory_document", [
      docId, agentId ?? "cadet", namespace ?? "general", title, content, "api", "{}",
    ]);
    return Response.json({ ok: true, documentId: docId });
  } catch (error) {
    return apiError(error, 400);
  }
}
