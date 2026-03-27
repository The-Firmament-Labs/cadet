import { loadInbox } from "../../../lib/server";

export async function GET() {
  const result = await loadInbox();
  return Response.json({ ok: true, result });
}
