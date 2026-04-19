// [claude-code 2026-04-19] S27-T5 W2c — voice session endpoints.
// /start   — pre-renders greeting, caches in voice-greetings bucket, returns signed URL
// /turn    — SSE stream of transcript → text → audio events for a single turn
// /interrupt — cancels the in-flight turn for a conversation
// /end     — closes the session
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import * as conversationStore from "../../services/ai/conversation-store.js";
import {
  streamVoiceReply,
  synthesizeGreeting,
  transcribeVoice,
} from "../../services/voice-service.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("VoiceSession");

const VOICE_BUCKET = "voice-greetings";

// Active turns keyed by conversation id so /interrupt can abort them mid-stream.
const activeTurns = new Map<string, AbortController>();

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  return userId ?? null;
}

async function uploadGreeting(
  conversationId: string,
  audioBase64: string,
  mimeType: string,
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const ext = mimeType.includes("opus") ? "opus" : "mp3";
  const path = `${conversationId}.${ext}`;
  const bytes = Buffer.from(audioBase64, "base64");

  const { error: uploadError } = await supabase.storage
    .from(VOICE_BUCKET)
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    });
  if (uploadError) {
    log.warn("greeting upload failed", { error: uploadError.message });
    return null;
  }

  const { data, error: signError } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (signError || !data) {
    log.warn("greeting sign failed", { error: signError?.message });
    return null;
  }
  return data.signedUrl;
}

export async function handleSessionStart(c: Context) {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req
    .json<{ conversationId?: string }>()
    .catch(() => ({}) as { conversationId?: string });

  const existing = body.conversationId
    ? await conversationStore.getConversation(body.conversationId, userId)
    : null;

  const conversation =
    existing ??
    (await conversationStore.createConversation(userId, {
      title: "Voice session",
      model: "harper-voice",
      metadata: { channel: "voice", agent: "harper-voice" },
    }));

  // Re-use existing cached greeting if the conversation is being resumed.
  if (existing) {
    return c.json({
      conversationId: conversation.id,
      greetingAudioUrl: null,
      resumed: true,
    });
  }

  try {
    const greeting = await synthesizeGreeting(conversation.id);
    const greetingAudioUrl = greeting
      ? await uploadGreeting(
          conversation.id,
          greeting.audioBase64,
          greeting.audioMimeType,
        )
      : null;

    return c.json({
      conversationId: conversation.id,
      greetingAudioUrl,
      greetingBase64: greetingAudioUrl ? undefined : greeting?.audioBase64,
      greetingMimeType: greeting?.audioMimeType,
      resumed: false,
    });
  } catch (err) {
    log.error("session/start failed", { error: String(err) });
    return c.json({
      conversationId: conversation.id,
      greetingAudioUrl: null,
      resumed: false,
      error: String(err),
    });
  }
}

export async function handleSessionTurn(c: Context) {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req
    .json<{
      conversationId?: string;
      audioBase64?: string;
      mimeType?: string;
      language?: string;
      text?: string;
    }>()
    .catch(() => null);

  if (!body?.conversationId) {
    return c.json({ error: "conversationId is required" }, 400);
  }

  const conversation = await conversationStore.getConversation(
    body.conversationId,
    userId,
  );
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);

  const transcription = await transcribeVoice({
    audioBase64: body.audioBase64,
    mimeType: body.mimeType,
    language: body.language,
    text: body.text,
  });

  const transcript = transcription.text;
  if (!transcript) {
    return c.json({ error: "No speech detected in audio" }, 400);
  }

  // Persist user turn immediately so an interrupt still leaves a record.
  await conversationStore.addMessage(conversation.id, {
    conversationId: conversation.id,
    role: "user",
    content: transcript,
    metadata: { channel: "voice" },
  });

  const controller = new AbortController();
  activeTurns.set(conversation.id, controller);

  return streamSSE(c, async (stream) => {
    let assistantText = "";
    try {
      const events = streamVoiceReply({
        conversationId: conversation.id,
        transcript,
        abortSignal: controller.signal,
      });

      for await (const evt of events) {
        if (controller.signal.aborted) break;
        if (evt.type === "text") assistantText += evt.text;
        await stream.writeSSE({
          event: evt.type,
          data: JSON.stringify(evt),
        });
        if (evt.type === "done") break;
      }
    } catch (err) {
      log.error("session/turn failed", { error: String(err) });
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ type: "error", message: String(err) }),
      });
    } finally {
      activeTurns.delete(conversation.id);
      if (assistantText.trim()) {
        const note = controller.signal.aborted ? " [interrupted]" : "";
        await conversationStore.addMessage(conversation.id, {
          conversationId: conversation.id,
          role: "assistant",
          content: assistantText + note,
          model: "hermes-harper-voice",
          metadata: { channel: "voice", interrupted: controller.signal.aborted },
        });
      }
    }
  });
}

export async function handleSessionInterrupt(c: Context) {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req
    .json<{ conversationId?: string }>()
    .catch(() => null);
  if (!body?.conversationId) {
    return c.json({ error: "conversationId is required" }, 400);
  }

  const conversation = await conversationStore.getConversation(
    body.conversationId,
    userId,
  );
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);

  const controller = activeTurns.get(conversation.id);
  if (!controller) {
    return c.json({ ok: true, interrupted: false });
  }
  controller.abort();
  activeTurns.delete(conversation.id);
  return c.json({ ok: true, interrupted: true });
}

export async function handleSessionEnd(c: Context) {
  const userId = getUserId(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req
    .json<{ conversationId?: string }>()
    .catch(() => null);
  if (!body?.conversationId) {
    return c.json({ error: "conversationId is required" }, 400);
  }

  const conversation = await conversationStore.getConversation(
    body.conversationId,
    userId,
  );
  if (!conversation) return c.json({ error: "Conversation not found" }, 404);

  const controller = activeTurns.get(conversation.id);
  if (controller) {
    controller.abort();
    activeTurns.delete(conversation.id);
  }

  return c.json({ ok: true, conversationId: conversation.id });
}

// Exposed for tests so they can peek at in-flight turns without hitting HTTP.
export function __getActiveTurnsForTest(): Map<string, AbortController> {
  return activeTurns;
}
