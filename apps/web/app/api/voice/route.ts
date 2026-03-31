import { requireOperatorApiSession } from "@/lib/auth";
import { textToSpeech, speechToText } from "@/lib/agent-runtime/voice";
import { apiError, apiUnauthorized } from "@/lib/api-response";

/** POST /api/voice — TTS: convert text to speech audio */
export async function POST(request: Request) {
  const { unauthorized } = await requireOperatorApiSession(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { text, voice, speed } = body as { text: string; voice?: string; speed?: number };
    if (!text) return apiError("text is required", 400);

    const audio = await textToSpeech(text, {
      ttsProvider: "openai",
      voice: voice ?? "nova",
      speed: speed ?? 1.0,
      autoSpeak: false,
    });

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
      },
    });
  } catch (error) {
    return apiError(error, 500);
  }
}
