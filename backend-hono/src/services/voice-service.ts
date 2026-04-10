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
  provider: "openai" | "fallback";
}

export interface VoiceSynthesisResult {
  audioBase64: string;
  audioMimeType: string;
  model: string;
  provider: "openai";
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TRANSCRIBE_MODEL =
  process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "alloy";

function normalizeBase64Audio(value: string): string {
  const trimmed = value.trim();
  const prefixMatch = trimmed.match(/^data:.*;base64,(.*)$/);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1];
  }
  return trimmed;
}

function inferFileExtension(mimeType?: string): string {
  if (!mimeType) return "webm";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "webm";
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
    return {
      text: "",
      model: "none",
      provider: "fallback",
    };
  }

  if (!OPENAI_API_KEY) {
    return {
      text: "",
      model: "openai-unconfigured",
      provider: "fallback",
    };
  }

  const normalizedBase64 = normalizeBase64Audio(input.audioBase64);
  const bytes = Buffer.from(normalizedBase64, "base64");
  const mimeType = input.mimeType ?? "audio/webm";
  const ext = inferFileExtension(mimeType);

  const form = new FormData();
  const blob = new Blob([bytes], { type: mimeType });
  form.append("file", blob, `voice.${ext}`);
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  if (input.language) {
    form.append("language", input.language);
  }
  if (input.prompt) {
    form.append("prompt", input.prompt);
  }

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Voice transcription failed (${response.status}): ${errorText}`,
    );
  }

  const json = (await response.json()) as { text?: string };

  return {
    text: json.text?.trim() ?? "",
    model: OPENAI_TRANSCRIBE_MODEL,
    provider: "openai",
  };
}

export async function synthesizeVoice(
  text: string,
): Promise<VoiceSynthesisResult | null> {
  const input = text.trim();
  if (!input) return null;
  if (!OPENAI_API_KEY) return null;

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: input.slice(0, 4000),
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Voice synthesis failed (${response.status}): ${errorText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBase64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    audioBase64,
    audioMimeType: "audio/mpeg",
    model: OPENAI_TTS_MODEL,
    provider: "openai",
  };
}
