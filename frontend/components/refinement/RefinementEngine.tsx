// [claude-code 2026-03-27] S2-T7: Refinement Engine — scoring calibration workbench
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wrench } from 'lucide-react';
import type { RiskFlowAlert } from '../../lib/riskflow-feed';
import type { CalibrationEntry } from '../../../backend-hono/src/types/calibration';
import type { CommentatorEntry } from '../../../backend-hono/src/types/commentator';
import type { MarketRegime } from '../../types/regime';
import { RegimeControl } from './RegimeControl';
import { QuickWeightEditor } from './QuickWeightEditor';
import { CommentatorManager } from './CommentatorManager';
import { AnnotatableItem } from './AnnotatableItem';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

interface RegimeState {
  regime: MarketRegime;
  confidence: number;
  detectedBy: string;
  multipliers?: Record<string, number>;
}

export function RefinementEngine() {
  const [items, setItems] = useState<RiskFlowAlert[]>([]);
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [weights, setWeights] = useState<CalibrationEntry[]>([]);
  const [registry, setRegistry] = useState<CommentatorEntry[]>([]);
  const [isRescoring, setIsRescoring] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/riskflow/feed`).then(r => r.json());
      setItems(res.items ?? []);
    } catch (err) {
      console.error('[RefinementEngine] Feed fetch failed:', err);
    }
  }, []);

  const fetchRegime = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/regime/current`).then(r => r.json());
      setRegime(res);
    } catch (err) {
      console.error('[RefinementEngine] Regime fetch failed:', err);
    }
  }, []);

  const fetchWeights = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calibration/weights`).then(r => r.json());
      setWeights(res.weights ?? []);
    } catch (err) {
      console.error('[RefinementEngine] Weights fetch failed:', err);
    }
  }, []);

  const fetchRegistry = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/commentator/registry`).then(r => r.json());
      setRegistry(res.registry ?? []);
    } catch (err) {
      console.error('[RefinementEngine] Registry fetch failed:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchFeed(), fetchRegime(), fetchWeights(), fetchRegistry()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchFeed, fetchRegime, fetchWeights, fetchRegistry]);

  const handleRescore = async () => {
    setIsRescoring(true);
    try {
      await fetch(`${API_BASE}/api/riskflow/rescore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json());
      await fetchFeed();
    } catch (err) {
      console.error('[RefinementEngine] Rescore failed:', err);
    } finally {
      setIsRescoring(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--fintheon-accent)]/15">
        <div className="flex items-center gap-2.5">
          <Wrench className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h1 className="text-sm font-bold text-[var(--fintheon-text)] tracking-wide">
            REFINEMENT ENGINE
          </h1>
        </div>
        <button
          onClick={handleRescore}
          disabled={isRescoring}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--fintheon-accent)]/40 text-[11px] font-semibold text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRescoring ? 'animate-spin' : ''}`} />
          {isRescoring ? 'Re-Scoring...' : 'Re-Score All'}
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[11px] text-zinc-500 animate-pulse">Loading Refinement Engine...</div>
        </div>
      ) : (
        /* Two-panel layout */
        <div className="flex-1 min-h-0 flex">
          {/* Left panel — regime, weights, commentators */}
          <div className="w-[320px] shrink-0 border-r border-[var(--fintheon-accent)]/15 overflow-y-auto p-3 space-y-5">
            <RegimeControl
              regime={regime}
              onRegimeChanged={fetchRegime}
            />

            <div className="border-t border-zinc-800" />

            <QuickWeightEditor
              weights={weights}
              onWeightsSaved={fetchWeights}
            />

            <div className="border-t border-zinc-800" />

            <CommentatorManager
              registry={registry}
              onRegistryChanged={fetchRegistry}
            />
          </div>

          {/* Right panel — annotatable feed */}
          <div className="flex-1 min-w-0 overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] text-zinc-500 mb-1">
              {items.length} item{items.length !== 1 ? 's' : ''} in feed
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-[11px] text-zinc-600">
                No feed items. Backend may need to be running.
              </div>
            ) : (
              items.map((item) => (
                <AnnotatableItem
                  key={item.id}
                  item={item}
                  onAnnotationSaved={() => {}}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
