// [claude-code 2026-04-25] S40-P1: shared TTS types for voice-tts router.

export type TtsProvider = "piper" | "elevenlabs";

export type PiperVoice = "cori" | "jenny_dioco";

export interface SynthesizedAudio {
  audioBase64: string;
  audioMimeType: string;
  provider: TtsProvider;
  voiceId: string;
}
