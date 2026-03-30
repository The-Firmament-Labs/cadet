import { requireOperatorApiSession } from "../../../lib/auth";
import { loadInbox, dispatchJobFromPayload, ingestSlackEvent, ingestGitHubEvent } from "../../../lib/server";
import { apiError } from "../../../lib/api-response";

export async function GET(request: Request) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  const result = await loadInbox(authToken);
  return Response.json({ ok: true, result });
}

export async function POST(request: Request) {
  // Accept bot mention payloads — no session required (server-to-server)
  try {
    const payload = await request.json();
    const body = payload as {
      source?: string;
      platform?: string;
      agentId?: string;
      text?: string;
      [key: string]: unknown;
    };

    // Route through platform-specific ingest for correct channel attribution
    const platform = body.source ?? body.platform ?? "web";

    let result: unknown;
    switch (platform) {
      case "slack":
        result = await ingestSlackEvent(body);
        break;
      case "github":
        result = await ingestGitHubEvent(body);
        break;
      default:
        // Discord, Telegram, web — use generic dispatch with agentId defaulting to "cadet"
        result = await dispatchJobFromPayload({
          agentId: body.agentId ?? "cadet",
          goal: body.text ?? "",
          ...body,
        });
        break;
    }

    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 400);
  }
}
