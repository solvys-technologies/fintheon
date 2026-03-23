import type { Context } from 'hono';
import * as conversationStore from '../../services/ai/conversation-store.js';
import { handleHermesChat } from '../../services/hermes-handler.js';
import { synthesizeVoice, transcribeVoice } from '../../services/voice-service.js';
import { analyzeSentiment } from '../../services/voice-sentiment.js';

function getUserId(c: Context): string | null {
  const userId = c.get('userId') as string | undefined;
  return userId ?? null;
}

async function resolveConversation(userId: string, conversationId: string | undefined, text: string) {
  if (conversationId) {
    const existing = await conversationStore.getConversation(conversationId, userId);
    if (existing) return existing;
  }

  return conversationStore.createConversation(userId, {
    title: conversationStore.generateTitle(text),
    model: 'hermes-harper-cao-voice',
    metadata: {
      channel: 'voice',
      agent: 'harper-cao',
    },
  });
}

export async function handleTranscribe(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
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
    return c.json({ error: 'Invalid request body' }, 400);
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
    console.error('[Voice] Transcribe failed:', error);
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return c.json({ error: message }, 500);
  }
}

export async function handleSpeak(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req
    .json<{
      text?: string;
      conversationId?: string;
      mode?: 'chat' | 'infraction';
      includeAudio?: boolean;
      agent?: string;
    }>()
    .catch(() => null);

  const text = body?.text?.trim() ?? '';
  if (!text) {
    return c.json({ error: 'text is required' }, 400);
  }

  const mode = body?.mode === 'infraction' ? 'infraction' : 'chat';
  const includeAudio = body?.includeAudio !== false;
  const agent = body?.agent || 'harper-cao';

  try {
    const conversation = await resolveConversation(userId, body?.conversationId, text);
    const history = await conversationStore.getRecentContext(conversation.id);

    const hermesInput =
      mode === 'infraction'
        ? `Psych Assist infraction signal. Provide a concise intervention with immediate de-escalation guidance. Context: ${text}`
        : text;

    const response = await handleHermesChat({
      message: hermesInput,
      conversationId: conversation.id,
      history,
      agentOverride: 'harper-cao',
    });

    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'user',
      content: text,
      metadata: {
        channel: 'voice',
        mode,
        requestedAgent: agent,
      },
    });

    await conversationStore.addMessage(conversation.id, {
      conversationId: conversation.id,
      role: 'assistant',
      content: response.content,
      model: `hermes-${response.agent}`,
      metadata: {
        channel: 'voice',
        mode,
      },
    });

    let audioBase64: string | undefined;
    let audioMimeType: string | undefined;

    if (includeAudio) {
      try {
        const audio = await synthesizeVoice(response.content);
        if (audio) {
          audioBase64 = audio.audioBase64;
          audioMimeType = audio.audioMimeType;
        }
      } catch (error) {
        console.warn('[Voice] TTS synthesis failed, returning text only:', error);
      }
    }

    return c.json({
      conversationId: conversation.id,
      agent: response.agent,
      responseText: response.content,
      audioBase64,
      audioMimeType,
      mode,
    });
  } catch (error) {
    console.error('[Voice] Speak failed:', error);
    const message = error instanceof Error ? error.message : 'Voice response failed';
    return c.json({ error: message }, 500);
  }
}

// [claude-code 2026-03-11] Track 7B: Claude Haiku sentiment analysis for VAD-triggered speech
export async function handleAnalyzeSentiment(c: Context) {
  const userId = getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
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
    return c.json({ error: 'Invalid request body' }, 400);
  }

  try {
    // If audio provided, transcribe first via Whisper
    let transcript = body.transcript?.trim() ?? '';
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
        summary: 'No speech detected',
        provider: 'fallback',
      });
    }

    const result = await analyzeSentiment({
      transcript,
      context: body.context,
    });

    return c.json(result);
  } catch (error) {
    console.error('[Voice] Sentiment analysis failed:', error);
    const message = error instanceof Error ? error.message : 'Sentiment analysis failed';
    return c.json({ error: message }, 500);
  }
}
