import { dispatchEdgeJobFromPayload } from "../../../../../lib/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    return Response.json({ ok: true, result: await dispatchEdgeJobFromPayload(payload) });
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
