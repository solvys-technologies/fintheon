// [claude-code 2026-04-26] S45.5/F2: utilities moved from deleted
// rettiwt-poller-econ.ts to econ-print-utils.ts; import path updated.
// [claude-code 2026-04-24] S34-T6: Keyword "Actual/Forecast" trigger + event-window promoter.
// Scans recent raw_riskflow_items for the keyword, checks whether any currently-subscribed
// (country, category) event window covers the item's timestamp, and promotes it via
// scored_riskflow_items with macro_level=4 / risk_type='Macro' / tags=['econ-print', ...].

import { createLogger } from "../../lib/logger.js";
import { fetchEconCalendar, type EconEvent } from "../econ-calendar-service.js";
import { isDatabaseAvailable, sql as dbSql } from "../../config/database.js";
import { getSupabaseClient } from "../../config/supabase.js";
import {
  writeScoredItems,
  type RawRiskFlowItem,
  type ScoredRiskFlowItem,
} from "../supabase-service.js";
import { broadcastEconPrint } from "./sse-broadcaster.js";
import {
  PRE_EVENT_MINUTES,
  POST_EVENT_MINUTES,
  extractActualFromText,
  matchTweetToEvent,
} from "./econ-print-utils.js";

const log = createLogger("EconKeywordTrigger");

// ── Local type (switch to T1's econ-watch-filter.ts import once that track merges) ──
// TODO(s34-t1): replace with `import type { EconWatchFilter } from "../../types/econ-watch-filter.js"`
export interface EconWatchFilter {
  country: string;
  category: string;
  active: boolean;
}

const KEYWORD_RE = /\b(actual|forecast)\b/i;
const RAW_SCAN_WINDOW_MS = 20 * 60_000; // 20 min lookback covers the full -5/+15 window + slack
const RAW_SCAN_LIMIT = 200;

interface SweepStats {
  lastTickAt: string | null;
  lastScanned: number;
  lastPromoted: number;
  totalScanned: number;
  totalPromoted: number;
  lastError: string | null;
}

const stats: SweepStats = {
  lastTickAt: null,
  lastScanned: 0,
  lastPromoted: 0,
  totalScanned: 0,
  totalPromoted: 0,
  lastError: null,
};

export function getTriggerStats(): Readonly<SweepStats> {
  return { ...stats };
}

// ── Keyword + Window Predicates ────────────────────────────────────────────

export function containsEconPrintKeyword(
  text: string | null | undefined,
): boolean {
  if (!text) return false;
  return KEYWORD_RE.test(text);
}

/** Event start timestamp, best-effort from date + optional time. */
function eventStartMs(event: EconEvent): number | null {
  if (!event.date) return null;
  try {
    const iso = event.time
      ? `${event.date}T${event.time}`
      : `${event.date}T00:00:00`;
    const ms = new Date(iso).getTime();
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

export function isInActiveWatchWindow(
  timestamp: Date,
  events: EconEvent[],
  filters: EconWatchFilter[],
): { event: EconEvent; country: string; category: string } | null {
  const tMs = timestamp.getTime();
  for (const event of events) {
    const startMs = eventStartMs(event);
    if (startMs == null) continue;
    const diffMin = (tMs - startMs) / 60_000;
    if (diffMin < -PRE_EVENT_MINUTES || diffMin > POST_EVENT_MINUTES) continue;

    const country = (event.country || "").toUpperCase();
    const category = event.category || "";
    if (!filterAllows(filters, country, category)) continue;

    return { event, country, category };
  }
  return null;
}

function filterAllows(
  filters: EconWatchFilter[],
  country: string,
  category: string,
): boolean {
  // Graceful fallback: empty filters table → treat as all subscribed
  // (lets T6 run before T1's seed lands in prod).
  if (filters.length === 0) return true;
  if (!country) return false;
  const match = filters.find(
    (f) =>
      f.country.toUpperCase() === country &&
      (category ? f.category === category : true),
  );
  if (!match) return false;
  return match.active;
}

// ── Filter Loader (tolerant of missing table) ──────────────────────────────

export async function loadActiveWatchFilters(): Promise<EconWatchFilter[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("econ_watch_filters")
      .select("country, category, active")
      .eq("active", true);
    if (error) {
      // Missing table / 42P01 → graceful empty list (implicit-all per filterAllows)
      log.info("econ_watch_filters unavailable; using implicit-all fallback", {
        code: error.code,
        message: error.message,
      });
      return [];
    }
    return (data ?? []).map((r) => ({
      country: String(r.country ?? "").toUpperCase(),
      category: String(r.category ?? ""),
      active: Boolean(r.active),
    }));
  } catch (err) {
    log.warn("loadActiveWatchFilters threw — falling back to empty", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Raw Item Scan ──────────────────────────────────────────────────────────

interface RawRowWithId extends RawRiskFlowItem {
  id: string;
  created_at?: string;
}

async function fetchRecentRawCandidates(): Promise<RawRowWithId[]> {
  const cutoff = new Date(Date.now() - RAW_SCAN_WINDOW_MS).toISOString();

  if (isDatabaseAvailable() && dbSql) {
    try {
      const rows = await dbSql`
        SELECT r.id, r.tweet_id, r.source, r.headline, r.body, r.url,
               r.symbols, r.tags, r.is_breaking, r.urgency, r.published_at,
               r.submitted_by, r.created_at
        FROM raw_riskflow_items r
        WHERE r.published_at >= ${cutoff}
          AND (r.headline ~* '\\yactual\\y|\\yforecast\\y'
               OR r.body ~* '\\yactual\\y|\\yforecast\\y')
          AND NOT EXISTS (
            SELECT 1 FROM scored_riskflow_items s
             WHERE s.tweet_id = r.tweet_id
               AND s.risk_type = 'Macro'
               AND 'econ-print' = ANY(COALESCE(s.tags, ARRAY[]::text[]))
          )
        ORDER BY r.published_at ASC
        LIMIT ${RAW_SCAN_LIMIT}
      `;
      return rows as RawRowWithId[];
    } catch (err) {
      log.warn("Raw scan SQL failed, falling back to Supabase client", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const sb = getSupabaseClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("raw_riskflow_items")
    .select("*")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false })
    .limit(RAW_SCAN_LIMIT);
  if (error || !data) return [];
  return data.filter((r) =>
    containsEconPrintKeyword((r.headline ?? "") + "\n" + (r.body ?? "")),
  ) as RawRowWithId[];
}

// ── Promotion ──────────────────────────────────────────────────────────────

interface PromotionContext {
  event: EconEvent;
  country: string;
  category: string;
  keyword: "actual" | "forecast";
}

export async function promoteToFeed(
  raw: RawRowWithId,
  ctx: PromotionContext,
): Promise<boolean> {
  const text = [raw.headline ?? "", raw.body ?? ""].join("\n");
  const extracted = extractActualFromText(text);

  const tags = new Set<string>(raw.tags ?? []);
  tags.add("econ-print");
  if (ctx.country) tags.add(`country:${ctx.country}`);
  if (ctx.category) tags.add(`category:${ctx.category}`);
  tags.add(`keyword:${ctx.keyword}`);

  const sentiment =
    extracted?.forecast != null && extracted?.actual != null
      ? extracted.actual > extracted.forecast
        ? "bullish"
        : extracted.actual < extracted.forecast
          ? "bearish"
          : "neutral"
      : undefined;

  const econData =
    extracted != null
      ? {
          actual: extracted.actual,
          forecast: extracted.forecast ?? null,
          previous: extracted.previous ?? null,
          event_name: ctx.event.name,
          event_country: ctx.country,
          event_category: ctx.category,
        }
      : {
          event_name: ctx.event.name,
          event_country: ctx.country,
          event_category: ctx.category,
          keyword_only: true,
        };

  const scored: ScoredRiskFlowItem = {
    tweet_id: raw.tweet_id,
    raw_item_id: raw.id,
    source: raw.source,
    headline: raw.headline,
    body: raw.body,
    url: raw.url,
    symbols: raw.symbols,
    tags: Array.from(tags),
    is_breaking: true,
    urgency: "high",
    sentiment,
    iv_score: 7,
    macro_level: 4,
    published_at: raw.published_at,
    analyzed_at: new Date().toISOString(),
    scored_by: "econ-keyword-trigger",
    risk_type: "Macro",
    econ_data: econData,
  };

  const written = await writeScoredItems([scored]);
  if (written <= 0) return false;

  try {
    const surprisePercent =
      extracted?.actual != null &&
      extracted?.forecast != null &&
      extracted.forecast !== 0
        ? ((extracted.actual - extracted.forecast) /
            Math.abs(extracted.forecast)) *
          100
        : null;
    const beatMiss: "beat" | "miss" | "inline" =
      surprisePercent == null
        ? "inline"
        : surprisePercent > 0.1
          ? "beat"
          : surprisePercent < -0.1
            ? "miss"
            : "inline";
    broadcastEconPrint({
      eventName: ctx.event.name,
      actual: extracted?.actual ?? 0,
      forecast: extracted?.forecast ?? null,
      previous: extracted?.previous ?? null,
      surprisePercent,
      beatMiss,
      printedAt: new Date().toISOString(),
    });
  } catch (err) {
    log.warn("broadcastEconPrint threw (swallowed)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("Promoted econ-print keyword match", {
    tweetId: raw.tweet_id,
    event: ctx.event.name,
    country: ctx.country,
    category: ctx.category,
    hasNumeric: extracted != null,
  });
  return true;
}

// ── Sweep ──────────────────────────────────────────────────────────────────

export async function runEconKeywordSweep(): Promise<{
  scanned: number;
  promoted: number;
}> {
  stats.lastTickAt = new Date().toISOString();

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [rawCandidates, filters, events] = await Promise.all([
      fetchRecentRawCandidates(),
      loadActiveWatchFilters(),
      fetchEconCalendar({ from: today, to: today }).catch(
        () => [] as EconEvent[],
      ),
    ]);

    stats.lastScanned = rawCandidates.length;
    stats.totalScanned += rawCandidates.length;

    if (rawCandidates.length === 0 || events.length === 0) {
      stats.lastPromoted = 0;
      return { scanned: rawCandidates.length, promoted: 0 };
    }

    let promoted = 0;
    for (const raw of rawCandidates) {
      const text = [raw.headline ?? "", raw.body ?? ""].join("\n");
      if (!containsEconPrintKeyword(text)) continue;

      const ts = raw.published_at ? new Date(raw.published_at) : new Date();
      const window = isInActiveWatchWindow(ts, events, filters);
      if (!window) continue;

      // Prefer explicit event match from text keywords (e.g. "CPI"); otherwise
      // fall back to the window event (nearest in time).
      const matchedEvent = matchTweetToEvent(text, events) ?? window.event;
      const matchedCategory = matchedEvent.category || window.category;
      const matchedCountry = (
        matchedEvent.country || window.country
      ).toUpperCase();
      const keyword = /\bactual\b/i.test(text) ? "actual" : "forecast";

      const ok = await promoteToFeed(raw, {
        event: matchedEvent,
        country: matchedCountry,
        category: matchedCategory,
        keyword,
      });
      if (ok) promoted++;
    }

    stats.lastPromoted = promoted;
    stats.totalPromoted += promoted;
    stats.lastError = null;
    return { scanned: rawCandidates.length, promoted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.lastError = msg;
    log.error("runEconKeywordSweep threw", { error: msg });
    return { scanned: 0, promoted: 0 };
  }
}
