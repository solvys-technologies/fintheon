// [claude-code 2026-04-25] S40-P6: Refinement Engine country toggle. v1 only
// US is selectable; EU/UK/JP are scaffolded with a "coming soon" tooltip so
// the Refinement Engine layout matches the future shape.
//
// Edit-lock note: per the Refinement Engine Advanced pane lock (S37), this
// renders read-only by default — the toggle is purely visual until the
// non-US scrapers land.

import { useState } from "react";
import { CountryFlag } from "../primitives/CountryFlag";

type CountryCode = "US" | "EU" | "UK" | "JP";

interface CountryOption {
  code: CountryCode;
  label: string;
  enabled: boolean;
}

const OPTIONS: CountryOption[] = [
  { code: "US", label: "United States", enabled: true },
  { code: "EU", label: "Eurozone", enabled: false },
  { code: "UK", label: "United Kingdom", enabled: false },
  { code: "JP", label: "Japan", enabled: false },
];

interface CountryToggleProps {
  storageKey?: string;
}

export function CountryToggle({
  storageKey = "fintheon:refinement:country:v1",
}: CountryToggleProps) {
  const [selected, setSelected] = useState<CountryCode>(() => {
    if (typeof window === "undefined") return "US";
    const raw = window.localStorage.getItem(storageKey);
    if (raw === "EU" || raw === "UK" || raw === "JP") return "US"; // forced US in v1
    return "US";
  });

  const handleSelect = (code: CountryCode, enabled: boolean) => {
    if (!enabled) return;
    setSelected(code);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, code);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] uppercase tracking-wider text-[var(--fintheon-text)]/60 font-mono">
        Country
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => handleSelect(opt.code, opt.enabled)}
              disabled={!opt.enabled}
              title={
                opt.enabled
                  ? opt.label
                  : `${opt.label} — coming soon (v1 ships US-only)`
              }
              aria-pressed={isSelected}
              className={[
                "flex items-center gap-2 px-2.5 py-1 rounded-sm border text-[11px] transition-colors",
                isSelected && opt.enabled
                  ? "border-[var(--fintheon-accent)]/50 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-text)]"
                  : opt.enabled
                    ? "border-[var(--fintheon-text)]/15 hover:border-[var(--fintheon-text)]/30 text-[var(--fintheon-text)]/80"
                    : "border-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/30 cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              <CountryFlag country={opt.code} size={10} />
              <span className="font-mono">{opt.code}</span>
              {!opt.enabled && (
                <span className="text-[9px] opacity-70">soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
