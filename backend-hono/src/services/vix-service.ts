// [claude-code 2026-04-18] C1: unified VIX_FALLBACK=18 (5-yr median); used here + in riskflow handlers
// [claude-code 2026-03-24] VIX velocity tracking, regime detection, trigger callback system; spike threshold lowered to 2.5%
// [claude-code 2026-03-14] VIX via Yahoo Finance — 60s polling, no API key needed
/**
 * VIX Service
 * Real-time VIX fetching with caching, spike detection, velocity tracking,
 * regime detection, and trigger callback system.
 * Source: Yahoo Finance (no API key required)
 */

/**
 * VIX fallback when live fetch fails AND there is no cached reading.
 * 18 is the ~5-year median — neutral enough to avoid over- or under-scoring
 * on cold-start. Same constant used by `routes/riskflow/handlers.ts` so
 * score-path and serve-path agree on the same number.
 */
export const VIX_FALLBACK = 18;

export interface VIXData {
  level: number;
  previousLevel: number;
  timestamp: Date;
  percentChange: number;
  isSpike: boolean;
  spikeDirection: "up" | "down" | "none";
  staleMinutes: number;
}

export interface VIXVelocity {
  pointsPerMinute: number;
  sustained: boolean; // >0.2pt/min for 3+ consecutive readings
  regime: "low" | "normal" | "elevated" | "crisis";
  previousRegime: "low" | "normal" | "elevated" | "crisis";
  regimeChanged: boolean;
}

export interface VIXTrigger {
  type: "spike" | "velocity" | "regime_change";
  vixLevel: number;
  previousLevel: number;
  detail: string;
  timestamp: Date;
}

type VIXTriggerCallback = (trigger: VIXTrigger) => void;
const _triggerCallbacks: VIXTriggerCallback[] = [];

/**
 * Register a callback for VIX trigger events (spike, velocity, regime change).
 * Returns an unsubscribe function.
 */
export function onVIXTrigger(cb: VIXTriggerCallback): () => void {
  _triggerCallbacks.push(cb);
  return () => {
    const idx = _triggerCallbacks.indexOf(cb);
    if (idx >= 0) _triggerCallbacks.splice(idx, 1);
  };
}

function fireTrigger(trigger: VIXTrigger): void {
  for (const cb of _triggerCallbacks) {
    try {
      cb(trigger);
    } catch {
      /* callback errors must not crash polling */
    }
  }
}

let _previousRegime: VIXVelocity["regime"] = "normal";

interface VIXCache {
  level: number;
  previousLevel: number;
  timestamp: Date;
  fetchedAt: Date;
}

// In-memory cache
let vixCache: VIXCache | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute cache
const STALE_THRESHOLD_MS = 15 * 60_000; // 15 minutes = stale

// VIX history for spike detection (last 15 readings)
const vixHistory: { level: number; timestamp: Date }[] = [];
const MAX_HISTORY = 15;

// Background polling
let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start background VIX polling (60s interval).
 * Call once at server startup.
 */
export function startVIXPolling(): void {
  if (pollInterval) return;
  // Immediate first fetch
  fetchVIX().catch(() => {});
  pollInterval = setInterval(() => {
    fetchVIX().catch(() => {});
  }, 60_000);
  console.log("[VIX] Background polling started (60s interval)");
}

/**
 * Fetch VIX from Yahoo Finance — no API key required.
 * Extracts price from Yahoo's v8 chart API — no API key required.
 */
async function fetchFromYahoo(): Promise<number | null> {
  // Yahoo blocked intraday (1m) — fall back to daily (1d) which still works
  // Yahoo blocked 1m interval — 2m still works and meta.regularMarketPrice is real-time
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1d&interval=2m";
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) return price;
    throw new Error("Invalid Yahoo VIX price");
  } catch (err) {
    console.warn(
      "[VIX] Yahoo fetch failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetch current VIX level from Yahoo Finance, then cached/default value
 */
export async function fetchVIX(): Promise<VIXData> {
  const now = new Date();

  // Check cache first
  if (vixCache && now.getTime() - vixCache.fetchedAt.getTime() < CACHE_TTL_MS) {
    return buildVIXData(vixCache, now);
  }

  const newLevel = await fetchFromYahoo();

  if (newLevel !== null) {
    const previousLevel = vixCache?.level ?? newLevel;

    vixCache = {
      level: newLevel,
      previousLevel,
      timestamp: now,
      fetchedAt: now,
    };

    vixHistory.push({ level: newLevel, timestamp: now });
    if (vixHistory.length > MAX_HISTORY) {
      vixHistory.shift();
    }

    console.log(
      `[VIX] Fetched: ${newLevel.toFixed(2)} (prev: ${previousLevel.toFixed(2)})`,
    );
    return buildVIXData(vixCache, now);
  }

  // All sources failed
  console.error("[VIX] All sources failed");
  return getFallbackVIX(now);
}

/**
 * Build VIX data response with spike detection
 */
function buildVIXData(cache: VIXCache, now: Date): VIXData {
  const staleMinutes = Math.floor(
    (now.getTime() - cache.timestamp.getTime()) / 60000,
  );
  const percentChange =
    cache.previousLevel > 0
      ? ((cache.level - cache.previousLevel) / cache.previousLevel) * 100
      : 0;

  // Spike detection: >2.5% change in 15 minutes (lowered from 5%)
  let isSpike = false;
  let spikeDirection: "up" | "down" | "none" = "none";

  if (vixHistory.length >= 2) {
    const oldest = vixHistory[0];
    const newest = vixHistory[vixHistory.length - 1];
    const minutesElapsed =
      (newest.timestamp.getTime() - oldest.timestamp.getTime()) / 60000;

    if (minutesElapsed <= 15) {
      const historicalChange =
        ((newest.level - oldest.level) / oldest.level) * 100;
      if (Math.abs(historicalChange) > 2.5) {
        isSpike = true;
        spikeDirection = historicalChange > 0 ? "up" : "down";

        fireTrigger({
          type: "spike",
          vixLevel: newest.level,
          previousLevel: oldest.level,
          detail: `${historicalChange > 0 ? "+" : ""}${historicalChange.toFixed(1)}% in ${minutesElapsed.toFixed(0)}min`,
          timestamp: newest.timestamp,
        });
      }
    }
  }

  // Velocity + regime triggers (only when we have enough history)
  if (vixHistory.length >= 3) {
    const velocity = getVIXVelocity();
    if (velocity.sustained) {
      fireTrigger({
        type: "velocity",
        vixLevel: cache.level,
        previousLevel: cache.previousLevel,
        detail: `Sustained ${velocity.pointsPerMinute.toFixed(2)} pts/min`,
        timestamp: cache.timestamp,
      });
    }
    if (velocity.regimeChanged) {
      fireTrigger({
        type: "regime_change",
        vixLevel: cache.level,
        previousLevel: cache.previousLevel,
        detail: `${velocity.previousRegime} → ${velocity.regime}`,
        timestamp: cache.timestamp,
      });
    }
  }

  return {
    level: cache.level,
    previousLevel: cache.previousLevel,
    timestamp: cache.timestamp,
    percentChange: Number(percentChange.toFixed(2)),
    isSpike,
    spikeDirection,
    staleMinutes,
  };
}

/**
 * Get fallback VIX (last known or default)
 */
function getFallbackVIX(now: Date): VIXData {
  if (vixCache) {
    const staleMinutes = Math.floor(
      (now.getTime() - vixCache.timestamp.getTime()) / 60000,
    );
    console.warn(`[VIX] Using stale cache (${staleMinutes} min old)`);
    return buildVIXData(vixCache, now);
  }

  // Default VIX if nothing available
  console.warn(`[VIX] No cache available, using default VIX=${VIX_FALLBACK}`);
  return {
    level: VIX_FALLBACK,
    previousLevel: VIX_FALLBACK,
    timestamp: now,
    percentChange: 0,
    isSpike: false,
    spikeDirection: "none",
    staleMinutes: 0,
  };
}

/**
 * Compute VIX velocity from recent history.
 * Uses last 5 readings (≈5 min at 60s intervals).
 */
export function getVIXVelocity(): VIXVelocity {
  const regime = levelToRegime(vixCache?.level ?? 20);

  if (vixHistory.length < 2) {
    const vel: VIXVelocity = {
      pointsPerMinute: 0,
      sustained: false,
      regime,
      previousRegime: _previousRegime,
      regimeChanged: regime !== _previousRegime,
    };
    if (vel.regimeChanged) _previousRegime = regime;
    return vel;
  }

  // Take last 5 readings for velocity window
  const window = vixHistory.slice(-5);
  const first = window[0];
  const last = window[window.length - 1];
  const minutesElapsed =
    (last.timestamp.getTime() - first.timestamp.getTime()) / 60000;
  const pointsPerMinute =
    minutesElapsed > 0 ? (last.level - first.level) / minutesElapsed : 0;

  // Sustained = rate > 0.2 pts/min for 3+ consecutive readings
  let sustained = false;
  if (window.length >= 3) {
    let consecutiveCount = 0;
    for (let i = 1; i < window.length; i++) {
      const dt =
        (window[i].timestamp.getTime() - window[i - 1].timestamp.getTime()) /
        60000;
      if (dt <= 0) continue;
      const rate = Math.abs(window[i].level - window[i - 1].level) / dt;
      if (rate > 0.2) {
        consecutiveCount++;
      } else {
        consecutiveCount = 0;
      }
    }
    sustained = consecutiveCount >= 3;
  }

  const regimeChanged = regime !== _previousRegime;
  const previousRegime = _previousRegime;
  if (regimeChanged) _previousRegime = regime;

  return { pointsPerMinute, sustained, regime, previousRegime, regimeChanged };
}

function levelToRegime(level: number): VIXVelocity["regime"] {
  if (level < 15) return "low";
  if (level < 22) return "normal";
  if (level < 30) return "elevated";
  return "crisis";
}

/**
 * Get VIX spike adjustment for scoring
 * +2 if VIX spiked up >2.5% in 15 min
 * -1 if VIX dropped >2.5% in 15 min
 */
export function getVIXSpikeAdjustment(vixData: VIXData): number {
  if (!vixData.isSpike) return 0;
  return vixData.spikeDirection === "up" ? 2 : -1;
}

/**
 * Check if VIX data is stale (>15 min old)
 */
export function isVIXStale(vixData: VIXData): boolean {
  return vixData.staleMinutes > 15;
}

/**
 * Get VIX multiplier for IV scoring
 */
export function getVIXScoringMultiplier(vixLevel: number): {
  multiplier: number;
  context: string;
  tier: string;
} {
  if (vixLevel < 15) {
    return { multiplier: 0.8, context: "Low fear, choppy PA", tier: "low" };
  }
  if (vixLevel < 20) {
    return { multiplier: 1.0, context: "Neutral, base hits", tier: "neutral" };
  }
  if (vixLevel < 30) {
    return {
      multiplier: 1.2,
      context: "Elevated, trendy PA",
      tier: "elevated",
    };
  }
  return { multiplier: 1.5, context: "High fear, home runs", tier: "extreme" };
}

/**
 * Calculate no-event baseline from VIX
 * Score = VIX / 3, capped at 10
 */
export function getVIXBaseline(vixLevel: number): number {
  return Math.min(10, Math.max(0, vixLevel / 3));
}

/**
 * Clear cache (for testing)
 */
export function clearVIXCache(): void {
  vixCache = null;
  vixHistory.length = 0;
}
