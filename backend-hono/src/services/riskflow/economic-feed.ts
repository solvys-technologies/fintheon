// [claude-code 2026-04-16] Economic feed for RiskFlow — uses Supabase econ calendar
import { fetchEconCalendar } from "../econ-calendar-service.js";
import { calculateIVScore } from "../analysis/iv-scorer.js";
import type {
  FeedItem,
  NewsSource,
  SentimentDirection,
} from "../../types/riskflow.js";
import type { HotPrint, ParsedHeadline } from "../../types/news-analysis.js";

const ECON_SOURCE: NewsSource = "EconomicCalendar";

/**
 * Fetch today's economic events from Supabase calendar and map to feed items.
 * Only includes events that have actual values (released prints).
 */
export async function fetchEconomicFeed(): Promise<FeedItem[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const events = await fetchEconCalendar({ from: today, to: today });
    if (!events.length) return [];

    const items: FeedItem[] = [];
    for (const event of events) {
      if (!event.actual) continue;

      const actual = parseFloat(event.actual);
      const forecast = event.forecast ? parseFloat(event.forecast) : null;
      const previous = event.previous ? parseFloat(event.previous) : null;
      const deviation = forecast != null ? Math.abs(actual - forecast) : 0;
      const isHot =
        forecast != null &&
        Math.abs(actual - forecast) / Math.max(Math.abs(forecast), 0.01) > 0.1;

      const headlineParts = [
        event.name,
        `Actual: ${actual}`,
        forecast != null ? `Forecast: ${forecast}` : null,
        previous != null ? `Prev: ${previous}` : null,
      ].filter(Boolean);
      const headline = headlineParts.join(" | ");

      const hotPrint: HotPrint | null = isHot
        ? {
            type: "economicData",
            actual,
            forecast: forecast ?? 0,
            previous: previous ?? undefined,
            deviation,
            direction:
              forecast != null && actual < forecast ? "below" : "above",
            impact: "high",
            tradingImplication: "High impact economic release",
            releaseTime: event.date ?? today,
          }
        : null;

      const parsed: ParsedHeadline = {
        raw: headline,
        source: ECON_SOURCE,
        symbols: [],
        tags: ["ECON_DATA"],
        isBreaking: true,
        urgency: "immediate",
        eventType: "economicData",
        numbers: {
          actual,
          forecast: forecast ?? undefined,
          previous: previous ?? undefined,
        },
        confidence: 0.9,
      };

      const iv = await calculateIVScore({
        parsed,
        hotPrint,
        timestamp: new Date(),
      });

      items.push({
        id: `econ-${event.id ?? event.name}-${today}`,
        source: ECON_SOURCE,
        headline,
        body: undefined,
        symbols: [],
        tags: ["ECON_DATA"],
        isBreaking: true,
        urgency: "immediate",
        sentiment: iv.sentiment as SentimentDirection,
        ivScore: iv.score,
        macroLevel: iv.macroLevel,
        publishedAt: event.date ?? new Date().toISOString(),
        analyzedAt: new Date().toISOString(),
        ingest_pipeline: "economic-calendar",
      });
    }

    return items;
  } catch (error) {
    console.error("[EconomicFeed] Failed to fetch economic prints:", error);
    return [];
  }
}
