import { ingestSlackEvent } from "../../../../lib/server";
import { verifySlackSignature } from "../../../../lib/webhook-verify";
import { apiError, apiUnauthorized } from "../../../../lib/api-response";

export async function POST(request: Request) {
  const body = await request.text();

  // Verify Slack signature when SLACK_SIGNING_SECRET is configured
  if (process.env.SLACK_SIGNING_SECRET) {
    const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
    const signature = request.headers.get("x-slack-signature") ?? "";

    if (!verifySlackSignature(body, timestamp, signature)) {
      return apiUnauthorized("Invalid Slack signature");
    }
  }

  try {
    const payload = JSON.parse(body);

    // Handle Slack URL verification challenge
    if (payload.type === "url_verification") {
      return Response.json({ challenge: payload.challenge });
    }

    const result = await ingestSlackEvent(payload);
    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 400);
  }
}
