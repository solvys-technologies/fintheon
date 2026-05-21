// [claude-code 2026-05-03] Fixed raw_riskflow_items INSERT: removed non-existent columns
// (sentiment/iv_score/macro_level/risk_type/econ_data). Econ metadata now flows through tags.
// [claude-code 2026-04-29] S51: extended econ-print tags — directional (beat/miss/inline) + magnitude (high-surprise/moderate-surprise/inline-surprise) for deviation gate
// [claude-code 2026-04-28] S48-T1: Fix 1 — redirect econ prints from legacy news_feed_items
// to raw_riskflow_items so they flow through the central scorer pipeline and appear in the feed.
// Gate at entry via isPipelineEnabled("economic-calendar"). Set url="" for sourceless purge fix.
// [claude-code 2026-04-24] S34-T9: unified T6+T8 SSE hook — single broadcastEconPrint call uses T8's flat payload (matches frontend EconPrintFrame).
// [claude-code 2026-04-24] S34-T6: SSE broadcast on successful inject for countdown modal
// [claude-code 2026-04-24] S34-T8: fire broadcastEconPrint SSE frame after successful insert
// so the frontend EconCountdownModal can cross-fade to the actual-vs-forecast view.
// [claude-code 2026-03-11] Bridge: econ prints → RiskFlow feed items
// When an economic release actual is detected, inject it as a high-priority RiskFlow item
// so it flows into the IV scoring engine and appears in the feed.

import { calculateIVScore } from "../analysis/iv-scorer.js";
import { broadcastEconPrint } from "./sse-broadcaster.js";
import { isPipelineEnabled } from "./pipeline-gate.js";
import { recordEconIngest, recordIngestAttempt } from "./ingest-ledger.js";
import { ECON_SOURCE_ID } from "../econ-calendar-service.js";

interface EconPrintEvent {
  eventName: string;
  actual: number;
  forecast?: number;
  previous?: number;
  date: string;
}

/**
 * Convert an econ print into a RiskFlow-compatible feed item and persist to DB.
 * Called by riskflow-econ-enricher and econ-triggered-poller when an actual lands.
 */
export async function injectEconPrintToFeed(
  print: EconPrintEvent,
): Promise<void> {
  try {
    const { sql, isDatabaseAvailable } =
      await import("../../config/database.js");
    if (!isDatabaseAvailable() || !sql) return;

    // S48-T1 Fix 1: Gate — skip if economic-calendar pipeline is disabled
    const enabled = await isPipelineEnabled("economic-calendar");
    if (!enabled) {
      console.log("[EconBridge] Skipped: economic-calendar pipeline disabled");
      recordEconIngest(false);
      recordIngestAttempt({
        source: "EconomicCalendar",
        pipeline: "economic-calendar",
        decision: "dropped_before_feed",
        reason: "economic-calendar pipeline disabled",
        headlinePreview: print.eventName,
      });
      return;
    }

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

    // Check for duplicate: same pipeline + event name prefix + date.
    // Anchored LIKE (no leading %) + ingest_pipeline filter prevents false
    // positives from other sources that mention the same event keyword.
    const existing = await sql`
      SELECT id FROM raw_riskflow_items
      WHERE ingest_pipeline = 'economic-calendar'
        AND lower(headline) LIKE lower(${print.eventName + " Actual%"})
        AND created_at::date = ${print.date}::date
      LIMIT 1
    `;
    if (existing.length > 0) {
      recordEconIngest(true, 0);
      recordIngestAttempt({
        source: "EconomicCalendar",
        pipeline: "economic-calendar",
        decision: "accepted",
        reason: "duplicate print already in raw RiskFlow inbox",
        headlinePreview: print.eventName,
      });
      return;
    }

    const econData = {
      actual: print.actual,
      forecast: print.forecast ?? null,
      previous: print.previous ?? null,
      beatMiss: direction as "beat" | "miss" | "inline",
      surprisePercent:
        Math.abs(surprise) > 0.01 ? Math.round(surprise * 100) / 100 : null,
    };

    // S51: extended tags for deviation gate + directional/magnitude
    const directional =
      direction === "beat" ? "beat" : direction === "miss" ? "miss" : "inline";
    const magnitude =
      Math.abs(surprise) > 5
        ? "high-surprise"
        : Math.abs(surprise) > 1
          ? "moderate-surprise"
          : "inline-surprise";
    const tags = [
      "econ",
      "print",
      "econ-print",
      print.eventName.toLowerCase().replace(/\s+/g, "-"),
      directional,
      magnitude,
    ];

    // Write to raw_riskflow_items using only columns that exist in the table.
    // Columns like sentiment/iv_score/macro_level/risk_type/econ_data do NOT
    // exist on raw_riskflow_items — they are added by the central scorer when
    // promoting to scored_riskflow_items. Emit econ metadata in tags + body
    // so the scorer can reconstruct them.
    await sql`
      INSERT INTO raw_riskflow_items (
        tweet_id, headline, body, source, source_domain, url,
        is_breaking, urgency, symbols, tags, published_at,
        submitted_by, ingest_pipeline
      ) VALUES (
        ${`econ:${print.date}:${print.eventName.replace(/[^a-zA-Z0-9]/g, "-")}`},
        ${headline},
        ${headline},
        ${ECON_SOURCE_ID},
        'economic-calendar',
        '',
        true,
        'high',
        ${[]},
        ${tags},
        ${new Date(print.date).toISOString()},
        'riskflow-worker',
        'economic-calendar'
      )
    `;

    console.log(
      `[EconBridge] Injected: ${headline} (macroLevel=${macroLevel})`,
    );
    recordEconIngest(true);
    recordIngestAttempt({
      source: "EconomicCalendar",
      pipeline: "economic-calendar",
      decision: "accepted",
      reason: "econ print inserted into RiskFlow inbox",
      headlinePreview: headline,
    });

    try {
      broadcastEconPrint({
        eventName: print.eventName,
        actual: print.actual,
        forecast: print.forecast ?? null,
        previous: print.previous ?? null,
        surprisePercent: econData.surprisePercent,
        beatMiss: direction as "beat" | "miss" | "inline",
        printedAt: new Date().toISOString(),
      });
    } catch (sseErr) {
      console.warn(
        "[EconBridge] broadcastEconPrint failed (non-fatal)",
        sseErr,
      );
    }
  } catch (err) {
    recordEconIngest(false);
    recordIngestAttempt({
      source: "EconomicCalendar",
      pipeline: "economic-calendar",
      decision: "errored",
      reason: err instanceof Error ? err.message : String(err),
      headlinePreview: print.eventName,
    });
    console.error("[EconBridge] Failed to inject econ print:", err);
  }
}
