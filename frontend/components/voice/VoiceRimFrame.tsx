// [claude-code 2026-04-19] S27-T5 W2c — accent-gold rim around the app window
// chrome when the voice assistant is active. Replaces the old VoiceBorderPulse
// in App.tsx. Rim must NEVER cover content: fixed inset, pointer-events: none
// everywhere except the dismiss button in the top-right.
//
// States:
//   listening  → solid 0.8 accent-gold
//   speaking   → pulse 2s opacity 0.6↔1.0
//   thinking   → pulse 1.2s faster
//   idle       → 0.4 faint
//   error      → solid red
//
// Transcript ticker + dismiss button are the only DOM that consumes pointer
// events, and the ticker is pointer-events-none.
import { useCallback } from "react";
import { X } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";
import { VoiceTranscriptTicker } from "./VoiceTranscriptTicker";

const ACCENT = "#c79f4a";
const ERROR = "#ef4444";
const RIM_THICKNESS = 3;

type RimAppearance = {
  color: string;
  opacity: number;
  animation?: string;
};

function resolveRimAppearance(
  runtimeState: string,
  enabled: boolean,
): RimAppearance | null {
  if (!enabled) return null;
  if (runtimeState === "error") {
    return { color: ERROR, opacity: 0.85 };
  }
  if (runtimeState === "speaking") {
    return {
      color: ACCENT,
      opacity: 1,
      animation: "voiceRimPulseSpeak 2s ease-in-out infinite",
    };
  }
  if (runtimeState === "thinking") {
    return {
      color: ACCENT,
      opacity: 0.9,
      animation: "voiceRimPulseThink 1.2s ease-in-out infinite",
    };
  }
  if (runtimeState === "listening") {
    return { color: ACCENT, opacity: 0.8 };
  }
  return { color: ACCENT, opacity: 0.4 };
}

export function VoiceRimFrame() {
  const { enabled, runtimeState, cancel, setEnabled } = useVoice();

  const appearance = resolveRimAppearance(runtimeState, enabled);

  const handleDismiss = useCallback(() => {
    cancel();
    setEnabled(false);
  }, [cancel, setEnabled]);

  if (!appearance) return null;

  return (
    <>
      <style>{`
        @keyframes voiceRimPulseSpeak {
          0%, 100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes voiceRimPulseThink {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.95; }
        }
      `}</style>

      <div
        data-testid="voice-rim-frame"
        aria-hidden="true"
        className="fixed inset-0 z-[90] pointer-events-none"
        style={{
          borderTop: `${RIM_THICKNESS}px solid ${appearance.color}`,
          borderBottom: `${RIM_THICKNESS}px solid ${appearance.color}`,
          borderLeft: `${RIM_THICKNESS}px solid ${appearance.color}`,
          borderRight: `${RIM_THICKNESS}px solid ${appearance.color}`,
          opacity: appearance.opacity,
          animation: appearance.animation,
        }}
      />

      <VoiceTranscriptTicker visible={enabled && runtimeState !== "idle"} />

      <button
        type="button"
        data-testid="voice-rim-dismiss"
        onClick={handleDismiss}
        title="Dismiss voice assistant"
        className="fixed top-[10px] right-[10px] z-[92] rounded-full cursor-pointer transition-colors"
        style={{
          width: "20px",
          height: "20px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(5, 4, 2, 0.85)",
          border: `1px solid ${appearance.color}`,
          color: appearance.color,
        }}
      >
        <X className="w-[12px] h-[12px]" />
      </button>
    </>
  );
}
