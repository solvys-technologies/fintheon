// [claude-code 2026-04-28] S47-T5: STT provider abstraction.
// VibeVoice evaluated: Microsoft's VibeVoice-ASR is a 7B model requiring
// NVIDIA GPU + Docker + PyTorch (see vibevoice-asr.md). Not suitable for
// the current Hono backend without a dedicated GPU sidecar. The mpaepper
// fork is a desktop dictation tool (Faster Whisper), not a backend service.
// VibeVoice is kept as a named option so a future GPU sidecar can wire in.
//
// Provider chain (first match wins):
//   1. VIBEVOICE_ASR_URL env → vibevoice HTTP client
//   2. HERMES_SIDECAR_ENABLED + whisper-turbo → sidecar
//   3. OPENAI_API_KEY → whisper (OpenAI API)
//   4. Fallback → text passthrough / empty

import { createLogger } from "../lib/logger.js";
import { isSidecarEnabled } from "./ai/sidecar-client.js";

const log = createLogger("VoiceSttProvider");

export type SttProvider = "vibevoice" | "sidecar" | "whisper" | "fallback";

export interface SttProviderInfo {
  provider: SttProvider;
  model: string;
  available: boolean;
  reason?: string;
}

function envProvider(): SttProvider | null {
  const raw = process.env.VOICE_STT_PROVIDER;
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "vibevoice" || v === "sidecar" || v === "whisper" || v === "fallback") {
    return v;
  }
  return null;
}

function canUseVibeVoice(): boolean {
  return Boolean(process.env.VIBEVOICE_ASR_URL);
}

function canUseSidecar(): boolean {
  return isSidecarEnabled() && process.env.VOICE_SIDECAR_DISABLED !== "true";
}

function canUseWhisper(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function resolveSttProvider(): SttProviderInfo {
  const forced = envProvider();

  if (forced === "vibevoice") {
    const available = canUseVibeVoice();
    return {
      provider: "vibevoice",
      model: "vibevoice-asr-7b",
      available,
      reason: available
        ? undefined
        : "VIBEVOICE_ASR_URL not set (requires GPU sidecar)",
    };
  }

  if (forced === "sidecar") {
    const available = canUseSidecar();
    return {
      provider: "sidecar",
      model: "whisper-turbo",
      available,
      reason: available
        ? undefined
        : "HERMES_SIDECAR_ENABLED=false or VOICE_SIDECAR_DISABLED=true",
    };
  }

  if (forced === "whisper") {
    const available = canUseWhisper();
    return {
      provider: "whisper",
      model: "whisper-1",
      available,
      reason: available ? undefined : "OPENAI_API_KEY not set",
    };
  }

  if (forced === "fallback") {
    return { provider: "fallback", model: "none", available: true };
  }

  // Auto-detect (no forced provider)
  if (canUseVibeVoice()) {
    return { provider: "vibevoice", model: "vibevoice-asr-7b", available: true };
  }
  if (canUseSidecar()) {
    return { provider: "sidecar", model: "whisper-turbo", available: true };
  }
  if (canUseWhisper()) {
    return { provider: "whisper", model: "whisper-1", available: true };
  }

  return {
    provider: "fallback",
    model: "none",
    available: true,
    reason: "no STT provider configured",
  };
}

export function getActiveSttProvider(): SttProvider {
  const info = resolveSttProvider();
  if (info.available) return info.provider;

  log.warn("forced STT provider unavailable, falling back", {
    forced: info.provider,
    reason: info.reason,
  });

  // Graceful degradation chain
  if (canUseSidecar()) return "sidecar";
  if (canUseWhisper()) return "whisper";
  return "fallback";
}

export function getSttProviderDiagnostics(): SttProviderInfo {
  return resolveSttProvider();
}
