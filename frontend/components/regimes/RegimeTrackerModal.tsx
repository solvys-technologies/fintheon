// [claude-code 2026-03-06] Full Regime Tracker modal — grouped by category, W-L tracking, add custom regimes
// [claude-code 2026-03-12] Replaced W/L with ORB bullish/bearish, AI generate CTA, delete all regimes, 12H NY time, collapsed active regimes, labeled ORB record
import { useState, useMemo } from 'react';
import {
  X, Plus, Clock, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Sparkles, Trash2,
} from 'lucide-react';
import { useRegimes } from '../../lib/regime-store';
import { isRegimeActive, getTimeRemaining, getCurrentETTime, formatTimeRange12H } from '../../lib/regime-time';
import type { TradingRegime } from '../../lib/regimes';

const CATEGORY_LABELS: Record<TradingRegime['category'], string> = {
  institutional: 'Institutional',
  session: 'Session',
  report: 'Report',
  custom: 'Custom',
};

const CATEGORY_ORDER: TradingRegime['category'][] = ['institutional', 'session', 'report', 'custom'];

function BiasBadge({ bias }: { bias: TradingRegime['bias'] }) {
  const config = {
    long: { label: 'Long', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    short: { label: 'Short', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
    fade: { label: 'Fade', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    neutral: { label: 'Neutral', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  }[bias];

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase border ${config.color}`}>
      {config.label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-emerald-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-[10px] font-semibold ${value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-yellow-500' : 'text-red-400'}`}>
        {value}%
      </span>
    </div>
  );
}

/** ORB Direction record — shows bullish/bearish day count with label */
function OrbRecord({ record }: { record: TradingRegime['record'] }) {
  const total = record.bullishDays + record.bearishDays;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-zinc-600 uppercase tracking-wider">ORB</span>
      <span className="flex items-center gap-0.5 text-[10px]">
        <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
        <span className="text-emerald-400 font-semibold">{record.bullishDays}</span>
      </span>
      <span className="text-zinc-700">/</span>
      <span className="flex items-center gap-0.5 text-[10px]">
        <span className="text-red-400 font-semibold">{record.bearishDays}</span>
        <TrendingDown className="w-2.5 h-2.5 text-red-400" />
      </span>
      {total > 0 && (
        <span className="text-[9px] text-zinc-600 ml-0.5">
          ({Math.round((record.bullishDays / total) * 100)}%)
        </span>
      )}
    </div>
  );
}

function RegimeCard({
  regime,
  isActive,
  timeInfo,
  onRecordBullish,
  onRecordBearish,
  onDelete,
}: {
  regime: TradingRegime;
  isActive: boolean;
  timeInfo: string;
  onRecordBullish: () => void;
  onRecordBearish: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`bg-[#0a0a06] border px-3 py-2.5 ${isActive ? 'border-[var(--fintheon-accent)]/50 shadow-[0_0_12px_rgba(212,175,55,0.1)]' : 'border-zinc-800/60'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--fintheon-text)] truncate">{regime.name}</span>
            {isActive && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-wider uppercase text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5">
                <span className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{regime.description}</p>
        </div>
        <button onClick={onDelete} className="shrink-0 p-1 text-zinc-700 hover:text-red-400 transition-colors" title="Delete regime">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Meta row — 12H NY time */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-[9px] text-zinc-500 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {formatTimeRange12H(regime.timeRange.start, regime.timeRange.end)}
        </span>
        <span className="text-[9px] text-zinc-600">{regime.daysActive.join(', ')}</span>
        <BiasBadge bias={regime.bias} />
        {regime.source && (
          <span className="text-[9px] text-zinc-600 italic">{regime.source}</span>
        )}
      </div>

      {/* Instruments */}
      <div className="flex items-center gap-1 mb-2">
        {regime.instruments.map((inst) => (
          <span key={inst} className="text-[9px] bg-zinc-800/60 text-zinc-400 px-1.5 py-0.5">{inst}</span>
        ))}
      </div>

      {/* Confidence bar */}
      <div className="mb-2">
        <ConfidenceBar value={regime.confidence} />
      </div>

      {/* Stats + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrbRecord record={regime.record} />
          <span className="text-[9px] text-zinc-600">{regime.daysObserved}d observed</span>
          <span className="text-[9px] text-[var(--fintheon-accent)]/60">{timeInfo}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRecordBullish}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
            title="Record Bullish ORB Day"
          >
            <TrendingUp className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={onRecordBearish}
            className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            title="Record Bearish ORB Day"
          >
            <TrendingDown className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddRegimeForm({ onAdd, onCancel }: { onAdd: (r: TradingRegime) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [bias, setBias] = useState<TradingRegime['bias']>('neutral');
  const [confidence, setConfidence] = useState(50);
  const [instruments, setInstruments] = useState('/NQ, /ES');

  const handleSubmit = () => {
    if (!name.trim()) return;
    const regime: TradingRegime = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category: 'custom',
      timeRange: { start: startTime, end: endTime },
      timezone: 'ET',
      daysActive: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      confidence,
      record: { bullishDays: 0, bearishDays: 0 },
      daysObserved: 0,
      bias,
      instruments: instruments.split(',').map((s) => s.trim()).filter(Boolean),
    };
    onAdd(regime);
  };

  const inputClass = 'w-full bg-[#0a0a06] border border-zinc-800 text-xs text-[var(--fintheon-text)] px-2 py-1.5 focus:outline-none focus:border-[var(--fintheon-accent)]/40';

  return (
    <div className="bg-[#0a0a06] border border-[var(--fintheon-accent)]/30 p-3 space-y-2">
      <div className="text-[10px] font-semibold text-[var(--fintheon-accent)] tracking-wider uppercase mb-1">New Custom Regime</div>
      <input className={inputClass} placeholder="Regime name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={inputClass} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-zinc-600 uppercase">Start (NY)</label>
          <input className={inputClass} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 uppercase">End (NY)</label>
          <input className={inputClass} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-zinc-600 uppercase">Bias</label>
          <select className={inputClass} value={bias} onChange={(e) => setBias(e.target.value as TradingRegime['bias'])}>
            <option value="neutral">Neutral</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
            <option value="fade">Fade</option>
          </select>
        </div>
        <div>
          <label className="text-[9px] text-zinc-600 uppercase">Confidence</label>
          <input className={inputClass} type="number" min={0} max={100} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
        </div>
      </div>
      <input className={inputClass} placeholder="Instruments (comma-sep)" value={instruments} onChange={(e) => setInstruments(e.target.value)} />
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          className="px-3 py-1 text-[10px] font-semibold bg-[var(--fintheon-accent)] text-black hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_80%,white)] transition-colors"
        >
          Add Regime
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface RegimeTrackerModalProps {
  onClose: () => void;
}

export function RegimeTrackerModal({ onClose }: RegimeTrackerModalProps) {
  const { regimes, addRegime, recordBullish, recordBearish, deleteRegime } = useRegimes();
  const [showAddForm, setShowAddForm] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const now = getCurrentETTime();

  const grouped = useMemo(() => {
    const map = new Map<TradingRegime['category'], TradingRegime[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const r of regimes) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return map;
  }, [regimes]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  /** Open sidebar chat with Regimes skill attached */
  const handleAIGenerate = () => {
    window.dispatchEvent(new CustomEvent('pulse:open-chat-skill', {
      detail: { skillId: 'regimes', prompt: 'Create a new trading regime for me' },
    }));
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/40 rounded-xl shadow-[0_0_40px_rgba(199,159,74,0.15)] flex flex-col max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--fintheon-accent)]/20 shrink-0">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--fintheon-accent)]" />
              <h2 className="text-sm font-bold text-[var(--fintheon-accent)]">Regime Tracker</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAIGenerate}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30 hover:bg-[var(--fintheon-accent)]/10 transition-colors"
                title="AI Generate a new regime via chat"
              >
                <Sparkles className="w-3 h-3" /> AI Generate
              </button>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800/50 transition-colors"
              >
                <Plus className="w-3 h-3" /> Manual
              </button>
              <button onClick={onClose} className="p-1 text-zinc-500 hover:text-[var(--fintheon-text)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {showAddForm && (
              <AddRegimeForm
                onAdd={(r) => { addRegime(r); setShowAddForm(false); }}
                onCancel={() => setShowAddForm(false)}
              />
            )}

            {CATEGORY_ORDER.map((cat) => {
              const items = grouped.get(cat) ?? [];
              if (items.length === 0 && cat !== 'custom') return null;
              const isCollapsed = collapsedCategories.has(cat);
              const activeItems = items.filter((r) => isRegimeActive(r, now));

              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-2 mb-2 group w-full text-left"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-3 h-3 text-[var(--fintheon-accent)]/60" />
                      : <ChevronDown className="w-3 h-3 text-[var(--fintheon-accent)]/60" />
                    }
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--fintheon-accent)]">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-[9px] text-zinc-600">{items.length} regime{items.length !== 1 ? 's' : ''}</span>
                    {activeItems.length > 0 && (
                      <span className="text-[9px] font-bold text-[var(--fintheon-accent)]">{activeItems.length} active</span>
                    )}
                  </button>

                  {/* Always show active regimes even when collapsed */}
                  {isCollapsed && activeItems.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {activeItems.map((r) => (
                        <RegimeCard
                          key={r.id}
                          regime={r}
                          isActive
                          timeInfo={getTimeRemaining(r, now)}
                          onRecordBullish={() => recordBullish(r.id)}
                          onRecordBearish={() => recordBearish(r.id)}
                          onDelete={() => deleteRegime(r.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Full list when expanded */}
                  {!isCollapsed && (
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 pl-5">No custom regimes yet</div>
                      ) : (
                        items.map((r) => (
                          <RegimeCard
                            key={r.id}
                            regime={r}
                            isActive={isRegimeActive(r, now)}
                            timeInfo={getTimeRemaining(r, now)}
                            onRecordBullish={() => recordBullish(r.id)}
                            onRecordBearish={() => recordBearish(r.id)}
                            onDelete={() => deleteRegime(r.id)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-2 border-t border-zinc-800/60 flex items-center justify-between">
            <span className="text-[9px] text-zinc-700 tracking-wider uppercase">
              {regimes.length} regimes | {regimes.filter((r) => isRegimeActive(r, now)).length} active
            </span>
            <span className="text-[9px] text-zinc-700">All times New York (ET)</span>
          </div>
        </div>
      </div>
    </>
  );
}
