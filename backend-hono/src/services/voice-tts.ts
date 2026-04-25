// [claude-code 2026-04-24] Server-side TTS — ElevenLabs first, soft no-op fallback.
// Frontend's `useVoiceAssistant` was falling all the way down to `window.speechSynthesis`,
// which is the macOS / Chrome built-in voice ("accessibility-tier" per user). When
// ELEVENLABS_API_KEY is set, /api/voice/speak synthesizes there and ships audio
// bytes back so the client plays a real human-sounding voice instead.
//
// Configure:
//   ELEVENLABS_API_KEY        — required to enable synthesis
//   ELEVENLABS_VOICE_ID       — defaults to a neutral en-US voice ("Rachel")
//   ELEVENLABS_MODEL_ID       — defaults to eleven_turbo_v2_5 (low latency)
//   ELEVENLABS_DISABLE=true   — disable even if a key is present (debug switch)

import { createLogger } from "../lib/logger.js";

const log = createLogger("VoiceTTS");

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel" — neutral, en-US
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";
const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

export interface SynthesizedAudio {
  audioBase64: string;
  audioMimeType: string;
  provider: "elevenlabs";
  voiceId: string;
}

export function isElevenLabsAvailable(): boolean {
  if (process.env.ELEVENLABS_DISABLE === "true") return false;
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeWithElevenLabs(
  text: string,
): Promise<SynthesizedAudio | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || process.env.ELEVENLABS_DISABLE === "true") return null;
  const message = text.trim();
  if (!message) return null;

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;
  const url = `${ENDPOINT}/${voiceId}?output_format=mp3_44100_128`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: message,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log.warn("ElevenLabs request failed", {
        status: res.status,
        detail: detail.slice(0, 240),
      });
      return null;
    }

    const buffer = await res.arrayBuffer();
    const audioBase64 = Buffer.from(buffer).toString("base64");
    return {
      audioBase64,
      audioMimeType: "audio/mpeg",
      provider: "elevenlabs",
      voiceId,
    };
  } catch (err) {
    log.warn("ElevenLabs synth threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
