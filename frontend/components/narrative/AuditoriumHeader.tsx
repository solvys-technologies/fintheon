// [claude-code 2026-03-23] Persistent Auditorium header — presets, run button, status, rolling period
// [claude-code 2026-03-25] Theme-sensitive fonts — use var(--font-heading) and var(--font-body)
import { Zap, Loader2 } from 'lucide-react';
import type { AuditoriumPreset } from '../../types/mirofish';
import { AuditoriumPresets } from './AuditoriumPresets';

interface AuditoriumHeaderProps {
  preset: AuditoriumPreset;
  onPresetChange: (p: AuditoriumPreset) => void;
  onRun: () => void;
  isLoading: boolean;
  status: 'idle' | 'running' | 'complete' | 'error';
  rollingDays: 7 | 14 | 30;
  onRollingChange: (d: 7 | 14 | 30) => void;
}

const ROLLING_OPTIONS = [7, 14, 30] as const;

export function AuditoriumHeader({
  preset, onPresetChange, onRun, isLoading, status, rollingDays, onRollingChange,
}: AuditoriumHeaderProps) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/10">
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold text-[var(--fintheon-accent)]/70 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          MiroFish
        </span>
        {status === 'complete' && (
          <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--fintheon-low)]/10 text-[var(--fintheon-low)] font-bold" style={{ fontFamily: 'var(--font-body)' }}>
            LIVE
          </span>
        )}
        {status === 'error' && (
          <span className="text-[9px] px-2 py-0.5 rounded bg-[var(--fintheon-severe)]/10 text-[var(--fintheon-severe)] font-bold" style={{ fontFamily: 'var(--font-body)' }}>
            ERROR
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <AuditoriumPresets active={preset} onChange={onPresetChange} />

        <div className="flex items-center rounded border border-[var(--fintheon-border)]/15 overflow-hidden">
          {ROLLING_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => onRollingChange(d)}
              className={`px-2 py-1 text-[10px] transition-colors ${
                rollingDays === d
                  ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/8'
                  : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {d}d
            </button>
          ))}
        </div>

        <button
          onClick={onRun}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold transition-colors border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-40"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {isLoading ? 'Running...' : 'Run MiroFish'}
        </button>
      </div>
    </div>
  );
}
