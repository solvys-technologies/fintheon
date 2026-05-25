// [claude-code 2026-03-26] S2-T2: Regime CRUD handlers — get/set/history/detect
// [claude-code 2026-05-16] DEPRECATED — replaced by themes route handlers (S68-T1). Preserved for migration reference.
import type { Context } from "hono";
import { MARKET_REGIMES, type MarketRegime } from "../../types/regime.js";
import {
  getCurrentRegime,
  setRegime,
  getRegimeHistory,
  getRegimeMultipliers,
} from "../../services/regime/regime-service.js";
import {
  detectRegimeFromFeed,
  shouldProposeRegimeChange,
} from "../../services/regime/regime-detector.js";
import { getFeed } from "../../services/riskflow/feed-service.js";

// GET /api/regime/current
export async function handleGetCurrent(c: Context) {
  const state = await getCurrentRegime();
  const multipliers = getRegimeMultipliers(state.regime);
  return c.json({ ...state, multipliers });
}

// GET /api/regime/history?limit=20
export async function handleGetHistory(c: Context) {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);
  const history = await getRegimeHistory(limit);
  return c.json({ history, count: history.length });
}

// POST /api/regime/set — manual override { regime, notes }
export async function handleSetRegime(c: Context) {
  const body = await c.req
    .json<{ regime: string; notes?: string }>()
    .catch(() => null);
  if (!body?.regime) {
    return c.json({ error: "Missing regime field" }, 400);
  }

  if (!MARKET_REGIMES.includes(body.regime as MarketRegime)) {
    return c.json(
      {
        error: `Invalid regime. Must be one of: ${MARKET_REGIMES.join(", ")}`,
      },
      400,
    );
  }

  const state = await setRegime(
    body.regime as MarketRegime,
    "manual",
    1.0,
    body.notes,
  );
  const multipliers = getRegimeMultipliers(state.regime);
  return c.json({ ...state, multipliers });
}

// POST /api/regime/confidence — antilag confidence blending
export async function handleConfidence(c: Context) {
  const body = await c.req
    .json<{ instrument: string; startTime: string; endTime: string }>()
    .catch(() => null);
  if (!body?.instrument || !body?.startTime || !body?.endTime) {
    return c.json(
      { error: "Missing required fields: instrument, startTime, endTime" },
      400,
    );
  }
  try {
    const { calculateRegimeConfidence } =
      await import("../../services/market-data/iv-scorer.js");
    const result = await calculateRegimeConfidence({
      instrument: body.instrument,
      startTime: body.startTime,
      endTime: body.endTime,
    });
    return c.json(result);
  } catch (err: any) {
    console.error("[regime] confidence error:", err.message);
    return c.json(
      { error: err.message ?? "Failed to calculate regime confidence" },
      500,
    );
  }
}

// POST /api/regime/detect — triggers detection, returns signal (does NOT auto-apply)
export async function handleDetect(c: Context) {
  const feedResponse = await getFeed("system", { limit: 50 });
  const current = await getCurrentRegime();
  const signal = detectRegimeFromFeed(feedResponse.items);

  if (!signal) {
    return c.json({
      signal: null,
      currentRegime: current.regime,
      message: "No strong regime signal detected from current feed",
    });
  }

  const shouldChange = shouldProposeRegimeChange(current.regime, signal);

  return c.json({
    signal,
    currentRegime: current.regime,
    shouldChange,
    message: shouldChange
      ? `Regime change proposed: ${current.regime} → ${signal.proposedRegime} (confidence: ${signal.confidence.toFixed(2)})`
      : `Signal detected (${signal.proposedRegime}) but not strong enough to change from ${current.regime}`,
  });
}
