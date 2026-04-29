// [claude-code 2026-04-28] S48-T3: CountdownFuse — NothingFuse wrapper with a
// beat/miss/par/X-close state machine and optional floating drag mode.
// State: IDLE→COUNTDOWN→BLINK→BEAT|MISS|PAR→CLOSEABLE
import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { NothingFuse } from "./NothingFuse";
import { useFloatingDrag } from "../../hooks/useFloatingDrag";

type FusePhase =
  | "countdown"
  | "blink"
  | "beat"
  | "miss"
  | "par"
  | "closeable"
  | "gone";

interface Props {
  eventName: string;
  countdownSeconds: number;
  forecast: string;
  actual: string | null;
  previous: string;
  beatMiss: "beat" | "miss" | "par" | null;
  floating?: boolean;
  onClose?: () => void;
}

const FUSE_COLORS = {
  beat: "var(--fintheon-bullish)",
  miss: "var(--fintheon-bearish)",
  par: "var(--fintheon-accent)",
  default: "var(--fintheon-accent)",
} as const;

const FUSE_LABELS = { beat: "BEAT", miss: "MISS", par: "PAR" } as const;

export function CountdownFuse({
  eventName,
  countdownSeconds,
  forecast,
  actual,
  previous,
  beatMiss,
  floating = false,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<FusePhase>(
    countdownSeconds > 0 ? "countdown" : "closeable",
  );
  const [remaining, setRemaining] = useState(countdownSeconds);
  const [blinkOn, setBlinkOn] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const {
    pos,
    dragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    redock,
  } = useFloatingDrag(floating);
  const containerRef = useRef<HTMLDivElement>(null);

  // Countdown tick
  useEffect(() => {
    if (phase !== "countdown" || remaining <= 0) return;
    const id = setInterval(
      () => setRemaining((r) => (r <= 1 ? 0 : r - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [phase, remaining]);

  // Phase transitions
  useEffect(() => {
    if (phase === "countdown" && remaining === 0) setPhase("blink");
  }, [phase, remaining]);

  useEffect(() => {
    if (phase !== "blink") return;
    const id = setInterval(() => {
      setBlinkCount((c) => {
        if (c >= 6) {
          clearInterval(id);
          return c;
        }
        setBlinkOn((p) => !p);
        return c + 1;
      });
    }, 300);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "blink" || blinkCount < 6) return;
    const t = setTimeout(
      () =>
        setPhase(
          beatMiss === "miss" ? "miss" : beatMiss === "beat" ? "beat" : "par",
        ),
      50,
    );
    return () => clearTimeout(t);
  }, [phase, blinkCount, beatMiss]);

  useEffect(() => {
    if (phase === "beat" || phase === "miss" || phase === "par") {
      const t = setTimeout(() => setPhase("closeable"), 500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // Auto-close after 30s
  useEffect(() => {
    if (phase !== "closeable") return;
    const t = setTimeout(() => {
      setDimmed(true);
      setTimeout(() => {
        setPhase("gone");
        onClose?.();
      }, 400);
    }, 30_000);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  const handleClose = useCallback(() => {
    setDimmed(true);
    setTimeout(() => {
      setPhase("gone");
      onClose?.();
    }, 400);
  }, [onClose]);

  // Double-tap detection for redock
  const [lastTap, setLastTap] = useState(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) redock();
    setLastTap(now);
  }, [lastTap, redock]);

  if (phase === "gone") return null;

  const fuseValue =
    phase === "countdown" && countdownSeconds > 0
      ? remaining / countdownSeconds
      : phase === "blink"
        ? blinkOn
          ? 1
          : 0
        : phase === "miss"
          ? 0
          : 1;

  const fuseColor =
    phase === "beat"
      ? FUSE_COLORS.beat
      : phase === "miss"
        ? FUSE_COLORS.miss
        : FUSE_COLORS.default;

  const isFinal =
    phase === "closeable" ||
    phase === "beat" ||
    phase === "miss" ||
    phase === "par";
  const fadeStyle: React.CSSProperties = {
    opacity: dimmed ? 0 : 1,
    transform: dimmed ? "scale(0.95)" : undefined,
    transition: "opacity 400ms ease, transform 400ms ease",
  };

  const floatingStyle: React.CSSProperties = floating
    ? {
        position: "fixed",
        zIndex: 50,
        top: pos?.y ?? 160,
        right: pos?.x ? undefined : 20,
        left: pos?.x ?? undefined,
        background: "var(--fintheon-glass-bg)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid var(--fintheon-glass-border)",
        borderRadius: 0,
        padding: "12px 14px 10px",
        minWidth: 220,
        maxWidth: 280,
        cursor: dragging ? "grabbing" : undefined,
        userSelect: "none",
        ...fadeStyle,
      }
    : fadeStyle;

  return (
    <div ref={containerRef} style={floatingStyle}>
      {floating && (
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleTap}
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 3,
            paddingBottom: 8,
            cursor: "grab",
            touchAction: "none",
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--fintheon-muted)",
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--fintheon-accent)",
            }}
          >
            {eventName}
          </div>
          <div
            style={{
              fontSize: 9,
              color: "var(--fintheon-muted)",
              marginTop: 1,
              fontFamily: "var(--font-body)",
            }}
          >
            F: {forecast} / P: {previous}
            {actual ? ` / A: ${actual}` : ""}
          </div>
        </div>
        {isFinal && (
          <button
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "1px solid var(--fintheon-glass-border)",
              padding: 2,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation:
                phase === "closeable"
                  ? "x-pulse 1s ease-in-out infinite"
                  : undefined,
            }}
          >
            <X size={12} color="var(--fintheon-muted)" />
          </button>
        )}
      </div>

      <NothingFuse
        value={fuseValue}
        color={fuseColor}
        orientation="horizontal"
        thickness={6}
        segments={10}
        animateIn={phase === "countdown"}
      />

      {isFinal && beatMiss && (
        <div
          style={{
            marginTop: 6,
            fontFamily: "var(--font-data)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: fuseColor,
            border: `1px solid ${fuseColor}`,
            display: "inline-block",
            padding: "1px 6px",
          }}
        >
          {FUSE_LABELS[beatMiss]}
        </div>
      )}
    </div>
  );
}
