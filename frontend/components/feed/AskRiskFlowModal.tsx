// [claude-code 2026-04-26] RiskFlow chat-CTA → inline persistent analyst note.
// Split into:
//   useRiskFlowNote(itemId) — hook owning {note, hidden, loading, ...}
//   RiskFlowNoteTrigger      — the chat icon (lives in card header)
//   RiskFlowNotePanel        — the inline panel (lives in card body flow)
//
// Persistence: note content + hidden flag both kept in localStorage keyed by
// itemId so the panel survives re-expansions and page reloads. Hide button
// dismisses with a fade-out; clicking the trigger again re-shows it without
// refetching.
//
// AskRiskFlowModal kept as a back-compat re-export — old call sites that
// renderered the unified component get the trigger only.

import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { AINoteModal, type AINoteModalContent } from "./AINoteModal";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

const NOTE_STORAGE_PREFIX = "fintheon:risk-note:";
const HIDDEN_STORAGE_PREFIX = "fintheon:risk-note-hidden:";

function noteStorageKey(itemId: string): string {
  return `${NOTE_STORAGE_PREFIX}${itemId}`;
}
function hiddenStorageKey(itemId: string): string {
  return `${HIDDEN_STORAGE_PREFIX}${itemId}`;
}
function readSelectedInstrument(): string {
  try {
    return localStorage.getItem("fintheon:selected-instrument") || "/ES";
  } catch {
    return "/ES";
  }
}
function readPersistedNote(itemId: string): AINoteModalContent | null {
  try {
    const raw = localStorage.getItem(noteStorageKey(itemId));
    if (!raw) return null;
    return JSON.parse(raw) as AINoteModalContent;
  } catch {
    return null;
  }
}
function writePersistedNote(itemId: string, note: AINoteModalContent): void {
  try {
    localStorage.setItem(noteStorageKey(itemId), JSON.stringify(note));
  } catch {
    /* quota exceeded — ignore */
  }
}
function readHidden(itemId: string): boolean {
  try {
    return localStorage.getItem(hiddenStorageKey(itemId)) === "1";
  } catch {
    return false;
  }
}
function writeHidden(itemId: string, hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(hiddenStorageKey(itemId), "1");
    else localStorage.removeItem(hiddenStorageKey(itemId));
  } catch {
    /* ignore */
  }
}

interface DetailedNoteResponse {
  source_url?: string | null;
  summary?: string;
  direction?: "bullish" | "bearish" | "neutral";
  instrument?: string;
}

export interface RiskFlowNoteState {
  note: AINoteModalContent | null;
  hidden: boolean;
  loading: boolean;
  trigger: () => void;
  hide: () => void;
}

export function useRiskFlowNote(opts: {
  itemId: string;
  headline: string;
  sourceUrl?: string | null;
  cachedNote?: string | null;
}): RiskFlowNoteState {
  const { itemId, headline, sourceUrl, cachedNote } = opts;
  const [note, setNote] = useState<AINoteModalContent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    const persisted = readPersistedNote(itemId);
    if (persisted) {
      setNote(persisted);
    } else if (cachedNote) {
      const seeded: AINoteModalContent = {
        summary: cachedNote,
        sourceUrl: sourceUrl ?? null,
        sourceHeadline: headline,
      };
      setNote(seeded);
      writePersistedNote(itemId, seeded);
    }
    setHidden(readHidden(itemId));
  }, [itemId, headline, sourceUrl, cachedNote]);

  const trigger = useCallback(async () => {
    if (note && hidden) {
      setHidden(false);
      writeHidden(itemId, false);
      return;
    }
    if (note) return;
    if (loading) return;
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
      const next: AINoteModalContent = {
        summary: data.summary,
        direction: data.direction,
        instrument: data.instrument ?? instrument,
        sourceUrl: data.source_url ?? sourceUrl ?? null,
        sourceHeadline: headline,
        generatedAt: new Date().toISOString(),
      };
      setNote(next);
      writePersistedNote(itemId, next);
      setHidden(false);
      writeHidden(itemId, false);
    } catch (err) {
      console.warn("[useRiskFlowNote] generate-note failed:", err);
      addToast("Note generation failed", "error");
    } finally {
      setLoading(false);
    }
  }, [itemId, headline, sourceUrl, note, hidden, loading, addToast]);

  const hide = useCallback(() => {
    setHidden(true);
    writeHidden(itemId, true);
  }, [itemId]);

  return { note, hidden, loading, trigger, hide };
}

interface RiskFlowNoteTriggerProps {
  state: RiskFlowNoteState;
  size?: number;
  hoverReveal?: boolean;
  className?: string;
}

export function RiskFlowNoteTrigger({
  state,
  size = 12,
  hoverReveal = true,
  className,
}: RiskFlowNoteTriggerProps) {
  const baseClass =
    "inline-flex items-center justify-center rounded-md border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/60 transition-colors";
  const reveal = hoverReveal
    ? "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200"
    : "";
  const title = state.loading
    ? "Generating…"
    : state.note
      ? state.hidden
        ? "Show analyst note"
        : "Note ready"
      : "Generate analyst note";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void state.trigger();
      }}
      title={title}
      aria-label="Toggle analyst note"
      className={`${baseClass} ${reveal} ${className ?? ""}`}
      style={{ width: size + 12, height: size + 12, flexShrink: 0 }}
    >
      <MessageSquare size={size} strokeWidth={2} />
    </button>
  );
}

interface RiskFlowNotePanelProps {
  state: RiskFlowNoteState;
}

export function RiskFlowNotePanel({ state }: RiskFlowNotePanelProps) {
  if (!state.note || state.hidden) return null;
  return <AINoteModal open onClose={state.hide} note={state.note} />;
}

// Back-compat re-export — old call sites get the trigger button only.
interface AskRiskFlowModalProps {
  itemId: string;
  headline: string;
  sourceUrl?: string | null;
  cachedNote?: string | null;
  size?: number;
  hoverReveal?: boolean;
  className?: string;
}

export function AskRiskFlowModal(props: AskRiskFlowModalProps) {
  const state = useRiskFlowNote({
    itemId: props.itemId,
    headline: props.headline,
    sourceUrl: props.sourceUrl,
    cachedNote: props.cachedNote,
  });
  return (
    <>
      <RiskFlowNoteTrigger
        state={state}
        size={props.size}
        hoverReveal={props.hoverReveal}
        className={props.className}
      />
      <RiskFlowNotePanel state={state} />
    </>
  );
}
