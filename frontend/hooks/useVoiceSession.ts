// [claude-code 2026-04-19] S27-T5 W2c — sidecar-relayed voice session hook.
// Observes voice enable/disable transitions, calls POST /api/voice/session/start
// to pre-render Harper's greeting, plays the signed-URL audio, and exposes an
// interrupt() that hits /api/voice/session/interrupt for the active turn.
//
// This runs in PARALLEL with the legacy useVoiceAssistant flow so the existing
// recording/VAD pipeline keeps working. The sidecar path is what powers the
// fast greeting + true streaming replies once HERMES_SIDECAR_ENABLED=true.
import { useCallback, useEffect, useRef, useState } from "react";
import { useBackend } from "../lib/backend";

interface UseVoiceSessionArgs {
  enabled: boolean;
}

interface VoiceSessionState {
  conversationId: string | null;
  greetingUrl: string | null;
  sessionError: string | null;
  isStarting: boolean;
}

export function useVoiceSession({ enabled }: UseVoiceSessionArgs) {
  const backend = useBackend();
  const [state, setState] = useState<VoiceSessionState>({
    conversationId: null,
    greetingUrl: null,
    sessionError: null,
    isStarting: false,
  });

  const greetingAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevEnabledRef = useRef(false);

  const stopGreeting = useCallback(() => {
    const audio = greetingAudioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.src = "";
    } catch {
      // ignore
    }
    greetingAudioRef.current = null;
  }, []);

  const startSession = useCallback(async () => {
    setState((s) => ({ ...s, isStarting: true, sessionError: null }));
    try {
      const resp = await backend.voice.sessionStart();
      setState({
        conversationId: resp.conversationId,
        greetingUrl: resp.greetingAudioUrl ?? null,
        sessionError: resp.error ?? null,
        isStarting: false,
      });

      // Play greeting if present — prefer signed URL, fall back to base64.
      const src =
        resp.greetingAudioUrl ||
        (resp.greetingBase64 && resp.greetingMimeType
          ? `data:${resp.greetingMimeType};base64,${resp.greetingBase64}`
          : null);
      if (src) {
        stopGreeting();
        const audio = new Audio(src);
        greetingAudioRef.current = audio;
        await audio.play().catch((err) => {
          console.warn("[VoiceSession] greeting playback failed", err);
        });
      }
    } catch (err) {
      console.warn("[VoiceSession] sessionStart failed (non-fatal)", err);
      setState((s) => ({
        ...s,
        isStarting: false,
        sessionError: String(err),
      }));
    }
  }, [backend, stopGreeting]);

  const interrupt = useCallback(async () => {
    const id = state.conversationId;
    if (!id) return;
    try {
      await backend.voice.sessionInterrupt({ conversationId: id });
    } catch (err) {
      console.warn("[VoiceSession] interrupt failed", err);
    }
  }, [backend, state.conversationId]);

  const endSession = useCallback(async () => {
    const id = state.conversationId;
    stopGreeting();
    if (!id) return;
    try {
      await backend.voice.sessionEnd({ conversationId: id });
    } catch (err) {
      console.warn("[VoiceSession] end failed", err);
    }
    setState({
      conversationId: null,
      greetingUrl: null,
      sessionError: null,
      isStarting: false,
    });
  }, [backend, state.conversationId, stopGreeting]);

  // Observe enabled transitions.
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      void startSession();
    } else if (!enabled && prevEnabledRef.current) {
      void endSession();
    }
    prevEnabledRef.current = enabled;
  }, [enabled, startSession, endSession]);

  useEffect(() => {
    return () => {
      stopGreeting();
    };
  }, [stopGreeting]);

  return {
    conversationId: state.conversationId,
    greetingUrl: state.greetingUrl,
    sessionError: state.sessionError,
    isStarting: state.isStarting,
    interrupt,
    endSession,
  };
}
