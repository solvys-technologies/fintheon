import { useMemo } from "react";
import { CalendarCell } from "./CalendarCell";
import { WeekTotalCell } from "./WeekTotalCell";
import type { ByDay, WeekTotal, CalendarSelection } from "./types";

const DOW_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Week"];

interface SolvysCalendarProps {
  year: number;
  month: number;
  byDay: ByDay;
  weekTotals: WeekTotal[];
  selection: CalendarSelection | null;
  onSelect: (sel: CalendarSelection) => void;
}

function buildCalendarRows(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const rows: Date[][] = [];
  const current = new Date(year, month, 1 - startOffset);

  while (rows.length < 6) {
    const row: Date[] = [];
    for (let d = 0; d < 6; d++) {
      row.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    rows.push(row);
    if (
      row.every(
        (d) =>
          d.getFullYear() > year ||
          (d.getFullYear() === year && d.getMonth() > month),
      )
    )
      break;
  }
  return rows;
}

export function SolvysCalendar({
  year,
  month,
  byDay,
  weekTotals,
  selection,
  onSelect,
}: SolvysCalendarProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const rows = useMemo(() => buildCalendarRows(year, month), [year, month]);

  const isSelected = (date: Date) => {
    if (!selection) return false;
    const t = date.getTime();
    return t >= selection.from.getTime() && t <= selection.to.getTime();
  };

  return (
    <div
      style={{
        background: "#050402",
        border: "1px solid #1a1a1a",
        borderRadius: "4px",
        padding: "8px",
      }}
    >
      <div
        className="grid mb-1"
        style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
      >
        {DOW_HEADERS.map((h) => (
          <div
            key={h}
            className="text-center py-1"
            style={{
              fontSize: "8px",
              color: "rgba(240,234,214,0.4)",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {h}
          </div>
        ))}
      </div>

      <div>
        {rows.map((row, rowIdx) => {
          const weekStart = row[0];
          const weekNum = weekTotals[rowIdx] ?? null;

          return (
            <div
              key={rowIdx}
              className="grid"
              style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
            >
              {row.map((date) => {
                const dateStr = date.toISOString().slice(0, 10);
                return (
                  <CalendarCell
                    key={dateStr}
                    date={date}
                    currentMonth={month}
                    data={byDay[dateStr] ?? null}
                    isToday={dateStr === todayStr}
                    isSelected={isSelected(date)}
                    variant="solvys"
                    onClick={onSelect}
                  />
                );
              })}
              <WeekTotalCell
                weekData={weekNum}
                rowIndex={rowIdx}
                variant="solvys"
                onClick={onSelect}
                weekStart={weekStart}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
