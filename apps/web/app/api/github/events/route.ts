import { ingestGitHubEvent } from "../../../../lib/server";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const result = await ingestGitHubEvent(payload);
  return Response.json({ ok: true, result });
}
