// [claude-code 2026-04-23] S32-T7: Autopilot guardian — non-psych supervisor.
// Pauses the autopilot scheduler on drawdown, stop violations, or size caps.
// Runs regardless of PsychAssist (no tilt signal — only mechanical risk).

import { getSupabaseClient } from "../../config/supabase.js";
import {
  setAutopilotEnabled,
  isAutopilotEnabled,
} from "./autopilot-scheduler.js";

export type GuardianStatus = "active" | "paused" | "disabled";
export type GuardianReason =
  | "drawdown"
  | "stop_violation"
  | "position_size_cap"
  | "manual"
  | null;

export interface GuardianThresholds {
  drawdownPctCap: number;
  positionNotionalCap: number;
  stopLossToleranceMin: number;
}

export const DEFAULT_GUARDIAN_THRESHOLDS: GuardianThresholds = {
  drawdownPctCap: 3,
  positionNotionalCap: 100_000,
  stopLossToleranceMin: 5,
};

const COOLDOWN_MS = 10 * 60 * 1000;

interface GuardianState {
  pausedAt: number | null;
  reason: GuardianReason;
  detail: string | null;
}

const state: GuardianState = {
  pausedAt: null,
  reason: null,
  detail: null,
};

function msUntilResume(): number {
  if (!state.pausedAt) return 0;
  const elapsed = Date.now() - state.pausedAt;
  return Math.max(0, COOLDOWN_MS - elapsed);
}

export function getGuardianStatus(): {
  status: GuardianStatus;
  reason: GuardianReason;
  resumesAt: string | null;
  detail: string | null;
} {
  if (!isAutopilotEnabled() && state.pausedAt) {
    const resumesAt = new Date(state.pausedAt + COOLDOWN_MS).toISOString();
    return {
      status: "paused",
      reason: state.reason,
      resumesAt,
      detail: state.detail,
    };
  }
  if (!isAutopilotEnabled()) {
    return {
      status: "disabled",
      reason: state.reason,
      resumesAt: null,
      detail: state.detail,
    };
  }
  return { status: "active", reason: null, resumesAt: null, detail: null };
}

export function pauseAutopilot(reason: GuardianReason, detail: string): void {
  if (state.pausedAt && msUntilResume() > 0) return;
  state.pausedAt = Date.now();
  state.reason = reason;
  state.detail = detail;
  setAutopilotEnabled(false);
  console.warn(`[Guardian] Paused autopilot — ${reason}: ${detail}`);
}

export function resumeAutopilot(origin: "auto" | "manual"): boolean {
  if (origin === "auto" && msUntilResume() > 0) return false;
  state.pausedAt = null;
  state.reason = null;
  state.detail = null;
  setAutopilotEnabled(true);
  console.log(`[Guardian] Resumed autopilot (${origin})`);
  return true;
}

export async function loadThresholds(
  userId: string,
): Promise<GuardianThresholds> {
  const sb = getSupabaseClient();
  if (!sb || !userId) return DEFAULT_GUARDIAN_THRESHOLDS;
  try {
    const { data } = await sb
      .from("user_preferences")
      .select("prefs")
      .eq("user_id", userId)
      .maybeSingle();
    const prefs = (data?.prefs ?? {}) as Record<string, unknown>;
    const override = prefs.autopilotGuardian as
      | Partial<GuardianThresholds>
      | undefined;
    return {
      ...DEFAULT_GUARDIAN_THRESHOLDS,
      ...(override ?? {}),
    };
  } catch {
    return DEFAULT_GUARDIAN_THRESHOLDS;
  }
}

export interface PreOrderCheck {
  order: {
    userId: string;
    notional: number;
  };
}

export interface PreOrderResult {
  allow: boolean;
  reason?: GuardianReason;
  detail?: string;
}

export async function preOrderCheck(
  ctx: PreOrderCheck,
): Promise<PreOrderResult> {
  const thresholds = await loadThresholds(ctx.order.userId);
  if (ctx.order.notional > thresholds.positionNotionalCap) {
    const detail = `notional ${ctx.order.notional} > cap ${thresholds.positionNotionalCap}`;
    pauseAutopilot("position_size_cap", detail);
    return { allow: false, reason: "position_size_cap", detail };
  }
  return { allow: true };
}

export interface PostFillSample {
  userId: string;
  sessionHighWaterMark: number;
  currentEquity: number;
  openPositions: Array<{
    stopPrice: number | null;
    lastPrice: number;
    side: "long" | "short";
    minutesSinceStopBreach: number | null;
  }>;
}

export async function postFillCheck(sample: PostFillSample): Promise<void> {
  const thresholds = await loadThresholds(sample.userId);

  if (sample.sessionHighWaterMark > 0) {
    const drawdownPct =
      ((sample.sessionHighWaterMark - sample.currentEquity) /
        sample.sessionHighWaterMark) *
      100;
    if (drawdownPct >= thresholds.drawdownPctCap) {
      pauseAutopilot(
        "drawdown",
        `drawdown ${drawdownPct.toFixed(2)}% >= cap ${thresholds.drawdownPctCap}%`,
      );
      return;
    }
  }

  for (const pos of sample.openPositions) {
    if (pos.stopPrice == null) continue;
    if (pos.minutesSinceStopBreach == null) continue;
    if (pos.minutesSinceStopBreach >= thresholds.stopLossToleranceMin) {
      const breached =
        pos.side === "long"
          ? pos.lastPrice < pos.stopPrice
          : pos.lastPrice > pos.stopPrice;
      if (breached) {
        pauseAutopilot(
          "stop_violation",
          `stop ${pos.stopPrice} breached for ${pos.minutesSinceStopBreach}min without exit`,
        );
        return;
      }
    }
  }
}

export function cooldownTick(): void {
  if (!state.pausedAt) return;
  if (msUntilResume() === 0) {
    resumeAutopilot("auto");
  }
}
