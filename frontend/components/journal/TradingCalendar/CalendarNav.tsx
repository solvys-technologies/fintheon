import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface CalendarNavProps {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  monthTotal: number;
  variant: "projectx" | "solvys";
}

export function CalendarNav({
  year,
  month,
  onPrev,
  onNext,
  onToday,
  monthTotal,
  variant,
}: CalendarNavProps) {
  const isProjectX = variant === "projectx";
  const totalColor =
    monthTotal >= 0
      ? isProjectX
        ? "#22c55e"
        : "#c79f4a"
      : isProjectX
        ? "#ef4444"
        : "#b4443a";
  const totalStr = `${monthTotal >= 0 ? "+" : ""}$${Math.abs(monthTotal).toFixed(2)}`;

  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--fintheon-muted)]" />
        </button>
        <span className="text-sm font-semibold text-[var(--fintheon-text)] min-w-[90px] text-center">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={onNext}
          className="p-1 rounded hover:bg-white/5 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4 text-[var(--fintheon-muted)]" />
        </button>
      </div>

      <div className="text-center flex-1">
        <span className="text-xs font-bold" style={{ color: totalColor }}>
          Monthly P/L: {totalStr}
        </span>
      </div>

      <button
        onClick={onToday}
        className="px-2 py-0.5 text-[10px] border border-[var(--fintheon-accent)]/20 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] hover:border-[var(--fintheon-accent)]/40 transition-colors"
      >
        Today
      </button>
    </div>
  );
}
