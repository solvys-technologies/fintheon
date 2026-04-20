// [claude-code 2026-03-16] Stone theme + narrative theme integration
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Play, Pause, Square } from "@/components/shared/iso-icons";
import type {
  NarrativeFlowState,
  CatalystCard,
} from "../../lib/narrative-types";

interface TimelineScrubberProps {
  state: NarrativeFlowState;
  catalysts: CatalystCard[];
  dispatch: (action: any) => void;
}

export function TimelineScrubber({
  state,
  catalysts,
  dispatch,
}: TimelineScrubberProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Compute date range from catalysts
  const { weeks, minDate, maxDate } = useMemo(() => {
    if (catalysts.length === 0) {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() + 1); // Monday
      const weeks: WeekBucket[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * 7);
        weeks.push({
          start: d.toISOString().slice(0, 10),
          bullish: 0,
          bearish: 0,
        });
      }
      return {
        weeks,
        minDate: weeks[0].start,
        maxDate: weeks[weeks.length - 1].start,
      };
    }

    const dates = catalysts
      .map((c) => new Date(c.date).getTime())
      .sort((a, b) => a - b);
    const min = new Date(dates[0]);
    const max = new Date(dates[dates.length - 1]);

    // Extend range by 2 weeks on each side
    min.setDate(min.getDate() - 14);
    max.setDate(max.getDate() + 14);

    // Snap to Monday
    min.setDate(min.getDate() - ((min.getDay() + 6) % 7));

    const buckets: WeekBucket[] = [];
    const cursor = new Date(min);
    while (cursor <= max) {
      const weekStart = cursor.toISOString().slice(0, 10);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 7);

      let bullish = 0;
      let bearish = 0;
      for (const c of catalysts) {
        const cd = new Date(c.date).getTime();
        if (cd >= cursor.getTime() && cd < weekEnd.getTime()) {
          if (c.sentiment === "bullish") bullish++;
          else if (c.sentiment === "bearish") bearish++;
        }
      }
      buckets.push({ start: weekStart, bullish, bearish });
      cursor.setDate(cursor.getDate() + 7);
    }

    return {
      weeks: buckets,
      minDate: buckets[0]?.start ?? "",
      maxDate: buckets[buckets.length - 1]?.start ?? "",
    };
  }, [catalysts]);

  const totalWeeks = weeks.length;
  const step = totalWeeks > 0 ? 1 / totalWeeks : 0;

  // Replay mode auto-advance
  useEffect(() => {
    if (!state.replayMode) return;
    const interval = setInterval(() => {
      dispatch({
        type: "SET_REPLAY_POSITION",
        position: Math.min(1, state.replayPosition + step),
      });
      if (state.replayPosition >= 1) {
        dispatch({ type: "SET_REPLAY_MODE", enabled: false });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.replayMode, state.replayPosition, step, dispatch]);

  // Click / drag to scrub
  const positionFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const jumpToPosition = useCallback(
    (pos: number) => {
      const weekIndex = Math.round(pos * (totalWeeks - 1));
      if (weeks[weekIndex]) {
        dispatch({ type: "SET_WEEK", weekStart: weeks[weekIndex].start });
      }
    },
    [totalWeeks, weeks, dispatch],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      const pos = positionFromEvent(e);
      jumpToPosition(pos);
    },
    [positionFromEvent, jumpToPosition],
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const pos = positionFromEvent(e);
      jumpToPosition(pos);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, positionFromEvent, jumpToPosition]);

  // Hover tooltip
  const handleHover = useCallback(
    (e: React.MouseEvent) => {
      if (!barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const weekIndex = Math.round(pos * (totalWeeks - 1));
      if (weeks[weekIndex]) {
        setHoveredWeek(weeks[weekIndex].start);
        setHoverX(e.clientX - rect.left);
      }
    },
    [totalWeeks, weeks],
  );

  // Playhead position
  const playheadPct = state.replayMode
    ? state.replayPosition * 100
    : getCurrentWeekPct(state.currentWeekStart, weeks);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((w, i) => {
      const d = new Date(w.start);
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        labels.push({
          label: d.toLocaleDateString("en-US", { month: "short" }),
          pct: (i / totalWeeks) * 100,
        });
      }
    });
    return labels;
  }, [weeks, totalWeeks]);

  return (
    <div className="h-10 flex items-center gap-2 px-2 bg-[var(--fintheon-surface)] border-t border-[var(--fintheon-border)]/20">
      {/* Play/Pause/Stop */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() =>
            dispatch({ type: "SET_REPLAY_MODE", enabled: !state.replayMode })
          }
          className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
          title={state.replayMode ? "Pause" : "Play"}
        >
          {state.replayMode ? (
            <Pause className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          ) : (
            <Play className="w-3.5 h-3.5 text-[var(--fintheon-muted)]" />
          )}
        </button>
        {state.replayMode && (
          <button
            onClick={() => {
              dispatch({ type: "SET_REPLAY_MODE", enabled: false });
              dispatch({ type: "SET_REPLAY_POSITION", position: 0 });
            }}
            className="p-1 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
            title="Stop"
          >
            <Square className="w-3 h-3 text-[var(--fintheon-muted)]" />
          </button>
        )}
      </div>

      {/* Timeline bar */}
      <div
        ref={barRef}
        className="flex-1 h-5 relative cursor-pointer rounded-sm overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleHover}
        onMouseLeave={() => setHoveredWeek(null)}
      >
        {/* Week segments */}
        <div className="absolute inset-0 flex">
          {weeks.map((w, i) => {
            let bg: string;
            if (w.bullish > w.bearish) bg = "var(--fintheon-bullish)";
            else if (w.bearish > w.bullish) bg = "var(--fintheon-bearish)";
            else bg = "var(--fintheon-muted)";
            const opacity =
              w.bullish > w.bearish || w.bearish > w.bullish ? 0.3 : 0.15;
            return (
              <div
                key={i}
                className="h-full"
                style={{
                  flex: 1,
                  backgroundColor: bg,
                  opacity,
                }}
              />
            );
          })}
        </div>

        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <span
            key={i}
            className="absolute bottom-0 text-[8px] text-[var(--fintheon-muted)] pointer-events-none"
            style={{ left: `${m.pct}%` }}
          >
            {m.label}
          </span>
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[var(--fintheon-accent)] pointer-events-none"
          style={{
            left: `${playheadPct}%`,
            transition: dragging ? "none" : "left 300ms ease",
          }}
        />

        {/* Hover tooltip */}
        {hoveredWeek && (
          <div
            className="absolute -top-7 px-1.5 py-0.5 rounded text-[9px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-border)]/30 text-[var(--fintheon-text)] whitespace-nowrap pointer-events-none z-10"
            style={{ left: hoverX, transform: "translateX(-50%)" }}
          >
            Week of {hoveredWeek}
          </div>
        )}
      </div>

      {/* Date range label */}
      <span className="text-[9px] text-[var(--fintheon-muted)] shrink-0 font-mono">
        {minDate} — {maxDate}
      </span>
    </div>
  );
}

// Helpers

interface WeekBucket {
  start: string;
  bullish: number;
  bearish: number;
}

function getCurrentWeekPct(
  currentWeek: string | undefined,
  weeks: WeekBucket[],
): number {
  if (!currentWeek || weeks.length === 0) return 0;
  const idx = weeks.findIndex((w) => w.start === currentWeek);
  if (idx === -1) return 0;
  return (idx / (weeks.length - 1)) * 100;
}
