// [claude-code 2026-03-09] Added cancel on click during speaking/thinking, mic denied-state UI
// [claude-code 2026-03-12] Switched from independent useVoiceAssistant() to shared VoiceContext
// [claude-code 2026-04-20] S21: Toggling also starts/stops a `voice_assistant` Harper Voice session so the popup + agent routing fire.
// [claude-code 2026-04-23] Collapse handleClick into single-intent paths: one click while enabled = full off
//   (cancel-if-busy + toggle + stopSession). Previous branching relied on stale `enabled` inside the
//   closure and could require 3 taps to turn the orb off when triggered mid-speech.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";
import { resolveVoiceOrbState } from "../../types/voice";
import { VoiceAuroraOrb } from "./VoiceAuroraOrb";
import { useHarperVoiceSession } from "../../hooks/useHarperVoiceSession";

const INFRACTION_HOLD_MS = 8_000;
const INFRACTION_WINDOW_MS = 5 * 60_000;
const INFRACTION_THRESHOLD = 2;
const ER_THRESHOLD = -1.5;
const INTERVENTION_COOLDOWN_MS = 10 * 60_000;

interface HeaderVoiceControlProps {
  compact?: boolean;
}

interface PsychAssistScoreEvent {
  score?: number;
  timestamp?: number;
}

interface PsychAssistInfractionEvent {
  timestamp?: number;
}

function readCurrentErScore(): number {
  try {
    const raw = localStorage.getItem("psychassist_current_score");
    const score = raw ? parseFloat(raw) : 0;
    return Number.isFinite(score) ? score : 0;
  } catch {
    return 0;
  }
}

export function HeaderVoiceControl({
  compact = false,
}: HeaderVoiceControlProps) {
  const {
    enabled,
    runtimeState,
    isSupported,
    micPermission,
    toggleEnabled,
    respondToInfraction,
    cancel,
  } = useVoice();

  const [currentScore, setCurrentScore] = useState(0);
  const [lastInfractionAt, setLastInfractionAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  const infractionTimestampsRef = useRef<number[]>([]);
  const cooldownUntilRef = useRef<number>(0);

  const evaluateIntervention = useCallback(
    (now: number) => {
      infractionTimestampsRef.current = infractionTimestampsRef.current.filter(
        (ts) => now - ts <= INFRACTION_WINDOW_MS,
      );

      if (!enabled) return;
      if (now < cooldownUntilRef.current) return;

      const hitInfractionThreshold =
        infractionTimestampsRef.current.length >= INFRACTION_THRESHOLD;
      const hitScoreThreshold = currentScore <= ER_THRESHOLD;

      if (!hitInfractionThreshold && !hitScoreThreshold) return;

      cooldownUntilRef.current = now + INTERVENTION_COOLDOWN_MS;
      void respondToInfraction({
        erScore: currentScore,
        infractionCount: infractionTimestampsRef.current.length,
      });
    },
    [currentScore, enabled, respondToInfraction],
  );

  useEffect(() => {
    setCurrentScore(readCurrentErScore());

    const scoreInterval = window.setInterval(() => {
      setCurrentScore(readCurrentErScore());
    }, 1500);

    const handleScore = (event: Event) => {
      const detail = (event as CustomEvent<PsychAssistScoreEvent>).detail;
      if (typeof detail?.score === "number" && Number.isFinite(detail.score)) {
        setCurrentScore(detail.score);
      }
    };

    const handleInfraction = (event: Event) => {
      const detail = (event as CustomEvent<PsychAssistInfractionEvent>).detail;
      const timestamp =
        typeof detail?.timestamp === "number" &&
        Number.isFinite(detail.timestamp)
          ? detail.timestamp
          : Date.now();

      setLastInfractionAt(timestamp);
      infractionTimestampsRef.current = [
        ...infractionTimestampsRef.current.filter(
          (ts) => timestamp - ts <= INFRACTION_WINDOW_MS,
        ),
        timestamp,
      ];
      evaluateIntervention(timestamp);
    };

    window.addEventListener("psychassist:score", handleScore as EventListener);
    window.addEventListener(
      "psychassist:infraction",
      handleInfraction as EventListener,
    );

    return () => {
      clearInterval(scoreInterval);
      window.removeEventListener(
        "psychassist:score",
        handleScore as EventListener,
      );
      window.removeEventListener(
        "psychassist:infraction",
        handleInfraction as EventListener,
      );
    };
  }, [evaluateIntervention]);

  useEffect(() => {
    const now = Date.now();
    evaluateIntervention(now);
  }, [currentScore, evaluateIntervention]);

  useEffect(() => {
    if (!lastInfractionAt) return;

    const tick = window.setInterval(() => {
      setClock(Date.now());
    }, 250);

    return () => clearInterval(tick);
  }, [lastInfractionAt]);

  useEffect(() => {
    if (!lastInfractionAt) return;
    if (clock - lastInfractionAt >= INFRACTION_HOLD_MS) {
      setLastInfractionAt(null);
    }
  }, [clock, lastInfractionAt]);

  const hasRecentInfraction = useMemo(() => {
    if (!lastInfractionAt) return false;
    return Date.now() - lastInfractionAt < INFRACTION_HOLD_MS;
  }, [lastInfractionAt, clock]);

  const orbState = resolveVoiceOrbState(runtimeState, hasRecentInfraction);

  const isBusy = runtimeState === "thinking" || runtimeState === "speaking";
  const isMicDenied = micPermission === "denied";
  const isDisabled = !isSupported || isMicDenied;

  // [S21] Parallel Harper Voice voice_assistant session — runs independent of VoiceContext's
  //   LiveKit/browser-speech path so the harper-voice backend can route questions to Oracle/Harper.
  const {
    session: voiceSession,
    start: startVoiceSession,
    stop: stopVoiceSession,
  } = useHarperVoiceSession();

  const handleClick = useCallback(() => {
    if (enabled) {
      // [claude-code 2026-04-24] Orb is the single voice master — toggling it
      // off must also drop ANY active Harper Voice session, regardless of which
      // trigger started it. Previous code only stopped sessions started under
      // `voice_assistant` and left psych_assist / performance_chat sessions
      // running silently. Since those buttons are removed, in practice only
      // voice_assistant should be active, but stopping any session here makes
      // the orb's deactivate semantics bulletproof.
      if (isBusy) cancel();
      toggleEnabled();
      if (voiceSession?.status === "active") void stopVoiceSession();
    } else {
      toggleEnabled();
      void startVoiceSession("voice_assistant");
    }
  }, [
    isBusy,
    enabled,
    cancel,
    toggleEnabled,
    voiceSession,
    startVoiceSession,
    stopVoiceSession,
  ]);

  const getTitle = () => {
    if (isMicDenied) return "Microphone blocked. Enable in browser settings.";
    if (!isSupported) return "Voice recognition unavailable in this browser";
    if (isBusy && enabled) return "Cancel current voice operation";
    if (runtimeState === "error") return "Voice error — recovering...";
    return enabled ? "Disable voice assistant" : "Enable voice assistant";
  };

  // Show the aurora orb only when actively listening/speaking/thinking/error/infraction
  const showOrb = enabled && orbState !== "idle";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`relative rounded-full transition-colors ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:opacity-90"}`}
      title={getTitle()}
    >
      {showOrb ? (
        <VoiceAuroraOrb state={orbState} compact={compact} />
      ) : (
        /* Dormant/idle state: bordered mic icon — Mic when enabled, MicOff when disabled */
        <div
          className="rounded-full bg-[#070704] flex items-center justify-center"
          style={{
            width: compact ? "24px" : "28px",
            height: compact ? "24px" : "28px",
            border: `1.5px solid var(--fintheon-accent)`,
          }}
        >
          {enabled ? (
            <Mic className="w-3 h-3 text-[var(--fintheon-accent)]/60" />
          ) : (
            <MicOff className="w-3 h-3 text-zinc-500" />
          )}
        </div>
      )}
    </button>
  );
}
