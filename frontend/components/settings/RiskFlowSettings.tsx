// [claude-code 2026-03-27] S2-T6: RiskFlow Developer Settings — weight sliders, regime display, commentator tiers, refinement toggle
import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Save, ChevronDown, ToggleLeft, ToggleRight } from 'lucide-react';
import { MARKET_REGIMES, REGIME_LABELS } from '../../types/regime';
import type { MarketRegime } from '../../types/regime';

// Mirrored from backend-hono/src/types — kept minimal to avoid cross-project imports
type CommentatorTier = 1 | 2 | 3;
const TIER_DEFAULT_MULTIPLIERS: Record<CommentatorTier, number> = { 1: 1.5, 2: 1.2, 3: 1.0 };
const UNTAGGED_MULTIPLIER = 0.8;

interface CommentatorEntry {
  id: string;
  name: string;
  aliases: string[];
  tier: CommentatorTier;
  role?: string;
  institution?: string;
  weightMultiplier: number;
  active: boolean;
  createdAt: string;
}

interface CalibrationEntry {
  id: string;
  eventType: string;
  baseWeight: number;
  regimeOverrides: Partial<Record<MarketRegime, number>>;
  updatedAt: string;
  updatedBy: string;
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

// --- Event type categories for grouping sliders ---
const EVENT_CATEGORIES: Record<string, string[]> = {
  'Black Swan': ['geopolitical_escalation', 'black_swan', 'flash_crash', 'liquidity_crisis'],
  'Fed / Policy': ['fomc_decision', 'fomc_minutes', 'fed_speaker', 'tariff_action', 'fiscal_policy'],
  'Data Prints': ['cpi_print', 'nfp_print', 'ppi_print', 'jobless_claims', 'gdp_print', 'pce_print', 'retail_sales', 'ism_manufacturing', 'consumer_confidence'],
  'Earnings': ['mag7_earnings', 'sector_earnings', 'guidance_revision'],
  'Other': [],
};

function categorizeEvent(eventType: string): string {
  for (const [cat, types] of Object.entries(EVENT_CATEGORIES)) {
    if (types.includes(eventType)) return cat;
  }
  return 'Other';
}

function formatEventLabel(eventType: string): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// --- Types ---
interface RegimeState {
  regime: MarketRegime;
  confidence: number;
  detectedBy: string;
  timestamp: string;
  multipliers: { bullish: number; bearish: number; neutral: number };
}

interface TierFilterState {
  1: boolean;
  2: boolean;
  3: boolean;
  untagged: boolean;
}

const TIER_FILTER_LS_KEY = 'fintheon-tier-filters';
const REFINEMENT_LS_KEY = 'fintheon-refinement-enabled';

function loadTierFilters(): TierFilterState {
  try {
    const stored = localStorage.getItem(TIER_FILTER_LS_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { 1: true, 2: true, 3: false, untagged: true };
}

export function RiskFlowSettings() {
  // --- Section A: Weights ---
  const [weights, setWeights] = useState<CalibrationEntry[]>([]);
  const [originalWeights, setOriginalWeights] = useState<Record<string, number>>({});
  const [weightsDirty, setWeightsDirty] = useState<Record<string, boolean>>({});
  const [weightsLoading, setWeightsLoading] = useState(true);
  const [weightsSaving, setWeightsSaving] = useState(false);

  // --- Section B: Regime ---
  const [regime, setRegime] = useState<RegimeState | null>(null);
  const [regimeLoading, setRegimeLoading] = useState(true);
  const [regimeDropdownOpen, setRegimeDropdownOpen] = useState(false);
  const [regimeSaving, setRegimeSaving] = useState(false);

  // --- Section C: Commentators ---
  const [registry, setRegistry] = useState<CommentatorEntry[]>([]);
  const [tierFilters, setTierFilters] = useState<TierFilterState>(loadTierFilters);
  const [commentatorsLoading, setCommentatorsLoading] = useState(true);

  // --- Section D: Refinement Toggle ---
  const [refinementEnabled, setRefinementEnabled] = useState(() =>
    localStorage.getItem(REFINEMENT_LS_KEY) === 'true'
  );

  // --- Fetch data ---
  const fetchWeights = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calibration/weights`);
      const data = await res.json();
      const w: CalibrationEntry[] = data.weights ?? [];
      setWeights(w);
      const orig: Record<string, number> = {};
      for (const entry of w) orig[entry.eventType] = entry.baseWeight;
      setOriginalWeights(orig);
      setWeightsDirty({});
    } catch (err) {
      console.warn('[RiskFlowSettings] Failed to fetch weights:', err);
    } finally {
      setWeightsLoading(false);
    }
  }, []);

  const fetchRegime = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/regime/current`);
      const data = await res.json();
      setRegime(data);
    } catch (err) {
      console.warn('[RiskFlowSettings] Failed to fetch regime:', err);
    } finally {
      setRegimeLoading(false);
    }
  }, []);

  const fetchCommentators = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/commentator/registry`);
      const data = await res.json();
      setRegistry(data.registry ?? []);
    } catch (err) {
      console.warn('[RiskFlowSettings] Failed to fetch commentators:', err);
    } finally {
      setCommentatorsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeights();
    fetchRegime();
    fetchCommentators();
  }, [fetchWeights, fetchRegime, fetchCommentators]);

  // --- Weight slider handlers ---
  const handleWeightChange = (eventType: string, value: number) => {
    setWeights(prev => prev.map(w =>
      w.eventType === eventType ? { ...w, baseWeight: value } : w
    ));
    setWeightsDirty(prev => ({
      ...prev,
      [eventType]: value !== originalWeights[eventType],
    }));
  };

  const handleResetWeight = (eventType: string) => {
    const orig = originalWeights[eventType];
    if (orig !== undefined) {
      handleWeightChange(eventType, orig);
    }
  };

  const handleSaveAllWeights = async () => {
    const changed = weights.filter(w => weightsDirty[w.eventType]);
    if (changed.length === 0) return;

    setWeightsSaving(true);
    try {
      await Promise.all(changed.map(w =>
        fetch(`${API_BASE}/api/calibration/weight/${encodeURIComponent(w.eventType)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseWeight: w.baseWeight }),
        })
      ));
      // Refresh to sync original values
      await fetchWeights();
    } catch (err) {
      console.error('[RiskFlowSettings] Failed to save weights:', err);
    } finally {
      setWeightsSaving(false);
    }
  };

  const handleResetAllWeights = async () => {
    setWeightsSaving(true);
    try {
      await fetch(`${API_BASE}/api/calibration/seed`, { method: 'POST' });
      await fetchWeights();
    } catch (err) {
      console.error('[RiskFlowSettings] Failed to reset weights:', err);
    } finally {
      setWeightsSaving(false);
    }
  };

  // --- Regime override ---
  const handleRegimeOverride = async (newRegime: MarketRegime) => {
    setRegimeSaving(true);
    setRegimeDropdownOpen(false);
    try {
      const res = await fetch(`${API_BASE}/api/regime/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regime: newRegime }),
      });
      const data = await res.json();
      setRegime(data);
    } catch (err) {
      console.error('[RiskFlowSettings] Failed to set regime:', err);
    } finally {
      setRegimeSaving(false);
    }
  };

  // --- Tier filter handlers ---
  const handleTierToggle = (key: keyof TierFilterState) => {
    setTierFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(TIER_FILTER_LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // --- Refinement toggle ---
  const handleRefinementToggle = () => {
    setRefinementEnabled(prev => {
      const next = !prev;
      localStorage.setItem(REFINEMENT_LS_KEY, String(next));
      return next;
    });
  };

  // --- Group weights by category ---
  const groupedWeights: Record<string, CalibrationEntry[]> = {};
  for (const w of weights) {
    const cat = categorizeEvent(w.eventType);
    if (!groupedWeights[cat]) groupedWeights[cat] = [];
    groupedWeights[cat].push(w);
  }

  const tierCounts: Record<number | 'untagged', number> = { 1: 0, 2: 0, 3: 0, untagged: 0 };
  for (const entry of registry) {
    if (entry.tier >= 1 && entry.tier <= 3) tierCounts[entry.tier]++;
  }

  const dirtyCount = Object.values(weightsDirty).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* ===== Section A: Event Weight Calibration ===== */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fintheon-accent)' }}>
          Event Weight Calibration
        </h3>

        {weightsLoading ? (
          <p className="text-xs text-gray-500">Loading weights...</p>
        ) : weights.length === 0 ? (
          <div className="text-xs text-gray-500">
            <p className="mb-2">No calibration weights found.</p>
            <button
              onClick={handleResetAllWeights}
              disabled={weightsSaving}
              className="text-xs px-3 py-1.5 rounded transition-colors"
              style={{
                color: 'var(--fintheon-accent)',
                border: '1px solid color-mix(in srgb, var(--fintheon-accent) 25%, transparent)',
              }}
            >
              Seed Default Weights
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedWeights).map(([category, entries]) => (
              <div key={category}>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2 font-medium">
                  {category}
                </p>
                <div className="space-y-2">
                  {entries.map(entry => (
                    <div
                      key={entry.eventType}
                      className="flex items-center gap-3 px-3 py-1.5 rounded"
                      style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
                    >
                      <span className="text-xs text-gray-300 w-40 shrink-0 truncate" title={entry.eventType}>
                        {formatEventLabel(entry.eventType)}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={0.5}
                        value={entry.baseWeight}
                        onChange={(e) => handleWeightChange(entry.eventType, parseFloat(e.target.value))}
                        className="flex-1 h-1.5 accent-[var(--fintheon-accent)] cursor-pointer"
                        style={{
                          accentColor: 'var(--fintheon-accent)',
                        }}
                      />
                      <span className="text-xs font-mono w-8 text-right" style={{ color: 'var(--fintheon-accent)' }}>
                        {entry.baseWeight.toFixed(1)}
                      </span>
                      <button
                        onClick={() => handleResetWeight(entry.eventType)}
                        className="text-gray-600 hover:text-gray-400 transition-colors"
                        title="Reset to saved value"
                        disabled={!weightsDirty[entry.eventType]}
                        style={{ opacity: weightsDirty[entry.eventType] ? 1 : 0.3 }}
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Save / Reset buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveAllWeights}
                disabled={weightsSaving || dirtyCount === 0}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-all disabled:opacity-40"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)',
                  color: 'var(--fintheon-accent)',
                  border: '1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)',
                }}
              >
                <Save size={12} />
                {weightsSaving ? 'Saving...' : `Save All${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
              </button>
              <button
                onClick={handleResetAllWeights}
                disabled={weightsSaving}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
                style={{
                  border: '1px solid color-mix(in srgb, var(--fintheon-border) 40%, transparent)',
                }}
              >
                <RotateCcw size={12} />
                Reset All to Defaults
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ===== Section B: Current Market Regime ===== */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fintheon-accent)' }}>
          Current Market Regime
        </h3>

        {regimeLoading ? (
          <p className="text-xs text-gray-500">Loading regime...</p>
        ) : regime ? (
          <div
            className="rounded-lg border p-4 space-y-3"
            style={{
              borderColor: 'color-mix(in srgb, var(--fintheon-accent) 15%, transparent)',
              backgroundColor: 'rgba(10,10,0,0.3)',
            }}
          >
            {/* Regime selector + confidence */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <button
                  onClick={() => setRegimeDropdownOpen(prev => !prev)}
                  disabled={regimeSaving}
                  className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded transition-colors"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    color: 'var(--fintheon-accent)',
                    border: '1px solid color-mix(in srgb, var(--fintheon-accent) 25%, transparent)',
                  }}
                >
                  {REGIME_LABELS[regime.regime] || regime.regime}
                  <ChevronDown size={14} className={`transition-transform ${regimeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {regimeDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-1 z-50 rounded-lg border py-1 w-56 shadow-xl"
                    style={{
                      backgroundColor: 'var(--fintheon-bg, #0a0a00)',
                      borderColor: 'color-mix(in srgb, var(--fintheon-accent) 25%, transparent)',
                    }}
                  >
                    {MARKET_REGIMES.map(r => (
                      <button
                        key={r}
                        onClick={() => handleRegimeOverride(r)}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          r === regime.regime ? 'text-white' : 'text-gray-400 hover:text-white'
                        }`}
                        style={r === regime.regime ? {
                          backgroundColor: 'color-mix(in srgb, var(--fintheon-accent) 10%, transparent)',
                          color: 'var(--fintheon-accent)',
                        } : {}}
                      >
                        {REGIME_LABELS[r]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="text-xs text-gray-500">
                Confidence: <span className="text-white font-mono">{Math.round(regime.confidence * 100)}%</span>
              </span>
            </div>

            {/* Set by / timestamp */}
            <p className="text-[11px] text-gray-600">
              Set by: <span className="text-gray-400">{regime.detectedBy}</span>
              {regime.timestamp && (
                <> &middot; <span className="text-gray-400">{new Date(regime.timestamp).toLocaleString()}</span></>
              )}
            </p>

            {/* Sentiment multipliers */}
            {regime.multipliers && (
              <div>
                <p className="text-[11px] text-gray-600 mb-1">Sentiment Multipliers:</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-gray-400">
                    Bullish: <span className="font-mono text-white">{regime.multipliers.bullish}x</span>
                  </span>
                  <span className="text-gray-400">
                    Bearish: <span className="font-mono text-white">{regime.multipliers.bearish}x</span>
                  </span>
                  <span className="text-gray-400">
                    Neutral: <span className="font-mono text-white">{regime.multipliers.neutral}x</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No regime data available. Is the backend running?</p>
        )}
      </section>

      {/* ===== Section C: Commentator Tiers ===== */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fintheon-accent)' }}>
          Commentator Tiers
        </h3>

        {commentatorsLoading ? (
          <p className="text-xs text-gray-500">Loading commentators...</p>
        ) : (
          <div className="space-y-2">
            {([1, 2, 3] as const).map(tier => {
              const labels: Record<CommentatorTier, string> = {
                1: 'Tier 1 — Market Movers',
                2: 'Tier 2 — Notable Officials',
                3: 'Tier 3 — Color Providers',
              };
              return (
                <label
                  key={tier}
                  className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
                >
                  <input
                    type="checkbox"
                    checked={tierFilters[tier]}
                    onChange={() => handleTierToggle(tier)}
                    className="accent-[var(--fintheon-accent)] w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-300 flex-1">
                    {labels[tier]} <span className="text-gray-600 font-mono">({TIER_DEFAULT_MULTIPLIERS[tier]}x)</span>
                  </span>
                  <span className="text-[11px] text-gray-600 font-mono">
                    {tierCounts[tier]} tagged
                  </span>
                </label>
              );
            })}

            {/* Untagged */}
            <label
              className="flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors hover:bg-white/[0.02]"
              style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
            >
              <input
                type="checkbox"
                checked={tierFilters.untagged}
                onChange={() => handleTierToggle('untagged')}
                className="accent-[var(--fintheon-accent)] w-3.5 h-3.5"
              />
              <span className="text-xs text-gray-300 flex-1">
                Untagged — Default <span className="text-gray-600 font-mono">({UNTAGGED_MULTIPLIER}x)</span>
              </span>
            </label>

            {/* Manage registry hint */}
            <p className="text-[11px] text-gray-600 pt-1">
              {refinementEnabled
                ? 'Manage Registry via the Refinement Engine tab in the sidebar.'
                : 'Enable Refinement Engine below to manage the commentator registry.'}
            </p>
          </div>
        )}
      </section>

      {/* ===== Section D: Refinement Engine Toggle ===== */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--fintheon-accent)' }}>
          Refinement Engine
        </h3>

        <div
          className="flex items-center justify-between px-3 py-3 rounded-lg border"
          style={{
            borderColor: 'color-mix(in srgb, var(--fintheon-accent) 12%, transparent)',
            backgroundColor: 'rgba(10,10,0,0.3)',
          }}
        >
          <div>
            <p className="text-xs text-gray-300">Show Refinement Engine tab</p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              When enabled, a Refinement tab appears in the sidebar above the notification bell.
            </p>
          </div>
          <button
            onClick={handleRefinementToggle}
            className="shrink-0 ml-4 transition-colors"
            style={{ color: refinementEnabled ? 'var(--fintheon-accent)' : 'rgba(107,114,128,0.5)' }}
          >
            {refinementEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
      </section>
    </div>
  );
}
