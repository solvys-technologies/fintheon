// [claude-code 2026-04-25] S40-P1: shim — the implementation moved to
// services/voice-tts/. This file re-exports the public surface so any straggler
// importer keeps working. Prefer importing from "../services/voice-tts/index"
// directly in new code.

export {
  synthesize,
  synthesizeSample,
  synthesizeWithElevenLabs,
  isElevenLabsAvailable,
  synthesizeWithPiper,
  isPiperAvailable,
} from "./voice-tts/index.js";
export type {
  SynthesizedAudio,
  TtsProvider,
  PiperVoice,
} from "./voice-tts/types.js";
