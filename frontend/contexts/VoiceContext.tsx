// [claude-code 2026-03-24] Wired useERScoring into voice pipeline for deterministic tilt detection
// [claude-code 2026-03-12] Single shared voice assistant context — fixes dual-instance bug
// where HeaderVoiceControl and FintheonComposer each ran independent SpeechRecognition
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";
import { useVoiceAssistant } from "../hooks/useVoiceAssistant";
import { useERScoring, type EREvent } from "../hooks/useERScoring";
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
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const backend = useBackend();

  // Fire-and-forget ER event persistence to backend
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

  // Listen for voice toggle events from chat input mic buttons
  useEffect(() => {
    const handler = () => voice.toggleEnabled();
    window.addEventListener("fintheon:voice-toggle", handler);
    return () => window.removeEventListener("fintheon:voice-toggle", handler);
  }, [voice.toggleEnabled]);

  return (
    <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within <VoiceProvider>");
  return ctx;
}
