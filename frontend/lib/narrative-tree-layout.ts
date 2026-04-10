// [claude-code 2026-03-28] S5-T1: Tree layout engine for structured mind-map canvas
// Replaces grid-layout for the new NarrativeMapView (grid-layout stays for backward compat)

import type { ZoomLevel, NarrativeCategory } from "./narrative-types";
import {
  getMonday,
  shiftWeek,
  getMonthWeeks,
  getQuarterMonths,
} from "./narrative-time";

export const CATEGORY_HEADER_W = 200,
  CATEGORY_HEADER_H = 60;
export const TIME_COL_W = 180,
  CARD_SLOT_W = 160,
  CARD_SLOT_H = 80;
export const H_GAP = 20,
  V_GAP = 80,
  CAT_INTERNAL_GAP = 40;

export const CATEGORIES: NarrativeCategory[] = [
  "geopolitical",
  "monetary",
  "macroeconomic",
  "earnings",
  "market-structure",
  "supply-chain",
  "black-swan",
];

export const CATEGORY_LABELS: Record<NarrativeCategory, string> = {
  geopolitical: "Geopolitical",
  monetary: "Monetary Policy",
  macroeconomic: "Macro / Econ",
  earnings: "Earnings",
  "market-structure": "Market Structure",
  "supply-chain": "Supply Chain",
  "black-swan": "Black Swan",
};

export interface TreeLayoutNode {
  id: string;
  x: number; // pixel position
  y: number;
  width: number;
  height: number;
  type: "category-header" | "time-column" | "card-slot";
  category?: NarrativeCategory;
  timeBucket?: string;
  label: string;
}

interface TimeBucket {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
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

function generateTimeBuckets(
  zoomLevel: ZoomLevel,
  anchorDate: Date,
  dateFilter?: { start: string; end: string },
): TimeBucket[] {
  const buckets: TimeBucket[] = [];

  switch (zoomLevel) {
    case "week": {
      // 5 weeks centered on anchor (current + 2 before + 2 after), each week is one bucket
      for (let off = -2; off <= 2; off++) {
        const monday = shiftWeek(getMonday(anchorDate), off);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        friday.setHours(23, 59, 59, 999);
        buckets.push({
          key: `w-${monday.toISOString().slice(0, 10)}`,
          label: `${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`,
          startDate: monday,
          endDate: friday,
        });
      }
      break;
    }
    case "month": {
      // Week buckets for current month +/- 1
      const year = anchorDate.getFullYear();
      const month = anchorDate.getMonth();
      for (let mOff = -1; mOff <= 1; mOff++) {
        const m = month + mOff;
        const adjYear = m < 0 ? year - 1 : m > 11 ? year + 1 : year;
        const adjMonth = ((m % 12) + 12) % 12;
        const weeks = getMonthWeeks(adjYear, adjMonth);
        for (const monday of weeks) {
          const friday = new Date(monday);
          friday.setDate(monday.getDate() + 4);
          friday.setHours(23, 59, 59, 999);
          buckets.push({
            key: `w-${monday.toISOString().slice(0, 10)}`,
            label: `Wk ${MONTH_NAMES[monday.getMonth()]} ${monday.getDate()}`,
            startDate: monday,
            endDate: friday,
          });
        }
      }
      break;
    }
    case "quarter": {
      // 3 month buckets for the current quarter
      const q = (Math.floor(anchorDate.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
      const months = getQuarterMonths(anchorDate.getFullYear(), q);
      for (const { year, month } of months) {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);
        end.setHours(23, 59, 59, 999);
        buckets.push({
          key: `m-${year}-${String(month).padStart(2, "0")}`,
          label: `${MONTH_NAMES[month]} ${year}`,
          startDate: start,
          endDate: end,
        });
      }
      break;
    }
    case "year": {
      // 4 quarter buckets
      const year = anchorDate.getFullYear();
      for (const q of [1, 2, 3, 4] as const) {
        const startMonth = (q - 1) * 3;
        const start = new Date(year, startMonth, 1);
        const end = new Date(year, startMonth + 3, 0);
        end.setHours(23, 59, 59, 999);
        buckets.push({
          key: `q-${year}-Q${q}`,
          label: `Q${q} ${year}`,
          startDate: start,
          endDate: end,
        });
      }
      break;
    }
  }

  // Apply optional date filter
  if (dateFilter) {
    const filterStart = new Date(dateFilter.start);
    const filterEnd = new Date(dateFilter.end);
    filterEnd.setHours(23, 59, 59, 999);
    return buckets.filter(
      (b) => b.endDate >= filterStart && b.startDate <= filterEnd,
    );
  }

  return buckets;
}

/** Generate tree layout positions for the structured mind-map. */
export function generateTreeLayout(
  categories: NarrativeCategory[],
  zoomLevel: ZoomLevel,
  anchorDate: Date,
  dateFilter?: { start: string; end: string },
): TreeLayoutNode[] {
  const nodes: TreeLayoutNode[] = [];
  const buckets = generateTimeBuckets(zoomLevel, anchorDate, dateFilter);
  const cats = categories.length > 0 ? categories : CATEGORIES;

  let yOffset = 0;

  for (const cat of cats) {
    // Category header node
    nodes.push({
      id: `cat-${cat}`,
      x: 0,
      y: yOffset,
      width: CATEGORY_HEADER_W,
      height: CATEGORY_HEADER_H,
      type: "category-header",
      category: cat,
      label: CATEGORY_LABELS[cat] ?? cat,
    });

    // Time column nodes branch right from category header
    const timeRowY = yOffset + (CATEGORY_HEADER_H - CARD_SLOT_H) / 2;
    let xOffset = CATEGORY_HEADER_W + H_GAP;

    for (const bucket of buckets) {
      // Time column header
      nodes.push({
        id: `time-${cat}-${bucket.key}`,
        x: xOffset,
        y: yOffset,
        width: TIME_COL_W,
        height: CATEGORY_HEADER_H,
        type: "time-column",
        category: cat,
        timeBucket: bucket.key,
        label: bucket.label,
      });

      // Card slot within the time bucket
      nodes.push({
        id: `slot-${cat}-${bucket.key}`,
        x: xOffset + (TIME_COL_W - CARD_SLOT_W) / 2,
        y: timeRowY + CATEGORY_HEADER_H + CAT_INTERNAL_GAP,
        width: CARD_SLOT_W,
        height: CARD_SLOT_H,
        type: "card-slot",
        category: cat,
        timeBucket: bucket.key,
        label: "",
      });

      xOffset += TIME_COL_W + H_GAP;
    }

    // Advance Y for next category: header + internal gap + card row + breathing room
    yOffset += CATEGORY_HEADER_H + CAT_INTERNAL_GAP + CARD_SLOT_H + V_GAP;
  }

  return nodes;
}

/** Get the time bucket key a date falls into */
export function getBucketKeyForDate(
  date: string,
  zoomLevel: ZoomLevel,
  anchorDate: Date,
  dateFilter?: { start: string; end: string },
): string | null {
  const d = new Date(date);
  const buckets = generateTimeBuckets(zoomLevel, anchorDate, dateFilter);
  for (const b of buckets) {
    if (d >= b.startDate && d <= b.endDate) return b.key;
  }
  return null;
}

/** Compute the bounding box of all layout nodes */
export function getLayoutBounds(nodes: TreeLayoutNode[]) {
  if (nodes.length === 0)
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
