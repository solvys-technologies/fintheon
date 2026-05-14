// [claude-code 2026-05-13] T2: Chevron navigation for multi-window desk plan
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DayPlanChevronNavProps {
  currentIndex: number;
  totalWindows: number;
  onPrev: () => void;
  onNext: () => void;
}

export function DayPlanChevronNav({
  currentIndex,
  totalWindows,
  onPrev,
  onNext,
}: DayPlanChevronNavProps) {
  if (totalWindows <= 1) return null;

  return (
    <span className="inline-flex items-center gap-1 select-none">
      <button
        onClick={onPrev}
        disabled={currentIndex <= 0}
        className="p-0.5 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
        aria-label="Previous window"
      >
        <ChevronLeft className="w-3 h-3" />
      </button>
      <span
        className="text-[10px] tabular-nums"
        style={{
          color: "var(--fintheon-muted, #908774)",
          fontFamily: "var(--font-data, monospace)",
          letterSpacing: "0.04em",
          minWidth: 22,
          textAlign: "center",
        }}
      >
        {currentIndex + 1}/{totalWindows}
      </span>
      <button
        onClick={onNext}
        disabled={currentIndex >= totalWindows - 1}
        className="p-0.5 rounded text-[var(--fintheon-accent)]/60 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
        aria-label="Next window"
      >
        <ChevronRight className="w-3 h-3" />
      </button>
    </span>
  );
}
