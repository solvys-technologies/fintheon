// [claude-code 2026-03-16] T4: Chart mode dropdown — P&L, ER Trend, or Hybrid overlay
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type ChartMode = "pnl" | "er" | "hybrid";

interface HybridChartDropdownProps {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
}

const OPTIONS: { value: ChartMode; label: string }[] = [
  { value: "pnl", label: "P&L" },
  { value: "er", label: "ER Trend" },
  { value: "hybrid", label: "Hybrid" },
];

export function HybridChartDropdown({
  mode,
  onChange,
}: HybridChartDropdownProps) {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === mode) ?? OPTIONS[0];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded text-[var(--fintheon-text)] hover:border-[var(--fintheon-accent)]/40 transition-colors"
      >
        {current.label}
        <ChevronDown
          className={`w-3 h-3 text-[var(--fintheon-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="fintheon-dropdown-surface absolute top-full left-0 mt-0.5 z-20 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded shadow-lg min-w-[80px]">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full text-left px-2 py-1 text-[10px] transition-colors ${
                opt.value === mode
                  ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                  : "text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/5"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
