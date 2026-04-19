// [claude-code 2026-04-19] S25-T1: Renamed tabs to Command/Econ/Risk/5D; chart-focus hidden (Chart button owns it); 5D is a passive window indicator
// [claude-code 2026-03-23] Sanctum preset selector toolbar
import type { SanctumPreset } from "../../types/miroshark";
import { AUDITORIUM_PRESETS } from "../../types/miroshark";

interface SanctumPresetsProps {
  active: SanctumPreset;
  onChange: (preset: SanctumPreset) => void;
}

// Tabs visible in the Aquarium header. chart-focus is owned by the Chart button in the top bar.
const VISIBLE_PRESET_IDS: SanctumPreset[] = [
  "full-brief",
  "econ-watch",
  "risk-scan",
];

export function SanctumPresets({ active, onChange }: SanctumPresetsProps) {
  const visible = AUDITORIUM_PRESETS.filter((p) =>
    VISIBLE_PRESET_IDS.includes(p.id),
  );
  return (
    <div className="flex items-center rounded border border-[var(--fintheon-border)]/15 overflow-hidden">
      {visible.map(({ id, label, description }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1 text-[10px] tracking-wide transition-colors ${
            active === id
              ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8"
              : "text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/4"
          }`}
          title={description}
        >
          {label}
        </button>
      ))}
      <span
        className="px-3 py-1 text-[10px] tracking-wide text-[var(--fintheon-muted)]/50 border-l border-[var(--fintheon-border)]/15"
        title="5-day rolling window"
      >
        5D
      </span>
    </div>
  );
}
