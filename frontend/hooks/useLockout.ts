// [claude-code 2026-05-13] Lockout hook — polls lockout status, provides toggle
// [claude-code 2026-05-13] S64 T3: Added scheduleLock, lockUntil, getNextWindow, auto-release polling, OS notification
import { useState, useEffect, useCallback, useRef } from "react";

export interface LockoutState {
  locked: boolean;
  until: string | null;
  remaining: number | null;
  autoReleaseAt?: string | null;
  scheduledBy?: string | null;
}

interface NextWindowInfo {
  locked: boolean;
  autoReleaseAt: string | null;
  scheduledBy: string | null;
  until: string | null;
  remaining: number | null;
}

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

async function fetchLockout(): Promise<LockoutState> {
  try {
    const res = await fetch(`${API_BASE}/api/lockout/status`, {
      credentials: "include",
    });
    if (!res.ok) return { locked: false, until: null, remaining: null };
    const data = await res.json();
    return {
      locked: !!data.locked,
      until: data.until ?? null,
      remaining: data.remaining ?? null,
      autoReleaseAt: data.autoReleaseAt ?? null,
      scheduledBy: data.scheduledBy ?? null,
    };
  } catch {
    return { locked: false, until: null, remaining: null };
  }
}

async function toggleLockout(
  locked: boolean,
  durationMinutes?: number,
  windowStartTime?: string,
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { locked };
    if (durationMinutes !== undefined) body.durationMinutes = durationMinutes;
    if (windowStartTime !== undefined) body.windowStartTime = windowStartTime;
    const res = await fetch(`${API_BASE}/api/lockout/toggle`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchNextWindow(): Promise<NextWindowInfo> {
  try {
    const res = await fetch(`${API_BASE}/api/lockout/next-window`, {
      credentials: "include",
    });
    if (!res.ok) {
      return {
        locked: false,
        autoReleaseAt: null,
        scheduledBy: null,
        until: null,
        remaining: null,
      };
    }
    return await res.json();
  } catch {
    return {
      locked: false,
      autoReleaseAt: null,
      scheduledBy: null,
      until: null,
      remaining: null,
    };
  }
}

/** Fire OS notification via Electron IPC if available */
function fireOsNotification() {
  try {
    const el = (window as any).electron;
    if (el?.systemNotification?.show) {
      el.systemNotification.show(
        "touch grass, kid.",
        "this app has been blocked by the agentic desk. see you next session!",
      );
    }
  } catch {
    // Best effort — may not be in Electron context
  }
}

export function useLockout(pollMs = 5000) {
  const [state, setState] = useState<LockoutState>({
    locked: false,
    until: null,
    remaining: null,
    autoReleaseAt: null,
    scheduledBy: null,
  });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReleaseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const previousLockedRef = useRef(false);
  const notifiedRef = useRef(false);

  const refresh = useCallback(async () => {
    const s = await fetchLockout();
    setState(s);
    setLoading(false);

    // Fire OS notification on lock transition (once per lock event)
    if (s.locked && !previousLockedRef.current && !notifiedRef.current) {
      notifiedRef.current = true;
      fireOsNotification();
    }
    if (!s.locked) {
      notifiedRef.current = false;
    }
    previousLockedRef.current = s.locked;
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, pollMs);

    // Auto-release polling: check every 5s if autoReleaseAt has passed
    autoReleaseIntervalRef.current = setInterval(async () => {
      setState((prev) => {
        if (prev.locked && prev.autoReleaseAt) {
          const now = Date.now();
          const releaseTime = new Date(prev.autoReleaseAt).getTime();
          if (!isNaN(releaseTime) && now >= releaseTime) {
            // Trigger unlock via API (async, outside setState)
            toggleLockout(false).then(() => refresh());
          }
        }
        return prev; // always return current state
      });
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (autoReleaseIntervalRef.current)
        clearInterval(autoReleaseIntervalRef.current);
    };
  }, [refresh, pollMs]);

  const lock = useCallback(
    async (durationMinutes?: number, windowStartTime?: string) => {
      const ok = await toggleLockout(true, durationMinutes, windowStartTime);
      if (ok) await refresh();
      return ok;
    },
    [refresh],
  );

  const unlock = useCallback(async () => {
    const ok = await toggleLockout(false);
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  /**
   * Schedule a timed lockout. Accepts either a duration + optional windowStartTime,
   * or an ISO timestamp to lock until.
   */
  const scheduleLock = useCallback(
    async (durationMinutes: number, windowStartTime?: string) => {
      try {
        const body: Record<string, unknown> = { durationMinutes };
        if (windowStartTime) body.windowStartTime = windowStartTime;
        const res = await fetch(`${API_BASE}/api/lockout/schedule`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const ok = res.ok;
        if (ok) await refresh();
        return ok;
      } catch {
        return false;
      }
    },
    [refresh],
  );

  /**
   * Lock until a specific ISO timestamp.
   */
  const lockUntil = useCallback(
    async (isoTimestamp: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/lockout/schedule`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lockUntil: isoTimestamp }),
        });
        const ok = res.ok;
        if (ok) await refresh();
        return ok;
      } catch {
        return false;
      }
    },
    [refresh],
  );

  /**
   * Fetch next scheduled window info.
   */
  const getNextWindow = useCallback(async (): Promise<NextWindowInfo> => {
    return await fetchNextWindow();
  }, []);

  return {
    state,
    loading,
    lock,
    unlock,
    refresh,
    scheduleLock,
    lockUntil,
    getNextWindow,
  };
}
