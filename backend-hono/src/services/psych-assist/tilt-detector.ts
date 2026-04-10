// [claude-code 2026-03-22] Source of Truth fusion — tilt detection engine

/**
 * Tilt Detection Engine
 * Detects psychological risk signals based on the Source of Truth:
 * - Fast losses + account resets
 * - Skipped morning routine
 * - Funded creep (eval aggression in funded accounts)
 * - Hot hand (48h window after $5K+ win)
 * - Loss streak count
 */

export type TiltSignalType =
  | "fast_losses"
  | "skipped_routine"
  | "funded_creep"
  | "hot_hand"
  | "loss_streak"
  | "post_circuit_breaker";

export interface TiltSignal {
  type: TiltSignalType;
  severity: "warning" | "critical";
  message: string;
  commandmentRef?: number;
}

export interface TradeStats {
  avgPositionSize: number;
  avgHoldTime: number;
  entryFrequency: number; // entries per hour
  winRate: number;
}

export interface TiltDetectorContext {
  /** Number of account resets today */
  accountResetsToday: number;
  /** Whether morning routine has been completed */
  morningRoutineDone: boolean;
  /** Recent trading stats on eval accounts */
  evalBehavior?: TradeStats;
  /** Recent trading stats on funded accounts */
  fundedBehavior?: TradeStats;
  /** Timestamp of last $5K+ win (ISO string or null) */
  lastBigWin: string | null;
  /** Number of consecutive losses this session */
  consecutiveLosses: number;
  /** Current daily P&L in dollars */
  currentPnL: number;
}

/**
 * Detect tilt signals from current trading context
 */
export function detectTiltSignals(context: TiltDetectorContext): TiltSignal[] {
  const signals: TiltSignal[] = [];

  // Fast losses + account resets
  if (context.accountResetsToday >= 3) {
    signals.push({
      type: "fast_losses",
      severity: "critical",
      message: `${context.accountResetsToday} account resets today. $${context.accountResetsToday * 120}+ in reset fees. Stop the bleeding.`,
      commandmentRef: 1,
    });
  } else if (context.accountResetsToday >= 1) {
    signals.push({
      type: "fast_losses",
      severity: "warning",
      message: `${context.accountResetsToday} account reset(s) today. Monitor for funded creep pattern.`,
      commandmentRef: 6,
    });
  }

  // Skipped morning routine
  if (!context.morningRoutineDone) {
    signals.push({
      type: "skipped_routine",
      severity: "critical",
      message:
        "Morning routine not completed. The routine IS the edge. No routine, no trades.",
      commandmentRef: 14,
    });
  }

  // Funded creep detection
  if (context.evalBehavior && context.fundedBehavior) {
    const sizeRatio =
      context.fundedBehavior.avgPositionSize /
      (context.evalBehavior.avgPositionSize || 1);
    const freqRatio =
      context.fundedBehavior.entryFrequency /
      (context.evalBehavior.entryFrequency || 1);

    // If funded behavior matches eval aggression (within 20%), flag it
    if (sizeRatio > 0.8 && freqRatio > 0.8) {
      signals.push({
        type: "funded_creep",
        severity: "warning",
        message:
          "Funded creep detected: position sizing and entry frequency match eval-mode aggression. Scale back to funded-account discipline.",
        commandmentRef: 7,
      });
    }
  }

  // Hot hand — 48h window after $5K+ win
  if (context.lastBigWin) {
    const winTime = new Date(context.lastBigWin).getTime();
    const now = Date.now();
    const hoursSince = (now - winTime) / (1000 * 60 * 60);

    if (hoursSince <= 48) {
      signals.push({
        type: "hot_hand",
        severity: "warning",
        message: `Hot hand flag active (${Math.round(48 - hoursSince)}h remaining). Remember BOJ: $20K win, gave back half next day. Verify thesis quality and enforce standard sizing.`,
        commandmentRef: 4,
      });
    }
  }

  // Loss streak
  if (context.consecutiveLosses >= 5) {
    signals.push({
      type: "loss_streak",
      severity: "critical",
      message: `${context.consecutiveLosses} consecutive losses. Hard lockout recommended. There is always another trade.`,
      commandmentRef: 13,
    });
  } else if (context.consecutiveLosses >= 3) {
    signals.push({
      type: "loss_streak",
      severity: "warning",
      message: `${context.consecutiveLosses} consecutive losses. Soft lockout recommended. Never make back losses the same way.`,
      commandmentRef: 6,
    });
  }

  return signals;
}

/**
 * Get overall tilt risk score (0-10) from detected signals
 */
export function computeTiltRisk(signals: TiltSignal[]): number {
  let score = 0;
  for (const signal of signals) {
    score += signal.severity === "critical" ? 3 : 1;
  }
  return Math.min(10, score);
}
