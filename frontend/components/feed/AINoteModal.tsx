// [claude-code 2026-04-26] iOS-style rounded popover for the RiskFlow card's
// AI note. Replaces the inline Oracle block — TP wants the card to feel like
// a social-media surface, with the analyst note tucked into a fade-in modal
// instead of inflating every card vertically.
//
// Style notes:
//   - Rounded 14px corners (iOS feel, not the usual 4px Solvys rectangle)
//   - Backdrop blur over a dimmed scrim
//   - Solvys Gold accent border at 25% opacity, no Kanban side stripe
//   - 220ms cubic-bezier fade-in, opacity-only (no transform spring)
//   - Click-outside or ESC dismisses

import { useEffect, useRef, useState } from "react";

export interface AINoteModalContent {
  summary: string;
  direction?: "bullish" | "bearish" | "neutral";
  instrument?: string;
  sourceUrl?: string | null;
  sourceHeadline?: string;
  generatedAt?: string;
}

interface AINoteModalProps {
  open: boolean;
  onClose: () => void;
  note: AINoteModalContent;
}

const FADE_OUT_MS = 220;

export function AINoteModal({ open, onClose, note }: AINoteModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  // Fade out, then unmount via parent's onClose.
  const beginClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, FADE_OUT_MS);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") beginClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const directionLabel =
    note.direction === "bullish"
      ? `Bullish${note.instrument ? ` for ${note.instrument}` : ""}`
      : note.direction === "bearish"
        ? `Bearish${note.instrument ? ` for ${note.instrument}` : ""}`
        : note.direction === "neutral"
          ? `Neutral${note.instrument ? ` for ${note.instrument}` : ""}`
          : null;

  const directionColor =
    note.direction === "bullish"
      ? "var(--fintheon-bullish, #34D399)"
      : note.direction === "bearish"
        ? "var(--fintheon-bearish, #EF4444)"
        : "var(--fintheon-accent)";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Analyst Note"
      ref={containerRef}
      onClick={(e) => {
        if (e.target === containerRef.current) beginClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "color-mix(in srgb, #050402 88%, transparent)",
        animation: closing
          ? `ainote-fade-out ${FADE_OUT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both`
          : "ainote-fade-in 220ms cubic-bezier(0.4, 0, 0.2, 1) both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] overflow-hidden"
        style={{
          background: "var(--fintheon-surface)",
          border:
            "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
          borderRadius: 14,
          animation: closing
            ? `ainote-pop-out ${FADE_OUT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both`
            : "ainote-pop-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        {/* Header — Hide button replaces the X icon, plain text per TP */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--fintheon-accent)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Analyst Note
          </span>
          <button
            type="button"
            onClick={beginClose}
            aria-label="Hide note"
            className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--fintheon-text)]/55 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            Hide
          </button>
        </div>

        {/* Source headline link */}
        {note.sourceUrl && note.sourceHeadline && (
          <a
            href={note.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-5 pb-2 text-[12px] text-[var(--fintheon-accent)] hover:underline break-words leading-snug"
          >
            {note.sourceHeadline}
          </a>
        )}

        {/* Body */}
        <p className="px-5 pb-3 text-[12px] text-[var(--fintheon-text)]/85 leading-relaxed break-words">
          {note.summary}
        </p>

        {/* Direction chip */}
        {directionLabel && (
          <div className="px-5 pb-4">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                color: directionColor,
                background: `color-mix(in srgb, ${directionColor} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${directionColor} 28%, transparent)`,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: directionColor }}
              />
              {directionLabel}
            </span>
          </div>
        )}

        {/* Footer */}
        {note.generatedAt && (
          <div className="px-5 pb-4 text-[9px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
            Generated {new Date(note.generatedAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Local keyframes — scoped to this component */}
      <style>{`
        @keyframes ainote-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ainote-fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes ainote-pop-in {
          from { opacity: 0; transform: translateY(6px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ainote-pop-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(4px) scale(0.99); }
        }
      `}</style>
    </div>
  );
}
