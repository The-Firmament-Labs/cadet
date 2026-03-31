import { ingestGitHubEvent } from "../../../../lib/server";
import { verifyGitHubSignature } from "../../../../lib/webhook-verify";
import { apiError, apiUnauthorized } from "../../../../lib/api-response";

export async function POST(request: Request) {
  const body = await request.text();

  // Verify GitHub signature when GITHUB_WEBHOOK_SECRET is configured
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const signature = request.headers.get("x-hub-signature-256") ?? "";

    if (!verifyGitHubSignature(body, signature)) {
      return apiUnauthorized("Invalid GitHub signature");
    }
  }

  try {
    const payload = JSON.parse(body);
    const result = await ingestGitHubEvent(payload);
    return Response.json({ ok: true, result });
  } catch (error) {
    return apiError(error, 400);
  }
}
