import { parseSessionFromRequest } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { apiError, apiUnauthorized } from "@/lib/api-response";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  try {
    const { messageId, isPositive, platform, runId } = await request.json();
    const client = createControlClient();
    const platformTag = platform ?? "web";
    const scoreId = `feedback_${platformTag}_${messageId}_${Date.now().toString(36)}`;
    const composite = isPositive ? 1.0 : 0.0;
    const effectiveRunId = runId ?? `run_chat_${messageId}`;

    await client.callReducer("record_trajectory_score", [
      scoreId,
      `traj_${messageId}`,
      effectiveRunId,
      composite, composite, composite, composite, composite,
      1.0, // surprise = 1.0 (operator feedback is always novel)
      "operator-feedback",
      "",
      `${platformTag}: ${isPositive ? "thumbs up" : "thumbs down"}`,
      JSON.stringify({ user_feedback: isPositive, platform: platformTag }),
    ]);

    return Response.json({ ok: true, scoreId });
  } catch (error) {
    return apiError(error, 500);
  }
}
