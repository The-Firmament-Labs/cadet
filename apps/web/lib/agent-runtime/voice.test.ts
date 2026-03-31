import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock global fetch ─────────────────────────────────────────────────
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

import {
  textToSpeech,
  speechToText,
  VOICE_PRESETS,
  DEFAULT_VOICE_CONFIG,
  type VoiceConfig,
} from "./voice";

// ── Helpers ───────────────────────────────────────────────────────────

function mockSuccessfulTtsResponse(buffer: ArrayBuffer = new ArrayBuffer(8)) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
    status: 200,
  });
}

function mockSuccessfulSttResponse(text = "transcribed text") {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: vi.fn().mockResolvedValue({ text }),
    status: 200,
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "sk-test-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// ── textToSpeech ──────────────────────────────────────────────────────

describe("textToSpeech", () => {
  it("calls OpenAI TTS API with correct URL and method", async () => {
    mockSuccessfulTtsResponse();

    await textToSpeech("Hello world");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect(opts.method).toBe("POST");
  });

  it("sends Authorization header with API key", async () => {
    mockSuccessfulTtsResponse();

    await textToSpeech("Test");

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test-key");
  });

  it("sends correct default voice config in body", async () => {
    mockSuccessfulTtsResponse();

    await textToSpeech("Test with defaults");

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe("tts-1");
    expect(body.input).toBe("Test with defaults");
    expect(body.voice).toBe("nova");
    expect(body.speed).toBe(1.0);
    expect(body.response_format).toBe("mp3");
  });

  it("respects custom voice name from config", async () => {
    mockSuccessfulTtsResponse();

    const config: VoiceConfig = {
      ttsProvider: "openai",
      voice: "onyx",
      speed: 0.95,
      autoSpeak: false,
    };

    await textToSpeech("Test", config);

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.voice).toBe("onyx");
    expect(body.speed).toBe(0.95);
  });

  it("respects custom speed from config", async () => {
    mockSuccessfulTtsResponse();

    const config: VoiceConfig = { ...DEFAULT_VOICE_CONFIG, speed: 1.5 };
    await textToSpeech("Fast speech", config);

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.speed).toBe(1.5);
  });

  it("truncates text to 4096 characters", async () => {
    mockSuccessfulTtsResponse();

    const longText = "a".repeat(5000);
    await textToSpeech(longText);

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.input.length).toBe(4096);
  });

  it("does not truncate text shorter than 4096 characters", async () => {
    mockSuccessfulTtsResponse();

    const shortText = "Hello world";
    await textToSpeech(shortText);

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.input).toBe("Hello world");
  });

  it("returns an ArrayBuffer on success", async () => {
    const expectedBuffer = new ArrayBuffer(16);
    mockSuccessfulTtsResponse(expectedBuffer);

    const result = await textToSpeech("Return buffer");
    expect(result).toBe(expectedBuffer);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(textToSpeech("No key")).rejects.toThrow("OPENAI_API_KEY required for TTS");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when fetch response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    await expect(textToSpeech("Rate limited")).rejects.toThrow("TTS failed: 429");
  });
});

// ── speechToText ──────────────────────────────────────────────────────

describe("speechToText", () => {
  it("calls Whisper API with correct URL and method", async () => {
    mockSuccessfulSttResponse();

    await speechToText(new ArrayBuffer(8));

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(opts.method).toBe("POST");
  });

  it("sends Authorization header with API key", async () => {
    mockSuccessfulSttResponse();

    await speechToText(new ArrayBuffer(8));

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test-key");
  });

  it("sends FormData body with audio file and model", async () => {
    mockSuccessfulSttResponse();

    await speechToText(new ArrayBuffer(8));

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    expect(opts.body).toBeInstanceOf(FormData);
    const form = opts.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    expect(form.get("language")).toBe("en");
  });

  it("returns the transcribed text string", async () => {
    mockSuccessfulSttResponse("hello from space");

    const text = await speechToText(new ArrayBuffer(8));
    expect(text).toBe("hello from space");
  });

  it("uses default webm format when not specified", async () => {
    mockSuccessfulSttResponse();

    await speechToText(new ArrayBuffer(8));

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const form = opts.body as FormData;
    const file = form.get("file") as File;
    expect(file.name).toBe("audio.webm");
  });

  it("uses custom format when specified", async () => {
    mockSuccessfulSttResponse();

    await speechToText(new ArrayBuffer(8), "mp3");

    const [, opts] = mockFetch.mock.calls[0]! as [string, RequestInit];
    const form = opts.body as FormData;
    const file = form.get("file") as File;
    expect(file.name).toBe("audio.mp3");
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(speechToText(new ArrayBuffer(8))).rejects.toThrow(
      "OPENAI_API_KEY required for STT"
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when fetch response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(speechToText(new ArrayBuffer(8))).rejects.toThrow("STT failed: 500");
  });
});

// ── VOICE_PRESETS ─────────────────────────────────────────────────────

describe("VOICE_PRESETS", () => {
  const requiredFields: (keyof VoiceConfig)[] = [
    "ttsProvider",
    "voice",
    "speed",
    "autoSpeak",
  ];

  it.each(Object.keys(VOICE_PRESETS))(
    "preset %s has all required fields",
    (presetName) => {
      const preset = VOICE_PRESETS[presetName]!;
      for (const field of requiredFields) {
        expect(preset).toHaveProperty(field);
      }
    }
  );

  it("has mission-control preset with onyx voice", () => {
    expect(VOICE_PRESETS["mission-control"]!.voice).toBe("onyx");
  });

  it("has flight-ops preset with nova voice", () => {
    expect(VOICE_PRESETS["flight-ops"]!.voice).toBe("nova");
  });

  it("has deep-space preset with echo voice", () => {
    expect(VOICE_PRESETS["deep-space"]!.voice).toBe("echo");
  });

  it("all preset speeds are within valid range 0.5-2.0", () => {
    for (const preset of Object.values(VOICE_PRESETS)) {
      expect(preset.speed).toBeGreaterThanOrEqual(0.5);
      expect(preset.speed).toBeLessThanOrEqual(2.0);
    }
  });
});

// ── DEFAULT_VOICE_CONFIG ──────────────────────────────────────────────

describe("DEFAULT_VOICE_CONFIG", () => {
  it("has all required fields", () => {
    expect(DEFAULT_VOICE_CONFIG).toHaveProperty("ttsProvider");
    expect(DEFAULT_VOICE_CONFIG).toHaveProperty("voice");
    expect(DEFAULT_VOICE_CONFIG).toHaveProperty("speed");
    expect(DEFAULT_VOICE_CONFIG).toHaveProperty("autoSpeak");
  });

  it("uses openai as default provider", () => {
    expect(DEFAULT_VOICE_CONFIG.ttsProvider).toBe("openai");
  });

  it("uses nova voice by default", () => {
    expect(DEFAULT_VOICE_CONFIG.voice).toBe("nova");
  });

  it("has speed of 1.0 by default", () => {
    expect(DEFAULT_VOICE_CONFIG.speed).toBe(1.0);
  });

  it("has autoSpeak disabled by default", () => {
    expect(DEFAULT_VOICE_CONFIG.autoSpeak).toBe(false);
  });
});
