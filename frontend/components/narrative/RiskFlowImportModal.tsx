// [claude-code 2026-03-06] RiskFlow import approval modal — score & import catalysts from RiskFlow/Daily Brief
import { useState, useCallback } from 'react';
import { X, Loader2, Download } from 'lucide-react';
import type { NarrativeLane, CatalystCard, CatalystSource } from '../../lib/narrative-types';
import type { ScoredCandidate } from '../../lib/services';
import { matchCandidatesToLanes, type MatchedCandidate } from '../../lib/narrative-matcher';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import baseBackend from '../../lib/backend';

interface RiskFlowImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (catalysts: Omit<CatalystCard, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  lanes: NarrativeLane[];
}

const TABS = [
  { key: 'riskflow' as const, label: 'RiskFlow' },
  { key: 'brief' as const, label: 'Daily Brief' },
];

const SCORE_COLORS = {
  high: '#22c55e',
  mid: 'var(--fintheon-accent)',
  low: '#ef4444',
} as const;

function scoreColor(score: number) {
  if (score > 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.mid;
  return SCORE_COLORS.low;
}

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  critical: { label: 'CRIT', color: '#F97316' },
  high: { label: 'HIGH', color: '#EF4444' },
  medium: { label: 'MED', color: 'var(--fintheon-accent)' },
  low: { label: 'LOW', color: 'var(--fintheon-muted)' },
};

export function RiskFlowImportModal({ open, onClose, onImport, lanes }: RiskFlowImportModalProps) {
  const [tab, setTab] = useState<'riskflow' | 'brief'>('riskflow');
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('');
  const [error, setError] = useState('');
  const { alerts } = useRiskFlow();

  const resetState = useCallback(() => {
    setCandidates([]);
    setSelected(new Set());
    setProvider('');
    setError('');
  }, []);

  const handleScoreRiskflow = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const mapped = alerts.map(a => ({
        id: a.id,
        headline: a.headline,
        summary: a.summary,
        source: a.source,
        severity: a.severity,
        tags: a.tags,
        publishedAt: a.publishedAt,
      }));
      const { scored, provider: p } = await baseBackend.narrative.scoreRiskflow(mapped);
      const matched = matchCandidatesToLanes(scored, lanes);
      setCandidates(matched);
      setSelected(new Set());
      setProvider(p);
    } catch (err: any) {
      setError(err?.message || 'Failed to score RiskFlow items');
    } finally {
      setLoading(false);
    }
  }, [alerts, lanes]);

  const handleScoreBrief = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await baseBackend.notion.getMdbBrief();
      const briefText = res.items.map(i => `${i.title}: ${i.detail}`).join('\n\n');
      const { scored, provider: p } = await baseBackend.narrative.scoreBrief(briefText);
      const matched = matchCandidatesToLanes(scored, lanes);
      setCandidates(matched);
      setSelected(new Set());
      setProvider(p);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse daily brief');
    } finally {
      setLoading(false);
    }
  }, [lanes]);

  const toggleItem = useCallback((sourceId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(candidates.map(c => c.sourceId)));
  }, [candidates]);

  const selectAbove70 = useCallback(() => {
    setSelected(new Set(candidates.filter(c => c.notabilityScore > 70).map(c => c.sourceId)));
  }, [candidates]);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleImport = useCallback(() => {
    const catalysts = candidates
      .filter(c => selected.has(c.sourceId))
      .map(c => ({
        title: c.suggestedTitle,
        description: c.suggestedDescription,
        date: new Date().toISOString(),
        sentiment: c.sentiment,
        severity: c.severity,
        source: (c.sourceType === 'riskflow' ? 'riskflow' : 'brief') as CatalystSource,
        narrativeIds: c.matchedLaneIds,
        isGhost: false,
        templateType: null as any,
        position: null,
      }));
    onImport(catalysts);
    onClose();
  }, [candidates, selected, onImport, onClose]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  if (!open) return null;

  const laneMap = new Map(lanes.map(l => [l.id, l.title]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-backdrop"
      onClick={handleClose}
    >
      <div
        className="max-w-2xl w-full max-h-[80vh] flex flex-col rounded-xl shadow-[0_0_40px_rgba(199,159,74,0.15)] animate-fade-in"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid color-mix(in srgb, var(--fintheon-border) 30%, transparent)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-border)]/20">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--fintheon-accent)]" />
            <h2 className="text-sm font-bold text-[var(--fintheon-accent)]">Import Catalysts</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-zinc-900 rounded transition-all">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--fintheon-border)]/20">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); resetState(); }}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'text-[var(--fintheon-accent)] border-b-2 border-[var(--fintheon-accent)]'
                  : 'text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {/* Score button */}
          {candidates.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <p className="text-xs text-[var(--fintheon-muted)]">
                {tab === 'riskflow'
                  ? `${alerts.length} RiskFlow alerts available to score`
                  : 'Fetch and parse the daily brief from Notion'}
              </p>
              <button
                onClick={tab === 'riskflow' ? handleScoreRiskflow : handleScoreBrief}
                disabled={tab === 'riskflow' && alerts.length === 0}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-all bg-[var(--fintheon-accent)] hover:brightness-110 text-black disabled:opacity-30"
              >
                {tab === 'riskflow' ? 'Score Items' : 'Parse Brief'}
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[var(--fintheon-accent)] animate-spin" />
              <span className="ml-2 text-xs text-[var(--fintheon-muted)]">Scoring...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 py-2">{error}</p>
          )}

          {/* Candidate list */}
          {candidates.length > 0 && !loading && (
            <>
              {/* Bulk controls */}
              <div className="flex items-center gap-3 mb-2">
                <button onClick={selectAbove70} className="text-[10px] text-[var(--fintheon-accent)] hover:underline">
                  Select All &gt;70
                </button>
                <button onClick={selectAll} className="text-[10px] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]">
                  Select All
                </button>
                <button onClick={deselectAll} className="text-[10px] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]">
                  Deselect All
                </button>
              </div>

              {/* Candidate rows */}
              <div className="flex flex-col gap-1">
                {candidates.map(c => {
                  const sev = SEVERITY_LABELS[c.severity] || SEVERITY_LABELS.low;
                  const laneName = c.matchedLaneIds.length > 0
                    ? c.matchedLaneIds.map(id => laneMap.get(id) || id).join(', ')
                    : 'Unassigned';

                  return (
                    <div
                      key={c.sourceId}
                      onClick={() => toggleItem(c.sourceId)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-[var(--fintheon-accent)]/5"
                      style={{
                        backgroundColor: selected.has(c.sourceId)
                          ? 'color-mix(in srgb, var(--fintheon-accent) 8%, transparent)'
                          : 'transparent',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                        style={{
                          borderColor: selected.has(c.sourceId) ? 'var(--fintheon-accent)' : 'var(--fintheon-border)',
                          backgroundColor: selected.has(c.sourceId) ? 'var(--fintheon-accent)' : 'transparent',
                        }}
                      >
                        {selected.has(c.sourceId) && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3.5 6L6.5 2" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Title + description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-[var(--fintheon-text)] truncate">
                          {c.suggestedTitle}
                        </p>
                        <p className="text-[10px] text-[var(--fintheon-muted)] truncate">
                          {c.suggestedDescription}
                        </p>
                      </div>

                      {/* Score badge */}
                      <span
                        className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          color: scoreColor(c.notabilityScore),
                          backgroundColor: `color-mix(in srgb, ${scoreColor(c.notabilityScore)} 15%, transparent)`,
                        }}
                      >
                        {c.notabilityScore}
                      </span>

                      {/* Sentiment pill */}
                      <span
                        className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium uppercase"
                        style={{
                          color: c.sentiment === 'bullish' ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)',
                          backgroundColor: c.sentiment === 'bullish'
                            ? 'color-mix(in srgb, var(--fintheon-bullish) 15%, transparent)'
                            : 'color-mix(in srgb, var(--fintheon-bearish) 15%, transparent)',
                        }}
                      >
                        {c.sentiment}
                      </span>

                      {/* Severity badge */}
                      <span
                        className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
                        style={{
                          color: sev.color,
                          backgroundColor: `color-mix(in srgb, ${sev.color} 15%, transparent)`,
                        }}
                      >
                        {sev.label}
                      </span>

                      {/* Ticker tags */}
                      {c.tickers.slice(0, 3).map(t => (
                        <span
                          key={t}
                          className="flex-shrink-0 rounded px-1 py-0.5 text-[8px] font-mono text-[var(--fintheon-muted)]"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--fintheon-muted) 10%, transparent)' }}
                        >
                          {t}
                        </span>
                      ))}

                      {/* Lane match */}
                      <span className="flex-shrink-0 text-[9px] text-[var(--fintheon-muted)] max-w-[100px] truncate">
                        {laneName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--fintheon-border)]/20">
          <span className="text-[10px] text-[var(--fintheon-muted)]">
            {candidates.length > 0 ? `${candidates.length} items scored via ${provider}` : ''}
          </span>
          <button
            onClick={handleImport}
            disabled={selected.size === 0}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all bg-[var(--fintheon-accent)] hover:brightness-110 text-black disabled:opacity-30"
          >
            Import {selected.size} Selected
          </button>
        </div>
      </div>
    </div>
  );
}
