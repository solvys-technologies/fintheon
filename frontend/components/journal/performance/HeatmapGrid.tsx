// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — shared GitHub-style grid primitive.

import type { ReactNode } from "react";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface HeatmapCell {
  key: string;
  dateKey: string | null;
  bg: string;
  borderColor: string;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
}

export interface HeatmapColumn {
  weekStart: string;
  cells: HeatmapCell[];
}

interface HeatmapGridProps {
  columns: HeatmapColumn[];
  weekdayRows: number;
  cellSize: number;
  gap?: number;
  footer?: ReactNode;
}

function mondayIndex(date: Date): number {
  const d = date.getUTCDay();
  return d === 0 ? 6 : d - 1;
}

export function buildYearColumns(year: number): {
  weekStart: string;
  days: (string | null)[];
}[] {
  const firstOfYear = new Date(Date.UTC(year, 0, 1));
  const lastOfYear = new Date(Date.UTC(year, 11, 31));
  const startMonday = new Date(firstOfYear);
  startMonday.setUTCDate(startMonday.getUTCDate() - mondayIndex(firstOfYear));

  const cols: { weekStart: string; days: (string | null)[] }[] = [];
  const cursor = new Date(startMonday);
  while (cursor <= lastOfYear) {
    const days: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setUTCDate(d.getUTCDate() + i);
      days.push(
        d.getUTCFullYear() === year ? d.toISOString().slice(0, 10) : null,
      );
    }
    cols.push({ weekStart: cursor.toISOString().slice(0, 10), days });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return cols;
}

export function HeatmapGrid({
  columns,
  weekdayRows,
  cellSize,
  gap = 2,
  footer,
}: HeatmapGridProps) {
  const rows = WEEKDAY_LABELS.slice(0, weekdayRows);
  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-1">
        <div
          className="flex flex-col text-[8px] text-[var(--fintheon-muted)] pr-1"
          style={{ gap: `${gap}px`, paddingTop: "2px" }}
        >
          {rows.map((r, i) => (
            <div
              key={r}
              style={{
                height: `${cellSize}px`,
                lineHeight: `${cellSize}px`,
                visibility: i % 2 === 0 ? "visible" : "hidden",
              }}
            >
              {r}
            </div>
          ))}
        </div>
        <div className="flex" style={{ gap: `${gap}px` }}>
          {columns.map((col) => (
            <div
              key={col.weekStart}
              className="flex flex-col"
              style={{ gap: `${gap}px` }}
            >
              {col.cells.slice(0, weekdayRows).map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  onClick={cell.onClick}
                  disabled={cell.disabled ?? !cell.onClick}
                  title={cell.title}
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    background: cell.bg,
                    border: cell.dateKey
                      ? `1px solid ${cell.borderColor}`
                      : "none",
                    borderRadius: "1px",
                    cursor: cell.onClick ? "pointer" : "default",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {footer}
    </div>
  );
}
