// [claude-code 2026-04-28] S48-T1: Backfill 21 days of econ events from
// FinancialJuice's X timeline into economic_events. Uses existing helpers
// (matchTweetToEvent, extractActualFromText) for parsing. DRY_RUN mode
// skips writes. Run: cd backend-hono && bun run scripts/backfill-econ-from-fj.ts

import {
  fetchEconCalendar,
  writeEconPrint,
  type EconEvent,
} from "../src/services/econ-calendar-service.js";
import {
  matchTweetToEvent,
  extractActualFromText,
} from "../src/services/riskflow/rettiwt-poller-econ.js";
import { getSupabaseClient } from "../src/config/supabase.js";

const DRY_RUN = process.env.DRY_RUN === "true";
const DAYS_BACK = 21;

// Priority event types to poll for
const EVENT_CATALOG = [
  { name: "Nonfarm Payrolls", freq: "monthly", dayHint: "first_friday" },
  { name: "CPI m/m", freq: "monthly", dayHint: "~10" },
  { name: "Core CPI m/m", freq: "monthly", dayHint: "~10" },
  { name: "PPI m/m", freq: "monthly", dayHint: "~11" },
  { name: "Core PPI m/m", freq: "monthly", dayHint: "~11" },
  { name: "FOMC Rate Decision", freq: "periodic", dayHint: "6wk" },
  { name: "ISM Manufacturing PMI", freq: "monthly", dayHint: "1st_biz" },
  { name: "ISM Services PMI", freq: "monthly", dayHint: "3rd_biz" },
  { name: "GDP q/q Advance", freq: "quarterly", dayHint: "~28" },
  { name: "PCE m/m", freq: "monthly", dayHint: "~28" },
  { name: "Core PCE m/m", freq: "monthly", dayHint: "~28" },
  { name: "Retail Sales m/m", freq: "monthly", dayHint: "~15" },
  { name: "Initial Jobless Claims", freq: "weekly", dayHint: "thursday" },
  { name: "ADP Employment Change", freq: "monthly", dayHint: "~3" },
  { name: "JOLTS Job Openings", freq: "monthly", dayHint: "~5" },
  { name: "Consumer Confidence (CB)", freq: "monthly", dayHint: "~25" },
  {
    name: "Michigan Consumer Sentiment (UoM)",
    freq: "monthly",
    dayHint: "~15",
  },
];

function dateRange(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = DAYS_BACK; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

interface BackfillResult {
  eventName: string;
  date: string;
  actual: number;
  forecast?: number;
  previous?: number;
  tweetId: string;
}

async function main() {
  console.log(
    `[EconBackfill] ${DRY_RUN ? "DRY RUN" : "LIVE"} — backfilling ${DAYS_BACK} days from FJ X timeline`,
  );

  const sb = getSupabaseClient();
  if (!sb) {
    console.error("[EconBackfill] No Supabase client — aborting");
    process.exit(1);
  }

  const dates = dateRange();
  const results: BackfillResult[] = [];
  let tweetsScanned = 0;
  let eventsFound = 0;
  let eventsMissing = 0;
  let partialData = 0;

  // First, get any events already in the calendar for this range
  for (const date of dates) {
    try {
      const events = await fetchEconCalendar({ from: date, to: date });
      console.log(
        `[EconBackfill] ${date}: ${events.length} events in calendar`,
      );

      for (const event of events) {
        if (event.actual) {
          eventsFound++;
        } else {
          eventsMissing++;
        }
      }
    } catch (err) {
      console.warn(`[EconBackfill] Failed to fetch calendar for ${date}:`, err);
    }
  }

  // Second, scan raw_riskflow_items for EconomicCalendar items with econ_data
  for (const date of dates) {
    try {
      const { data: rawItems } = await sb
        .from("raw_riskflow_items")
        .select("headline, econ_data, created_at, source")
        .eq("source", "EconomicCalendar")
        .gte("created_at", `${date}T00:00:00Z`)
        .lt("created_at", `${date}T23:59:59Z`)
        .order("created_at", { ascending: false });

      if (!rawItems || rawItems.length === 0) continue;

      tweetsScanned += rawItems.length;

      for (const item of rawItems as Array<{
        headline: string;
        econ_data: any;
        created_at: string;
      }>) {
        const { econ_data } = item;
        if (!econ_data?.actual && econ_data?.actual !== 0) {
          partialData++;
          continue;
        }

        results.push({
          eventName: item.headline.split(" Actual")[0] || "Unknown",
          date,
          actual: econ_data.actual,
          forecast: econ_data.forecast ?? undefined,
          previous: econ_data.previous ?? undefined,
          tweetId: `${date}-${item.headline.slice(0, 30)}`,
        });

        // Upsert into economic_events
        if (!DRY_RUN) {
          try {
            await writeEconPrint({
              eventName: item.headline.split(" Actual")[0] || "Unknown",
              date,
              actual: econ_data.actual,
              forecast: econ_data.forecast ?? undefined,
              previous: econ_data.previous ?? undefined,
            });
          } catch (err) {
            console.warn(
              `[EconBackfill] Failed to write print: ${item.headline.slice(0, 60)}`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.warn(`[EconBackfill] Failed to scan raw items for ${date}:`, err);
    }
  }

  // Third, also try to match against events catalog using FJ tweets from the X timeline
  // (only fires when raw_riskflow_items already has X-sourced items for FJ)
  for (const date of dates) {
    try {
      const events = await fetchEconCalendar({ from: date, to: date });

      // Look for FJ tweets from raw_riskflow_items with source FinancialJuice
      const { data: fjItems } = await sb
        .from("raw_riskflow_items")
        .select("headline, body, created_at, source, author_handle")
        .eq("source", "FinancialJuice")
        .gte("created_at", `${date}T00:00:00Z`)
        .lt("created_at", `${date}T23:59:59Z`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (!fjItems || fjItems.length === 0) continue;

      tweetsScanned += fjItems.length;

      for (const item of fjItems as Array<{
        headline: string;
        body: string | null;
        created_at: string;
      }>) {
        const text = `${item.headline} ${item.body || ""}`;

        // Use the existing helpers to check if this tweet matches an event
        const matchedEvent = matchTweetToEvent(text, events);
        if (!matchedEvent) continue;

        const extracted = extractActualFromText(text);
        if (!extracted) {
          partialData++;
          continue;
        }

        results.push({
          eventName: matchedEvent.name,
          date,
          actual: extracted.actual,
          forecast: extracted.forecast,
          previous: extracted.previous,
          tweetId: `${date}-${matchedEvent.name.slice(0, 30)}`,
        });

        if (!DRY_RUN) {
          try {
            await writeEconPrint({
              eventName: matchedEvent.name,
              date,
              actual: extracted.actual,
              forecast: extracted.forecast ?? undefined,
              previous: extracted.previous ?? undefined,
            });
          } catch (err) {
            console.warn(
              `[EconBackfill] Failed to write matched print: ${matchedEvent.name}`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.warn(
        `[EconBackfill] Failed to match FJ tweets for ${date}:`,
        err,
      );
    }
  }

  console.log(
    `\n[EconBackfill] Complete — scanned ${tweetsScanned} tweets across ${dates.length} days`,
  );
  console.log(
    `  Results: ${results.length} prints found, ${eventsFound} already in calendar, ${eventsMissing} missing, ${partialData} partial`,
  );
  console.log(
    `  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE (wrote to economic_events)"}`,
  );

  if (results.length > 0) {
    console.log(`\n  Sample prints:`);
    for (const r of results.slice(0, 10)) {
      console.log(
        `    ${r.date} | ${r.eventName} | Actual: ${r.actual}${r.forecast ? ` | Forecast: ${r.forecast}` : ""}${r.previous ? ` | Previous: ${r.previous}` : ""}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[EconBackfill] Fatal:", err);
  process.exit(1);
});
