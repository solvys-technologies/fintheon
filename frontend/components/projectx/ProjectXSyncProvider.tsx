import { useCallback, useEffect, useRef, useState } from "react";
import { useBackend } from "../../lib/backend";

const ACTIVE_SYNC_MS = 60_000;
const FALLBACK_SYNC_MS = 5 * 60_000;
const RATE_LIMIT_COOLDOWN_MS = 15 * 60_000;

export function ProjectXSyncProvider() {
  const backend = useBackend();
  const [isConfigured, setIsConfigured] = useState(false);
  const fastPausedUntilRef = useRef(0);
  const activeTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (activeTimerRef.current) window.clearInterval(activeTimerRef.current);
    if (fallbackTimerRef.current)
      window.clearInterval(fallbackTimerRef.current);
    activeTimerRef.current = null;
    fallbackTimerRef.current = null;
  }, []);

  const sync = useCallback(
    async (mode: "active" | "fallback") => {
      if (!isConfigured) return;
      if (mode === "active" && Date.now() < fastPausedUntilRef.current) return;
      if (mode === "active" && document.visibilityState !== "visible") return;

      try {
        const result = await backend.projectx.syncProjectXAccounts(mode);
        if (result.status === "rate_limited" || result.httpStatus === 429) {
          fastPausedUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        }
        if (result.status === "needs_credentials") setIsConfigured(false);
      } catch {
        if (mode === "active") {
          fastPausedUntilRef.current = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        }
      }
    },
    [backend, isConfigured],
  );

  const refreshStatus = useCallback(async () => {
    try {
      const status = await backend.projectx.getStatus();
      setIsConfigured(status.configured);
      if (status.configured) {
        void backend.projectx.syncProjectXAccounts("fallback").catch(() => {});
      }
    } catch {
      setIsConfigured(false);
    }
  }, [backend]);

  useEffect(() => {
    void refreshStatus();
    window.addEventListener("projectx:connection-updated", refreshStatus);
    return () => {
      window.removeEventListener("projectx:connection-updated", refreshStatus);
    };
  }, [refreshStatus]);

  useEffect(() => {
    clearTimers();
    if (!isConfigured) return clearTimers;
    activeTimerRef.current = window.setInterval(
      () => void sync("active"),
      ACTIVE_SYNC_MS,
    );
    fallbackTimerRef.current = window.setInterval(
      () => void sync("fallback"),
      FALLBACK_SYNC_MS,
    );
    return clearTimers;
  }, [clearTimers, isConfigured, sync]);

  return null;
}
