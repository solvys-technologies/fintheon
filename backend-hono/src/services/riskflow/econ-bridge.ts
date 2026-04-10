// [claude-code 2026-03-11] Bridge: econ prints → RiskFlow feed items
// When an economic release actual is detected, inject it as a high-priority RiskFlow item
// so it flows into the IV scoring engine and appears in the feed.

import { calculateIVScore } from "../analysis/iv-scorer.js";

interface EconPrintEvent {
  eventName: string;
  actual: number;
  forecast?: number;
  previous?: number;
  date: string;
}

/**
 * Convert an econ print into a RiskFlow-compatible feed item and persist to DB.
 * Called by econ-enricher and econ-triggered-poller when an actual lands.
 */
export async function injectEconPrintToFeed(
  print: EconPrintEvent,
): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } =
      await import("../../config/database.js");
    if (!isDatabaseAvailable() || !sql) return;

    const isBeat = print.forecast != null && print.actual > print.forecast;
    const isMiss = print.forecast != null && print.actual < print.forecast;
    const direction = isBeat ? "beat" : isMiss ? "miss" : "inline";
    const surprise =
      print.forecast != null && print.forecast !== 0
        ? ((print.actual - print.forecast) / Math.abs(print.forecast)) * 100
        : 0;

    const headline = `${print.eventName} Actual ${print.actual}${
      print.forecast != null ? ` (Forecast ${print.forecast}` : ""
    }${
      print.previous != null ? `, Previous ${print.previous}` : ""
    }${print.forecast != null ? ")" : ""} — ${direction.toUpperCase()}${
      Math.abs(surprise) > 0.1
        ? ` ${surprise > 0 ? "+" : ""}${surprise.toFixed(1)}%`
        : ""
    }`;

    // Score for macro level
    let macroLevel = 2;
    try {
      const parsed = { raw: headline, eventType: null, isBreaking: true };
      const ivResult = await calculateIVScore({
        parsed: parsed as any,
        timestamp: new Date(),
      });
      macroLevel = ivResult.macroLevel;
    } catch {
      // Fallback: econ prints are at least level 2
    }

    // Check for duplicate (same event name + date)
    const existing = await sql`
      SELECT id FROM news_feed_items
      WHERE headline ILIKE ${"%" + print.eventName + "%Actual%"}
        AND published_at::date = ${print.date}::date
      LIMIT 1
    `;
    if (existing.length > 0) return;

    const econData = {
      actual: print.actual,
      forecast: print.forecast ?? null,
      previous: print.previous ?? null,
      beatMiss: direction as "beat" | "miss" | "inline",
      surprisePercent:
        Math.abs(surprise) > 0.01 ? Math.round(surprise * 100) / 100 : null,
    };

    await sql`
      INSERT INTO news_feed_items (
        headline, body, source, url, published_at, is_breaking,
        urgency, sentiment, iv_score, macro_level, symbols, tags,
        econ_data, risk_type
      ) VALUES (
        ${headline},
        ${headline},
        'EconomicCalendar',
        ${`notion://econ/${print.eventName}`},
        ${new Date(print.date).toISOString()},
        true,
        'high',
        ${isBeat ? "bullish" : isMiss ? "bearish" : "neutral"},
        ${macroLevel >= 3 ? 7 : 5},
        ${macroLevel},
        ${JSON.stringify([])},
        ${JSON.stringify(["econ", "print", print.eventName.toLowerCase().replace(/\s+/g, "-")])},
        ${JSON.stringify(econData)},
        'Macro'
      )
    `;

    console.log(
      `[EconBridge] Injected: ${headline} (macroLevel=${macroLevel})`,
    );
  } catch (err) {
    console.error("[EconBridge] Failed to inject econ print:", err);
  }
}
