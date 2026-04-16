// [claude-code 2026-04-16] S20-T9: Split from iv-scoring-v2.ts — session, VIX, decay, stacking, edge cases
// [claude-code 2026-04-16] Main scoring function extracted to ticker.ts, taxonomy to taxonomy.ts

import { classifyVixRegime } from "../../types/volatility-taxonomy.js";
import {
  type SessionInfo,
  SESSIONS,
  VIX_MULTIPLIERS,
  DECAY_HALF_LIVES,
  getIVScoringConfig,
} from "./config.js";
import { getVolatilityProfile } from "./taxonomy.js";

// ============================================================================
// SESSION HELPERS
// ============================================================================

export function getCurrentSession(date: Date = new Date()): SessionInfo {
  const etHour = getEasternHour(date);

  for (const session of SESSIONS) {
    if (session.start > session.end) {
      if (etHour >= session.start || etHour < session.end) {
        return session;
      }
    } else {
      if (etHour >= session.start && etHour < session.end) {
        return session;
      }
    }
  }

  return SESSIONS.find((s) => s.name === "NY")!;
}

function getEasternHour(date: Date): number {
  const utcHour = date.getUTCHours();
  return (utcHour + 24 - 5) % 24;
}

// ============================================================================
// VIX CORRELATION LOGIC
// ============================================================================

export interface VIXState {
  level: number;
  previousLevel: number;
  timestamp: Date;
  multiplier: number;
  spikeAdjustment: number;
}

export function getVIXMultiplier(vixLevel: number): {
  multiplier: number;
  context: string;
} {
  for (const tier of VIX_MULTIPLIERS) {
    if (vixLevel < tier.max) {
      return { multiplier: tier.multiplier, context: tier.context };
    }
  }
  return { multiplier: 1.5, context: "Extreme volatility" };
}

const VIX_CURVE: { vix: number; multiplier: number }[] = [
  { vix: 10, multiplier: 0.7 },
  { vix: 13, multiplier: 0.78 },
  { vix: 15, multiplier: 0.85 },
  { vix: 18, multiplier: 1.0 },
  { vix: 20, multiplier: 1.08 },
  { vix: 22, multiplier: 1.15 },
  { vix: 25, multiplier: 1.25 },
  { vix: 30, multiplier: 1.4 },
  { vix: 40, multiplier: 1.5 },
];

export function continuousVIXMultiplier(vix: number): number {
  if (vix <= VIX_CURVE[0].vix) return VIX_CURVE[0].multiplier;
  if (vix >= VIX_CURVE[VIX_CURVE.length - 1].vix)
    return VIX_CURVE[VIX_CURVE.length - 1].multiplier;

  for (let i = 0; i < VIX_CURVE.length - 1; i++) {
    const lo = VIX_CURVE[i];
    const hi = VIX_CURVE[i + 1];
    if (vix >= lo.vix && vix <= hi.vix) {
      const t = (vix - lo.vix) / (hi.vix - lo.vix);
      return lo.multiplier + t * (hi.multiplier - lo.multiplier);
    }
  }

  return 1.0;
}

export function calculateVIXSpikeAdjustment(
  currentVix: number,
  previousVix: number,
  minutesElapsed: number,
): number {
  if (minutesElapsed > 15 || previousVix === 0) return 0;

  const pctChange = ((currentVix - previousVix) / previousVix) * 100;

  if (pctChange > 5) return 2;
  if (pctChange < -5) return -1;
  return 0;
}

export function getNoEventBaseline(vixLevel: number): number {
  return Math.min(10, vixLevel / 3);
}

// ============================================================================
// TIME DECAY (exponential)
// ============================================================================

export function calculateDecayedScore(
  baseScore: number,
  eventType: string,
  minutesSinceEvent: number,
): number {
  const halfLife = DECAY_HALF_LIVES[eventType] ?? DECAY_HALF_LIVES.default;
  const decayFactor = Math.pow(0.5, minutesSinceEvent / halfLife);
  return baseScore * decayFactor;
}

export function calculateDecayedScoreV3(
  baseScore: number,
  eventType: string,
  minutesSinceEvent: number,
  currentVixLevel: number,
): number {
  const profile = getVolatilityProfile(eventType);
  const regime = classifyVixRegime(currentVixLevel);
  const regimeMultiplier = profile.decayRegimeMultipliers[regime];
  const effectiveHalfLife = profile.decayBaseMinutes * regimeMultiplier;
  const decayFactor = Math.pow(0.5, minutesSinceEvent / effectiveHalfLife);
  return baseScore * decayFactor;
}

export function getEventWeight(eventType: string): number {
  const profile = getVolatilityProfile(eventType);
  return profile.baseWeight;
}

export function getInstrumentAdjustedWeight(
  eventType: string,
  instrument: string,
): number {
  const profile = getVolatilityProfile(eventType);
  const override = profile.instrumentOverrides?.[instrument];
  if (override !== undefined) {
    return profile.baseWeight * override;
  }
  return profile.baseWeight;
}

// ============================================================================
// ACTIVITY LEVEL BASELINE
// ============================================================================

export interface ActivityLevel {
  isHighIV: boolean;
  baseline: number;
  context: string;
}

export function getActivityBaseline(
  eventCount: number,
  isEarningsSeason: boolean,
  isFOMCWeek: boolean,
): ActivityLevel {
  const isHighIV = eventCount >= 3 || isEarningsSeason || isFOMCWeek;

  if (isHighIV) {
    return {
      isHighIV: true,
      baseline: 4,
      context:
        "Elevated ambient vol, trendy PA respecting 20/50 EMA; use Anchored VWAP",
    };
  }

  return {
    isHighIV: false,
    baseline: 1,
    context: "Floor for choppy PA around 20/100 EMA; use ORB/Power Hour",
  };
}

// ============================================================================
// STACKING LOGIC
// ============================================================================

export interface StackedEvent {
  eventType: string;
  baseScore: number;
  timestamp: Date;
  decayedScore?: number;
}

export function calculateStackedScore(
  events: StackedEvent[],
  now: Date = new Date(),
  vixLevel?: number,
): { score: number; synergy: boolean; events: StackedEvent[] } {
  if (events.length === 0) {
    return { score: 0, synergy: false, events: [] };
  }

  const processedEvents = events.map((event) => {
    const minutesSince = (now.getTime() - event.timestamp.getTime()) / 60000;
    const decayed =
      vixLevel !== undefined
        ? calculateDecayedScoreV3(
            event.baseScore,
            event.eventType,
            minutesSince,
            vixLevel,
          )
        : calculateDecayedScore(event.baseScore, event.eventType, minutesSince);
    return { ...event, decayedScore: decayed };
  });

  let totalScore = processedEvents.reduce(
    (sum, e) => sum + (e.decayedScore ?? 0),
    0,
  );

  let synergy = false;
  if (events.length >= 2) {
    const sortedByTime = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    for (let i = 1; i < sortedByTime.length; i++) {
      const gap =
        (sortedByTime[i].timestamp.getTime() -
          sortedByTime[i - 1].timestamp.getTime()) /
        60000;
      if (gap < 30) {
        synergy = true;
        break;
      }
    }
  }

  if (synergy) {
    totalScore *= 1.2;
  }

  totalScore = Math.min(10, totalScore);

  return { score: totalScore, synergy, events: processedEvents };
}

// ============================================================================
// INSTANT TRIGGERS
// ============================================================================

export function isInstantTrigger(eventType: string): {
  isInstant: boolean;
  minScore: number;
} {
  const triggers = getIVScoringConfig().instantTriggers;
  const minScore = triggers[eventType];
  return {
    isInstant: minScore !== undefined,
    minScore: minScore ?? 0,
  };
}

// ============================================================================
// EDGE CASES
// ============================================================================

export interface EdgeCaseResult {
  triggered: boolean;
  score?: number;
  message?: string;
  holdMinutes?: number;
}

export function checkEdgeCases(
  eventType: string,
  vixLevel: number,
  isMarketClosed: boolean,
): EdgeCaseResult {
  if (
    eventType === "blackSwan" ||
    eventType === "datacenterHalt" ||
    eventType === "majorCrisis"
  ) {
    return {
      triggered: true,
      score: 10,
      message: "Get focused 'cause this one of them ones",
      holdMinutes: vixLevel > 25 ? 60 : 30,
    };
  }

  if (vixLevel > 50) {
    return {
      triggered: true,
      score: 10,
      message: "Get focused 'cause this one of them ones - Extreme VIX",
    };
  }

  if (isMarketClosed) {
    return {
      triggered: true,
      message: "Market closed - using last close VIX with 0.5 daily decay",
    };
  }

  return { triggered: false };
}

// ============================================================================
// MULTI-SESSION SPILLOVER
// ============================================================================

export function calculateSpillover(previousSessionScore: number): number {
  return previousSessionScore * 0.2;
}
