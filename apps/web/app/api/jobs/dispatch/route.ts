import { dispatchJobFromPayload } from "../../../../lib/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await dispatchJobFromPayload(payload);
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

