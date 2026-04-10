// [claude-code 2026-03-30] Auto-refresh toggle — syncs with backend polling window status
// Auto-enables when polling window is active (8-11AM ET weekdays), auto-disables when not
import { useEffect, useRef } from "react";
import { useSettings } from "../../contexts/SettingsContext";

const API_BASE =
  (window as any).__FINTHEON_API_BASE__ || "http://localhost:8080";
const POLL_INTERVAL_MS = 30_000; // Check every 30s

export function AutoRefreshToggle({ size = "sm" }: { size?: "sm" | "xs" }) {
  const { autoRefresh, setAutoRefresh } = useSettings();
  const lastWindowState = useRef<boolean | null>(null);

  // Sync toggle with backend polling window state
  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/riskflow/polling-status`);
        if (!res.ok || !mounted) return;
        const data = await res.json();
        const windowActive: boolean = data.windowActive;

        // Auto-flip toggle when window state changes
        if (
          lastWindowState.current !== null &&
          lastWindowState.current !== windowActive
        ) {
          setAutoRefresh(windowActive);
        }
        lastWindowState.current = windowActive;
      } catch {
        // Backend unreachable — turn off
        if (lastWindowState.current !== false) {
          setAutoRefresh(false);
          lastWindowState.current = false;
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setAutoRefresh]);

  const h = size === "xs" ? "h-3" : "h-3.5";
  const w = size === "xs" ? "w-6" : "w-7";
  const dot = size === "xs" ? "w-2 h-2" : "w-2.5 h-2.5";
  const translate = size === "xs" ? "translate-x-3" : "translate-x-3.5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={autoRefresh}
      onClick={() => setAutoRefresh(!autoRefresh)}
      className={`relative inline-flex ${h} ${w} items-center rounded-full transition-colors shrink-0 ${
        autoRefresh
          ? "bg-[var(--fintheon-accent)]/30 border border-[var(--fintheon-accent)]/50"
          : "bg-zinc-800 border border-zinc-700"
      }`}
      title={
        autoRefresh
          ? "Auto-refresh ON (polling window active)"
          : "Auto-refresh OFF"
      }
    >
      <span
        className={`inline-block ${dot} rounded-full transition-transform ${
          autoRefresh
            ? `${translate} bg-[var(--fintheon-accent)]`
            : "translate-x-0.5 bg-zinc-500"
        }`}
      />
    </button>
  );
}
