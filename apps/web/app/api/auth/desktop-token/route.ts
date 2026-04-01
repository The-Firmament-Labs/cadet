import { createControlClient } from "@/lib/server";
import { sqlEscape } from "@/lib/sql";
import { apiError } from "@/lib/api-response";

/**
 * Desktop Auth Token Exchange
 *
 * POST: Browser writes the session token after auth
 * GET: Desktop app polls for the token
 *
 * Uses SpacetimeDB memory_document as ephemeral storage (5 min TTL).
 */

const DOC_ID = "desktop_auth_pending";

export async function POST(request: Request) {
  try {
    const { token } = (await request.json()) as { token: string };
    if (!token) return apiError("token required", 400);

    const client = createControlClient();
    await client.callReducer("upsert_memory_document", [
      DOC_ID,
      "system",
      "desktop-auth",
      "Desktop Auth Token",
      JSON.stringify({ token, createdAt: Date.now() }),
      "desktop-auth",
      "{}",
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error, 500);
  }
}

export async function GET() {
  try {
    const client = createControlClient();
    const rows = (await client.sql(
      `SELECT content FROM memory_document WHERE document_id = '${sqlEscape(DOC_ID)}'`,
    )) as Record<string, unknown>[];

    if (rows.length === 0) {
      return Response.json({ ok: false, error: "No token available" }, { status: 404 });
    }

    const data = JSON.parse(String(rows[0]!.content)) as { token: string; createdAt: number };

    // Token must be less than 5 minutes old
    if (Date.now() - data.createdAt > 5 * 60 * 1000) {
      await client.callReducer("delete_memory_document", [DOC_ID]).catch(() => {});
      return Response.json({ ok: false, error: "Token expired" }, { status: 410 });
    }

    // Delete after reading (one-time use)
    await client.callReducer("delete_memory_document", [DOC_ID]).catch(() => {});

    return Response.json({ ok: true, token: data.token });
  } catch {
    return Response.json({ ok: false, error: "No token available" }, { status: 404 });
  }
}
