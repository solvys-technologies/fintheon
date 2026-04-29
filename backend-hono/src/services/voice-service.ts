// [claude-code 2026-04-19] S27-T5 W2c — rewritten to relay through Hermes sidecar
// (voicebox/Qwen3-TTS + Whisper-turbo + qwen/qwen3.6-plus-preview:free reasoning).
// The old OpenAI-direct path never worked end-to-end (brief §Context).
// Kept: VoiceTranscribeInput/Result shape so existing /api/voice/speak caller
// still type-checks. Added: streamVoiceReply generator + synthesizeGreeting
// for the new /api/voice/session routes.

import { sidecarClient, isSidecarEnabled } from "./ai/sidecar-client.js";
import { selectModel } from "./ai/routing.js";
import { createLogger } from "../lib/logger.js";
import {
  getActiveSttProvider,
  getSttProviderDiagnostics,
} from "./voice-stt-provider.js";
import { transcribeWithOpenAI } from "./voice-whisper-client.js";

const log = createLogger("VoiceService");

const HARPER_VOICE_AGENT_ID = "harper-voice";
const HARPER_VOICE_ID = "harper-voice";

const GREETING_PROMPT =
  "The user just opened the voice assistant. Give a 1-sentence greeting (max 12 words) and wait for their question. Do not begin analysis.";

export interface VoiceTranscribeInput {
  audioBase64?: string;
  mimeType?: string;
  language?: string;
  prompt?: string;
  text?: string;
}

export interface VoiceTranscribeResult {
  text: string;
  model: string;
  provider: "vibevoice" | "hermes-sidecar" | "openai-whisper" | "fallback";
  words?: { word: string; start: number; end: number }[];
  confidence?: number;
  fallbackReason?: string;
}

export interface VoiceSynthesisResult {
  audioBase64: string;
  audioMimeType: string;
  model: string;
  provider: "hermes-sidecar";
}

export type VoiceEvent =
  | { type: "transcript"; text: string }
  | { type: "text"; text: string }
  | { type: "audio"; audioBase64: string; mimeType: string }
  | { type: "done"; reason: "complete" | "interrupted" | "error" }
  | { type: "error"; message: string };

function normalizeBase64Audio(value: string): string {
  const trimmed = value.trim();
  const prefixMatch = trimmed.match(/^data:.*;base64,(.*)$/);
  if (prefixMatch && prefixMatch[1]) return prefixMatch[1];
  return trimmed;
}

function isVoiceEnabled(): boolean {
  return isSidecarEnabled() && process.env.VOICE_SIDECAR_DISABLED !== "true";
}

export async function transcribeVoice(
  input: VoiceTranscribeInput,
): Promise<VoiceTranscribeResult> {
  if (input.text?.trim()) {
    return {
      text: input.text.trim(),
      model: "client-text",
      provider: "fallback",
    };
  }

  if (!input.audioBase64) {
    return { text: "", model: "none", provider: "fallback" };
  }

  const provider = getActiveSttProvider();
  const normalized = normalizeBase64Audio(input.audioBase64);

  if (provider === "vibevoice") {
    log.info("VibeVoice STT not yet wired — requires GPU sidecar");
    return {
      text: "",
      model: "vibevoice-asr-7b",
      provider: "vibevoice",
      fallbackReason: "VibeVoice requires GPU sidecar (not deployed)",
    };
  }

  if (provider === "whisper") {
    return transcribeWithOpenAI(normalized, input.language);
  }

  if (provider === "sidecar") {
    const result = await sidecarClient.voice.stt({
      audio_bytes: normalized,
      lang: input.language,
    });
    return {
      text: result.transcript.trim(),
      model: "whisper-turbo",
      provider: "hermes-sidecar",
      words: result.words,
    };
  }

  // fallback
  log.warn("transcribeVoice: no STT provider available", { provider });
  return {
    text: "",
    model: "none",
    provider: "fallback",
    fallbackReason: "no STT provider configured",
  };
}

export function getVoiceDiagnostics() {
  return {
    stt: getSttProviderDiagnostics(),
    sidecarEnabled: isSidecarEnabled(),
    voiceSidecarDisabled: process.env.VOICE_SIDECAR_DISABLED === "true",
    vibevoiceConfigured: Boolean(process.env.VIBEVOICE_ASR_URL),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}

export async function synthesizeVoice(
  text: string,
  voiceId: string = HARPER_VOICE_ID,
): Promise<VoiceSynthesisResult | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!isVoiceEnabled()) return null;

  const buf = await sidecarClient.voice.tts({
    text: trimmed.slice(0, 4000),
    voice_id: voiceId,
    stream: false,
  });

  return {
    audioBase64: Buffer.from(buf).toString("base64"),
    audioMimeType: "audio/ogg; codecs=opus",
    model: "qwen3-tts",
    provider: "hermes-sidecar",
  };
}

export async function synthesizeGreeting(
  conversationId: string,
): Promise<VoiceSynthesisResult | null> {
  if (!isVoiceEnabled()) return null;

  await sidecarClient.context.ingest(conversationId, {
    id: crypto.randomUUID(),
    role: "system",
    content: GREETING_PROMPT,
    tokens_estimated: Math.ceil(GREETING_PROMPT.length / 4),
    created_at: Date.now(),
  });

  let greetingText = "";
  const stream = sidecarClient.chat.stream({
    agent_id: HARPER_VOICE_AGENT_ID,
    conversation_id: conversationId,
    user_message: GREETING_PROMPT,
    stream: true,
    system_overrides: { model: selectModel("harper-voice").model },
  });

  for await (const evt of stream) {
    if (
      evt.type === "delta" &&
      typeof (evt.payload as { text?: string })?.text === "string"
    ) {
      greetingText += (evt.payload as { text: string }).text;
    }
    if (evt.type === "done" || evt.type === "error") break;
  }

  const cleaned = greetingText.trim();
  if (!cleaned) return null;
  return synthesizeVoice(cleaned, HARPER_VOICE_ID);
}

export interface StreamVoiceReplyArgs {
  conversationId: string;
  transcript: string;
  abortSignal?: AbortSignal;
}

export async function* streamVoiceReply(
  args: StreamVoiceReplyArgs,
): AsyncGenerator<VoiceEvent> {
  const { conversationId, transcript, abortSignal } = args;

  if (!isVoiceEnabled()) {
    yield {
      type: "error",
      message: "voice sidecar not enabled (HERMES_SIDECAR_ENABLED=false)",
    };
    yield { type: "done", reason: "error" };
    return;
  }

  yield { type: "transcript", text: transcript };

  await sidecarClient.context.ingest(conversationId, {
    id: crypto.randomUUID(),
    role: "user",
    content: transcript,
    tokens_estimated: Math.ceil(transcript.length / 4),
    created_at: Date.now(),
    metadata: { channel: "voice" },
  });

  const chatStream = sidecarClient.chat.stream({
    agent_id: HARPER_VOICE_AGENT_ID,
    conversation_id: conversationId,
    user_message: transcript,
    stream: true,
    system_overrides: { model: selectModel("harper-voice").model },
  });

  // Sentence-gated TTS: synthesize every complete sentence as soon as the
  // reasoning model emits it so audio starts overlapping generation.
  let buffer = "";
  const sentenceRe = /(?<=[.!?])\s+|\n\n/;
  const ttsTasks: Promise<VoiceEvent>[] = [];

  const startTts = (chunk: string): void => {
    const clean = chunk.trim();
    if (!clean) return;
    ttsTasks.push(
      (async () => {
        try {
          const buf = await sidecarClient.voice.tts({
            text: clean,
            voice_id: HARPER_VOICE_ID,
            stream: true,
          });
          return {
            type: "audio",
            audioBase64: Buffer.from(buf).toString("base64"),
            mimeType: "audio/ogg; codecs=opus",
          } satisfies VoiceEvent;
        } catch (err) {
          log.warn("tts chunk failed", { error: String(err) });
          return {
            type: "error",
            message: `tts failed: ${String(err)}`,
          } satisfies VoiceEvent;
        }
      })(),
    );
  };

  try {
    for await (const evt of chatStream) {
      if (abortSignal?.aborted) break;

      if (evt.type === "delta") {
        const text = (evt.payload as { text?: string })?.text ?? "";
        if (!text) continue;
        yield { type: "text", text };
        buffer += text;
        const parts = buffer.split(sentenceRe);
        if (parts.length > 1) {
          for (let i = 0; i < parts.length - 1; i++) startTts(parts[i]);
          buffer = parts[parts.length - 1];
        }
      } else if (evt.type === "error") {
        const message =
          (evt.payload as { message?: string })?.message ?? "sidecar error";
        yield { type: "error", message };
      } else if (evt.type === "done") {
        break;
      }
    }

    if (!abortSignal?.aborted && buffer.trim()) startTts(buffer);

    for (const task of ttsTasks) {
      if (abortSignal?.aborted) break;
      yield await task;
    }

    yield {
      type: "done",
      reason: abortSignal?.aborted ? "interrupted" : "complete",
    };
  } catch (err) {
    log.error("streamVoiceReply failed", { error: String(err) });
    yield { type: "error", message: String(err) };
    yield { type: "done", reason: "error" };
  }
}
