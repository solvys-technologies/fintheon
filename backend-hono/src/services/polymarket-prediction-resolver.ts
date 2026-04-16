// [claude-code 2026-04-16] Added PREDICTION_RESOLVER_VIA_ROUTINE env flag — disables backend resolver when Routine active
// [claude-code 2026-04-12] S15-T3: Resolve Polymarket predictions when markets close

import { createPolymarketService } from "./polymarket-service.js";
import { getSupabaseClient } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("PredictionResolver");
const RESOLVE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function resolveClosedPredictions(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { data: pending } = await sb
    .from("polymarket_predictions")
    .select("id, market_id, predicted_outcome")
    .eq("resolved", false)
    .limit(50);

  if (!pending || pending.length === 0) return;

  const polyService = createPolymarketService();
  let resolved = 0;

  for (const pred of pending) {
    try {
      const market = await polyService.getMarketBySlug(pred.market_id);
      if (!market) continue;
      if (market.status !== "closed") continue;

      // Determine actual outcome: yesPrice >= 0.95 → YES won, <= 0.05 → NO won
      let actualOutcome: string | null = null;
      if (market.yesPrice >= 0.95) actualOutcome = "Yes";
      else if (market.yesPrice <= 0.05) actualOutcome = "No";
      else continue; // Not yet settled

      const isWin =
        pred.predicted_outcome.toLowerCase() === actualOutcome.toLowerCase();

      await sb
        .from("polymarket_predictions")
        .update({
          resolved: true,
          actual_outcome: actualOutcome,
          result: isWin ? "win" : "loss",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", pred.id);

      resolved++;
    } catch (err) {
      log.warn(`Failed to resolve prediction ${pred.id}`, {
        error: String(err),
      });
    }
  }

  if (resolved > 0) {
    log.info(`Resolved ${resolved} predictions`);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startPredictionResolver(): void {
  if (process.env.PREDICTION_RESOLVER_VIA_ROUTINE === "true") {
    log.info(
      "Prediction resolver handled by Claude Code Routine (PREDICTION_RESOLVER_VIA_ROUTINE=true) — backend resolver disabled",
    );
    return;
  }

  log.info("Starting prediction resolver (1h interval)");
  setTimeout(() => resolveClosedPredictions(), 60_000);
  intervalId = setInterval(resolveClosedPredictions, RESOLVE_INTERVAL_MS);
}

export function stopPredictionResolver(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
