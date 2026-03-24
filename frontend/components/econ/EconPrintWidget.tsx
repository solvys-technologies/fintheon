// [claude-code 2026-03-05] Mini print widget: Prev/Forecast/Actual/Surprise% columns for a single event.
import type { EconPrintItem } from '../../lib/services';

function getSurpriseColor(direction: string | null, goodBeta: boolean): string {
  if (!direction) return 'text-zinc-500';
  if (direction === 'beat') return goodBeta ? 'text-emerald-400' : 'text-red-400';
  if (direction === 'miss') return goodBeta ? 'text-red-400' : 'text-emerald-400';
  return 'text-zinc-500';
}

function getDirectionIcon(direction: string | null): string {
  if (direction === 'beat') return '\u25B2';
  if (direction === 'miss') return '\u25BC';
  if (direction === 'inline') return '\u25C6';
  return '';
}

interface EconPrintWidgetProps {
  print: EconPrintItem;
  compact?: boolean;
}

export function EconPrintWidget({ print, compact = false }: EconPrintWidgetProps) {
  const surpColor = getSurpriseColor(print.direction, print.goodBeta);
  const dirIcon = getDirectionIcon(print.direction);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-zinc-500">{print.previous ?? '-'}</span>
        <span className="text-zinc-400">{print.forecast ?? '-'}</span>
        <span className="text-zinc-100 font-semibold">{print.actual ?? '-'}</span>
        <span className={`font-semibold ${surpColor}`}>
          {dirIcon} {print.surprise != null ? `${print.surprise > 0 ? '+' : ''}${print.surprise.toFixed(1)}%` : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1 text-[10px]">
      <div className="flex flex-col items-center">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider mb-0.5">Prev</span>
        <span className="font-mono text-zinc-500">{print.previous ?? '-'}</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider mb-0.5">Fcst</span>
        <span className="font-mono text-zinc-400">{print.forecast ?? '-'}</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider mb-0.5">Actual</span>
        <span className="font-mono text-zinc-100 font-semibold">{print.actual ?? '-'}</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider mb-0.5">Surprise</span>
        <span className={`font-mono font-semibold ${surpColor}`}>
          {dirIcon}{' '}
          {print.surprise != null ? `${print.surprise > 0 ? '+' : ''}${print.surprise.toFixed(1)}%` : '-'}
        </span>
      </div>
    </div>
  );
}
