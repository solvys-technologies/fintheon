// [claude-code 2026-03-23] Wired lockout-protocol + tilt-detector into psych-assist-service
import { query } from "../db/optimized.js";
import {
  detectTiltSignals,
  computeTiltRisk,
} from "./psych-assist/tilt-detector.js";
import type {
  TiltSignal,
  TiltDetectorContext,
} from "./psych-assist/tilt-detector.js";
import {
  evaluateLockout,
  isTradeBlocked,
  dismissLockout,
  submitDebrief,
  createLockoutSession,
} from "./psych-assist/lockout-protocol.js";
import type {
  LockoutState,
  LockoutSessionState,
} from "./psych-assist/lockout-protocol.js";

export type PsychScores = {
  executions: number;
  emotionalControl: number;
  planAdherence: number;
  riskSizing: number;
  adaptability: number;
};

export interface PsychProfile {
  userId: string;
  blindSpots: string[];
  goal: string | null;
  orientationComplete: boolean;
  psychScores: PsychScores;
  lastAssessmentAt: string | null;
  updatedAt: string;
  createdAt: string;
}

const DEFAULT_SCORES: PsychScores = {
  executions: 6,
  emotionalControl: 6,
  planAdherence: 6,
  riskSizing: 6,
  adaptability: 6,
};

const BLINDSPOT_CHAR_CAP = 140;
const BLINDSPOT_ITEM_CAP = 4;

const normalizeBlindSpots = (blindSpots?: unknown): string[] => {
  if (!Array.isArray(blindSpots)) return [];
  return blindSpots
    .map((spot) => (typeof spot === "string" ? spot.trim() : ""))
    .filter((spot) => spot.length > 0)
    .map((spot) =>
      spot.length > BLINDSPOT_CHAR_CAP
        ? spot.slice(0, BLINDSPOT_CHAR_CAP)
        : spot,
    )
    .slice(0, BLINDSPOT_ITEM_CAP);
};

const sanitizeGoal = (goal?: unknown): string | null => {
  if (typeof goal !== "string") return null;
  const trimmed = goal.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeScore = (value: unknown): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  const clamped = Math.max(0, Math.min(10, Math.round(value)));
  return clamped % 2 === 0 ? clamped : clamped - 1;
};

const normalizeScores = (scores?: Record<string, unknown>): PsychScores => {
  const incoming = scores ?? {};
  return {
    executions: normalizeScore(incoming.executions),
    emotionalControl: normalizeScore(incoming.emotionalControl),
    planAdherence: normalizeScore(incoming.planAdherence),
    riskSizing: normalizeScore(incoming.riskSizing),
    adaptability: normalizeScore(incoming.adaptability),
  };
};

const mapProfile = (row: Record<string, unknown>): PsychProfile => {
  const blindSpotsRaw = row.blind_spots;
  const scoresRaw = row.psych_scores as Record<string, unknown> | null;
  const mergedScores = { ...DEFAULT_SCORES, ...(scoresRaw ?? {}) };
  return {
    userId: String(row.user_id),
    blindSpots: Array.isArray(blindSpotsRaw)
      ? blindSpotsRaw.map((spot) =>
          typeof spot === "string" ? spot : String(spot),
        )
      : [],
    goal: row.goal ? String(row.goal) : null,
    orientationComplete: row.orientation_complete === true,
    psychScores: normalizeScores(mergedScores),
    lastAssessmentAt: row.last_assessment_at
      ? String(row.last_assessment_at)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
};

export const createPsychAssistService = () => {
  const ensureProfile = async (userId: string): Promise<PsychProfile> => {
    let result = await query(
      `
      SELECT *
      FROM user_psychology
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length) {
      return mapProfile(result.rows[0] as Record<string, unknown>);
    }

    result = await query(
      `
      INSERT INTO user_psychology (user_id, blind_spots, goal, orientation_complete, psych_scores)
      VALUES ($1, '[]'::jsonb, NULL, FALSE, $2::jsonb)
      RETURNING *
      `,
      [userId, JSON.stringify(DEFAULT_SCORES)],
    );
    return mapProfile(result.rows[0] as Record<string, unknown>);
  };

  const updateProfile = async (
    userId: string,
    input: {
      blindSpots?: string[];
      goal?: string | null;
      orientationComplete?: boolean;
    },
  ) => {
    const current = await ensureProfile(userId);
    const nextBlindSpots =
      input.blindSpots !== undefined
        ? normalizeBlindSpots(input.blindSpots)
        : current.blindSpots;
    const nextGoal =
      input.goal !== undefined ? sanitizeGoal(input.goal) : current.goal;
    const orientationComplete = input.orientationComplete
      ? true
      : current.orientationComplete;

    const result = await query(
      `
      INSERT INTO user_psychology (user_id, blind_spots, goal, orientation_complete)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT (user_id) DO UPDATE
      SET blind_spots = EXCLUDED.blind_spots,
          goal = EXCLUDED.goal,
          orientation_complete = GREATEST(user_psychology.orientation_complete::int, EXCLUDED.orientation_complete::int)::boolean,
          updated_at = NOW()
      RETURNING *
      `,
      [userId, JSON.stringify(nextBlindSpots), nextGoal, orientationComplete],
    );

    return mapProfile(result.rows[0] as Record<string, unknown>);
  };

  const updateScores = async (userId: string, scores: Partial<PsychScores>) => {
    await ensureProfile(userId);
    const normalized = normalizeScores(scores as Record<string, unknown>);
    const result = await query(
      `
      UPDATE user_psychology
      SET psych_scores = $2::jsonb,
          last_assessment_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
      `,
      [userId, JSON.stringify(normalized)],
    );
    return mapProfile(result.rows[0] as Record<string, unknown>);
  };

  // Per-user lockout session tracking (in-memory, resets on server restart)
  const sessions = new Map<string, LockoutSessionState>();

  const getSession = (userId: string): LockoutSessionState => {
    if (!sessions.has(userId)) {
      sessions.set(userId, createLockoutSession());
    }
    return sessions.get(userId)!;
  };

  const assessTradingReadiness = async (
    userId: string,
    context: TiltDetectorContext,
  ) => {
    const profile = await ensureProfile(userId);
    const session = getSession(userId);

    // Detect tilt signals
    const signals = detectTiltSignals(context);
    const riskScore = computeTiltRisk(signals);

    // Evaluate lockout (only if not already locked out)
    let lockout: LockoutState | null = session.activeLockout;
    if (!lockout) {
      lockout = evaluateLockout({
        consecutiveLosses: context.consecutiveLosses,
        previousLockoutsToday: session.lockoutCount,
        currentPnL: context.currentPnL,
        accountResetsToday: context.accountResetsToday,
      });
      if (lockout) {
        session.lockoutCount++;
        session.activeLockout = lockout;
      }
    }

    return {
      profile,
      signals,
      riskScore,
      lockout,
      isBlocked: isTradeBlocked(session),
    };
  };

  const handleDismissLockout = (userId: string): LockoutSessionState => {
    const session = getSession(userId);
    const updated = dismissLockout(session);
    sessions.set(userId, updated);
    return updated;
  };

  const handleSubmitDebrief = (
    userId: string,
    answers: Record<string, string>,
  ): LockoutSessionState => {
    const session = getSession(userId);
    const updated = submitDebrief(session, answers);
    sessions.set(userId, updated);
    return updated;
  };

  return {
    getProfile: ensureProfile,
    updateProfile,
    updateScores,
    assessTradingReadiness,
    dismissLockout: handleDismissLockout,
    submitDebrief: handleSubmitDebrief,
    getSession,
  };
};

// Re-export types for route consumers
export type {
  TiltSignal,
  TiltDetectorContext,
  LockoutState,
  LockoutSessionState,
};
