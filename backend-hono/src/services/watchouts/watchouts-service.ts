// [claude-code 2026-04-23] S32-T7: Watchouts logger — silent observations surfaced
// on the Performance tab. Never emits voice, toast, or nudge.

import { getSupabaseClient } from "../../config/supabase.js";
import { readEconEvents } from "../supabase-service.js";

export type WatchoutKind = "calendar_proximity" | "strategy_drift_observation";

export interface WatchoutRow {
  id: string;
  user_id: string;
  ts: string;
  kind: WatchoutKind;
  detail: string;
  resolved_at: string | null;
}

async function insertWatchout(
  userId: string,
  kind: WatchoutKind,
  detail: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb || !userId) return;
  try {
    await sb.from("watchouts").insert({ user_id: userId, kind, detail });
  } catch (err) {
    console.warn("[watchouts] insert failed (non-fatal):", err);
  }
}

export async function logCalendarProximityIfNear(opts: {
  userId: string;
  tradeAt: Date;
  withinMinutes?: number;
}): Promise<void> {
  const within = opts.withinMinutes ?? 5;
  const date = opts.tradeAt.toISOString().slice(0, 10);
  const events = await readEconEvents({ from: date, to: date });

  const ms = opts.tradeAt.getTime();
  for (const evt of events) {
    if (evt.impact !== "high") continue;
    if (!evt.date || !evt.time) continue;
    const when = new Date(`${evt.date}T${evt.time.slice(0, 5)}:00`);
    if (!Number.isFinite(when.getTime())) continue;
    const diffMin = Math.abs(ms - when.getTime()) / 60_000;
    if (diffMin <= within) {
      await insertWatchout(
        opts.userId,
        "calendar_proximity",
        `Trade fired ${Math.round(diffMin)}min from ${evt.name} (high-impact)`,
      );
      return;
    }
  }
}

export interface StrategyDriftSignal {
  userId: string;
  strategyName: string;
  deviation: string;
}

export async function logStrategyDrift(
  signal: StrategyDriftSignal,
): Promise<void> {
  if (!signal.deviation) return;
  await insertWatchout(
    signal.userId,
    "strategy_drift_observation",
    `${signal.strategyName} drift — ${signal.deviation}`,
  );
}

export async function listWatchouts(
  userId: string,
  fromIso?: string,
): Promise<WatchoutRow[]> {
  const sb = getSupabaseClient();
  if (!sb || !userId) return [];
  try {
    let query = sb
      .from("watchouts")
      .select("*")
      .eq("user_id", userId)
      .order("ts", { ascending: false })
      .limit(50);
    if (fromIso) query = query.gte("ts", fromIso);
    const { data } = await query;
    return (data ?? []) as WatchoutRow[];
  } catch {
    return [];
  }
}
