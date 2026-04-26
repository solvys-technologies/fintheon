// [claude-code 2026-04-26] RiskFlow-specific Ask handler that pipes the chat
// response into the iOS-rounded AINoteModal instead of the chat sidebar.
// Replaces the generic <AskAboutThis> CTA on RiskFlow detail cards.
//
// Flow:
//   1. User clicks the chat icon → modal opens immediately in [LOADING…] state
//   2. POST /api/riskflow/:id/generate-note (one-shot, returns structured note)
//   3. Response fills the modal body
//   4. Hide button (text, top-right) fades the modal out
//
// The chat sidebar is left alone — this is the modal-driven path TP wants for
// per-card context analysis.

import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { AINoteModal, type AINoteModalContent } from "./AINoteModal";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface AskRiskFlowModalProps {
  itemId: string;
  /** RiskFlow alert headline — passed into the modal as the source line. */
  headline: string;
  /** Original article URL — clickable inside the modal. */
  sourceUrl?: string | null;
  /** Existing agent note body (if already generated) — short-circuits the
   *  fetch so repeat clicks don't burn credits. */
  cachedNote?: string | null;
  /** Compact icon size (default 12). */
  size?: number;
  /** Show as hover-revealed (default true) — match other card affordances. */
  hoverReveal?: boolean;
  className?: string;
}

function readSelectedInstrument(): string {
  try {
    return localStorage.getItem("fintheon:selected-instrument") || "/ES";
  } catch {
    return "/ES";
  }
}

interface DetailedNoteResponse {
  source_url?: string | null;
  summary?: string;
  direction?: "bullish" | "bearish" | "neutral";
  instrument?: string;
}

export function AskRiskFlowModal({
  itemId,
  headline,
  sourceUrl,
  cachedNote,
  size = 12,
  hoverReveal = true,
  className,
}: AskRiskFlowModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<AINoteModalContent | null>(null);
  const { addToast } = useToast();

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setOpen(true);

      if (cachedNote) {
        setNote({
          summary: cachedNote,
          sourceUrl: sourceUrl ?? null,
          sourceHeadline: headline,
        });
        return;
      }

      if (loading || note) return;
      setLoading(true);
      try {
        const rawId = itemId.replace(/^backend-/, "");
        const instrument = readSelectedInstrument();
        const res = await fetch(
          `${API_BASE}/api/riskflow/${encodeURIComponent(rawId)}/generate-note`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instrument }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DetailedNoteResponse;
        if (!data.summary) throw new Error("empty_summary");
        setNote({
          summary: data.summary,
          direction: data.direction,
          instrument: data.instrument ?? instrument,
          sourceUrl: data.source_url ?? sourceUrl ?? null,
          sourceHeadline: headline,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn("[AskRiskFlowModal] generate-note failed:", err);
        addToast("Note generation failed", "error");
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [itemId, headline, sourceUrl, cachedNote, loading, note, addToast],
  );

  const baseClass =
    "inline-flex items-center justify-center rounded-md border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/60 transition-colors";

  const reveal = hoverReveal
    ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
    : "";

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="Ask about this"
        aria-label="Ask about this"
        className={`${baseClass} ${reveal} ${className ?? ""}`}
        style={{
          width: size + 12,
          height: size + 12,
          flexShrink: 0,
        }}
      >
        <MessageSquare size={size} strokeWidth={2} />
      </button>

      {open && (
        <AINoteModal
          open
          onClose={() => setOpen(false)}
          note={
            note ?? {
              summary: loading ? "[LOADING…]" : "",
              sourceUrl: sourceUrl ?? null,
              sourceHeadline: headline,
            }
          }
        />
      )}
    </>
  );
}
