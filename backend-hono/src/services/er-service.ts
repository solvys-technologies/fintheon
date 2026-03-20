import { isPoolAvailable, query } from '../db/optimized.js';

export type ERState = 'stable' | 'neutral' | 'tilt';

export interface SaveERSessionInput {
  sessionId?: number;
  finalScore: number;
  timeInTiltSeconds: number;
  infractionCount: number;
  sessionDurationSeconds: number;
  maxTiltScore?: number;
  maxTiltTime?: string | Date;
}

export interface SaveERSnapshotInput {
  sessionId: number;
  score: number;
  state: ERState;
  audioLevels?: string;
  keywords?: string[];
}

interface MemorySession {
  id: number;
  userId: string;
  finalScore: number;
  timeInTiltSeconds: number;
  infractionCount: number;
  sessionDurationSeconds: number;
  maxTiltScore?: number;
  maxTiltTime?: string;
  isFinalized: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MemorySnapshot {
  id: number;
  sessionId: number;
  userId: string;
  score: number;
  state: ERState;
  audioLevels?: string;
  keywords?: string[];
  createdAt: string;
}

const isDev = process.env.NODE_ENV !== 'production';

const memorySessions: MemorySession[] = [];
const memorySnapshots: MemorySnapshot[] = [];
let memorySessionId = 1;
let memorySnapshotId = 1;

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export async function saveSession(userId: string, input: SaveERSessionInput): Promise<{ sessionId: number; finalized: boolean }> {
  const finalized = input.sessionDurationSeconds > 0;
  const maxTiltTime = input.maxTiltTime ? new Date(input.maxTiltTime) : null;

  if (!isPoolAvailable()) {
    if (!isDev) {
      throw new Error('Database unavailable for ER session persistence');
    }

    const now = new Date().toISOString();

    if (input.sessionId) {
      const existing = memorySessions.find((session) => session.id === input.sessionId && session.userId === userId);
      if (existing) {
        existing.finalScore = input.finalScore;
        existing.timeInTiltSeconds = input.timeInTiltSeconds;
        existing.infractionCount = input.infractionCount;
        existing.sessionDurationSeconds = input.sessionDurationSeconds;
        existing.maxTiltScore = input.maxTiltScore;
        existing.maxTiltTime = maxTiltTime?.toISOString();
        existing.isFinalized = finalized;
        existing.updatedAt = now;
        return { sessionId: existing.id, finalized };
      }
    }

    const openSession = memorySessions
      .filter((session) => session.userId === userId && !session.isFinalized)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

    if (openSession && finalized) {
      openSession.finalScore = input.finalScore;
      openSession.timeInTiltSeconds = input.timeInTiltSeconds;
      openSession.infractionCount = input.infractionCount;
      openSession.sessionDurationSeconds = input.sessionDurationSeconds;
      openSession.maxTiltScore = input.maxTiltScore;
      openSession.maxTiltTime = maxTiltTime?.toISOString();
      openSession.isFinalized = true;
      openSession.updatedAt = now;
      return { sessionId: openSession.id, finalized: true };
    }

    const sessionId = memorySessionId;
    memorySessionId += 1;

    memorySessions.push({
      id: sessionId,
      userId,
      finalScore: input.finalScore,
      timeInTiltSeconds: input.timeInTiltSeconds,
      infractionCount: input.infractionCount,
      sessionDurationSeconds: input.sessionDurationSeconds,
      maxTiltScore: input.maxTiltScore,
      maxTiltTime: maxTiltTime?.toISOString(),
      isFinalized: finalized,
      createdAt: now,
      updatedAt: now,
    });

    return { sessionId, finalized };
  }

  if (input.sessionId) {
    const update = await query<{ id: number }>(
      `
      UPDATE er_sessions
      SET
        final_score = $3,
        time_in_tilt_seconds = $4,
        infraction_count = $5,
        session_duration_seconds = $6,
        max_tilt_score = $7,
        max_tilt_time = $8,
        is_finalized = $9,
        updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING id
      `,
      [
        userId,
        input.sessionId,
        input.finalScore,
        input.timeInTiltSeconds,
        input.infractionCount,
        input.sessionDurationSeconds,
        input.maxTiltScore ?? null,
        maxTiltTime,
        finalized,
      ]
    );

    const updatedId = update.rows[0]?.id;
    if (updatedId) {
      return { sessionId: updatedId, finalized };
    }
  }

  if (finalized) {
    const finalizeOpen = await query<{ id: number }>(
      `
      UPDATE er_sessions
      SET
        final_score = $2,
        time_in_tilt_seconds = $3,
        infraction_count = $4,
        session_duration_seconds = $5,
        max_tilt_score = $6,
        max_tilt_time = $7,
        is_finalized = TRUE,
        updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM er_sessions
        WHERE user_id = $1
          AND is_finalized = FALSE
        ORDER BY updated_at DESC
        LIMIT 1
      )
      RETURNING id
      `,
      [
        userId,
        input.finalScore,
        input.timeInTiltSeconds,
        input.infractionCount,
        input.sessionDurationSeconds,
        input.maxTiltScore ?? null,
        maxTiltTime,
      ]
    );

    const finalizedId = finalizeOpen.rows[0]?.id;
    if (finalizedId) {
      return { sessionId: finalizedId, finalized: true };
    }
  }

  const insert = await query<{ id: number }>(
    `
    INSERT INTO er_sessions (
      user_id,
      final_score,
      time_in_tilt_seconds,
      infraction_count,
      session_duration_seconds,
      max_tilt_score,
      max_tilt_time,
      is_finalized
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
    `,
    [
      userId,
      input.finalScore,
      input.timeInTiltSeconds,
      input.infractionCount,
      input.sessionDurationSeconds,
      input.maxTiltScore ?? null,
      maxTiltTime,
      finalized,
    ]
  );

  return {
    sessionId: insert.rows[0].id,
    finalized,
  };
}

export async function saveSnapshot(userId: string, input: SaveERSnapshotInput): Promise<{ snapshotId: number }> {
  let audioLevels: Record<string, unknown> | null = null;
  if (input.audioLevels) {
    try {
      audioLevels = JSON.parse(input.audioLevels) as Record<string, unknown>;
    } catch {
      audioLevels = null;
    }
  }
  const keywords = input.keywords ?? null;

  if (!isPoolAvailable()) {
    if (!isDev) {
      throw new Error('Database unavailable for ER snapshot persistence');
    }

    const snapshotId = memorySnapshotId;
    memorySnapshotId += 1;

    memorySnapshots.push({
      id: snapshotId,
      sessionId: input.sessionId,
      userId,
      score: input.score,
      state: input.state,
      audioLevels: audioLevels ? JSON.stringify(audioLevels) : undefined,
      keywords: keywords ?? undefined,
      createdAt: new Date().toISOString(),
    });

    return { snapshotId };
  }

  const result = await query<{ id: number }>(
    `
    INSERT INTO er_snapshots (
      session_id,
      user_id,
      score,
      state,
      audio_levels,
      keywords
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
    RETURNING id
    `,
    [
      input.sessionId,
      userId,
      input.score,
      input.state,
      audioLevels ? JSON.stringify(audioLevels) : null,
      keywords ? JSON.stringify(keywords) : null,
    ]
  );

  return { snapshotId: result.rows[0].id };
}

export async function listSessions(
  userId: string,
  options?: { limit?: number }
): Promise<Array<Record<string, unknown>>> {
  const limit = Math.max(1, Math.min(100, Math.floor(options?.limit ?? 20)));

  if (!isPoolAvailable()) {
    return memorySessions
      .filter((session) => session.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((session) => ({
        sessionId: session.id,
        finalScore: session.finalScore,
        timeInTiltSeconds: session.timeInTiltSeconds,
        infractionCount: session.infractionCount,
        sessionDurationSeconds: session.sessionDurationSeconds,
        maxTiltScore: session.maxTiltScore,
        maxTiltTime: session.maxTiltTime,
        isFinalized: session.isFinalized,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }));
  }

  const result = await query<{
    id: number;
    final_score: number;
    time_in_tilt_seconds: number;
    infraction_count: number;
    session_duration_seconds: number;
    max_tilt_score: number | null;
    max_tilt_time: string | null;
    is_finalized: boolean;
    created_at: string;
    updated_at: string;
  }>(
    `
    SELECT
      id,
      final_score,
      time_in_tilt_seconds,
      infraction_count,
      session_duration_seconds,
      max_tilt_score,
      max_tilt_time,
      is_finalized,
      created_at,
      updated_at
    FROM er_sessions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows.map((row) => ({
    sessionId: row.id,
    finalScore: toNumber(row.final_score),
    timeInTiltSeconds: toNumber(row.time_in_tilt_seconds),
    infractionCount: toNumber(row.infraction_count),
    sessionDurationSeconds: toNumber(row.session_duration_seconds),
    maxTiltScore: row.max_tilt_score !== null ? toNumber(row.max_tilt_score) : null,
    maxTiltTime: row.max_tilt_time,
    isFinalized: Boolean(row.is_finalized),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function evaluateOvertrading(
  userId: string,
  options?: { windowMinutes?: number; threshold?: number }
): Promise<{
  isOvertrading: boolean;
  tradesInWindow: number;
  weightedTrades: number;
  threshold: number;
  penalty: number;
  warning?: string;
}> {
  return { isOvertrading: false, tradesInWindow: 0, weightedTrades: 0, threshold: options?.threshold ?? 10, penalty: 0 };
}
