// [claude-code 2026-05-13] Lockout hook — polls lockout status, provides toggle
import { useState, useEffect, useCallback, useRef } from "react";

export interface LockoutState {
  locked: boolean;
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
    };
  } catch {
    return { locked: false, until: null, remaining: null };
  }
}

async function toggleLockout(
  locked: boolean,
  durationMinutes?: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/lockout/toggle`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked, durationMinutes }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useLockout(pollMs = 5000) {
  const [state, setState] = useState<LockoutState>({
    locked: false,
    until: null,
    remaining: null,
  });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchLockout();
    setState(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, pollMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, pollMs]);

  const lock = useCallback(
    async (durationMinutes?: number) => {
      const ok = await toggleLockout(true, durationMinutes);
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

  return { state, loading, lock, unlock, refresh };
}
