/**
 * Cadet Voice System
 *
 * Text-to-speech for agent responses and speech-to-text for voice input.
 * Uses OpenAI TTS/STT via AI Gateway for best quality and simplicity.
 *
 * Voice is delivered through:
 * - Web: Audio element in chat panel
 * - Slack/Discord: Voice message attachments
 * - CLI: Pipe to system audio
 */

export interface VoiceConfig {
  /** TTS provider */
  ttsProvider: "openai" | "elevenlabs";
  /** Voice ID / name */
  voice: string;
  /** Speed multiplier (0.5 - 2.0) */
  speed: number;
  /** Whether to auto-speak agent responses */
  autoSpeak: boolean;
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  ttsProvider: "openai",
  voice: "nova", // Clean, professional — fits orbital ops theme
  speed: 1.0,
  autoSpeak: false,
};

// Space-themed voice presets
export const VOICE_PRESETS: Record<string, VoiceConfig> = {
  "mission-control": {
    ttsProvider: "openai",
    voice: "onyx",
    speed: 0.95,
    autoSpeak: false,
  },
  "flight-ops": {
    ttsProvider: "openai",
    voice: "nova",
    speed: 1.1,
    autoSpeak: false,
  },
  "deep-space": {
    ttsProvider: "openai",
    voice: "echo",
    speed: 0.9,
    autoSpeak: false,
  },
};

/** Generate speech from text using AI Gateway TTS. */
export async function textToSpeech(
  text: string,
  config: VoiceConfig = DEFAULT_VOICE_CONFIG,
): Promise<ArrayBuffer> {
  // OpenAI TTS via AI Gateway
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required for TTS");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4096), // TTS limit
      voice: config.voice,
      speed: config.speed,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`TTS failed: ${res.status}`);
  }

  return res.arrayBuffer();
}

/** Transcribe speech to text using OpenAI Whisper. */
export async function speechToText(
  audio: ArrayBuffer,
  format: string = "webm",
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required for STT");

  const formData = new FormData();
  formData.append("file", new Blob([audio], { type: `audio/${format}` }), `audio.${format}`);
  formData.append("model", "whisper-1");
  formData.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`STT failed: ${res.status}`);
  const data = (await res.json()) as { text: string };
  return data.text;
}
