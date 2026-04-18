// [claude-code 2026-04-19] S24-T3: Regime decision outcome tagger.
// 4h and 24h after each regime_proposals.decided_at, snapshots SPY and writes
// market_4h / market_24h / delta_*_pct into regime_decision_outcomes.
// T4 admin UI surfaces "your GEO_TENSIONS overrides were right 80%" from this data.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("OutcomeTagger");

const FOUR_HOURS_MS = 4 * 3600_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3600_000;
const CHECK_INTERVAL_MS = 5 * 60_000; // sweep every 5 min

let sweepTimer: ReturnType<typeof setInterval> | null = null;

/** Boot entry: start the periodic sweep that snapshots SPY at 4h and 24h marks. */
export function startOutcomeTagger(): void {
  if (sweepTimer) return;
  log.info("Outcome tagger started (5 min sweep)");
  sweepTimer = setInterval(() => {
    sweepDueOutcomes().catch((err) =>
      log.warn("sweepDueOutcomes failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }, CHECK_INTERVAL_MS);
  sweepTimer.unref?.();
}

export function stopOutcomeTagger(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
    log.info("Outcome tagger stopped");
  }
}

/**
 * Called when a regime_proposals row is decided (approved or denied).
 * Records the baseline SPY price; sweep handles the delayed snapshots.
 */
export async function recordOutcomeBaseline(
  proposalId: string,
  approved: boolean,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const spy = await fetchSPYSpot();
  if (spy === null) {
    log.warn("Skipping baseline — SPY unavailable", { proposalId });
    return;
  }

  const { error } = await sb.from("regime_decision_outcomes").insert({
    regime_proposal_id: proposalId,
    approved,
    market_at_decision: spy,
  });
  if (error) {
    if (error.code === "42P01") return; // table missing — silent during T1 transition
    log.warn("Failed to record outcome baseline", {
      proposalId,
      error: error.message,
    });
  }
}

/** Sweep: find rows missing 4h or 24h snapshots whose deadline has passed. */
export async function sweepDueOutcomes(): Promise<{
  tagged4h: number;
  tagged24h: number;
}> {
  const sb = getSupabaseClient();
  if (!sb) return { tagged4h: 0, tagged24h: 0 };

  const now = Date.now();
  const cutoff4h = new Date(now - FOUR_HOURS_MS).toISOString();
  const cutoff24h = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();
  const lookback = new Date(now - 7 * 24 * 3600_000).toISOString();

  const { data, error } = await sb
    .from("regime_decision_outcomes")
    .select(
      "id, regime_proposal_id, market_at_decision, market_4h, market_24h, created_at",
    )
    .gte("created_at", lookback)
    .or("market_4h.is.null,market_24h.is.null")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    if (error.code === "42P01") return { tagged4h: 0, tagged24h: 0 };
    log.warn("sweepDueOutcomes select failed", { error: error.message });
    return { tagged4h: 0, tagged24h: 0 };
  }

  if (!data || data.length === 0) return { tagged4h: 0, tagged24h: 0 };

  let tagged4h = 0;
  let tagged24h = 0;
  let cachedSpy: number | null = null;

  for (const row of data) {
    const baseline = Number(row.market_at_decision);
    const createdAt = new Date(row.created_at as string).toISOString();
    if (!Number.isFinite(baseline) || baseline <= 0) continue;

    const updates: Record<string, number> = {};
    if (row.market_4h === null && createdAt <= cutoff4h) {
      cachedSpy = cachedSpy ?? (await fetchSPYSpot());
      if (cachedSpy !== null) {
        updates.market_4h = cachedSpy;
        updates.delta_4h_pct = pctDelta(baseline, cachedSpy);
        tagged4h++;
      }
    }
    if (row.market_24h === null && createdAt <= cutoff24h) {
      cachedSpy = cachedSpy ?? (await fetchSPYSpot());
      if (cachedSpy !== null) {
        updates.market_24h = cachedSpy;
        updates.delta_24h_pct = pctDelta(baseline, cachedSpy);
        tagged24h++;
      }
    }
    if (Object.keys(updates).length === 0) continue;

    const { error: updateError } = await sb
      .from("regime_decision_outcomes")
      .update(updates)
      .eq("id", row.id);
    if (updateError) {
      log.warn("Failed to update outcome row", {
        id: row.id,
        error: updateError.message,
      });
    }
  }

  if (tagged4h > 0 || tagged24h > 0) {
    log.info("Outcome sweep tagged", { tagged4h, tagged24h });
  }
  return { tagged4h, tagged24h };
}

function pctDelta(baseline: number, current: number): number {
  return Number((((current - baseline) / baseline) * 100).toFixed(3));
}

let spyCache: { price: number; fetchedAt: number } | null = null;
const SPY_CACHE_TTL_MS = 60_000;

/** Fetch SPY from Yahoo Finance (mirrors VIX fetch helper). Caches 60s. */
export async function fetchSPYSpot(): Promise<number | null> {
  if (spyCache && Date.now() - spyCache.fetchedAt < SPY_CACHE_TTL_MS) {
    return spyCache.price;
  }
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1d&interval=2m";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) {
      spyCache = { price, fetchedAt: Date.now() };
      return price;
    }
    return null;
  } catch (err) {
    log.warn("Yahoo SPY fetch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
