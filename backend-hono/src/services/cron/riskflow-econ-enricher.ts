// [claude-code 2026-04-24] RiskFlow Econ Enricher — writes Notion calendar prints to RiskFlow feed (renamed from econ-enricher in S35)

import {
  fetchEconCalendar,
  writeEconPrint,
  updateEventActual,
} from "../econ-calendar-service.js";
import { injectEconPrintToFeed } from "../riskflow/econ-bridge.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("RiskFlowEconEnricher");

const ENRICHER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const INTRADAY_CHECK_MS = 5 * 60 * 1000; // 5 min during market hours
let enricherTimer: ReturnType<typeof setInterval> | null = null;
let intradayTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Enrichment: fetch today's calendar events from Notion,
 * inject hot prints into RiskFlow feed for IV scoring.
 */
export async function runEconEnrichment(): Promise<{
  processed: number;
  written: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  let processed = 0;
  let written = 0;

  try {
    const events = await fetchEconCalendar({ from: today, to: today });
    if (!events.length) {
      log.info(" No events for today");
      return { processed: 0, written: 0 };
    }

    for (const event of events) {
      processed++;
      if (!event.actual) continue;

      // Write print to Econ Prints DB
      const result = await writeEconPrint({
        eventName: event.name,
        date: today,
        actual: parseFloat(event.actual),
        forecast: event.forecast ? parseFloat(event.forecast) : undefined,
        previous: event.previous ? parseFloat(event.previous) : undefined,
      });

      if (result) {
        written++;
        await injectEconPrintToFeed({
          eventName: event.name,
          actual: parseFloat(event.actual),
          forecast: event.forecast ? parseFloat(event.forecast) : undefined,
          previous: event.previous ? parseFloat(event.previous) : undefined,
          date: today,
        }).catch((err) => log.error(" Bridge inject error:", err));
        console.log(
          `[RiskFlowEconEnricher] Wrote print: ${event.name} = ${event.actual}`,
        );
      }
    }

    console.log(
      `[RiskFlowEconEnricher] Done: ${processed} processed, ${written} written`,
    );
  } catch (err) {
    log.error(" Enrichment error:", err);
  }

  return { processed, written };
}

/** Check if we're in US market hours (8:00-17:00 ET) */
function isMarketHours(): boolean {
  const now = new Date();
  const etHour = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  ).getHours();
  return etHour >= 8 && etHour <= 17;
}

export function startRiskFlowEconEnricher(): void {
  log.info(" Starting enrichment scheduler");

  enricherTimer = setInterval(() => {
    runEconEnrichment().catch((err) => log.error(" Nightly error:", err));
  }, ENRICHER_INTERVAL_MS);

  intradayTimer = setInterval(() => {
    if (isMarketHours()) {
      runEconEnrichment().catch((err) => log.error(" Intraday error:", err));
    }
  }, INTRADAY_CHECK_MS);

  runEconEnrichment().catch((err) => log.error(" Initial run error:", err));
}

export function stopRiskFlowEconEnricher(): void {
  if (enricherTimer) {
    clearInterval(enricherTimer);
    enricherTimer = null;
  }
  if (intradayTimer) {
    clearInterval(intradayTimer);
    intradayTimer = null;
  }
}
