import { useMemo, useEffect } from "react";
import { X } from "lucide-react";
import type { CalendarSelection, DayAggregate } from "./types";

interface EquityCurveDrawerProps {
  selection: CalendarSelection | null;
  byDay: Record<string, DayAggregate>;
  onClose: () => void;
}

const PAD = { top: 16, right: 16, bottom: 28, left: 52 };
const W = 480;
const H = 160;

export function EquityCurveDrawer({
  selection,
  byDay,
  onClose,
}: EquityCurveDrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const { points, minY, maxY, totalPnl } = useMemo(() => {
    if (!selection) return { points: [], minY: 0, maxY: 0, totalPnl: 0 };

    const days: DayAggregate[] = [];
    const cur = new Date(selection.from);
    while (cur <= selection.to) {
      const key = cur.toISOString().slice(0, 10);
      if (byDay[key]) days.push(byDay[key]);
      cur.setDate(cur.getDate() + 1);
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    const pts: number[] = [];
    for (const day of days) {
      running += day.pnl;
      pts.push(running);
    }

    const allVals = [0, ...pts];
    return {
      points: pts,
      minY: Math.min(...allVals),
      maxY: Math.max(...allVals),
      totalPnl: running,
    };
  }, [selection, byDay]);

  if (!selection) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const range = maxY - minY || 1;

  const toX = (i: number, total: number) =>
    PAD.left + (i / Math.max(total - 1, 1)) * innerW;
  const toY = (v: number) => PAD.top + innerH - ((v - minY) / range) * innerH;

  const pathD =
    points.length < 2
      ? ""
      : points
          .map(
            (v, i) =>
              `${i === 0 ? "M" : "L"}${toX(i, points.length).toFixed(1)},${toY(v).toFixed(1)}`,
          )
          .join(" ");

  const lineColor = totalPnl >= 0 ? "#22c55e" : "#ef4444";
  const labelFmt = (v: number) =>
    `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(0)}`;

  const selLabel =
    selection.kind === "day"
      ? selection.from.toLocaleDateString()
      : `${selection.from.toLocaleDateString()} – ${selection.to.toLocaleDateString()}`;

  return (
    <div
      className="fintheon-modal-backdrop fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="fintheon-sheet-surface w-full max-w-2xl rounded-t-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-semibold text-[var(--fintheon-text)]">
              Equity Curve
            </div>
            <div className="text-[10px] text-[var(--fintheon-muted)]">
              {selLabel}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-mono font-bold"
              style={{ color: lineColor }}
            >
              {labelFmt(totalPnl)}
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-[var(--fintheon-muted)]" />
            </button>
          </div>
        </div>

        {points.length < 2 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-[var(--fintheon-muted)]">
            Not enough data for this selection
          </div>
        ) : (
          <svg
            width="100%"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            {minY < 0 && maxY > 0 && (
              <line
                x1={PAD.left}
                y1={toY(0)}
                x2={W - PAD.right}
                y2={toY(0)}
                stroke="rgba(255,255,255,0.15)"
                strokeDasharray="3,3"
              />
            )}
            <path
              d={pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <text
              x={PAD.left - 4}
              y={PAD.top + 4}
              textAnchor="end"
              fontSize="8"
              fill="rgba(240,234,214,0.4)"
            >
              {labelFmt(maxY)}
            </text>
            <text
              x={PAD.left - 4}
              y={H - PAD.bottom}
              textAnchor="end"
              fontSize="8"
              fill="rgba(240,234,214,0.4)"
            >
              {labelFmt(minY)}
            </text>
          </svg>
        )}
      </div>
    </div>
  );
}
