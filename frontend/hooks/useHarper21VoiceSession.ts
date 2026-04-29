// [claude-code 2026-04-20] S21: React hook that manages the global Omi voice session.
// Emits a `fintheon:agent-response` CustomEvent that the app-wide
// AgentResponsePopup listens to, so any of the three triggers (PsychAssist,
// Voice Assistant, Performance chat) can spin up the same popup without a
// React context dependency.
import { useCallback, useEffect, useState } from "react";
import {
  getActiveHarper21VoiceSession,
  startHarper21VoiceSession,
  stopHarper21VoiceSession,
  type Harper21VoiceSession,
  type Harper21VoiceTrigger,
} from "../lib/harper-voice";
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

export function useHarper21VoiceSession() {
  const [session, setSession] = useState<Harper21VoiceSession | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getActiveHarper21VoiceSession().then((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async (trigger: Harper21VoiceTrigger) => {
    setStarting(true);
    try {
      // Permission may already be granted by the onboarding flow; this is a
      // belt-and-braces check so the live triggers still work before
      // onboarding ships.
      await ensureVoicePermissions();
      const s = await startHarper21VoiceSession(trigger);
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
    await stopHarper21VoiceSession();
    setSession(null);
    emitAgentResponse({ agent: "coach", isSpeaking: false, open: false });
  }, []);

  return { session, starting, start, stop };
}
