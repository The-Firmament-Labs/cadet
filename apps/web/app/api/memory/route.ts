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
  const { unauthorized, operatorId } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Quick memory via # prefix — stores as user-scoped memory
    if (body.action === "quick_memory") {
      const content = String(body.content ?? "").trim();
      const userId = String(body.userId ?? operatorId ?? "operator");
      if (!content) return apiError("content required", 400);

      const client = createControlClient();
      const docId = `qmem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const title = content.length > 60 ? `${content.slice(0, 57)}...` : content;

      await client.callReducer("upsert_memory_document", [
        docId,
        `user_${userId}`,    // agent_id = user scope
        "user-memory",        // namespace
        "quick-note",         // source_kind
        title,
        content,
        JSON.stringify({ userId, createdVia: "hash-prefix", createdAt: new Date().toISOString() }),
      ]);
      return Response.json({ ok: true, documentId: docId, title });
    }

    // Standard memory creation
    const { title, content, namespace, agentId, sourceKind } = body as {
      title: string; content: string; namespace?: string; agentId?: string; sourceKind?: string;
    };
    if (!title || !content) return apiError("title and content are required", 400);

    const client = createControlClient();
    const docId = `doc_${Date.now().toString(36)}`;
    await client.callReducer("upsert_memory_document", [
      docId,
      agentId ?? "cadet",
      namespace ?? "general",
      sourceKind ?? "api",       // source_kind (4th arg)
      title,                     // title (5th arg)
      content,                   // content (6th arg)
      "{}",
    ]);
    return Response.json({ ok: true, documentId: docId });
  } catch (error) {
    return apiError(error, 400);
  }
}
