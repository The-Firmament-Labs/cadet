import { requireOperatorApiSession } from "../../../../lib/auth";
import { registerAgentFromPayload } from "../../../../lib/server";

export async function POST(request: Request) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = await request.json();
    const result = await registerAgentFromPayload(payload, authToken);
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown register error"
      },
      { status: 400 }
    );
  }
}
