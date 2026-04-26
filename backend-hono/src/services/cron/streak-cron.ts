// [claude-code 2026-04-26] S45-T1: Streak cron — Mon-Fri 16:00 ET. Pulls
// ProjectX account balance delta (start-of-day vs end-of-day) and writes a
// day_plan_streaks row per PIC user. Green = positive delta, red = negative,
// flat = zero. streak_at_close = previous_streak + 1 if green else 0; flat
// preserves the prior streak.

import cron from "node-cron";
import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { getAccount } from "../projectx-service.js";
import type { DailyColor } from "../../types/day-plan.js";

const log = createLogger("StreakCron");

const SCHEDULE = "0 16 * * 1-5";
const STREAK_USER_IDS_ENV = "DAY_PLAN_STREAK_USER_IDS";
const SYSTEM_USER_ID_ENV = "SYSTEM_USER_ID";

let task: cron.ScheduledTask | null = null;
let running = false;
let lastFiredAt: string | null = null;

const startOfDayBalances = new Map<string, number>(); // userId -> SOD balance

function classify(delta: number): DailyColor {
  if (delta > 0) return "green";
  if (delta < 0) return "red";
  return "flat";
}

function activeUserIds(): string[] {
  const raw = process.env[STREAK_USER_IDS_ENV];
  if (raw) {
    return raw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  const fallback = process.env[SYSTEM_USER_ID_ENV];
  return fallback ? [fallback] : [];
}

/** Snapshot start-of-day balances. Called by a separate boot hook at 09:30 ET. */
export async function captureStartOfDayBalances(): Promise<void> {
  for (const userId of activeUserIds()) {
    try {
      const account = await getAccount(userId);
      if (account?.balance != null) {
        startOfDayBalances.set(userId, Number(account.balance));
      }
    } catch (err) {
      log.warn("captureStartOfDayBalances failed for user", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function tickForUser(userId: string, dateIso: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  let dailyPnl = 0;
  try {
    const account = await getAccount(userId);
    const startBalance = startOfDayBalances.get(userId);
    if (account?.balance != null && startBalance != null) {
      dailyPnl = Number(account.balance) - startBalance;
    } else if (account?.balance == null) {
      log.warn("Streak cron: no account balance — skipping user", { userId });
      return;
    }
  } catch (err) {
    log.warn("Streak cron: getAccount failed — skipping user", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const color = classify(dailyPnl);

  // Read previous streak
  const { data: prevRows } = await sb
    .from("day_plan_streaks")
    .select("streak_at_close, daily_color, date")
    .eq("user_id", userId)
    .lt("date", dateIso)
    .order("date", { ascending: false })
    .limit(1);
  const prev = prevRows?.[0];
  const prevStreak = prev?.streak_at_close ?? 0;

  let streakAtClose: number;
  if (color === "green") streakAtClose = prevStreak + 1;
  else if (color === "red") streakAtClose = 0;
  else streakAtClose = prevStreak;

  const { error } = await sb.from("day_plan_streaks").upsert(
    {
      user_id: userId,
      date: dateIso,
      daily_pnl: dailyPnl,
      daily_color: color,
      streak_at_close: streakAtClose,
    },
    { onConflict: "user_id,date" },
  );
  if (error) {
    log.warn("Streak upsert failed", { userId, error: error.message });
    return;
  }

  log.info("Streak row written", { userId, dateIso, color, streakAtClose });
}

async function tick(): Promise<void> {
  const dateIso = new Date().toISOString().slice(0, 10);
  const userIds = activeUserIds();
  if (userIds.length === 0) {
    log.info(
      "Streak cron skipped — DAY_PLAN_STREAK_USER_IDS / SYSTEM_USER_ID unset",
    );
    return;
  }
  for (const userId of userIds) {
    await tickForUser(userId, dateIso);
  }
  lastFiredAt = new Date().toISOString();
}

export function startStreakCron(): void {
  if (running) return;
  if (process.env.STREAK_CRON_ENABLED === "false") {
    log.info("Disabled via STREAK_CRON_ENABLED=false");
    return;
  }

  task = cron.schedule(
    SCHEDULE,
    () => {
      tick().catch((err) =>
        log.warn("Streak tick failed (swallowed)", { error: String(err) }),
      );
    },
    { timezone: "America/New_York" },
  );
  running = true;
  log.info(`Registered Streak cron (${SCHEDULE} America/New_York)`);
}

export function stopStreakCron(): void {
  if (!running) return;
  task?.stop();
  task = null;
  running = false;
}

export function getLastStreakFiredAt(): string | null {
  return lastFiredAt;
}

export function isStreakCronActive(): boolean {
  return running;
}
