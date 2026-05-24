// [claude-code 2026-04-19] S25-T4a: Event-filter dropdown + timespan + Generate. Up to 4 events selectable, each option shows category tag + sub-desc (releases collected, last seen, next release). Generate fires onGenerate({events, timespan}) which the parent uses to mount EconEventCards with magical staggered fade-in.
import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Zap, Loader2 } from "lucide-react";
import type { EconEventCardData } from "./EconEventCard";

const MAX_EVENTS = 4;

const TIMESPANS = [
  { id: "1w", label: "1W" },
  { id: "1m", label: "1M" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "1y", label: "1Y" },
] as const;

export type EconTimespan = (typeof TIMESPANS)[number]["id"];

interface EconEventFilterProps {
  /** Catalogue of selectable events with sub-desc data already populated */
  catalogue: EconEventCardData[];
  isGenerating: boolean;
  onGenerate: (selection: {
    events: EconEventCardData[];
    timespan: EconTimespan;
  }) => void;
}

export function EconEventFilter({
  catalogue,
  isGenerating,
  onGenerate,
}: EconEventFilterProps) {
  const [open, setOpen] = useState(false);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);
  const [timespan, setTimespan] = useState<EconTimespan>("3m");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectedEvents = useMemo(
    () => catalogue.filter((c) => selectedTickers.includes(c.ticker)),
    [catalogue, selectedTickers],
  );

  const toggleTicker = (ticker: string) => {
    setSelectedTickers((prev) => {
      if (prev.includes(ticker)) return prev.filter((t) => t !== ticker);
      if (prev.length >= MAX_EVENTS) return prev; // hard cap
      return [...prev, ticker];
    });
  };

  const canGenerate = selectedTickers.length > 0 && !isGenerating;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Event dropdown */}
      <div ref={dropdownRef} className="relative flex-1 min-w-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]/40 hover:border-[var(--fintheon-accent)]/40 transition-colors"
        >
          <span className="text-[10px] tracking-wide text-[var(--fintheon-text)]/70">
            {selectedTickers.length === 0
              ? "Select up to 4 events"
              : `${selectedTickers.length}/${MAX_EVENTS} selected — ${selectedEvents.map((e) => e.ticker).join(" · ")}`}
          </span>
          <ChevronDown
            size={12}
            className={`transition-transform text-[var(--fintheon-muted)]/50 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown panel */}
        <div
          className="fintheon-dropdown-surface absolute top-full left-0 right-0 mt-1 z-30 rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden max-h-[420px] overflow-y-auto transition-[opacity,transform] duration-200 ease-out"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(-4px)",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {catalogue.length === 0 && (
            <p className="px-3 py-3 text-[10px] text-[var(--fintheon-muted)]/40">
              No events available — backend may be offline.
            </p>
          )}
          {catalogue.map((evt) => {
            const checked = selectedTickers.includes(evt.ticker);
            const disabled = !checked && selectedTickers.length >= MAX_EVENTS;
            return (
              <button
                key={evt.ticker}
                type="button"
                disabled={disabled}
                onClick={() => toggleTicker(evt.ticker)}
                className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors ${
                  checked
                    ? "bg-[var(--fintheon-accent)]/10"
                    : disabled
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-[var(--fintheon-accent)]/5"
                }`}
              >
                <div
                  className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    checked
                      ? "border-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/20"
                      : "border-[var(--fintheon-muted)]/30"
                  }`}
                >
                  {checked && (
                    <Check
                      size={10}
                      className="text-[var(--fintheon-accent)]"
                    />
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-bold text-[var(--fintheon-accent)]"
                      style={{
                        fontFamily: "Doto, ui-monospace, monospace",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {evt.ticker}
                    </span>
                    <span
                      className="text-[8px] tracking-[0.18em] uppercase text-[var(--fintheon-muted)]/60"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {categoryLabel(evt.category)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--fintheon-text)]/65 truncate">
                    {evt.name}
                  </span>
                  <span className="text-[9px] text-[var(--fintheon-muted)]/45">
                    {evt.releasesCollected} releases collected
                    {evt.lastSeen ? ` · last ${evt.lastSeen}` : ""}
                    {evt.nextRelease ? ` · next ${evt.nextRelease}` : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timespan picker */}
      <div className="flex items-center rounded-md border border-[var(--fintheon-accent)]/20 overflow-hidden">
        {TIMESPANS.map((ts) => (
          <button
            key={ts.id}
            type="button"
            onClick={() => setTimespan(ts.id)}
            className={`px-2.5 py-1.5 text-[10px] tracking-wide transition-colors ${
              timespan === ts.id
                ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                : "text-[var(--fintheon-muted)]/55 hover:text-[var(--fintheon-text)]"
            }`}
          >
            {ts.label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        type="button"
        disabled={!canGenerate}
        onClick={() =>
          canGenerate && onGenerate({ events: selectedEvents, timespan })
        }
        className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[10px] font-medium border border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {isGenerating ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Zap size={12} />
        )}
        Generate
      </button>
    </div>
  );
}

function categoryLabel(c: EconEventCardData["category"]): string {
  switch (c) {
    case "supply-chain":
      return "Supply Chain";
    case "employment":
      return "Employment";
    case "price-stability":
      return "Price Stability";
    default:
      return "General";
  }
}
