import { parseSessionFromRequest } from "@/lib/auth";
import { createControlClient } from "@/lib/server";
import { apiError, apiUnauthorized } from "@/lib/api-response";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session) return apiUnauthorized();

  try {
    const { messageId, isPositive } = await request.json();
    const client = createControlClient();
    const scoreId = `feedback_${messageId}_${Date.now().toString(36)}`;
    const composite = isPositive ? 1.0 : 0.0;

    await client.callReducer("record_trajectory_score", [
      scoreId,
      `traj_${messageId}`,
      `run_chat_${messageId}`,
      composite, composite, composite, composite, composite,
      1.0, // surprise = 1.0 (operator feedback is always novel)
      "operator-feedback",
      "",
      isPositive ? "Operator thumbs up" : "Operator thumbs down",
      JSON.stringify({ user_feedback: isPositive }),
    ]);

    return Response.json({ ok: true, scoreId });
  } catch (error) {
    return apiError(error, 500);
  }
}
