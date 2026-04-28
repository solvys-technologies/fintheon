// [claude-code 2026-04-28] S47-T5: OpenAI Whisper STT client.
// Separate file to keep voice-service.ts under 300 lines.

import { createLogger } from "../lib/logger.js";

const log = createLogger("VoiceWhisper");

export async function transcribeWithOpenAI(
  audioBase64: string,
  language?: string,
): Promise<{
  text: string;
  model: string;
  provider: "openai-whisper" | "fallback";
  fallbackReason?: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      text: "",
      model: "whisper-1",
      provider: "fallback",
      fallbackReason: "OPENAI_API_KEY not set",
    };
  }

  try {
    const buffer = Buffer.from(audioBase64, "base64");
    const blob = new Blob([buffer], { type: "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("model", "whisper-1");
    if (language) form.append("language", language);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log.warn("OpenAI Whisper failed", {
        status: res.status,
        detail: detail.slice(0, 200),
      });
      return {
        text: "",
        model: "whisper-1",
        provider: "fallback",
        fallbackReason: `OpenAI HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as { text?: string };
    return {
      text: (json.text ?? "").trim(),
      model: "whisper-1",
      provider: "openai-whisper",
    };
  } catch (err) {
    log.warn("OpenAI Whisper threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      text: "",
      model: "whisper-1",
      provider: "fallback",
      fallbackReason: err instanceof Error ? err.message : "OpenAI network error",
    };
  }
}
