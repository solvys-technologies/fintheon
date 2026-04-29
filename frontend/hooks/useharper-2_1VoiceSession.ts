// [claude-code 2026-04-20] S21: React hook that manages the global Omi voice session.
// Emits a `fintheon:agent-response` CustomEvent that the app-wide
// AgentResponsePopup listens to, so any of the three triggers (PsychAssist,
// Voice Assistant, Performance chat) can spin up the same popup without a
// React context dependency.
import { useCallback, useEffect, useState } from "react";
import {
  getActiveharper-2_1VoiceSession,
  startharper-2_1VoiceSession,
  stopharper-2_1VoiceSession,
  type harper-2_1VoiceSession,
  type harper-2_1VoiceTrigger,
} from "../lib/harper-2.1-voice";
import { ensureVoicePermissions } from "../lib/system-permissions";

export interface AgentResponseEventDetail {
  agent: "coach" | "oracle" | "harper";
  isSpeaking: boolean;
  preamble?: string;
  streamedText?: string;
  open: boolean;
}

export function emitAgentResponse(detail: AgentResponseEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AgentResponseEventDetail>("fintheon:agent-response", {
      detail,
    }),
  );
}

export function useharper-2_1VoiceSession() {
  const [session, setSession] = useState<harper-2_1VoiceSession | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getActiveharper-2_1VoiceSession().then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async (trigger: harper-2_1VoiceTrigger) => {
    setStarting(true);
    try {
      // Permission may already be granted by the onboarding flow; this is a
      // belt-and-braces check so the live triggers still work before
      // onboarding ships.
      await ensureVoicePermissions();
      const s = await startharper-2_1VoiceSession(trigger);
      setSession(s);
      if (s) {
        emitAgentResponse({
          agent: s.primaryAgent,
          isSpeaking: true,
          open: true,
        });
      }
      return s;
    } finally {
      setStarting(false);
    }
  }, []);

  const stop = useCallback(async () => {
    await stopharper-2_1VoiceSession();
    setSession(null);
    emitAgentResponse({ agent: "coach", isSpeaking: false, open: false });
  }, []);

  return { session, starting, start, stop };
}
