// [claude-code 2026-03-24] Wired useERScoring into voice pipeline for deterministic tilt detection
// [claude-code 2026-03-12] Single shared voice assistant context — fixes dual-instance bug
//   where HeaderVoiceControl and FintheonComposer each ran independent SpeechRecognition
// [claude-code 2026-04-19] S27-T5 W2c — added sidecar session bootstrap:
//   when `enabled` flips true we POST /api/voice/session/start to pre-render
//   Harper's greeting + play it, and cancel() now also hits /session/interrupt.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { useERScoring, type EREvent } from "../hooks/useERScoring";
import { useVoiceSession } from "../hooks/useVoiceSession";
import { useBackend } from "../lib/backend";
import type { VoiceRuntimeState, MicPermissionState } from "../types/voice";

interface VoiceContextValue {
  enabled: boolean;
  runtimeState: VoiceRuntimeState;
  conversationId: string | null;
  lastUserText: string;
  lastAssistantText: string;
  isSupported: boolean;
  micPermission: MicPermissionState;
  setEnabled: (v: boolean) => void;
  toggleEnabled: () => void;
  sendText: (text: string, mode?: "chat" | "infraction") => Promise<any>;
  respondToInfraction: (input?: {
    erScore?: number;
    infractionCount?: number;
  }) => Promise<any>;
  cancel: () => void;
  // S27-T5 W2c — sidecar session.
  voiceSessionId: string | null;
  voiceSessionError: string | null;
  isVoiceSessionStarting: boolean;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const backend = useBackend();

  const handleEREvent = useCallback(
    (event: EREvent) => {
      backend.er.postEREvent(event).catch((err: unknown) => {
        console.warn(
          "[VoiceProvider] ER event persistence failed (non-critical):",
          err,
        );
      });
    },
    [backend],
  );

  const erScoring = useERScoring({ onEvent: handleEREvent });

  const voice = useVoiceAssistant({
    onTranscript: erScoring.processTranscript,
  });

  const session = useVoiceSession({ enabled: voice.enabled });

  useEffect(() => {
    const handler = () => voice.toggleEnabled();
    window.addEventListener("fintheon:voice-toggle", handler);
    return () => window.removeEventListener("fintheon:voice-toggle", handler);
  }, [voice.toggleEnabled]);

  // Compose cancel: wrap legacy cancel with a sidecar /session/interrupt.
  const baseCancel = voice.cancel;
  const cancel = useCallback(() => {
    void session.interrupt();
    baseCancel();
  }, [session, baseCancel]);

  const value = useMemo<VoiceContextValue>(
    () => ({
      ...voice,
      cancel,
      voiceSessionId: session.conversationId,
      voiceSessionError: session.sessionError,
      isVoiceSessionStarting: session.isStarting,
    }),
    [voice, cancel, session],
  );

  return (
    <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within <VoiceProvider>");
  return ctx;
}
