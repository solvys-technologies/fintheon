// [claude-code 2026-03-05] Expandable econ event row: importance dots, US flag, print table.
// [claude-code 2026-03-11] Track 6: Volume bars (height=importance), beat/miss check/X, more row spacing.
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react';
import { useEconCalendar } from '../../contexts/EconCalendarContext';
import type { EconEventItem, EconPrintItem } from '../../lib/services';

/** Volume bar heights mapped to importance 1/2/3 */
const VOLUME_BAR: Record<number, { height: string; color: string }> = {
  1: { height: 'h-2.5', color: 'bg-zinc-600' },
  2: { height: 'h-4', color: 'bg-[var(--fintheon-accent)]' },
  3: { height: 'h-6', color: 'bg-red-400' },
};

const FLAG_EMOJI: Record<string, string> = {
  US: '\u{1F1FA}\u{1F1F8}',
  UK: '\u{1F1EC}\u{1F1E7}',
  GB: '\u{1F1EC}\u{1F1E7}',
  EU: '\u{1F1EA}\u{1F1FA}',
  JP: '\u{1F1EF}\u{1F1F5}',
  CA: '\u{1F1E8}\u{1F1E6}',
  AU: '\u{1F1E6}\u{1F1FA}',
  CN: '\u{1F1E8}\u{1F1F3}',
  CH: '\u{1F1E8}\u{1F1ED}',
};

type BeatStatus = 'beat' | 'miss' | 'pending';

function getBeatStatus(event: EconEventItem): BeatStatus {
  if (!event.actual || !event.forecast) return 'pending';
  const actual = parseFloat(event.actual);
  const forecast = parseFloat(event.forecast);
  if (isNaN(actual) || isNaN(forecast)) return 'pending';
  return actual >= forecast ? 'beat' : 'miss';
}

function getSurpriseColor(direction: string | null, goodBeta: boolean): string {
  if (!direction) return 'text-zinc-400';
  if (direction === 'beat') return goodBeta ? 'text-emerald-400' : 'text-red-400';
  if (direction === 'miss') return goodBeta ? 'text-red-400' : 'text-emerald-400';
  return 'text-zinc-400';
}

interface EconEventRowProps {
  event: EconEventItem;
}

export function EconEventRow({ event }: EconEventRowProps) {
  const { fetchPrints } = useEconCalendar();
  const [expanded, setExpanded] = useState(false);
  const [prints, setPrints] = useState<EconPrintItem[]>([]);
  const [loadingPrints, setLoadingPrints] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoadingPrints(true);
    fetchPrints(event.name).then((p) => {
      if (!cancelled) {
        setPrints(p.slice(0, 3));
        setLoadingPrints(false);
      }
    });
    return () => { cancelled = true; };
  }, [expanded, event.name, fetchPrints]);

  const bar = VOLUME_BAR[event.importance] ?? VOLUME_BAR[1];
  const flag = FLAG_EMOJI[event.country.toUpperCase()] ?? FLAG_EMOJI['US'];
  const beatStatus = getBeatStatus(event);
  const hasActual = !!event.actual;

  return (
    <div className="group">
      {/* Main row — increased vertical padding */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-[var(--fintheon-accent)]/5 transition-colors"
      >
        {/* Expand icon */}
        {expanded
          ? <ChevronDown className="w-3 h-3 text-[var(--fintheon-accent)]/60 shrink-0" />
          : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
        }

        {/* Flag */}
        <span className="text-sm shrink-0" title={event.country}>{flag}</span>

        {/* Volume bar (replaces importance dots) */}
        <div className="flex items-end shrink-0 w-3" title={`Impact: ${event.importance}/3`}>
          <div className={`w-full rounded-sm ${bar.height} ${bar.color}`} />
        </div>

        {/* Time */}
        {event.time && (
          <span className="text-[10px] text-zinc-500 font-mono shrink-0 w-12">
            {event.time}
          </span>
        )}

        {/* Event name */}
        <span className={`text-[11px] font-medium flex-1 min-w-0 truncate ${
          hasActual ? 'text-zinc-300' : 'text-zinc-100'
        }`}>
          {event.name}
        </span>

        {/* P / A / F columns (reordered: Prev, Actual, Forecast) */}
        <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono">
          <div className="w-14 text-right text-zinc-500" title="Previous">
            {event.previous ?? '-'}
          </div>
          <div className={`w-14 text-right font-semibold ${hasActual ? 'text-[var(--fintheon-accent)]' : 'text-zinc-600'}`} title="Actual">
            {event.actual ?? '-'}
          </div>
          <div className="w-14 text-right text-zinc-400" title="Forecast">
            {event.forecast ?? '-'}
          </div>
        </div>

        {/* Beat/miss indicator */}
        <div className="w-5 flex items-center justify-center shrink-0">
          {beatStatus === 'beat' && (
            <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
          )}
          {beatStatus === 'miss' && (
            <X className="w-3.5 h-3.5 text-red-400" strokeWidth={3} />
          )}
          {beatStatus === 'pending' && (
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 ml-6 border-l border-[var(--fintheon-accent)]/15 space-y-2">
          {/* Definition */}
          {event.definition && (
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              {event.definition}
            </p>
          )}

          {/* Column headers for prints table */}
          {prints.length > 0 && (
            <div className="mt-2">
              <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">
                Last {prints.length} Print{prints.length !== 1 ? 's' : ''}
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left py-1 font-medium">Date</th>
                    <th className="text-right py-1 font-medium">Prev</th>
                    <th className="text-right py-1 font-medium">Actual</th>
                    <th className="text-right py-1 font-medium">Fcst</th>
                    <th className="text-right py-1 font-medium">Surprise%</th>
                    <th className="text-center py-1 font-medium w-8">B/M</th>
                  </tr>
                </thead>
                <tbody>
                  {prints.map((p) => {
                    const printBeat = p.direction === 'beat' ? 'beat' as const
                      : p.direction === 'miss' ? 'miss' as const
                      : 'pending' as const;
                    return (
                      <tr key={p.id} className="border-b border-zinc-800/50">
                        <td className="py-1.5 text-zinc-400 font-mono">{p.date}</td>
                        <td className="py-1.5 text-right text-zinc-500 font-mono">{p.previous ?? '-'}</td>
                        <td className="py-1.5 text-right text-zinc-200 font-mono font-semibold">{p.actual ?? '-'}</td>
                        <td className="py-1.5 text-right text-zinc-400 font-mono">{p.forecast ?? '-'}</td>
                        <td className={`py-1.5 text-right font-mono font-semibold ${getSurpriseColor(p.direction, p.goodBeta)}`}>
                          {p.surprise != null ? `${p.surprise > 0 ? '+' : ''}${p.surprise.toFixed(1)}%` : '-'}
                        </td>
                        <td className="py-1.5 text-center">
                          {printBeat === 'beat' && <Check className="w-3 h-3 text-emerald-400 inline-block" strokeWidth={3} />}
                          {printBeat === 'miss' && <X className="w-3 h-3 text-red-400 inline-block" strokeWidth={3} />}
                          {printBeat === 'pending' && <span className="text-zinc-600">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {loadingPrints && (
            <div className="text-[10px] text-zinc-500 italic">Loading prints...</div>
          )}

          {!loadingPrints && prints.length === 0 && (
            <div className="text-[10px] text-zinc-600 italic">No historical prints available</div>
          )}
        </div>
      )}
    </div>
  );
}
