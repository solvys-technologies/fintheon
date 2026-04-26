// [claude-code 2026-04-25] S40-P1: TTS router. Routes synthesize() to either
// Piper (local; en_GB-cori-medium) or ElevenLabs based on HARPER_TTS_PROVIDER.
// Default is "piper" — Harper should sound like a senior British PM, not the
// 20-something Californian "Rachel" voice that ships with ElevenLabs.
//
// On Piper failure (binary missing, weights missing, exec error) we fall
// through to ElevenLabs so Harper still talks. Logged as a soft warning.

import { createLogger } from "../../lib/logger.js";
import {
  synthesizeWithElevenLabs,
  isElevenLabsAvailable,
} from "./elevenlabs.js";
import { synthesizeWithPiper, isPiperAvailable } from "./piper.js";
import type { PiperVoice, SynthesizedAudio, TtsProvider } from "./types.js";

const log = createLogger("VoiceTTS:Router");

export type { SynthesizedAudio, TtsProvider, PiperVoice } from "./types.js";

function resolveProvider(): TtsProvider {
  const env = (process.env.HARPER_TTS_PROVIDER ?? "piper").toLowerCase();
  if (env === "elevenlabs") return "elevenlabs";
  return "piper";
}

export async function synthesize(
  text: string,
): Promise<SynthesizedAudio | null> {
  const provider = resolveProvider();

  if (provider === "piper") {
    const piper = await synthesizeWithPiper(text);
    if (piper) return piper;
    log.warn("Piper unavailable; falling back to ElevenLabs");
  }

  return synthesizeWithElevenLabs(text);
}

// Sample endpoint helper — explicit voice selection, lets TP A/B candidate
// voices in his own ear.
export async function synthesizeSample(
  text: string,
  voice: PiperVoice | "elevenlabs",
): Promise<SynthesizedAudio | null> {
  if (voice === "elevenlabs") {
    return synthesizeWithElevenLabs(text);
  }
  return synthesizeWithPiper(text, voice);
}

export {
  synthesizeWithElevenLabs,
  isElevenLabsAvailable,
  synthesizeWithPiper,
  isPiperAvailable,
};
