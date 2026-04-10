// [claude-code 2026-03-27] Grid layout math for NarrativeFlow 2D canvas — time columns × risk rows

import type { ZoomLevel, NarrativeCategory } from "./narrative-types";
import {
  getMonday,
  getWeekDates,
  shiftWeek,
  getMonthWeeks,
  getQuarterMonths,
} from "./narrative-time";

// Risk category lane order (Y-axis, top to bottom)
export const RISK_LANES: NarrativeCategory[] = [
  "geopolitical",
  "monetary",
  "macroeconomic",
  "earnings",
  "market-structure",
  "supply-chain",
  "black-swan",
];

export const RISK_LANE_LABELS: Record<NarrativeCategory, string> = {
  geopolitical: "Geopolitical",
  monetary: "Monetary Policy",
  macroeconomic: "Macro / Econ",
  earnings: "Earnings",
  "market-structure": "Market Structure",
  "supply-chain": "Supply Chain",
  "black-swan": "Black Swan",
};

// Grid dimensions
export const LANE_HEADER_WIDTH = 160; // px, left sidebar
export const WEEK_COL_WIDTH = 140; // px per day column at week zoom
export const MONTH_COL_WIDTH = 200; // px per week column at month zoom
export const LANE_ROW_HEIGHT = 120; // px per risk category row
export const LANE_ROW_GAP = 4; // px between rows

export interface GridColumn {
  key: string; // unique key (ISO date or week label)
  label: string; // display label ("Mon 3/24" or "Week of Mar 24")
  startDate: Date;
  endDate: Date;
  width: number; // px
}

const MONTH_NAMES = [
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

function formatDayLabel(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

// Generate columns for the current zoom level
export function getGridColumns(
  zoomLevel: ZoomLevel,
  anchorDate: Date,
): GridColumn[] {
  switch (zoomLevel) {
    case "week": {
      // 5 day columns per week, current + 2 before + 2 after = 5 weeks × 5 days = 25 cols
      const columns: GridColumn[] = [];
      for (let weekOff = -2; weekOff <= 2; weekOff++) {
        const monday = shiftWeek(getMonday(anchorDate), weekOff);
        const days = getWeekDates(monday);
        for (const day of days) {
          const endOfDay = new Date(day);
          endOfDay.setHours(23, 59, 59, 999);
          columns.push({
            key: day.toISOString().slice(0, 10),
            label: formatDayLabel(day),
            startDate: day,
            endDate: endOfDay,
            width: WEEK_COL_WIDTH,
          });
        }
      }
      return columns;
    }
    case "month": {
      // Week columns for current month + 1 month before and after
      // Deduplicate: weeks spanning month boundaries appear in both months
      const columns: GridColumn[] = [];
      const seenKeys = new Set<string>();
      const year = anchorDate.getFullYear();
      const month = anchorDate.getMonth();
      for (let mOff = -1; mOff <= 1; mOff++) {
        const m = month + mOff;
        const adjYear = m < 0 ? year - 1 : m > 11 ? year + 1 : year;
        const adjMonth = ((m % 12) + 12) % 12;
        const weeks = getMonthWeeks(adjYear, adjMonth);
        for (const monday of weeks) {
          const key = `w-${monday.toISOString().slice(0, 10)}`;
          if (seenKeys.has(key)) continue; // skip duplicate week
          seenKeys.add(key);
          const friday = new Date(monday);
          friday.setDate(monday.getDate() + 4);
          friday.setHours(23, 59, 59, 999);
          columns.push({
            key,
            label: `Week of ${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`,
            startDate: monday,
            endDate: friday,
            width: MONTH_COL_WIDTH,
          });
        }
      }
      return columns;
    }
    case "quarter": {
      // 3 month columns for the current quarter
      const q = (Math.floor(anchorDate.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
      const months = getQuarterMonths(anchorDate.getFullYear(), q);
      return months.map(({ year, month }) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        end.setHours(23, 59, 59, 999);
        return {
          key: `m-${year}-${String(month).padStart(2, "0")}`,
          label: `${MONTH_NAMES[month]} ${year}`,
          startDate: start,
          endDate: end,
          width: MONTH_COL_WIDTH,
        };
      });
    }
    case "year": {
      // 4 quarter columns
      const year = anchorDate.getFullYear();
      return ([1, 2, 3, 4] as const).map((q) => {
        const startMonth = (q - 1) * 3;
        const start = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 3, 0);
        end.setHours(23, 59, 59, 999);
        return {
          key: `q-${year}-Q${q}`,
          label: `Q${q} ${year}`,
          startDate: start,
          endDate: end,
          width: MONTH_COL_WIDTH,
        };
      });
    }
  }
}

// Get the column key a card belongs to based on its date
export function getColumnKeyForDate(
  date: string,
  columns: GridColumn[],
): string | null {
  const d = new Date(date);
  for (const col of columns) {
    if (d >= col.startDate && d <= col.endDate) return col.key;
  }
  return null;
}

// Get the lane index for a risk category
export function getLaneIndex(category: NarrativeCategory): number {
  const idx = RISK_LANES.indexOf(category);
  return idx >= 0 ? idx : 0;
}
