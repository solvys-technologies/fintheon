// [claude-code 2026-03-16] Auditorium — MiroFish prediction visualization panel (40% split view)
import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import type { AuditoriumData } from '../../types/mirofish';
import { AuditoriumChart } from './AuditoriumChart';
import { AuditoriumKanban } from './AuditoriumKanban';
import { AuditoriumTheses } from './AuditoriumTheses';

interface CatalystInput {
  id: string;
  title: string;
  date: string;
  sentiment: string;
  severity: string;
  category?: string;
  narrativeIds?: string[];
}

interface AuditoriumProps {
  data: AuditoriumData | null;
  onRun: () => Promise<void>;
  catalysts: CatalystInput[];
}

const ROLLING_OPTIONS = [7, 14, 30] as const;

export function Auditorium({ data, onRun, catalysts }: AuditoriumProps) {
  const [rollingDays, setRollingDays] = useState<7 | 14 | 30>(14);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      await onRun();
    } finally {
      setRunning(false);
    }
  };

  const status = data?.status ?? 'idle';
  const isLoading = running || status === 'running';

  return (
    <div
      className="w-[40%] h-full flex flex-col border-l border-[var(--fintheon-border)]/20 overflow-hidden"
      style={{ backgroundColor: 'var(--fintheon-surface)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-border)]/15">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-xs font-medium text-[var(--fintheon-text)]">Auditorium</span>
          {status === 'complete' && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#34D399]/10 text-[#34D399] font-mono">
              LIVE
            </span>
          )}
          {status === 'error' && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#EF4444]/10 text-[#EF4444] font-mono">
              ERROR
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Rolling period toggle */}
          <div className="flex items-center rounded border border-[var(--fintheon-border)]/15 overflow-hidden">
            {ROLLING_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setRollingDays(d)}
                className={`px-1.5 py-0.5 text-[9px] font-mono transition-colors ${
                  rollingDays === d
                    ? 'text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10'
                    : 'text-[var(--fintheon-muted)]/50 hover:text-[var(--fintheon-text)]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isLoading}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium transition-colors bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/20 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {isLoading ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {status === 'idle' && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Zap className="w-8 h-8 text-[var(--fintheon-accent)]/20 mb-3" />
            <p className="text-xs text-[var(--fintheon-muted)]/40">
              Run MiroFish to generate predictions
            </p>
            <p className="text-[9px] text-[var(--fintheon-muted)]/25 mt-1">
              5-agent debate simulation across 6 risk categories
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-[var(--fintheon-accent)] animate-spin mb-3" />
            <p className="text-xs text-[var(--fintheon-muted)]/50">
              Agents debating...
            </p>
          </div>
        )}

        {status === 'complete' && data && !isLoading && (
          <div className="flex flex-col gap-3 p-3">
            {/* Score summary */}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--fintheon-muted)]/60">Composite IV</span>
              <span className="text-[var(--fintheon-accent)] font-mono font-bold text-sm">
                {data.compositeIV.toFixed(1)}
              </span>
            </div>

            {/* Chart section */}
            <div>
              <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-1 uppercase tracking-wider">
                Predicted IV by Risk Type
              </div>
              <AuditoriumChart
                timeSeries={data.timeSeries}
                rollingDays={rollingDays}
              />
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {(['geopolitical', 'political', 'monetary-policy', 'earnings-corporate', 'market-structure', 'black-swan'] as const).map(cat => (
                  <div key={cat} className="flex items-center gap-1">
                    <div className="w-2 h-[2px]" style={{ backgroundColor: { geopolitical: '#EF4444', political: '#8B5CF6', 'monetary-policy': '#3B82F6', 'earnings-corporate': '#10B981', 'market-structure': '#F59E0B', 'black-swan': '#EC4899' }[cat] }} />
                    <span className="text-[7px] text-[var(--fintheon-muted)]/40">{cat.split('-')[0]}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-[2px]" style={{ backgroundColor: '#c79f4a' }} />
                  <span className="text-[7px] text-[var(--fintheon-accent)]/60 font-bold">composite</span>
                </div>
              </div>
            </div>

            {/* Kanban section */}
            <div>
              <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-1 uppercase tracking-wider">
                Upcoming Events by Risk
              </div>
              <AuditoriumKanban
                catalysts={catalysts}
                generatedEvents={data.generatedEvents}
              />
            </div>

            {/* Theses section */}
            <div>
              <div className="text-[9px] text-[var(--fintheon-muted)]/40 font-mono mb-1 uppercase tracking-wider">
                Top Volatile Theses
              </div>
              <AuditoriumTheses
                scenarios={data.scenarios}
                categoryScores={data.categoryScores}
              />
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-[8px] text-[var(--fintheon-muted)]/25 pt-1 border-t border-[var(--fintheon-border)]/10">
              <span>Regime shift: {(data.regimeShiftProbability * 100).toFixed(0)}%</span>
              <span>Confidence: {(data.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}

        {status === 'error' && data?.error && (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <p className="text-xs text-[#EF4444]/70 text-center">{data.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
