// [claude-code 2026-04-26] Inline analyst-note panel for the RiskFlow card.
// Renders inside the card's expanded body — NOT a global fixed-position
// overlay. Triggered by the chat-icon CTA on the card row, dismisses with the
// "Hide" text button (top-right) and a fade-out transition.
//
// Style: rounded 14px corners, accent border at 30%, solid surface fill (no
// backdrop-blur or box-shadow per the no-glass-effects rule). Fade-in/out via
// inline keyframes; ESC key closes.

import { useEffect, useState } from "react";

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
  /** When true (default), shows the source headline above the body. The card
   *  row already shows the headline at the top of the expanded surface, so
   *  callers usually pass `false` to avoid the duplicate render. */
  showSourceHeadline?: boolean;
}

const FADE_OUT_MS = 220;

export function AINoteModal({
  open,
  onClose,
  note,
  showSourceHeadline = false,
}: AINoteModalProps) {
  const [closing, setClosing] = useState(false);

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

  // Theme-sensitive — every color resolves through CSS custom properties so
  // the note inherits whatever palette is active.
  const directionColor =
    note.direction === "bullish"
      ? "var(--fintheon-bullish)"
      : note.direction === "bearish"
        ? "var(--fintheon-bearish)"
        : "var(--fintheon-accent)";

  return (
    <div
      role="region"
      aria-label="Analyst Note"
      onClick={(e) => e.stopPropagation()}
      className="relative w-full overflow-hidden mb-3"
      style={{
        background:
          "color-mix(in srgb, var(--fintheon-surface) 60%, transparent)",
        borderRadius: 14,
        animation: closing
          ? `ainote-pop-out ${FADE_OUT_MS}ms cubic-bezier(0.4, 0, 0.2, 1) both`
          : "ainote-pop-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      {/* Top fading ruler */}
      <FadingRule />

      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--fintheon-accent)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Analyst Note
        </span>
        <button
          type="button"
          onClick={beginClose}
          aria-label="Hide note"
          className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--fintheon-text)]/55 hover:text-[var(--fintheon-accent)] transition-colors"
        >
          Hide
        </button>
      </div>

      {showSourceHeadline && note.sourceUrl && note.sourceHeadline && (
        <a
          href={note.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 pb-2 text-[11px] text-[var(--fintheon-accent)] hover:underline break-words leading-snug"
        >
          {note.sourceHeadline}
        </a>
      )}

      {note.summary && (
        <p className="px-4 pb-3 text-[11px] text-[var(--fintheon-text)]/85 leading-relaxed break-words">
          {note.summary}
        </p>
      )}

      {directionLabel && (
        <>
          <FadingRule />
          <div className="px-4 py-2">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
              style={{
                color: directionColor,
                background: `color-mix(in srgb, ${directionColor} 14%, transparent)`,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: directionColor }}
              />
              {directionLabel}
            </span>
          </div>
        </>
      )}

      {note.generatedAt && (
        <>
          <FadingRule />
          <div className="px-4 py-2 text-[8px] uppercase tracking-wider text-[var(--fintheon-text)]/35">
            Generated {new Date(note.generatedAt).toLocaleString()}
          </div>
        </>
      )}

      {/* Bottom fading ruler */}
      <FadingRule />

      <style>{`
        @keyframes ainote-pop-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ainote-pop-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(2px); }
        }
      `}</style>
    </div>
  );
}

function FadingRule() {
  return (
    <div className="h-px relative">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, var(--fintheon-accent) 50%, transparent 100%)",
          opacity: 0.18,
        }}
      />
    </div>
  );
}
