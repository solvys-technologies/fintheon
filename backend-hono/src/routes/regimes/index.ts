// [claude-code 2026-03-06] Regime Tracker API — returns active trading regimes for agent context
import { Hono } from "hono";

interface RegimeTimeRange {
  start: string;
  end: string;
}

interface TradingRegime {
  id: string;
  name: string;
  description: string;
  category: string;
  timeRange: RegimeTimeRange;
  timezone: string;
  daysActive: string[];
  confidence: number;
  record: { bullishDays: number; bearishDays: number };
  daysObserved: number;
  /** Valid values: continuation, reversal, convergence, consolidation, rotation */
  bias: string;
  source?: string;
  instruments: string[];
  notes?: string;
}

const SEED_REGIMES: TradingRegime[] = [
  {
    id: "cash-open-manipulation",
    name: "Cash Open Manipulation",
    description:
      "Institutions manipulate price at cash open. Wait for the fake move, fade it.",
    category: "institutional",
    timeRange: { start: "09:30", end: "09:45" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 72,
    record: { bullishDays: 36, bearishDays: 14 },
    daysObserved: 50,
    bias: "reversal",
    source: "Jane Street",
    instruments: ["/NQ", "/ES", "/MNQ"],
  },
  {
    id: "gs-morning-note",
    name: "Goldman Sachs Morning Note",
    description:
      "GS publishes morning research. Lean OPPOSITE to their stated bias.",
    category: "institutional",
    timeRange: { start: "07:00", end: "08:00" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 65,
    record: { bullishDays: 28, bearishDays: 15 },
    daysObserved: 43,
    bias: "reversal",
    source: "Goldman Sachs",
    instruments: ["/NQ", "/ES"],
  },
  {
    id: "jpm-flow-report",
    name: "JPM Flow Report",
    description: "JPMorgan flow desk reports. Fade the stated direction.",
    category: "institutional",
    timeRange: { start: "08:00", end: "09:00" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 62,
    record: { bullishDays: 25, bearishDays: 15 },
    daysObserved: 40,
    bias: "reversal",
    source: "JPMorgan",
    instruments: ["/NQ", "/ES"],
  },
  {
    id: "citi-boa-positioning",
    name: "Citi/BOA Institutional Positioning",
    description: "Citibank and BOA positioning reports. Fade bias.",
    category: "institutional",
    timeRange: { start: "07:30", end: "08:30" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 60,
    record: { bullishDays: 22, bearishDays: 15 },
    daysObserved: 37,
    bias: "reversal",
    source: "Citi/BOA",
    instruments: ["/NQ", "/ES"],
  },
  {
    id: "asian-session",
    name: "Asian Session Volume",
    description:
      "Easy setups during Asian session. Low competition, clear levels.",
    category: "session",
    timeRange: { start: "20:00", end: "00:00" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 70,
    record: { bullishDays: 30, bearishDays: 13 },
    daysObserved: 43,
    bias: "consolidation",
    instruments: ["/NQ", "/ES"],
  },
  {
    id: "london-open",
    name: "London Open",
    description:
      "London session opens with directional intent. Strong moves off London open levels.",
    category: "session",
    timeRange: { start: "03:00", end: "04:30" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 68,
    record: { bullishDays: 27, bearishDays: 12 },
    daysObserved: 39,
    bias: "consolidation",
    instruments: ["/NQ", "/ES", "/MNQ"],
  },
  {
    id: "london-ny-overlap",
    name: "London/NY Overlap",
    description: "Highest volume period. Big moves happen here.",
    category: "session",
    timeRange: { start: "08:00", end: "11:00" },
    timezone: "ET",
    daysActive: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    confidence: 75,
    record: { bullishDays: 38, bearishDays: 12 },
    daysObserved: 50,
    bias: "consolidation",
    instruments: ["/NQ", "/ES", "/MNQ"],
  },
  {
    id: "fomc-days",
    name: "FOMC Days",
    description:
      "Fed rate decision + presser. Extreme volatility. Wait for the whipsaw, trade the trend after.",
    category: "report",
    timeRange: { start: "14:00", end: "15:00" },
    timezone: "ET",
    daysActive: ["Wed"],
    confidence: 80,
    record: { bullishDays: 8, bearishDays: 2 },
    daysObserved: 10,
    bias: "consolidation",
    instruments: ["/NQ", "/ES", "/MNQ"],
    notes: "Only on FOMC meeting dates",
  },
  {
    id: "nfp-friday",
    name: "NFP Friday",
    description:
      "Non-Farm Payroll release. Initial spike is noise, trade the reversal.",
    category: "report",
    timeRange: { start: "08:30", end: "09:30" },
    timezone: "ET",
    daysActive: ["Fri"],
    confidence: 71,
    record: { bullishDays: 7, bearishDays: 3 },
    daysObserved: 10,
    bias: "reversal",
    instruments: ["/NQ", "/ES", "/MNQ"],
    notes: "First Friday of each month",
  },
];

function getCurrentETTime(): Date {
  const now = new Date();
  const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(etStr);
}

function isActive(regime: TradingRegime, et: Date): boolean {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = days[et.getDay()];
  if (!regime.daysActive.includes(dayName)) return false;

  const currentMins = et.getHours() * 60 + et.getMinutes();
  const [sh, sm] = regime.timeRange.start.split(":").map(Number);
  const [eh, em] = regime.timeRange.end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;

  if (endMins <= startMins) {
    return currentMins >= startMins || currentMins < endMins;
  }
  return currentMins >= startMins && currentMins < endMins;
}

export function createRegimeRoutes(): Hono {
  const app = new Hono();

  // GET /api/regimes/active — returns currently active regimes
  app.get("/active", (c) => {
    const et = getCurrentETTime();
    const active = SEED_REGIMES.filter((r) => isActive(r, et));
    return c.json({ active, timestamp: et.toISOString() });
  });

  // GET /api/regimes — returns all regimes
  app.get("/", (c) => {
    return c.json({ regimes: SEED_REGIMES });
  });

  return app;
}
