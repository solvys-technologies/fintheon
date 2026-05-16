// [claude-code 2026-05-15] S66-T2: Themed lock screen overlay with frosted glass + countdown
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";
import { useLockout } from "../hooks/useLockout";

function formatCountdown(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "00:00:00";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export function LockScreen() {
  const { state } = useLockout();
  const [display, setDisplay] = useState<string>("00:00:00");
  const serverRemainingRef = useRef<number | null>(null);
  const serverTimeRef = useRef<number>(Date.now());

  const tick = useCallback(() => {
    if (serverRemainingRef.current == null || serverRemainingRef.current <= 0) {
      setDisplay("00:00:00");
      return;
    }
    const elapsed = (Date.now() - serverTimeRef.current) / 1000;
    const current = Math.max(0, serverRemainingRef.current - elapsed);
    setDisplay(formatCountdown(current));
  }, []);

  useEffect(() => {
    if (state.remaining != null) {
      serverRemainingRef.current = state.remaining;
      serverTimeRef.current = Date.now();
      tick();
    }
  }, [state.remaining, tick]);

  useEffect(() => {
    if (!state.locked) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state.locked, tick]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: state.locked ? "flex" : "none",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--fintheon-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            borderRadius: "0.75rem",
            border: "1px solid rgba(199,159,74,0.1)",
            padding: "2rem",
            background: "rgba(5,4,2,0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem",
          }}
        >
          <Lock
            size={48}
            color="var(--fintheon-accent)"
            style={{ flexShrink: 0 }}
          />
          <div
            style={{
              width: "50%",
              height: "1px",
              background: "var(--fintheon-accent)",
              opacity: 0.3,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontFamily: "system-ui",
                color: "var(--fintheon-text)",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              This app has been blocked by the agentic desk.
            </span>
            <span
              style={{
                fontFamily: "system-ui",
                color: "var(--fintheon-text)",
                opacity: 0.6,
                fontSize: "13px",
              }}
            >
              See you next session!
            </span>
          </div>
          <span
            style={{
              fontFamily: "system-ui, monospace",
              color: "var(--fintheon-accent)",
              fontSize: "28px",
              fontWeight: 300,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {display}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
