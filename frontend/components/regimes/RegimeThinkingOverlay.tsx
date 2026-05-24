// [claude-code 2026-04-15] T3: Glassmorphic thinking overlay for AI regime generation
// [claude-code 2026-05-16] DEPRECATED — regime tracker replaced by theme-tracker (S68-T1). Kept for backward compat.
import { useEffect, useRef, useState } from "react";
import { GlassEffect } from "../ui/liquid-glass";

const THINKING_PHRASES = [
  "Analyzing institutional flow...",
  "Scanning COT positioning...",
  "Calibrating antilag confidence...",
  "Mapping regime time windows...",
  "Cross-referencing ORB history...",
];

interface RegimeThinkingOverlayProps {
  isVisible: boolean;
  isGenerating: boolean;
  onComplete?: () => void;
}

export function RegimeThinkingOverlay({
  isVisible,
  isGenerating,
  onComplete,
}: RegimeThinkingOverlayProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const prevGenerating = useRef(isGenerating);

  useEffect(() => {
    if (prevGenerating.current && !isGenerating) {
      // Generation completed — start exit sequence
      setFadingOut(true);

      const dissolveTimer = setTimeout(() => {
        setDissolving(true);
      }, 200);

      const completeTimer = setTimeout(() => {
        setFadingOut(false);
        setDissolving(false);
        onComplete?.();
      }, 700);

      return () => {
        clearTimeout(dissolveTimer);
        clearTimeout(completeTimer);
      };
    }
    prevGenerating.current = isGenerating;
  }, [isGenerating, onComplete]);

  if (!isVisible) return null;

  return (
    <GlassEffect
      blur={24}
      tint="var(--fintheon-glass-surface)"
      className={`absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center ${
        dissolving
          ? "animate-[glass-dissolve_500ms_ease-out_forwards]"
          : "animate-[glass-slide-up_400ms_ease-out_forwards]"
      }`}
    >
      {/* Gold pulsing dot */}
      <span className="w-2 h-2 rounded-full bg-[var(--fintheon-accent)] animate-pulse mb-4" />

      {/* Thinking phrases */}
      <div className="space-y-2">
        {THINKING_PHRASES.map((phrase, idx) => (
          <div
            key={phrase}
            style={{
              animation: "fadeSlideIn 0.3s ease-out forwards",
              animationDelay: `${idx * 800}ms`,
              opacity: 0,
            }}
            className={`text-xs text-[var(--fintheon-text)]/70 tracking-wide text-center ${
              fadingOut ? "transition-opacity duration-200 opacity-0" : ""
            }`}
          >
            {phrase}
          </div>
        ))}
      </div>
    </GlassEffect>
  );
}
