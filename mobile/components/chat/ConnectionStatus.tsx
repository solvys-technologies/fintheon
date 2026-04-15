// [claude-code 2026-04-15] T6: Relay connection status — polls health every 30s, three states

import { useState, useEffect, useCallback } from "react";

type RelayState = "connected" | "reconnecting" | "offline";

const API_BASE = import.meta.env.VITE_API_URL || "";

const DOT_COLORS: Record<RelayState, string> = {
  connected: "var(--success)",
  reconnecting: "var(--warning)",
  offline: "var(--error)",
};

const LABELS: Record<RelayState, string> = {
  connected: "CONNECTED",
  reconnecting: "RECONNECTING...",
  offline: "OFFLINE",
};

interface ConnectionStatusProps {
  onStateChange?: (state: RelayState) => void;
}

export default function ConnectionStatus({
  onStateChange,
}: ConnectionStatusProps) {
  const [state, setState] = useState<RelayState>("reconnecting");

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/relay/health`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        setState("offline");
        onStateChange?.("offline");
        return;
      }
      const data = await res.json();
      const next: RelayState = data.connected ? "connected" : "offline";
      setState(next);
      onStateChange?.(next);
    } catch {
      setState("offline");
      onStateChange?.("offline");
    }
  }, [onStateChange]);

  useEffect(() => {
    checkHealth();
    const id = setInterval(checkHealth, 30_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  return (
    <div
      role="status"
      aria-label={`Connection: ${LABELS[state]}`}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: DOT_COLORS[state],
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        [{LABELS[state]}]
      </span>
    </div>
  );
}

export type { RelayState };
