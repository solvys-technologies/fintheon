import type { Context } from "hono";
import * as conversationStore from "../../services/ai/conversation-store.js";
import { handleHermesChat } from "../../services/hermes-handler.js";
import { transcribeVoice } from "../../services/voice-service.js";
import { analyzeSentiment } from "../../services/voice-sentiment.js";
import { speakToUser } from "../../services/harper-voice/speak.js";
import {
  synthesize,
  synthesizeSample,
} from "../../services/voice-tts/index.js";
import type { PiperVoice } from "../../services/voice-tts/types.js";

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  return userId ?? null;
}

async function resolveConversation(
  userId: string,
  conversationId: string | undefined,
  text: string,
) {
  if (conversationId) {
    const existing = await conversationStore.getConversation(
      conversationId,
      userId,
    );
    if (existing) return existing;
  }

  return conversationStore.createConversation(userId, {
    title: conversationStore.generateTitle(text),
    model: "hermes-harper-cao-voice",
    metadata: {
      channel: "voice",
      agent: "harper-cao",
    },
  });
}

export async function handleTranscribe(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req
    .json<{
      audioBase64?: string;
      mimeType?: string;
      language?: string;
      prompt?: string;
      text?: string;
    }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  try {
    const result = await transcribeVoice({
      audioBase64: body.audioBase64,
      mimeType: body.mimeType,
      language: body.language,
      prompt: body.prompt,
      text: body.text,
    });

    return c.json(result);
  } catch (error) {
    console.error("[Voice] Transcribe failed:", error);
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return c.json({ error: message }, 500);
  }
}

export async function handleSpeak(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req
    .json<{
      text?: string;
      conversationId?: string;
      mode?: "chat" | "infraction";
      includeAudio?: boolean;
      agent?: string;
    }>()
    .catch(() => null);

  const text = body?.text?.trim() ?? "";
  if (!text) {
    return c.json({ error: "text is required" }, 400);
  }

  const mode = body?.mode === "infraction" ? "infraction" : "chat";
  const agent = body?.agent || "harper-cao";

  try {
    const conversation = await resolveConversation(
      userId,
      body?.conversationId,
      text,
    );
    const history = await conversationStore.getRecentContext(conversation.id);

    const hermesInput =
      mode === "infraction"
        ? `Psych Assist infraction signal. Provide a concise intervention with immediate de-escalation guidance. Context: ${text}`
        : text;

    const response = await handleHermesChat({
      message: hermesInput,
      conversationId: conversation.id,
      history,
      agentOverride: "harper-cao",
    });

    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: "user",
      content: text,
      metadata: {
        channel: "voice",
        mode,
        requestedAgent: agent,
      },
    });

    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: "assistant",
      content: response.content,
      model: `hermes-${response.agent}`,
      metadata: {
        channel: "voice",
        mode,
      },
    });

    // [S28-T1] Omi pairing path stays as-is — fire-and-forget Harper Voice
    // notification so paired users hear it through the earbuds.
    void speakToUser(userId, response.content).catch((err) => {
      console.warn("[Voice] Harper Voice speak failed (non-fatal):", err);
    });

    // [claude-code 2026-04-24] When the client asks for inline audio (default
    // for the on-screen orb), synthesize via ElevenLabs and return the bytes.
    // Frontend `useVoiceAssistant.playAudio` already plays `audioBase64`. If
    // ELEVENLABS_API_KEY isn't configured, audio is omitted and the frontend
    // falls all the way back to its built-in synthesis (which we mark as a
    // last resort, not the primary path).
    const wantsAudio = body?.includeAudio !== false;
    let audioBase64: string | undefined;
    let audioMimeType: string | undefined;
    let ttsProvider: string | undefined;
    if (wantsAudio) {
      // [S40-P1] Routed through voice-tts/ — Piper en_GB-cori-medium first,
      // ElevenLabs fallback. HARPER_TTS_PROVIDER env switch overrides.
      const synth = await synthesize(response.content);
      if (synth) {
        audioBase64 = synth.audioBase64;
        audioMimeType = synth.audioMimeType;
        ttsProvider = synth.provider;
      }
    }

    return c.json({
      conversationId: conversation.id,
      agent: response.agent,
      responseText: response.content,
      mode,
      audioBase64,
      audioMimeType,
      ttsProvider,
    });
  } catch (error) {
    console.error("[Voice] Speak failed:", error);
    const message =
      error instanceof Error ? error.message : "Voice response failed";
    return c.json({ error: message }, 500);
  }
}

// [claude-code 2026-04-25] S40-P1: voice sample endpoint — TP curls this with
// ?voice=cori|jenny_dioco|elevenlabs&text=... to A/B candidate voices. Returns
// { audioBase64, mimeType, provider, voiceId }. Mounted unauthed in the parent
// app so a quick curl from TP's terminal works without a JWT.
export async function handleVoiceSample(c: Context) {
  const voiceParam = (c.req.query("voice") ?? "cori").toLowerCase();
  const text = (c.req.query("text") ?? "").trim();

  if (!text) {
    return c.json({ error: "text query param required" }, 400);
  }
  if (text.length > 500) {
    return c.json({ error: "text too long (500 char max)" }, 400);
  }

  const allowed = new Set(["cori", "jenny_dioco", "elevenlabs"]);
  if (!allowed.has(voiceParam)) {
    return c.json(
      {
        error: "invalid voice",
        allowed: ["cori", "jenny_dioco", "elevenlabs"],
      },
      400,
    );
  }

  const voice = voiceParam as PiperVoice | "elevenlabs";
  const synth = await synthesizeSample(text, voice);
  if (!synth) {
    return c.json(
      { error: "synthesis_unavailable", voice: voiceParam },
      503,
    );
  }

  return c.json({
    audioBase64: synth.audioBase64,
    mimeType: synth.audioMimeType,
    provider: synth.provider,
    voiceId: synth.voiceId,
  });
}

// [claude-code 2026-03-11] Track 7B: Claude Haiku sentiment analysis for VAD-triggered speech
export async function handleAnalyzeSentiment(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req
    .json<{
      transcript?: string;
      audioBase64?: string;
      mimeType?: string;
      context?: string;
    }>()
    .catch(() => null);

  if (!body) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  try {
    // If audio provided, transcribe first via Whisper
    let transcript = body.transcript?.trim() ?? "";
    if (!transcript && body.audioBase64) {
      const transcription = await transcribeVoice({
        audioBase64: body.audioBase64,
        mimeType: body.mimeType,
      });
      transcript = transcription.text;
    }

    if (!transcript) {
      return c.json({
        sentiment: 0,
        confidence: 0,
        keywords: [],
        tiltIndicators: [],
        summary: "No speech detected",
        provider: "fallback",
      });
    }

    const result = await analyzeSentiment({
      transcript,
      context: body.context,
    });

    return c.json(result);
  } catch (error) {
    console.error("[Voice] Sentiment analysis failed:", error);
    const message =
      error instanceof Error ? error.message : "Sentiment analysis failed";
    return c.json({ error: message }, 500);
  }
}
