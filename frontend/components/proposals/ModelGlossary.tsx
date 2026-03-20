// [claude-code 2026-03-20] S3:T2e — ModelGlossary redesign: fused card, merged items, rounded whole card
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ModelEntry {
  name: string;
  description: string;
  whenToUse: string;
  riskProfile: string;
}

const MODELS: ModelEntry[] = [
  {
    name: 'FortyForty Club',
    description:
      'Targets instruments where IV rank is above 40 and the 40-day moving average slope flips. Catches the inflection point where premium sellers get trapped and directional momentum ignites.',
    whenToUse: 'High IV environments with a clear slope change on the 40 DMA. Best after extended consolidation or a volatility squeeze.',
    riskProfile: 'Moderate — tight stops at the prior swing, 2:1 minimum R:R. Sized at 1-2 contracts.',
  },
  {
    name: 'Ripper',
    description:
      'Momentum continuation model. Identifies "charged" setups where multiple timeframe alignment (5m, 15m, 1h) confirms a strong directional move already in progress. Enters on pullbacks into VWAP or key EMA confluence.',
    whenToUse: 'Trending days with clear directional bias. Avoid chop and range-bound sessions. Best during RTH after the first 30 minutes.',
    riskProfile: 'Aggressive — wider stops behind structure, targets 3:1+ R:R. Can pyramid on confirmation.',
  },
  {
    name: 'AWV (Asymmetric Volatility)',
    description:
      'Exploits the asymmetry between upside and downside vol. When the VIX term structure inverts or skew steepens beyond 2 standard deviations, AWV positions for a mean reversion snap-back in the underlying.',
    whenToUse: 'VIX above 20 with steep put skew. Works best during macro fear events that overshoot. Avoid when vol is structurally elevated (e.g. earnings season).',
    riskProfile: 'Conservative — small position, wide stop, 4:1+ R:R. Designed for infrequent, high-conviction setups.',
  },
  {
    name: 'Snipe',
    description:
      'Precision scalp model for micro-timeframe entries. Uses order flow delta, footprint charts, and level 2 absorption to identify exact entry ticks at key levels (prior day high/low, weekly VWAP, GEX walls).',
    whenToUse: 'Any session with defined levels. Best when GEX walls and options flow align with a technical level. Avoid during low-volume holiday sessions.',
    riskProfile: 'High frequency, low risk per trade — 3-5 tick stops, 1:1 to 2:1 R:R. Volume is the edge, not size.',
  },
];

export function ModelGlossary() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-semibold mb-2">
        Model Glossary
      </div>
      {/* Fused card — rounded on the whole outer container, no individual rounding */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        {MODELS.map((model, idx) => {
          const isOpen = expandedIndex === idx;
          const isLast = idx === MODELS.length - 1;
          return (
            <div key={model.name}>
              <button
                type="button"
                onClick={() => setExpandedIndex(isOpen ? null : idx)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-900/50 transition-colors text-left"
              >
                <span className="text-[11px] font-semibold text-white">{model.name}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="px-3 pb-2.5 space-y-2 border-t border-zinc-800/50">
                  <p className="text-[11px] text-zinc-400 leading-relaxed pt-2">{model.description}</p>
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider">When to Use</div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{model.whenToUse}</p>
                  </div>
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Risk Profile</div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{model.riskProfile}</p>
                  </div>
                </div>
              </div>
              {/* Divider between items (not after last) */}
              {!isLast && <div className="border-b border-zinc-800/50" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
