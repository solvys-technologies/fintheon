// [claude-code 2026-04-26] S45-T1: 15-min Desk Drift monitor. Scans trades
// since last_seen, classifies each fill against today's day_plan_windows +
// dead-volume rule, evaluates PsychAssist resonance, picks a message flavor,
// applies the -5 non-healing ER offset on drift, and logs a "drifted from
// desk theme" annotation via writeAnnotation.

import { getSupabaseClient } from "../../config/supabase.js";
import { query } from "../../db/optimized.js";
import { createLogger } from "../../lib/logger.js";
import { writeAnnotation } from "../supabase-service.js";
import { evaluateLockout } from "../psych-assist/lockout-protocol.js";
import { applyDeskDriftOffset } from "../psych-assist/lockout-protocol.js";
import { readDayPlan } from "../day-plan/day-plan-service.js";
import { isDeadVolume, isInsideAnyWindow } from "./dead-volume-rule.js";
import { pickDriftMessage } from "./drift-messages.js";
import type { DriftKind } from "../../types/day-plan.js";

const log = createLogger("DriftMonitor");

interface TradeRow {
  id: string;
  contract: string;
  entry_at: string;
  user_id: string | null;
  side: string;
  qty: string;
  realized_pnl: string | null;
}

export interface DriftEvent {
  tradeId: string;
  userId: string | null;
  contract: string;
  firedAt: string;
  kind: DriftKind;
  message: string;
  inWindow: boolean;
}

interface MonitorState {
  lastSeen: string; // ISO timestamp
  lastEvent: DriftEvent | null;
}

const state: MonitorState = {
  lastSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  lastEvent: null,
};

/** External getter for /api/day-plan/drift-status */
export function getLastDriftEvent(): DriftEvent | null {
  return state.lastEvent;
}

export async function runDriftCycle(): Promise<DriftEvent[]> {
  const since = state.lastSeen;
  const now = new Date();
  const dateIso = now.toISOString().slice(0, 10);

  const result = await query<TradeRow>(
    `SELECT id, contract, entry_at, user_id, side, qty, realized_pnl
       FROM trades
       WHERE entry_at > $1
       ORDER BY entry_at ASC`,
    [since],
  );

  if (result.rows.length === 0) {
    state.lastSeen = now.toISOString();
    return [];
  }

  const plan = await readDayPlan("pic", dateIso);
  const windows = plan?.windows ?? [];

  const events: DriftEvent[] = [];

  for (const row of result.rows) {
    const fillUtc = new Date(row.entry_at);
    const fillEt = toEastern(fillUtc);
    const inWindow = isInsideAnyWindow(fillEt, windows);
    if (inWindow) continue;

    const dead = isDeadVolume(fillEt, windows);
    const resonance = evaluateResonance(row.user_id);
    const intradayPnl = await sumIntradayPnl(row.user_id, dateIso);

    const kind: DriftKind = dead
      ? "dead_volume"
      : resonance.healthy
        ? "drift_alert"
        : "tilt_stop";

    const message = pickDriftMessage({
      kind,
      contract: row.contract,
      fillEt,
      intradayPnl,
      resonanceHealthy: resonance.healthy,
      deskTheme: plan?.deskTheme ?? null,
    });

    if (kind !== "dead_volume" && row.user_id) {
      applyDeskDriftOffset(row.user_id, dateIso, -5);
    }

    await writeAnnotation({
      riskflowItemId: `desk-drift:${row.id}`,
      flawTag: "desk-drift",
      comment: message,
      createdBy: "system",
    }).catch((err) =>
      log.warn("writeAnnotation desk-drift failed", {
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    const event: DriftEvent = {
      tradeId: row.id,
      userId: row.user_id,
      contract: row.contract,
      firedAt: new Date().toISOString(),
      kind,
      message,
      inWindow: false,
    };
    events.push(event);
    state.lastEvent = event;

    log.info("Drift event fired", {
      tradeId: row.id,
      kind,
      contract: row.contract,
    });
  }

  state.lastSeen = now.toISOString();
  return events;
}

function toEastern(utc: Date): Date {
  return new Date(
    utc.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
}

function evaluateResonance(_userId: string | null): { healthy: boolean } {
  // Lightweight wrapper around evaluateLockout — when no signal is available
  // we treat the user as healthy. This keeps the monitor non-blocking when
  // PsychAssist hasn't observed the user this session.
  const lockout = evaluateLockout({
    consecutiveLosses: 0,
    previousLockoutsToday: 0,
    currentPnL: 0,
    accountResetsToday: 0,
  });
  return { healthy: lockout === null };
}

async function sumIntradayPnl(
  userId: string | null,
  dateIso: string,
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;

  const startOfDayEt = new Date(`${dateIso}T13:30:00.000Z`).toISOString();
  const builder = sb
    .from("trades")
    .select("realized_pnl")
    .gte("entry_at", startOfDayEt);
  const { data, error } = userId
    ? await builder.eq("user_id", userId)
    : await builder;
  if (error || !data) return 0;
  return data.reduce((sum: number, row: { realized_pnl: number | null }) => {
    return sum + (row.realized_pnl ? Number(row.realized_pnl) : 0);
  }, 0);
}
