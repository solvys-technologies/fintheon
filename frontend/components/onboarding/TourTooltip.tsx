// [claude-code 2026-03-16] Positioned tooltip for spotlight tour — auto-positions around target
import { useState, useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface TourStep {
  title: string;
  description: string;
  target: string;
  targetSelector: string;
}

type TooltipPosition = "auto" | "top" | "bottom" | "left" | "right";

interface TourTooltipProps {
  targetRect: { x: number; y: number; width: number; height: number } | null;
  position?: TooltipPosition;
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const TOOLTIP_GAP = 12;
const TOOLTIP_WIDTH = 340;

function pickPosition(
  rect: { x: number; y: number; width: number; height: number },
  preferred: TooltipPosition,
): "top" | "bottom" | "left" | "right" {
  if (preferred !== "auto") return preferred;

  const spaceTop = rect.y;
  const spaceBottom = window.innerHeight - (rect.y + rect.height);
  const spaceLeft = rect.x;
  const spaceRight = window.innerWidth - (rect.x + rect.width);

  const spaces = {
    bottom: spaceBottom,
    top: spaceTop,
    right: spaceRight,
    left: spaceLeft,
  };
  return Object.entries(spaces).sort((a, b) => b[1] - a[1])[0][0] as
    | "top"
    | "bottom"
    | "left"
    | "right";
}

export function TourTooltip({
  targetRect,
  position = "auto",
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipHeight, setTooltipHeight] = useState(180);

  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  }, [step, targetRect]);

  if (!targetRect) return null;

  const side = pickPosition(targetRect, position);
  const isLast = stepIndex === totalSteps - 1;

  let top = 0;
  let left = 0;

  switch (side) {
    case "bottom":
      top = targetRect.y + targetRect.height + TOOLTIP_GAP;
      left = targetRect.x + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "top":
      top = targetRect.y - tooltipHeight - TOOLTIP_GAP;
      left = targetRect.x + targetRect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case "right":
      top = targetRect.y + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.x + targetRect.width + TOOLTIP_GAP;
      break;
    case "left":
      top = targetRect.y + targetRect.height / 2 - tooltipHeight / 2;
      left = targetRect.x - TOOLTIP_WIDTH - TOOLTIP_GAP;
      break;
  }

  // Clamp to viewport
  left = Math.max(12, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] shadow-2xl"
      style={{
        top,
        left,
        width: TOOLTIP_WIDTH,
        transition: "all 300ms ease",
      }}
    >
      <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-xl overflow-hidden">
        {/* Content */}
        <div className="px-5 py-4">
          <div className="text-lg font-semibold text-white mb-1.5">
            {step.title}
          </div>
          <p className="text-sm text-[var(--fintheon-muted,#9ca3af)] leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--fintheon-accent)]/10">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === stepIndex
                    ? "bg-[var(--fintheon-accent)]"
                    : i < stepIndex
                      ? "bg-[var(--fintheon-accent)]/40"
                      : "bg-white/10"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="px-2 py-1 text-[11px] text-gray-500 hover:text-white transition-colors"
            >
              Skip
            </button>
            {stepIndex > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-0.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-0.5 px-4 py-1.5 text-xs font-medium bg-[var(--fintheon-accent)] text-black rounded hover:brightness-110 transition-all"
            >
              {isLast ? "Get Started" : "Next"}
              {!isLast && <ChevronRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
