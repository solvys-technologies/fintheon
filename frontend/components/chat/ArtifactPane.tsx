// [claude-code 2026-04-25] S42-T4: dual-pane artifact preview — chat-on-left, artifact-on-right
// Resizable (drag the left edge), collapsible (X), slides in via t-panel-slide once an
// artifact is loaded. Renders ArtifactSlot inside; consumes EmbeddedBrowserFrame /
// ReportViewer verbatim (no parallel iframe wrapper).
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Layers } from "lucide-react";
import { ArtifactSlot } from "./ArtifactSlot";
import type { ArtifactPayload } from "./artifactTypes";

const SPLIT_KEY = "fintheon:artifactSplit";
const DEFAULT_SPLIT = 0.4;
const MIN_SPLIT = 0.25;
const MAX_SPLIT = 0.7;

function readSplit(): number {
  if (typeof window === "undefined") return DEFAULT_SPLIT;
  const raw = window.localStorage.getItem(SPLIT_KEY);
  if (!raw) return DEFAULT_SPLIT;
  const v = Number(raw);
  if (!Number.isFinite(v)) return DEFAULT_SPLIT;
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, v));
}

interface ArtifactPaneProps {
  artifact: ArtifactPayload | null;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function ArtifactPane({
  artifact,
  onClose,
  containerRef,
}: ArtifactPaneProps) {
  const [split, setSplit] = useState<number>(readSplit);
  const [open, setOpen] = useState<boolean>(false);
  const dragging = useRef(false);

  // Drive t-panel-slide entry on first paint after artifact arrives so the
  // tween runs from the closed resting state (memory: t-panel-slide rAF).
  useEffect(() => {
    if (!artifact) {
      setOpen(false);
      return;
    }
    setOpen(false);
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [artifact]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startSplit = split;
      const containerWidth =
        containerRef.current?.getBoundingClientRect().width ?? 1;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current || containerWidth <= 0) return;
        const dx = startX - ev.clientX;
        const next = Math.min(
          MAX_SPLIT,
          Math.max(MIN_SPLIT, startSplit + dx / containerWidth),
        );
        setSplit(next);
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        try {
          window.localStorage.setItem(SPLIT_KEY, String(split));
        } catch {
          /* ignore quota / private mode */
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [split, containerRef],
  );

  // Persist on every committed split change (debounced via the mouseup handler
  // above, but also on prop-driven resets so the value sticks).
  useEffect(() => {
    try {
      window.localStorage.setItem(SPLIT_KEY, String(split));
    } catch {
      /* ignore */
    }
  }, [split]);

  if (!artifact) return null;

  return (
    <div
      className="t-panel-slide flex-shrink-0 flex h-full"
      data-open={open ? "true" : "false"}
      style={{ width: `${Math.round(split * 100)}%` }}
    >
      {/* Drag handle — left edge, full height, accent-on-hover */}
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        className="w-1 cursor-col-resize bg-[var(--fintheon-accent)]/15 hover:bg-[var(--fintheon-accent)]/40"
      />

      <div className="flex-1 flex flex-col bg-[var(--fintheon-surface)] border-l border-[var(--fintheon-accent)]/15 overflow-hidden">
        <div className="h-14 border-b border-[var(--fintheon-accent)]/15 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-wide">
              {labelFor(artifact)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--fintheon-accent)]/10 rounded transition-colors"
            aria-label="Close artifact pane"
          >
            <X className="w-4 h-4 text-[var(--fintheon-accent)]/70" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <ArtifactSlot artifact={artifact} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

function labelFor(a: ArtifactPayload): string {
  if (a.kind === "tradingview") return `Chart · ${a.payload.symbol}`;
  if (a.kind === "browserbase") return "Browser";
  if (a.kind === "report") return a.payload.title ?? "Report";
  return a.payload.source ?? "Source";
}
