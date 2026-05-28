// [claude-code 2026-05-13] Lockout hook — polls lockout status, provides toggle
// [claude-code 2026-05-13] S64 T3: Added scheduleLock, lockUntil, getNextWindow, auto-release polling, OS notification
// [claude-code 2026-05-15] S66-T2: Added lockUntilDeskSession, lock screen IPC listeners
import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings } from "../contexts/SettingsContext";
import {
  mergeDomainLists,
  notifyBlockerStateUpdated,
  resolveBlockerTarget,
  type BlockerStatus,
} from "../lib/platform-blocker";

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

interface BlockerApi {
  enable: () => Promise<unknown>;
  enableFast: () => Promise<unknown>;
  disable: () => Promise<unknown>;
  disableFast?: () => Promise<unknown>;
  getStatus?: () => Promise<BlockerStatus>;
  setDomains: (
    domains: string[],
  ) => Promise<{ ok: boolean; domains?: string[]; reason?: string }>;
}

interface LockoutElectronApi {
  checkAccessibility?: () => Promise<{ granted: boolean }>;
  requestAccessibility?: () => Promise<{ granted: boolean }>;
}

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

export type BriefingAnchor = "mdb" | "adb" | "pmdb";

function getBlockerApi(): BlockerApi | null {
  const e = window as unknown as { electron?: { blocker?: BlockerApi } };
  return e.electron?.blocker ?? null;
}

function getLockoutApi(): LockoutElectronApi | null {
  const e = window as unknown as {
    electron?: { lockout?: LockoutElectronApi };
  };
  return e.electron?.lockout ?? null;
}

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
  const {
    defaultPlatform,
    proposerIframeSources,
    blockerQuickTarget,
    blockerCustomDomains,
    lockoutPermission,
    setLockoutPermission,
  } = useSettings();
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

  const ensureSelectedPlatformBlocked = useCallback(async () => {
    const api = getBlockerApi();
    if (!api) return;
    const target = resolveBlockerTarget({
      target: blockerQuickTarget,
      sources: proposerIframeSources,
      selectedPlatform: defaultPlatform,
    });
    const blockerDomains = mergeDomainLists(
      target?.domains ?? [],
      blockerCustomDomains,
    );
    if (blockerDomains.length === 0) return;

    try {
      const result = await api.setDomains(blockerDomains);
      if (!result.ok) return;
      const status = api.getStatus ? await api.getStatus() : null;
      const hasSystemLayer =
        !!status?.layers?.hosts || !!status?.layers?.resolver;
      if (hasSystemLayer) await api.enable();
      await api.enableFast();
      notifyBlockerStateUpdated();
    } catch {
      // Best effort only — lockout itself should still proceed.
    }
  }, [
    blockerCustomDomains,
    blockerQuickTarget,
    defaultPlatform,
    proposerIframeSources,
  ]);

  const releaseSelectedPlatformBlocker = useCallback(async () => {
    const api = getBlockerApi();
    if (!api) return;
    try {
      const status = api.getStatus ? await api.getStatus() : null;
      const hasSystemLayer =
        !!status?.layers?.hosts || !!status?.layers?.resolver;
      if (hasSystemLayer) await api.disable();
      else if (api.disableFast) await api.disableFast();
      else await api.disable();
      notifyBlockerStateUpdated();
    } catch {
      // Lockout state is server-owned; blocker release is best effort.
    }
  }, []);

  const ensureAccessibilityPermission = useCallback(async () => {
    const api = getLockoutApi();
    if (!api?.checkAccessibility) return true;
    try {
      const current = await api.checkAccessibility();
      if (current?.granted) {
        if (lockoutPermission !== "granted") setLockoutPermission("granted");
        return true;
      }
      const requested = api.requestAccessibility
        ? await api.requestAccessibility()
        : current;
      const granted = !!requested?.granted;
      setLockoutPermission(granted ? "granted" : "denied");
      return granted;
    } catch {
      return false;
    }
  }, [lockoutPermission, setLockoutPermission]);

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
      await ensureAccessibilityPermission();
      const ok = await toggleLockout(true, durationMinutes, windowStartTime);
      if (ok) {
        await ensureSelectedPlatformBlocked();
        await refresh();
      }
      return ok;
    },
    [ensureAccessibilityPermission, ensureSelectedPlatformBlocked, refresh],
  );

  const unlock = useCallback(async () => {
    const ok = await toggleLockout(false);
    if (ok) {
      await releaseSelectedPlatformBlocker();
      await refresh();
    }
    return ok;
  }, [refresh, releaseSelectedPlatformBlocker]);

  const lockUntilBriefing = useCallback(
    async (briefingAnchor: BriefingAnchor): Promise<LockoutState> => {
      try {
        await ensureAccessibilityPermission();
        const res = await fetch(`${API_BASE}/api/lockout/toggle`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locked: true, briefingAnchor }),
        });
        const data = await res.json();
        if (res.ok) {
          await ensureSelectedPlatformBlocked();
          await refresh();
        }
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
    },
    [ensureAccessibilityPermission, ensureSelectedPlatformBlocked, refresh],
  );

  /**
   * Schedule a timed lockout. Accepts either a duration + optional windowStartTime,
   * or an ISO timestamp to lock until.
   */
  const scheduleLock = useCallback(
    async (durationMinutes: number, windowStartTime?: string) => {
      try {
        await ensureAccessibilityPermission();
        const body: Record<string, unknown> = { durationMinutes };
        if (windowStartTime) body.windowStartTime = windowStartTime;
        const res = await fetch(`${API_BASE}/api/lockout/schedule`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const ok = res.ok;
        if (ok) {
          await ensureSelectedPlatformBlocked();
          await refresh();
        }
        return ok;
      } catch {
        return false;
      }
    },
    [ensureAccessibilityPermission, ensureSelectedPlatformBlocked, refresh],
  );

  /**
   * Lock until a specific ISO timestamp.
   */
  const lockUntil = useCallback(
    async (isoTimestamp: string) => {
      try {
        await ensureAccessibilityPermission();
        const res = await fetch(`${API_BASE}/api/lockout/schedule`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lockUntil: isoTimestamp }),
        });
        const ok = res.ok;
        if (ok) {
          await ensureSelectedPlatformBlocked();
          await refresh();
        }
        return ok;
      } catch {
        return false;
      }
    },
    [ensureAccessibilityPermission, ensureSelectedPlatformBlocked, refresh],
  );

  /**
   * Lock until next desk session window (minus 15 min auto-release).
   */
  const lockUntilDeskSession = useCallback(async (): Promise<LockoutState> => {
    try {
      await ensureAccessibilityPermission();
      const res = await fetch(
        `${API_BASE}/api/lockout/lock-until-desk-session`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await res.json();
      if (res.ok) {
        await ensureSelectedPlatformBlocked();
        await refresh();
      }
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
  }, [ensureAccessibilityPermission, ensureSelectedPlatformBlocked, refresh]);

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
    lockUntilBriefing,
    lockUntilDeskSession,
    getNextWindow,
    requestPermission: ensureAccessibilityPermission,
  };
}
