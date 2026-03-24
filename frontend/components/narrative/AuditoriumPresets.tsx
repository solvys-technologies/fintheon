// [claude-code 2026-03-23] Auditorium preset selector toolbar
import type { AuditoriumPreset } from '../../types/mirofish';
import { AUDITORIUM_PRESETS } from '../../types/mirofish';

interface AuditoriumPresetsProps {
  active: AuditoriumPreset;
  onChange: (preset: AuditoriumPreset) => void;
}

export function AuditoriumPresets({ active, onChange }: AuditoriumPresetsProps) {
  return (
    <div className="flex items-center rounded border border-[var(--fintheon-border)]/15 overflow-hidden">
      {AUDITORIUM_PRESETS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1 text-[10px] tracking-wide transition-colors ${
            active === id
              ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8'
              : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)] hover:bg-[var(--fintheon-accent)]/4'
          }`}
          title={AUDITORIUM_PRESETS.find(p => p.id === id)?.description}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
