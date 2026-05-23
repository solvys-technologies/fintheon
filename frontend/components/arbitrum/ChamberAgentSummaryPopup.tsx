// [claude-code 2026-05-03] Arbitrum-only floating agent rationale popup.
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { FadingRuler } from "../shared/FadingRuler";
import { DigitGroup } from "../shared/DigitGroup";
import { NothingFuse } from "../shared/NothingFuse";
import { ROLE_DISPLAY_NAMES } from "./ChamberSeats";
import type { ArbitrumSeat } from "./types";

const POPUP_WIDTH = 380;
const POPUP_GAP = 16;

interface ChamberAgentSummaryPopupProps {
  seat: ArbitrumSeat;
  index: number;
  zIndex: number;
  onClose: () => void;
  onActivate: () => void;
}

function initialPosition(index: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 72 + index * 28, y: 120 };
  return {
    x: Math.max(
      16,
      window.innerWidth - POPUP_WIDTH - index * (POPUP_WIDTH + POPUP_GAP),
    ),
    y: 128 + index * 42,
  };
}

function clampPosition(x: number, y: number): { x: number; y: number } {
  if (typeof window === "undefined") return { x, y };
  return {
    x: Math.max(8, Math.min(x, window.innerWidth - 320)),
    y: Math.max(8, Math.min(y, window.innerHeight - 160)),
  };
}

export function ChamberAgentSummaryPopup({
  seat,
  index,
  zIndex,
  onClose,
  onActivate,
}: ChamberAgentSummaryPopupProps) {
  const [position, setPosition] = useState(() => initialPosition(index));
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const score = Math.max(0, Math.min(10, seat.probability * 10));
  const displayName = ROLE_DISPLAY_NAMES[seat.role] ?? seat.role;

  return (
    <section
      className="fintheon-popover-surface fixed max-w-[calc(100vw-24px)] p-3 text-[var(--fintheon-text)]"
      style={{
        left: position.x,
        top: position.y,
        width: "min(380px, calc(100vw - 24px))",
        zIndex,
      }}
      aria-label={`${displayName} chamber summary`}
      onPointerDown={onActivate}
    >
      <header
        className="flex cursor-move touch-none select-none items-start justify-between gap-3"
        onPointerDown={(event) => {
          onActivate();
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            offsetX: event.clientX - position.x,
            offsetY: event.clientY - position.y,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          setPosition(
            clampPosition(
              event.clientX - drag.offsetX,
              event.clientY - drag.offsetY,
            ),
          );
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
            {displayName}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <DigitGroup
              value={score.toFixed(1)}
              className="text-[var(--fintheon-accent)] leading-none"
              style={{
                fontFamily: "Doto, ui-monospace, monospace",
                fontSize: 20,
              }}
            />
            <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/60">
              chamber score
            </span>
          </div>
        </div>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          className="shrink-0 p-1 text-[var(--fintheon-muted)]/70 hover:text-[var(--fintheon-accent)] transition-colors"
          aria-label={`Close ${displayName} summary`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <FadingRuler className="my-2.5" />

      <div className="max-h-[min(420px,calc(100vh-220px))] overflow-y-auto whitespace-pre-wrap pr-1 text-[12px] leading-relaxed text-[var(--fintheon-text)]/80">
        {seat.rationale || "No full summary published for this seat."}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[8px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]/45">
            Agent score
          </span>
          <span
            className="text-[9px] tabular-nums text-[var(--fintheon-accent)]"
            style={{ fontFamily: "Doto, ui-monospace, monospace" }}
          >
            {score.toFixed(1)}
          </span>
        </div>
        <NothingFuse
          value={score / 10}
          score={score}
          color="var(--fintheon-accent)"
          orientation="horizontal"
          thickness={7}
          segments={10}
          animateIn
        />
      </div>
    </section>
  );
}
