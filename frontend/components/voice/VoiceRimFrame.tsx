// [claude-code 2026-04-19] S27-T5 W2c — accent-gold rim around the app window
// chrome when the voice assistant is active. Replaces the old VoiceBorderPulse
// in App.tsx. Rim must NEVER cover content: fixed inset, pointer-events: none
// everywhere except the dismiss button in the top-right.
//
// [claude-code 2026-04-24 /solvys-feels] Dithered border — replaces the flat
// 3px gold line with a translucent 6px frame whose alpha varies around the
// rectangle (8-stop conic gradient masked to a thin edge). Mount micro-
// interaction: starts at a tighter inset with a small extra blur, then snaps
// to the chrome over 320ms with the blur fading to 0 — reads as if the pixels
// are reassembling at the radius before settling at the final edge.
//
// VoiceTranscriptTicker (the "Give a brief casual greeting…" floating banner)
// is removed — agent transcripts surface elsewhere; the rim stays
// distraction-free.
//
// States:
//   listening  → solid 0.8 accent-gold (dithered)
//   speaking   → pulse 2s opacity 0.6↔1.0 (dithered)
//   thinking   → pulse 1.2s faster (dithered)
//   idle       → 0.4 faint (dithered)
//   error      → solid red (NOT dithered — alarm reads cleaner with a flat edge)
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";

const ACCENT = "#c79f4a";
const ERROR = "#ef4444";
const RIM_THICKNESS = 6;
// 8-stop conic — alternating bright + trough alpha around the rect gives the
// rim a "dithered" feel at the corners instead of a flat line.
const RIM_DITHER_STOPS = [
  "rgba(199,159,74,0.08) 0deg",
  "rgba(199,159,74,0.55) 22deg",
  "rgba(199,159,74,0.18) 45deg",
  "rgba(199,159,74,0.62) 90deg",
  "rgba(199,159,74,0.10) 135deg",
  "rgba(199,159,74,0.55) 180deg",
  "rgba(199,159,74,0.18) 225deg",
  "rgba(199,159,74,0.62) 270deg",
  "rgba(199,159,74,0.10) 315deg",
  "rgba(199,159,74,0.08) 360deg",
].join(", ");

type RimAppearance = {
  color: string;
  opacity: number;
  animation?: string;
  dithered: boolean;
};

function resolveRimAppearance(
  runtimeState: string,
  enabled: boolean,
): RimAppearance | null {
  if (!enabled) return null;
  if (runtimeState === "error") {
    return { color: ERROR, opacity: 0.85, dithered: false };
  }
  if (runtimeState === "speaking") {
    return {
      color: ACCENT,
      opacity: 1,
      animation: "voiceRimPulseSpeak 2s ease-in-out infinite",
      dithered: true,
    };
  }
  if (runtimeState === "thinking") {
    return {
      color: ACCENT,
      opacity: 0.9,
      animation: "voiceRimPulseThink 1.2s ease-in-out infinite",
      dithered: true,
    };
  }
  if (runtimeState === "listening") {
    return { color: ACCENT, opacity: 0.8, dithered: true };
  }
  return { color: ACCENT, opacity: 0.4, dithered: true };
}

export function VoiceRimFrame() {
  const { enabled, runtimeState, cancel, setEnabled } = useVoice();
  const appearance = resolveRimAppearance(runtimeState, enabled);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!appearance) {
      setMounted(false);
      return;
    }
    // double-rAF so the browser commits the inset/opacity/blur start state
    // before transitioning — without this, the transition plays as a snap.
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setMounted(true)),
    );
    return () => cancelAnimationFrame(raf);
  }, [appearance]);

  const handleDismiss = useCallback(() => {
    cancel();
    setEnabled(false);
  }, [cancel, setEnabled]);

  if (!appearance) return null;

  const flatBorder = !appearance.dithered
    ? `${RIM_THICKNESS}px solid ${appearance.color}`
    : undefined;

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
        className="fixed z-[90] pointer-events-none"
        style={{
          // Inset 12 → 0 + blur 2.5px → 0 = "pixels reassemble at the radius".
          top: mounted ? 0 : 12,
          left: mounted ? 0 : 12,
          right: mounted ? 0 : 12,
          bottom: mounted ? 0 : 12,
          opacity: mounted ? appearance.opacity : 0,
          filter: mounted ? "blur(0px)" : "blur(2.5px)",
          transition:
            "top 320ms cubic-bezier(0.22, 1, 0.36, 1), left 320ms cubic-bezier(0.22, 1, 0.36, 1), right 320ms cubic-bezier(0.22, 1, 0.36, 1), bottom 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease-out, filter 360ms ease-out",
          ...(flatBorder
            ? {
                borderTop: flatBorder,
                borderBottom: flatBorder,
                borderLeft: flatBorder,
                borderRight: flatBorder,
              }
            : {
                padding: `${RIM_THICKNESS}px`,
                background: `conic-gradient(from 45deg at 50% 50%, ${RIM_DITHER_STOPS})`,
                // Mask trick: outer rect minus inner content = a "ring".
                WebkitMask:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }),
          animation: appearance.animation,
        }}
      />

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
