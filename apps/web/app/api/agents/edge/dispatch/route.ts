import { requireOperatorApiSession } from "../../../../../lib/auth";
import { dispatchEdgeJobFromPayload } from "../../../../../lib/server";

export async function POST(request: Request) {
  const { unauthorized, authToken } = await requireOperatorApiSession(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const payload = await request.json();
    return Response.json({
      ok: true,
      result: await dispatchEdgeJobFromPayload(payload, authToken)
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown edge dispatch error"
      },
      { status: 400 }
    );
  }
}
