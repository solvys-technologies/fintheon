// [claude-code 2026-04-10] Sticky bulletin persistence — user notes, event of week, antilag times
import { sql, isDatabaseAvailable } from "../config/database.js";

export interface StickyBulletinData {
  tradingNotes: string;
  eventOfWeek: string;
  antilagTimes: AntilagEntry[];
  updatedAt: string;
}

export interface AntilagEntry {
  time: string; // HH:mm format
  dayOfWeek: number; // 0=Sun, 6=Sat
  instrument: string;
  notes: string;
  createdAt: string;
}

// In-memory fallback
const memoryStore = new Map<string, StickyBulletinData>();
const antilagGlobal: AntilagEntry[] = [];

/**
 * Get a user's sticky bulletin data
 */
export async function getUserBulletin(
  userId: string,
): Promise<StickyBulletinData> {
  const defaults: StickyBulletinData = {
    tradingNotes: "",
    eventOfWeek: "",
    antilagTimes: [],
    updatedAt: new Date().toISOString(),
  };

  if (!isDatabaseAvailable() || !sql) {
    return memoryStore.get(userId) ?? defaults;
  }

  try {
    const result = await sql`
      SELECT trading_notes, event_of_week, updated_at
      FROM sticky_bulletin
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const antilag = await sql`
      SELECT time, day_of_week, instrument, notes, created_at
      FROM antilag_times
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    if (result.length === 0) return defaults;
    const row = result[0] as any;
    return {
      tradingNotes: row.trading_notes ?? "",
      eventOfWeek: row.event_of_week ?? "",
      antilagTimes: (antilag as any[]).map((r) => ({
        time: r.time,
        dayOfWeek: r.day_of_week,
        instrument: r.instrument ?? "",
        notes: r.notes ?? "",
        createdAt: r.created_at,
      })),
      updatedAt: row.updated_at,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      await ensureTables();
      return defaults;
    }
    throw err;
  }
}

/**
 * Save user's sticky bulletin text fields (notes + event of week)
 */
export async function saveUserBulletin(
  userId: string,
  data: { tradingNotes?: string; eventOfWeek?: string },
): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    const existing = memoryStore.get(userId) ?? {
      tradingNotes: "",
      eventOfWeek: "",
      antilagTimes: [],
      updatedAt: "",
    };
    memoryStore.set(userId, {
      ...existing,
      tradingNotes: data.tradingNotes ?? existing.tradingNotes,
      eventOfWeek: data.eventOfWeek ?? existing.eventOfWeek,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await sql`
      INSERT INTO sticky_bulletin (user_id, trading_notes, event_of_week, updated_at)
      VALUES (
        ${userId},
        ${data.tradingNotes ?? ""},
        ${data.eventOfWeek ?? ""},
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        trading_notes = COALESCE(${data.tradingNotes ?? null}, sticky_bulletin.trading_notes),
        event_of_week = COALESCE(${data.eventOfWeek ?? null}, sticky_bulletin.event_of_week),
        updated_at = NOW()
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      await ensureTables();
      await saveUserBulletin(userId, data);
    } else {
      throw err;
    }
  }
}

/**
 * Record an antilag time observation — stored per-user, aggregated across all users for insights
 */
export async function addAntilagTime(
  userId: string,
  entry: { time: string; dayOfWeek: number; instrument: string; notes: string },
): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    antilagGlobal.push({
      ...entry,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  try {
    await sql`
      INSERT INTO antilag_times (user_id, time, day_of_week, instrument, notes, created_at)
      VALUES (${userId}, ${entry.time}, ${entry.dayOfWeek}, ${entry.instrument}, ${entry.notes}, NOW())
    `;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      await ensureTables();
      await addAntilagTime(userId, entry);
    } else {
      throw err;
    }
  }
}

/**
 * Get aggregated antilag time data across all users
 */
export async function getAntilagAggregates(): Promise<
  Array<{
    time: string;
    dayOfWeek: number;
    count: number;
    instruments: string[];
  }>
> {
  if (!isDatabaseAvailable() || !sql) {
    return [];
  }

  try {
    const result = await sql`
      SELECT time, day_of_week, COUNT(*) as count,
        array_agg(DISTINCT instrument) FILTER (WHERE instrument != '') as instruments
      FROM antilag_times
      GROUP BY time, day_of_week
      ORDER BY count DESC
      LIMIT 50
    `;
    return (result as any[]).map((r) => ({
      time: r.time,
      dayOfWeek: r.day_of_week,
      count: parseInt(r.count, 10),
      instruments: r.instruments ?? [],
    }));
  } catch {
    return [];
  }
}

async function ensureTables(): Promise<void> {
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS sticky_bulletin (
      user_id TEXT PRIMARY KEY,
      trading_notes TEXT NOT NULL DEFAULT '',
      event_of_week TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS antilag_times (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      time TEXT NOT NULL,
      day_of_week INTEGER NOT NULL,
      instrument TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_antilag_times_user ON antilag_times (user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_antilag_times_agg ON antilag_times (time, day_of_week)
  `;
}
