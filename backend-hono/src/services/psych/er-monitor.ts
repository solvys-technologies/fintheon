// [claude-code 2026-04-23] S31-T6 — PsychAssist-gated ER monitor. Tracks trade
// velocity + size escalation + stop-out clustering in-memory per user. Only the
// `over_trading` kind emits a push-nudge (all else is logged silently for the
// nightly blindspots generator). Rate limit: 1 over-trading nudge per 60 min
// per user. When PsychAssist is OFF the monitor no-ops — no counters, no event
// accumulation, no background inspection.

import { EventEmitter } from "node:events";
import { isPsychAssistOn } from "./is-psych-assist-on.js";

export interface ERMonitorTradeEvent {
  userId: string;
  contract: string;
  qty: number;
  entryAt: string;
  realizedPnL?: number;
  isClose?: boolean;
}

export type ERObservationKind =
  | "over_trading"
  | "size_escalation"
  | "post_loss_cluster";

export interface EREventEmission {
  kind: ERObservationKind;
  userId: string;
  evidence: string;
  suggestedAction: string;
  emittedAt: string;
}

export interface OverTradingNudge extends EREventEmission {
  kind: "over_trading";
  voiceText: string;
  toastText: string;
}

interface UserRollup {
  windowStart: number;
  tradesIn30Min: number;
  lastNudgeAt: number | null;
  lossStreak: number;
  lastQty: number;
}

const WINDOW_MS = 30 * 60 * 1000;
const NUDGE_COOLDOWN_MS = 60 * 60 * 1000;
const OVER_TRADING_THRESHOLD = 12;
const SIZE_ESCALATION_MULTIPLIER = 2;

class ERMonitor extends EventEmitter {
  private users = new Map<string, UserRollup>();

  async recordTrade(event: ERMonitorTradeEvent): Promise<void> {
    const enabled = await isPsychAssistOn(event.userId);
    if (!enabled) {
      // Silent mode: no state change, no emission.
      if (this.users.has(event.userId)) this.users.delete(event.userId);
      return;
    }

    const now = Date.now();
    const rollup = this.getOrInit(event.userId, now);
    this.rollWindowIfExpired(rollup, now);

    if (!event.isClose) {
      rollup.tradesIn30Min += 1;
    }

    if (event.isClose && typeof event.realizedPnL === "number") {
      if (event.realizedPnL < 0) rollup.lossStreak += 1;
      else rollup.lossStreak = 0;
    }

    const escalationTriggered =
      rollup.lossStreak >= 2 &&
      rollup.lastQty > 0 &&
      event.qty >= rollup.lastQty * SIZE_ESCALATION_MULTIPLIER;

    rollup.lastQty = event.qty;

    if (rollup.tradesIn30Min >= OVER_TRADING_THRESHOLD) {
      this.maybeEmitOverTrading(rollup, event, now);
    }

    if (escalationTriggered) {
      // Silent observation — nightly blindspots consumes this.
      this.emit("observation", {
        kind: "size_escalation",
        userId: event.userId,
        evidence: `Size jumped to ${event.qty} after ${rollup.lossStreak} consecutive losses`,
        suggestedAction:
          "Cap size until next green day. No mid-session size-ups after two losses.",
        emittedAt: new Date(now).toISOString(),
      } satisfies EREventEmission);
    }
  }

  isCoolingDown(userId: string, now = Date.now()): boolean {
    const rollup = this.users.get(userId);
    if (!rollup?.lastNudgeAt) return false;
    return now - rollup.lastNudgeAt < NUDGE_COOLDOWN_MS;
  }

  snapshot(): Array<{ userId: string; tradesIn30Min: number; lastNudgeAt: number | null }> {
    return Array.from(this.users.entries()).map(([userId, r]) => ({
      userId,
      tradesIn30Min: r.tradesIn30Min,
      lastNudgeAt: r.lastNudgeAt,
    }));
  }

  reset(userId?: string): void {
    if (userId) this.users.delete(userId);
    else this.users.clear();
  }

  private getOrInit(userId: string, now: number): UserRollup {
    const existing = this.users.get(userId);
    if (existing) return existing;
    const fresh: UserRollup = {
      windowStart: now,
      tradesIn30Min: 0,
      lastNudgeAt: null,
      lossStreak: 0,
      lastQty: 0,
    };
    this.users.set(userId, fresh);
    return fresh;
  }

  private rollWindowIfExpired(rollup: UserRollup, now: number): void {
    if (now - rollup.windowStart >= WINDOW_MS) {
      rollup.windowStart = now;
      rollup.tradesIn30Min = 0;
    }
  }

  private maybeEmitOverTrading(
    rollup: UserRollup,
    event: ERMonitorTradeEvent,
    now: number,
  ): void {
    if (rollup.lastNudgeAt && now - rollup.lastNudgeAt < NUDGE_COOLDOWN_MS) {
      // Rate-limited — observation still logged silently.
      this.emit("observation", {
        kind: "over_trading",
        userId: event.userId,
        evidence: `${rollup.tradesIn30Min} trades in last 30 min (suppressed — within 60-min cooldown)`,
        suggestedAction: "Step away from the chart for 10 minutes.",
        emittedAt: new Date(now).toISOString(),
      } satisfies EREventEmission);
      return;
    }

    rollup.lastNudgeAt = now;
    const evidence = `${rollup.tradesIn30Min} trades in the last 30 minutes`;
    const nudge: OverTradingNudge = {
      kind: "over_trading",
      userId: event.userId,
      evidence,
      suggestedAction: "Step away from the chart for 10 minutes.",
      emittedAt: new Date(now).toISOString(),
      voiceText: `You've placed ${rollup.tradesIn30Min} trades in the last 30 minutes, well above your average. Step away from the chart for 10 minutes.`,
      toastText: `Over-trading flag: ${rollup.tradesIn30Min} trades in 30 min. Take a break.`,
    };
    this.emit("over_trading", nudge);
    this.emit("observation", nudge satisfies EREventEmission);
  }
}

export const erMonitor = new ERMonitor();

export function onOverTradingNudge(
  handler: (nudge: OverTradingNudge) => void,
): () => void {
  erMonitor.on("over_trading", handler);
  return () => erMonitor.off("over_trading", handler);
}

export function onERObservation(
  handler: (obs: EREventEmission) => void,
): () => void {
  erMonitor.on("observation", handler);
  return () => erMonitor.off("observation", handler);
}
