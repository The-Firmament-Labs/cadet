import { registerAgentFromPayload } from "../../../../lib/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await registerAgentFromPayload(payload);
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

