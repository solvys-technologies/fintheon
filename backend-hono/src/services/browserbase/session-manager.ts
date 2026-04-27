// [claude-code 2026-04-25] S40-P9: Browserbase session manager. Per-user state:
//   - 1 active session at a time (replaces if create is called again)
//   - 15-min idle TTL (auto-close if no activity)
//   - 4 sessions per UTC day cap
//
// Not Postgres-backed — in-memory state is fine because Browserbase sessions
// die anyway when the backend restarts. Audits go to browser_harness_audit.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import {
  createSession,
  endSession,
  isBrowserbaseAvailable,
  type BrowserbaseSession,
} from "./client.js";
import { broadcastConsulBrowser } from "./sse.js";

const log = createLogger("Browserbase:SessionManager");

const IDLE_TTL_MS = 15 * 60_000;
const DAILY_CAP = 4;

interface UserSessionState {
  session: BrowserbaseSession | null;
  lastActivityAt: number;
  idleTimer: NodeJS.Timeout | null;
  dayKey: string;
  dayCount: number;
}

const sessions = new Map<string, UserSessionState>();

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getOrInitState(userId: string): UserSessionState {
  const today = getDayKey();
  const existing = sessions.get(userId);
  if (existing) {
    if (existing.dayKey !== today) {
      existing.dayKey = today;
      existing.dayCount = 0;
    }
    return existing;
  }
  const fresh: UserSessionState = {
    session: null,
    lastActivityAt: 0,
    idleTimer: null,
    dayKey: today,
    dayCount: 0,
  };
  sessions.set(userId, fresh);
  return fresh;
}

async function audit(
  userId: string,
  action: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb
    .from("browser_harness_audit")
    .insert({
      user_id: userId,
      action: `consul_browser:${action}`,
      detail,
      created_at: new Date().toISOString(),
    })
    .then((res) => {
      if (res.error) {
        log.warn("audit insert failed (non-fatal)", {
          error: res.error.message,
        });
      }
    });
}

function scheduleIdleTeardown(userId: string): void {
  const state = sessions.get(userId);
  if (!state) return;
  if (state.idleTimer) clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    closeForUser(userId, "idle_ttl").catch((err) =>
      log.warn("idle teardown threw (swallowed)", { error: String(err) }),
    );
  }, IDLE_TTL_MS);
}

export async function createForUser(
  userId: string,
): Promise<{ session: BrowserbaseSession | null; reason?: string }> {
  if (!isBrowserbaseAvailable()) {
    return { session: null, reason: "browserbase_unavailable" };
  }

  const state = getOrInitState(userId);
  if (state.dayCount >= DAILY_CAP) {
    return { session: null, reason: "daily_cap_reached" };
  }

  // Replace any existing session.
  if (state.session) {
    await endSession(state.session.id).catch(() => {});
    state.session = null;
  }

  const session = await createSession();
  if (!session) {
    return { session: null, reason: "create_failed" };
  }

  state.session = session;
  state.lastActivityAt = Date.now();
  state.dayCount += 1;
  scheduleIdleTeardown(userId);

  await audit(userId, "create", { sessionId: session.id });
  broadcastConsulBrowser({
    userId,
    state: "active",
    session: { id: session.id, liveUrl: session.liveUrl },
  });
  return { session };
}

export function getActiveForUser(userId: string): BrowserbaseSession | null {
  return sessions.get(userId)?.session ?? null;
}

export function touchActivity(userId: string): void {
  const state = sessions.get(userId);
  if (!state || !state.session) return;
  state.lastActivityAt = Date.now();
  scheduleIdleTeardown(userId);
}

export async function closeForUser(
  userId: string,
  reason: string,
): Promise<boolean> {
  const state = sessions.get(userId);
  if (!state || !state.session) return false;
  const sessionId = state.session.id;
  await endSession(sessionId).catch(() => {});
  state.session = null;
  if (state.idleTimer) {
    clearTimeout(state.idleTimer);
    state.idleTimer = null;
  }
  await audit(userId, "close", { sessionId, reason });
  broadcastConsulBrowser({ userId, state: "closed", session: null });
  return true;
}

export interface SessionStats {
  active: boolean;
  liveUrl: string | null;
  sessionId: string | null;
  dayCount: number;
  dayCap: number;
  idleTtlMs: number;
}

export function getStats(userId: string): SessionStats {
  const state = sessions.get(userId);
  return {
    active: Boolean(state?.session),
    liveUrl: state?.session?.liveUrl ?? null,
    sessionId: state?.session?.id ?? null,
    dayCount: state?.dayCount ?? 0,
    dayCap: DAILY_CAP,
    idleTtlMs: IDLE_TTL_MS,
  };
}
