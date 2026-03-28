import { requireOperatorApiSession } from "../../../../lib/auth";
import { dispatchJobFromPayload } from "../../../../lib/server";

export async function POST(request: Request) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = await request.json();
    const result = await dispatchJobFromPayload(payload, authToken);
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown dispatch error"
      },
      { status: 400 }
    );
  }
}
