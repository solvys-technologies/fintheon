// [claude-code 2026-04-24] Wired t-dropdown transition (solvys-transitions) for open/close motion.
// [claude-code 2026-04-19] Multi-select source filter — mirrors PriorityFilterMenu.
//   Replaces the legacy granular <select> dropdown of 7 raw sources with a
//   7-bucket popover: Wire / Macro / OSINT / Commentary / Econ / Earnings / Geopolitical.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SOURCE_BUCKETS, type SourceBucket } from "../../lib/source-buckets";

interface SourceFilterMenuProps {
  selected: Set<SourceBucket>;
  onToggle: (b: SourceBucket) => void;
  onClear: () => void;
  counts?: Partial<Record<SourceBucket, number>>;
}

export function SourceFilterMenu({
  selected,
  onToggle,
  onClear,
  counts,
}: SourceFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedCount = selected.size;
  const summary =
    selectedCount === 0
      ? "Source: All"
      : selectedCount === 1
        ? `Source: ${[...selected][0]}`
        : `Source: ${selectedCount} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`px-1.5 py-0.5 bg-[var(--fintheon-bg)] border rounded text-[10px] focus:outline-none cursor-pointer flex items-center gap-1 transition-colors ${
          open || selectedCount > 0
            ? "border-[var(--fintheon-accent)]/40 text-[var(--fintheon-accent)]"
            : "border-zinc-800 text-zinc-400 hover:text-zinc-300"
        }`}
        title="Filter by source bucket — multi-select"
      >
        <span>{summary}</span>
        <ChevronDown
          className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        aria-hidden={!open}
        data-origin="top-left"
        className={`t-dropdown absolute left-0 top-full mt-1 z-50 min-w-[160px] py-1 bg-zinc-900 border border-zinc-700 rounded shadow-lg ${open ? "is-open" : ""}`}
      >
        <button
          type="button"
          onClick={() => onClear()}
          className={`flex items-center w-full px-2.5 py-1.5 text-[10px] gap-2 transition-colors ${
            selectedCount === 0
              ? "text-[var(--fintheon-accent)]"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <span className="inline-flex items-center justify-center w-3 h-3 border border-zinc-600">
            {selectedCount === 0 && (
              <Check className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
            )}
          </span>
          <span className="flex-1 text-left">All</span>
        </button>
        <div className="h-px bg-zinc-800 mx-1.5 my-0.5" />
        {SOURCE_BUCKETS.map((bucket) => {
          const isOn = selected.has(bucket);
          const count = counts?.[bucket];
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => onToggle(bucket)}
              className={`flex items-center w-full px-2.5 py-1.5 text-[10px] gap-2 transition-colors ${
                isOn
                  ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-3 h-3 border ${
                  isOn
                    ? "border-[var(--fintheon-accent)]/60"
                    : "border-zinc-600"
                }`}
              >
                {isOn && (
                  <Check className="w-2.5 h-2.5 text-[var(--fintheon-accent)]" />
                )}
              </span>
              <span className="flex-1 text-left tracking-wider">{bucket}</span>
              {count != null && count > 0 && (
                <span className="text-zinc-600 tabular-nums">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
