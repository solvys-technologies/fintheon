// [claude-code 2026-04-11] S14-T5: Multi-select headline attachment for chat surfaces
import { useState, useEffect, useRef, useMemo } from "react";
import { X, Search, Check, Newspaper } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";

export interface HeadlineChip {
  id: string;
  headline: string;
  severity?: string;
  direction?: string | null;
  instrument?: string | null;
}

interface HeadlinePickerPopoverProps {
  open: boolean;
  onClose: () => void;
  alerts: RiskFlowAlert[];
  selected: HeadlineChip[];
  onToggle: (chip: HeadlineChip) => void;
  onClear: () => void;
}

export function HeadlinePickerPopover({
  open,
  onClose,
  alerts,
  selected,
  onToggle,
  onClear,
}: HeadlinePickerPopoverProps) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const selectedIds = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? alerts.filter((a) => a.headline.toLowerCase().includes(q))
      : alerts;
    return list.slice(0, 20);
  }, [alerts, query]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 right-0 z-50 mb-1 mx-2 max-h-64 flex flex-col rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10 shrink-0">
        <span className="text-[9px] text-[var(--fintheon-accent)]/50 uppercase tracking-wider flex items-center gap-1.5">
          <Newspaper size={10} />
          Attach Headlines
          {selected.length > 0 && (
            <span className="text-[var(--fintheon-accent)]">
              ({selected.length})
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              onClick={onClear}
              className="text-[9px] text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/60 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-[var(--fintheon-accent)]/10 shrink-0">
        <div className="flex items-center gap-2 rounded-md bg-[var(--fintheon-accent)]/5 px-2 py-1">
          <Search size={11} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headlines..."
            className="flex-1 bg-transparent text-[11px] text-[var(--fintheon-text)] placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Items */}
      <div className="overflow-y-auto flex-1">
        {filtered.map((a) => {
          const isSelected = selectedIds.has(a.id);
          return (
            <button
              key={a.id}
              onClick={() =>
                onToggle({
                  id: a.id,
                  headline: a.headline,
                  severity: a.severity,
                  direction: a.direction,
                  instrument: a.instrument,
                })
              }
              className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors flex items-center gap-2 ${
                isSelected
                  ? "bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-text)]"
                  : "text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]"
              }`}
            >
              {/* Severity dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  a.severity === "high" || a.severity === "critical"
                    ? "bg-red-400"
                    : a.severity === "medium"
                      ? "bg-[var(--fintheon-accent)]"
                      : "bg-zinc-500"
                }`}
              />
              <span className="truncate flex-1">{a.headline}</span>
              {a.direction && (
                <span
                  className={`text-[8px] shrink-0 ${
                    a.direction === "Bullish"
                      ? "text-emerald-400/60"
                      : a.direction === "Bearish"
                        ? "text-red-400/60"
                        : "text-zinc-500"
                  }`}
                >
                  {a.direction}
                </span>
              )}
              {/* Checkbox */}
              <span
                className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                  isSelected
                    ? "border-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/20"
                    : "border-zinc-600"
                }`}
              >
                {isSelected && (
                  <Check size={9} className="text-[var(--fintheon-accent)]" />
                )}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-[10px] text-zinc-600">
            {query ? "No matching headlines" : "No headlines available"}
          </div>
        )}
      </div>
    </div>
  );
}

/** Render headline chips above input with remove buttons */
export function HeadlineChips({
  chips,
  onRemove,
}: {
  chips: HeadlineChip[];
  onRemove: (id: string) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 px-3 pb-1">
      {chips.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
        >
          {c.headline.slice(0, 40)}
          {c.headline.length > 40 ? "..." : ""}
          <button
            onClick={() => onRemove(c.id)}
            className="hover:text-red-400 transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Format selected headline chips into context text for message injection */
export function formatHeadlineContext(chips: HeadlineChip[]): string {
  if (chips.length === 0) return "";
  const lines = chips.map((c) => {
    const parts = [c.headline];
    if (c.direction) parts.push(`(${c.direction})`);
    if (c.instrument) parts.push(`[${c.instrument}]`);
    return `- ${parts.join(" ")}`;
  });
  return `\n\n[Attached Headlines]\n${lines.join("\n")}`;
}
