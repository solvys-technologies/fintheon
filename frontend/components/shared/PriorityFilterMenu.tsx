// [claude-code 2026-04-19] Multi-select priority filter — Nothing-design checkbox popover.
//   Replaces the single-value FilterDropdown so users can stack priority levels
//   (e.g. show CRIT + HIGH together). Empty selection = "All". Counts shown next to each
//   level mirror the mobile filter strip's count badges.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { AlertSeverity } from "../../lib/riskflow-feed";

const LEVELS: { value: AlertSeverity; label: string }[] = [
  { value: "critical", label: "CRIT" },
  { value: "high", label: "HIGH" },
  { value: "medium", label: "MED" },
  { value: "low", label: "LOW" },
];

interface PriorityFilterMenuProps {
  selected: Set<AlertSeverity>;
  onToggle: (s: AlertSeverity) => void;
  onClear: () => void;
  counts?: Partial<Record<AlertSeverity, number>>;
}

export function PriorityFilterMenu({
  selected,
  onToggle,
  onClear,
  counts,
}: PriorityFilterMenuProps) {
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
      ? "Priority: All"
      : selectedCount === 1
        ? `Priority: ${LEVELS.find((l) => selected.has(l.value))?.label ?? "—"}`
        : `Priority: ${selectedCount} selected`;

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
        title="Filter by priority — multi-select"
      >
        <span>{summary}</span>
        <ChevronDown
          className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[140px] py-1 bg-zinc-900 border border-zinc-700 rounded shadow-lg">
          <button
            type="button"
            onClick={() => {
              onClear();
            }}
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
          {LEVELS.map(({ value, label }) => {
            const isOn = selected.has(value);
            const count = counts?.[value];
            return (
              <button
                key={value}
                type="button"
                onClick={() => onToggle(value)}
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
                <span className="flex-1 text-left tracking-wider">{label}</span>
                {count != null && count > 0 && (
                  <span className="text-zinc-600 tabular-nums">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
