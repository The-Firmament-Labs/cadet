import { requireVercelAccessToken } from "@/lib/auth";
import { screenshotUrl } from "@/lib/agent-runtime/browser";
import { apiError } from "@/lib/api-response";

/** POST /api/browser/screenshot — take a screenshot of a URL */
export async function POST(request: Request) {
  const { unauthorized, vercelAccessToken, operatorId } = await requireVercelAccessToken(request);
  if (unauthorized) return unauthorized;

  try {
    const { url, sandboxId } = (await request.json()) as { url: string; sandboxId: string };
    if (!url || !sandboxId) return apiError("url and sandboxId are required", 400);

    const screenshot = await screenshotUrl(url, sandboxId, vercelAccessToken!);
    if (!screenshot) return apiError("Screenshot failed", 500);

    return Response.json({ ok: true, screenshot });
  } catch (error) {
    return apiError(error, 500);
  }
}
