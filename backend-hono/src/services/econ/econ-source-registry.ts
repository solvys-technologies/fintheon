// [claude-code 2026-04-30] S55: Econ source registry. Catalogues event-source
// roles and known official source URLs/patterns from research. All latency
// assumptions are RESEARCH ONLY — not production truth until stopwatch-tested.

export interface EconSourceEntry {
  sourceId: string;
  label: string;
  role: "schedule" | "provisional-live" | "authoritative" | "research";
  /** URL or pattern for the official release page */
  url?: string;
  /** Agencies/orgs this source covers */
  agencies: string[];
  /** Known latency assumptions (research inputs, not truth) */
  latencyNotes: string;
}

/**
 * TradingView is schedule-only. It owns economic_events, active-watch,
 * agentic scheduling, and countdown windows. It does NOT own live actual truth.
 */
export const TRADINGVIEW_SCHEDULE: EconSourceEntry = {
  sourceId: "tradingview",
  label: "TradingView Economic Calendar",
  role: "schedule",
  url: "https://www.tradingview.com/economic-calendar/",
  agencies: ["all"],
  latencyNotes:
    "Schedule updates within ~60s of release window. Actuals may lag 5-300s behind true release time.",
};

/**
 * Official source registry. Each entry is a known official release page or API.
 * Promotion to provisional-live or authoritative requires release-day stopwatch evidence.
 */
export const OFFICIAL_SOURCES: EconSourceEntry[] = [
  {
    sourceId: "bls-cpi",
    label: "BLS — Consumer Price Index",
    role: "research",
    url: "https://www.bls.gov/news.release/cpi.toc.htm",
    agencies: ["BLS"],
    latencyNotes:
      "BLS.gov updates at exactly 8:30 AM ET on release day. Embargoed until 8:30.",
  },
  {
    sourceId: "bls-nfp",
    label: "BLS — Employment Situation (NFP)",
    role: "research",
    url: "https://www.bls.gov/news.release/empsit.toc.htm",
    agencies: ["BLS"],
    latencyNotes:
      "BLS.gov updates at exactly 8:30 AM ET first Friday. High embargo enforcement.",
  },
  {
    sourceId: "bls-ppi",
    label: "BLS — Producer Price Index",
    role: "research",
    url: "https://www.bls.gov/news.release/ppi.toc.htm",
    agencies: ["BLS"],
    latencyNotes: "BLS.gov updates at exactly 8:30 AM ET.",
  },
  {
    sourceId: "bls-jolts",
    label: "BLS — Job Openings and Labor Turnover Survey",
    role: "research",
    url: "https://www.bls.gov/news.release/jolts.toc.htm",
    agencies: ["BLS"],
    latencyNotes: "BLS.gov updates at 10:00 AM ET.",
  },
  {
    sourceId: "bls-eci",
    label: "BLS — Employment Cost Index",
    role: "research",
    url: "https://www.bls.gov/news.release/eci.toc.htm",
    agencies: ["BLS"],
    latencyNotes: "BLS.gov updates at 8:30 AM ET quarterly.",
  },
  {
    sourceId: "bea-gdp",
    label: "BEA — Gross Domestic Product",
    role: "research",
    url: "https://www.bea.gov/news/schedule",
    agencies: ["BEA"],
    latencyNotes:
      "BEA.gov updates at 8:30 AM ET. Advance/2nd/3rd estimates follow quarterly schedule.",
  },
  {
    sourceId: "bea-pce",
    label: "BEA — Personal Consumption Expenditures",
    role: "research",
    url: "https://www.bea.gov/news/schedule",
    agencies: ["BEA"],
    latencyNotes: "BEA.gov updates at 8:30 AM ET monthly.",
  },
  {
    sourceId: "census-retail",
    label: "Census — Advance Retail Sales",
    role: "research",
    url: "https://www.census.gov/retail/",
    agencies: ["Census"],
    latencyNotes: "PDF released at 8:30 AM ET. XML/spreadsheet follows.",
  },
  {
    sourceId: "census-durable",
    label: "Census — Durable Goods",
    role: "research",
    url: "https://www.census.gov/manufacturing/",
    agencies: ["Census"],
    latencyNotes: "Released at 8:30 AM ET.",
  },
  {
    sourceId: "census-housing",
    label: "Census — Housing Starts / Building Permits",
    role: "research",
    url: "https://www.census.gov/construction/nrc/",
    agencies: ["Census"],
    latencyNotes: "Released at 8:30 AM ET.",
  },
  {
    sourceId: "census-trade",
    label: "Census — International Trade Balance",
    role: "research",
    url: "https://www.census.gov/foreign-trade/",
    agencies: ["Census"],
    latencyNotes: "Released at 8:30 AM ET.",
  },
  {
    sourceId: "dol-claims",
    label: "DOL/ETA — Initial Jobless Claims",
    role: "research",
    url: "https://oui.doleta.gov/press/",
    agencies: ["DOL"],
    latencyNotes: "Released at 8:30 AM ET Thursdays.",
  },
  {
    sourceId: "frb-fomc",
    label: "Federal Reserve — FOMC Decision",
    role: "research",
    url: "https://www.federalreserve.gov/newsevents/pressreleases.htm",
    agencies: ["FRB"],
    latencyNotes:
      "Released at 2:00 PM ET on FOMC day 2. Statement goes live instantly on federalreserve.gov.",
  },
  {
    sourceId: "frb-minutes",
    label: "Federal Reserve — FOMC Minutes",
    role: "research",
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    agencies: ["FRB"],
    latencyNotes: "Released at 2:00 PM ET, 3 weeks after FOMC meeting.",
  },
  {
    sourceId: "frb-ip",
    label: "Federal Reserve — G.17 Industrial Production",
    role: "research",
    url: "https://www.federalreserve.gov/releases/g17/",
    agencies: ["FRB"],
    latencyNotes: "Released at 9:15 AM ET mid-month.",
  },
];

/**
 * WIRE sources are the fastest live-print channel during release windows.
 * FinancialJuice and DeItaOne typically beat TradingView actuals by 2-30s.
 */
export const WIRE_SOURCES: EconSourceEntry[] = [
  {
    sourceId: "financialjuice",
    label: "FinancialJuice (X/WIRE)",
    role: "provisional-live",
    url: "https://x.com/financialjuice",
    agencies: ["all"],
    latencyNotes:
      "Typically 2-15s after official release. Word-gate classified (Actual+Forecast).",
  },
  {
    sourceId: "deitaone",
    label: "DeItaOne (X/WIRE)",
    role: "provisional-live",
    url: "https://x.com/deitaone",
    agencies: ["all"],
    latencyNotes:
      "Typically 3-20s after official release. Covers macro commentary + data releases.",
  },
];

/**
 * Live race participant roles:
 *   schedule: opens the window, defines countdown target
 *   provisional-live: races for first valid print
 *   authoritative: confirms/corrects the final value
 *   research: documented but not yet race-promoted
 */
export type LiveRaceRole =
  | "schedule"
  | "provisional-live"
  | "authoritative"
  | "research";

export interface LiveRaceParticipant {
  sourceId: string;
  label: string;
  role: LiveRaceRole;
}

export function getParticipantsForEvent(
  agencies: string[],
): LiveRaceParticipant[] {
  const participants: LiveRaceParticipant[] = [
    {
      sourceId: TRADINGVIEW_SCHEDULE.sourceId,
      label: TRADINGVIEW_SCHEDULE.label,
      role: "schedule",
    },
  ];

  for (const wire of WIRE_SOURCES) {
    participants.push({
      sourceId: wire.sourceId,
      label: wire.label,
      role: wire.role,
    });
  }

  // Official sources matching the event agencies are research participants
  for (const official of OFFICIAL_SOURCES) {
    const match =
      agencies.length === 0 ||
      official.agencies.some((a) => agencies.includes(a)) ||
      official.agencies.includes("all");
    if (match) {
      participants.push({
        sourceId: official.sourceId,
        label: official.label,
        role: "research",
      });
    }
  }

  return participants;
}

export function getSourceByRole(role: LiveRaceRole): EconSourceEntry[] {
  if (role === "schedule") return [TRADINGVIEW_SCHEDULE];
  if (role === "provisional-live") return WIRE_SOURCES;
  if (role === "research") return OFFICIAL_SOURCES;
  return [];
}
