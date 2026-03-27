// [claude-code 2026-03-26] T4: Sub-score breakdown bar for RiskFlow detail cards
import React from 'react';
import type { SubScoreBreakdown } from '../../lib/riskflow-feed';

interface SubScoreBarProps {
  subScores: SubScoreBreakdown;
}

const SEGMENTS: Array<{
  key: keyof Omit<SubScoreBreakdown, 'vixMultiplier' | 'regimeMultiplier' | 'regimeName' | 'commentatorMultiplier' | 'speaker'>;
  label: string;
  max: number;
  color: string;
}> = [
  { key: 'eventWeight', label: 'evt', max: 10, color: 'bg-[var(--fintheon-accent)]' },
  { key: 'timing',      label: 'tim', max: 3,  color: 'bg-cyan-500' },
  { key: 'deviation',   label: 'dev', max: 3,  color: 'bg-amber-500' },
  { key: 'momentum',    label: 'mom', max: 2,  color: 'bg-rose-500' },
  { key: 'vixContext',  label: 'vix', max: 10, color: 'bg-violet-500' },
];

const TOTAL_MAX = SEGMENTS.reduce((sum, s) => sum + s.max, 0); // 28

export function SubScoreBar({ subScores }: SubScoreBarProps) {
  return (
    <div className="w-full">
      {/* Bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/50 gap-px">
        {SEGMENTS.map((seg) => {
          const value = subScores[seg.key] ?? 0;
          const widthPct = (seg.max / TOTAL_MAX) * 100;
          const fillPct = seg.max > 0 ? (value / seg.max) * 100 : 0;
          return (
            <div
              key={seg.key}
              className="relative h-full"
              style={{ width: `${widthPct}%` }}
            >
              <div
                className={`absolute inset-y-0 left-0 ${seg.color} rounded-sm`}
                style={{ width: `${Math.min(fillPct, 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      {/* Labels */}
      <div className="flex mt-0.5 gap-px">
        {SEGMENTS.map((seg) => {
          const value = subScores[seg.key] ?? 0;
          const widthPct = (seg.max / TOTAL_MAX) * 100;
          return (
            <div
              key={seg.key}
              className="text-[8px] text-zinc-600 text-center truncate"
              style={{ width: `${widthPct}%` }}
            >
              {seg.label} {value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
