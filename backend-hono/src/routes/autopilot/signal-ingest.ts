// [claude-code 2026-03-11] Signal ingest handler — receives signals from QuantConnect, TradingView, or manual trigger

/**
 * Signal Ingest Handler
 * Receives signals from QuantConnect, TradingView, or manual trigger
 */

import type { Context } from "hono";
import {
  processSignal,
  getRecentSignals,
} from "../../services/autopilot/signal-processor.js";
import {
  getAutopilotStatus,
  isAutopilotEnabled,
} from "../../services/autopilot/autopilot-scheduler.js";
import type { SignalEvent } from "../../types/agents.js";

/**
 * POST /api/autopilot/signal-ingest
 * Receives a signal event and routes through fast or full path
 */
export async function handleSignalIngest(c: Context) {
  try {
    const body = (await c.req.json()) as SignalEvent;

    // Validate required fields
    if (
      !body.source ||
      !body.strategy ||
      !body.direction ||
      !body.instrument ||
      !body.confidence ||
      !body.entryPrice ||
      !body.stopLoss
    ) {
      return c.json(
        {
          error:
            "Missing required fields: source, strategy, direction, instrument, confidence, entryPrice, stopLoss",
        },
        400,
      );
    }

    if (!isAutopilotEnabled()) {
      return c.json({
        received: true,
        processed: false,
        reason: "Autopilot is disabled",
      });
    }

    const userId = (c.get("userId") as string | undefined) ?? "system";
    const result = await processSignal(body, userId);

    return c.json({
      received: true,
      processed: true,
      ...result,
    });
  } catch (error) {
    console.error("[AutoPilot] Signal ingest error:", error);
    return c.json({ error: "Failed to process signal" }, 500);
  }
}

/**
 * GET /api/autopilot/signals
 * Returns recent signal log
 */
export async function handleGetSignals(c: Context) {
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const signals = getRecentSignals(limit);
  return c.json({ signals, total: signals.length });
}

/**
 * GET /api/autopilot/status
 * Returns autopilot scheduler status
 */
export async function handleAutopilotStatus(c: Context) {
  return c.json(getAutopilotStatus());
}
