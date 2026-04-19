// [claude-code 2026-03-23] Sanctum preset selector toolbar
import type { SanctumPreset } from "../../types/agent-desk";
import { AUDITORIUM_PRESETS } from "../../types/agent-desk";

interface SanctumPresetsProps {
  active: SanctumPreset;
  onChange: (preset: SanctumPreset) => void;
}

export function SanctumPresets({ active, onChange }: SanctumPresetsProps) {
  return (
    <div className="flex items-center rounded border border-[var(--fintheon-border)]/15 overflow-hidden">
      {AUDITORIUM_PRESETS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1 text-[10px] tracking-wide transition-colors ${
            active === id
              ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8"
              : "text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/4"
          }`}
          title={AUDITORIUM_PRESETS.find((p) => p.id === id)?.description}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
