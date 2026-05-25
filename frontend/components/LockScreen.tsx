// [claude-code 2026-05-15] S66-T2: Themed lock screen overlay with frosted glass + countdown
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLockout } from "../hooks/useLockout";
import { DeskBlockOverlay } from "./blocker/DeskBlockOverlay";

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
    <DeskBlockOverlay visible={state.locked} fixed countdown={display} />,
    document.body,
  );
}
