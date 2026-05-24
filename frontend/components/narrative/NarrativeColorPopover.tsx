import { Check } from "lucide-react";

interface NarrativeColorPopoverProps {
  color: string;
  onChange: (color: string) => void;
}

const SWATCHES = ["#c79f4a", "#34D399", "#FBBF24", "#A78BFA", "#14B8A6", "#F97316"];

export function NarrativeColorPopover({ color, onChange }: NarrativeColorPopoverProps) {
  return (
    <div className="fintheon-popover-surface w-44 px-3 py-2">
      <div className="mb-2 text-[9px] uppercase tracking-[0.18em] text-[var(--fintheon-muted)]">
        Color
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {SWATCHES.map((swatch) => {
          const isSelected = swatch.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={swatch}
              type="button"
              onClick={() => onChange(swatch)}
              className="flex h-5 w-5 items-center justify-center rounded border border-white/10"
              style={{ backgroundColor: swatch }}
              title={swatch}
            >
              {isSelected ? <Check size={12} className="text-black" /> : null}
            </button>
          );
        })}
      </div>
      <input
        value={color}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-7 w-full rounded border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-2 text-[11px] uppercase text-[var(--fintheon-text)] outline-none focus:border-[var(--fintheon-accent)]/45"
        aria-label="Narrative color hex"
      />
    </div>
  );
}
