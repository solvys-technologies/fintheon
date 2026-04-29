// [claude-code 2026-04-28] S48-T3: CountdownFuse — NothingFuse wrapper with a
// beat/miss/par/X-close state machine and optional floating drag mode.
// State: IDLE→COUNTDOWN→BLINK→BEAT|MISS|PAR→CLOSEABLE
// Floating mode: drag on braille-pattern handle, glass pill, localStorage position.
import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { NothingFuse } from "./NothingFuse";

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

const POS_KEY = "fintheon:countdown-position";

function loadPosition(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { x: number; y: number };
  } catch {
    return null;
  }
}

function savePosition(pos: { x: number; y: number }) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  } catch {
    // silent
  }
}

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

  // Floating position
  const [pos, setPos] = useState(() => loadPosition());
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    posX: number;
    posY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Countdown tick
  useEffect(() => {
    if (phase !== "countdown" || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, remaining]);

  // Transition to blink when countdown reaches 0
  useEffect(() => {
    if (phase === "countdown" && remaining === 0) {
      setPhase("blink");
    }
  }, [phase, remaining]);

  // Blink phase: 3 rapid toggles (300ms × 6 = 1.8s)
  useEffect(() => {
    if (phase !== "blink") return;
    const interval = setInterval(() => {
      setBlinkCount((c) => {
        if (c >= 6) {
          clearInterval(interval);
          return c;
        }
        setBlinkOn((prev) => !prev);
        return c + 1;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [phase]);

  // After blink, settle into beat/miss/par
  useEffect(() => {
    if (phase === "blink" && blinkCount >= 6) {
      const timer = setTimeout(() => {
        if (beatMiss === "beat") setPhase("beat");
        else if (beatMiss === "miss") setPhase("miss");
        else if (beatMiss === "par") setPhase("par");
        else setPhase("par");
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [phase, blinkCount, beatMiss]);

  // After settle (beat/miss/par), become closeable after 500ms
  useEffect(() => {
    if (phase === "beat" || phase === "miss" || phase === "par") {
      const timer = setTimeout(() => setPhase("closeable"), 500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Auto-close 30s after becoming closeable
  useEffect(() => {
    if (phase !== "closeable") return;
    const timer = setTimeout(() => {
      setDimmed(true);
      setTimeout(() => {
        setPhase("gone");
        onClose?.();
      }, 400);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [phase, onClose]);

  const handleClose = useCallback(() => {
    setDimmed(true);
    setTimeout(() => {
      setPhase("gone");
      onClose?.();
    }, 400);
  }, [onClose]);

  // Drag handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!floating) return;
      e.preventDefault();
      const current = pos ?? { x: 0, y: 0 };
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: current.x,
        posY: current.y,
      };
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [floating, pos],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newPos = {
        x: dragRef.current.posX + dx * 0.08,
        y: dragRef.current.posY + dy * 0.08,
      };
      setPos(newPos);
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    dragRef.current = null;
    if (pos) savePosition(pos);
  }, [dragging, pos]);

  // Double-tap to re-dock
  const [lastTap, setLastTap] = useState(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) {
      setPos(null);
      try {
        localStorage.removeItem(POS_KEY);
      } catch {
        /* silent */
      }
    }
    setLastTap(now);
  }, [lastTap]);

  if (phase === "gone") return null;

  const fuseValue =
    phase === "countdown"
      ? countdownSeconds > 0
        ? remaining / countdownSeconds
        : 1
      : phase === "blink"
        ? blinkOn
          ? 1
          : 0
        : phase === "miss"
          ? 0
          : 1;

  const fuseColor =
    phase === "beat"
      ? "var(--fintheon-bullish)"
      : phase === "miss"
        ? "var(--fintheon-bearish)"
        : "var(--fintheon-accent)";

  const isFinal =
    phase === "closeable" ||
    phase === "beat" ||
    phase === "miss" ||
    phase === "par";

  const containerStyle: React.CSSProperties = floating
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
        opacity: dimmed ? 0 : 1,
        transform: dimmed ? "scale(0.95)" : undefined,
        transition: "opacity 400ms ease, transform 400ms ease",
        cursor: dragging ? "grabbing" : undefined,
        userSelect: "none",
      }
    : {
        opacity: dimmed ? 0 : 1,
        transform: dimmed ? "scale(0.95)" : undefined,
        transition: "opacity 400ms ease, transform 400ms ease",
      };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Braille-pattern drag handle */}
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

      {/* Header row */}
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
            F: {forecast} · P: {previous}
            {actual && ` · A: ${actual}`}
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

      {/* Fuse bar */}
      <NothingFuse
        value={fuseValue}
        color={fuseColor}
        orientation="horizontal"
        thickness={6}
        segments={10}
        animateIn={phase === "countdown"}
      />

      {/* Beat/miss/par badge */}
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
          {phase === "beat" ? "BEAT" : phase === "miss" ? "MISS" : "PAR"}
        </div>
      )}
    </div>
  );
}
