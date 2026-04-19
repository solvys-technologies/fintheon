// [claude-code 2026-04-19] S27-T5 W2c — thin typed wrapper around the sidecar
// /v1/voice/* endpoints. Keeps voice-service.ts free of raw HTTP concerns and
// gives the session routes + tests a single seam to mock.

import { sidecarClient, isSidecarEnabled } from "./sidecar-client.js";

export interface SidecarVoiceSttResult {
  transcript: string;
  words?: { word: string; start: number; end: number }[];
  model?: string;
}

export interface SidecarVoiceTtsArgs {
  text: string;
  voiceId: string;
  stream?: boolean;
}

export const sidecarVoiceClient = {
  isEnabled(): boolean {
    return isSidecarEnabled();
  },

  async stt(args: {
    audioBase64: string;
    lang?: string;
  }): Promise<SidecarVoiceSttResult> {
    const result = await sidecarClient.voice.stt({
      audio_bytes: args.audioBase64,
      lang: args.lang,
    });
    return {
      transcript: result.transcript,
      words: result.words,
      model: "whisper-turbo",
    };
  },

  async tts(args: SidecarVoiceTtsArgs): Promise<ArrayBuffer> {
    return sidecarClient.voice.tts({
      text: args.text,
      voice_id: args.voiceId,
      stream: args.stream ?? true,
    });
  },
};
