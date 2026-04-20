// [claude-code 2026-04-20] S21-T7: Prosody feature extractor (v1 stub).
// Takes a PCM16 little-endian audio chunk + transcript text and emits a single
// voice-arousal signal (0..1). v1 uses simple RMS energy + frustration-keyword
// detection. A fuller pitch/rate model (autocorrelation pitch, syllable rate)
// is TODO in a follow-up; the contract here is stable enough that PsychAssist
// can consume it today.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";

const log = createLogger("ProsodyExtractor");

const FRUSTRATION_WORDS =
  /\b(fuck|shit|damn|bullshit|hell|fucking|god damn|goddamn|stupid|idiot|bullshit|ridiculous|seriously|are you kidding)\b/i;
const ONE_MORE_TRY_PATTERNS =
  /\b(one more (try|chance|shot)|last (one|trade)|revenge|get (it|this) back|make it back)\b/i;

export interface ProsodyFeatures {
  arousal: number; // 0..1 composite
  energy: number; // 0..1 normalized RMS
  frustration: number; // 0..1 keyword match strength
  pitchVariance: number; // placeholder
  speakingRate: number; // placeholder
}

export function computeEnergyFromPcm16(buf: Uint8Array): number {
  if (buf.length < 2) return 0;
  const samples = buf.length / 2;
  let sumSq = 0;
  for (let i = 0; i < buf.length; i += 2) {
    // little-endian int16
    const lo = buf[i];
    const hi = buf[i + 1];
    let val = (hi << 8) | lo;
    if (val >= 0x8000) val -= 0x10000;
    sumSq += (val / 32768) * (val / 32768);
  }
  const rms = Math.sqrt(sumSq / samples);
  return Math.max(0, Math.min(1, rms * 3));
}

export function computeFrustrationFromText(text: string): number {
  if (!text) return 0;
  let score = 0;
  if (FRUSTRATION_WORDS.test(text)) score += 0.5;
  if (ONE_MORE_TRY_PATTERNS.test(text)) score += 0.4;
  const allCapsTokens = text
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (allCapsTokens.length >= 2) score += 0.2;
  return Math.max(0, Math.min(1, score));
}

export function computeFeatures(
  pcm16: Uint8Array | null,
  text: string,
): ProsodyFeatures {
  const energy = pcm16 ? computeEnergyFromPcm16(pcm16) : 0;
  const frustration = computeFrustrationFromText(text);
  // Composite: energy weighted 0.4, frustration 0.6.
  const arousal = Math.max(0, Math.min(1, energy * 0.4 + frustration * 0.6));
  return {
    arousal,
    energy,
    frustration,
    pitchVariance: 0,
    speakingRate: 0,
  };
}

export async function persistSample(
  sessionId: string,
  features: ProsodyFeatures,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.from("omi_prosody_samples").insert({
    session_id: sessionId,
    arousal: features.arousal,
    pitch_variance: features.pitchVariance,
    speaking_rate: features.speakingRate,
    energy: features.energy,
    frustration: features.frustration,
  });
  if (error) log.warn("persist prosody failed", { error: error.message });
}
