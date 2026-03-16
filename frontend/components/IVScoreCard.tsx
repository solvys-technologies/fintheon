// [claude-code 2026-03-11] Redesigned to consume backend IVScoreResponse — point range, rationale tooltip, environment label
// [claude-code 2026-03-11] VIX pulsating border: red >22, sunburst orange 16-22, yellow 14-16
import { Info, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { IVScoreResponse } from '../types/market-data';

interface IVScoreCardProps {
  /** Backend blended IV score response */
  data: IVScoreResponse | null;
  /** Loading state while first fetch is in-flight */
  loading?: boolean;
  layoutOption?: 'tickers-only' | 'combined';
}

function getScoreColor(score: number) {
  if (score >= 8) return 'text-red-500';
  if (score >= 6) return 'text-orange-400';
  if (score >= 4) return 'text-yellow-400';
  return 'text-emerald-400';
}

function getEnvironmentLabel(score: number): string {
  if (score >= 8) return 'Shit Show';
  if (score >= 6) return 'Tipping Point';
  if (score >= 4) return 'Gathering Storm';
  if (score >= 2) return 'Light Winds';
  return 'Calm Seas';
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case 'extreme': return 'text-red-500';
    case 'high': return 'text-orange-400';
    case 'elevated': return 'text-yellow-400';
    case 'moderate': return 'text-blue-400';
    default: return 'text-emerald-400';
  }
}

/** Returns CSS for VIX-based pulsating border. Hardcoded colors — theme-independent. */
function getVixPulseStyle(vixLevel: number): React.CSSProperties | undefined {
  if (vixLevel >= 22) {
    // Red pulse — high fear
    return {
      animation: 'vix-pulse 1.5s ease-in-out infinite',
      borderColor: '#ef4444',
      boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)',
    };
  }
  if (vixLevel >= 16) {
    // Sunburst orange pulse — elevated
    return {
      animation: 'vix-pulse 2s ease-in-out infinite',
      borderColor: '#f97316',
      boxShadow: '0 0 5px rgba(249, 115, 22, 0.35)',
    };
  }
  if (vixLevel >= 14) {
    // Yellow pulse — caution
    return {
      animation: 'vix-pulse 2.5s ease-in-out infinite',
      borderColor: '#eab308',
      boxShadow: '0 0 4px rgba(234, 179, 8, 0.3)',
    };
  }
  return undefined;
}

// Inject the keyframes once via a style tag
const PULSE_KEYFRAMES_ID = 'vix-pulse-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(PULSE_KEYFRAMES_ID)) {
  const style = document.createElement('style');
  style.id = PULSE_KEYFRAMES_ID;
  style.textContent = `
    @keyframes vix-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `;
  document.head.appendChild(style);
}

export function IVScoreCard({ data, loading, layoutOption }: IVScoreCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading || !data) {
    return (
      <div className="relative bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg px-3 h-8 flex items-center">
        <span className="text-[10px] text-gray-500">IV Score</span>
        <span className="text-sm font-bold text-gray-600 ml-2">--</span>
      </div>
    );
  }

  const color = getScoreColor(data.score);
  const envLabel = getEnvironmentLabel(data.score);
  const pts = data.points;
  const vixPulse = getVixPulseStyle(data.vix.level);

  return (
    <div
      className="relative bg-[var(--fintheon-bg)] border rounded-lg px-3 h-8 flex items-center"
      style={vixPulse ?? { borderColor: 'rgba(var(--fintheon-accent-rgb, 199, 159, 74), 0.2)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-400">IV</span>
        <span className={`text-sm font-bold ${color}`}>
          {data.score.toFixed(1)}
        </span>

        {/* Info button for rationale tooltip */}
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="text-gray-500 hover:text-gray-400 transition-colors ml-0.5"
        >
          <Info className="w-2.5 h-2.5" />
        </button>
      </div>

      {showTooltip && (
        <div
          className={`absolute top-full mt-2 w-80 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg p-4 shadow-xl z-[9999] ${
            layoutOption === 'tickers-only' ? 'right-0' : 'left-0'
          }`}
          style={{
            maxWidth: layoutOption === 'tickers-only' ? 'min(320px, calc(100vw - 2rem))' : '320px',
          }}
        >
          <h4 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-2">
            Blended IV Score
          </h4>
          <p className="text-xs text-gray-400 mb-3">
            60% VIX ({data.vix.level.toFixed(1)}) + 40% headline heat ({data.eventCount} events).
          </p>

          {/* Component breakdown */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mb-3 space-y-2">
            <h5 className="text-xs font-semibold text-gray-300 mb-1">Components</h5>
            {[
              { label: 'VIX Component', value: data.vixComponent, max: 10 },
              { label: 'Headline Component', value: data.headlineComponent, max: 10 },
            ].map(c => (
              <div key={c.label} className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{c.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--fintheon-accent)]"
                      style={{ width: `${(c.value / c.max) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-300 w-8 text-right">{c.value.toFixed(1)}</span>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-gray-300 font-medium">Blended</span>
              <span className="text-xs font-bold text-[var(--fintheon-accent)]">{data.score.toFixed(1)}/10</span>
            </div>
          </div>

          {/* Implied point range detail */}
          {pts && (
            <div className="bg-[var(--fintheon-accent)]/10 border border-[var(--fintheon-accent)]/20 rounded-lg p-3 mb-3">
              <h5 className="text-xs font-semibold text-[var(--fintheon-accent)] mb-1">
                Implied Range ({data.instrument})
              </h5>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">±{pts.scaledPoints}</span>
                <span className="text-xs text-gray-400">pts</span>
                <span className="text-xs text-gray-500">(${pts.scaledDollarRisk}/contract)</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                <span>Daily implied: ±{pts.implied.adjustedPoints.toFixed(1)} pts</span>
                <span>|</span>
                <span>Beta: {pts.implied.beta.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Rationale lines from backend */}
          {data.rationale.length > 0 && (
            <div className="mb-3 space-y-1">
              <h5 className="text-xs font-semibold text-gray-300">Rationale</h5>
              {data.rationale.map((line, i) => (
                <p key={i} className="text-[10px] text-gray-500">{line}</p>
              ))}
            </div>
          )}

          {/* V3: Systemic risk overlay */}
          {data.systemic && data.systemic.score > 0 && (
            <div className="mb-3 space-y-1">
              <h5 className="text-xs font-semibold text-amber-400">Systemic Risk</h5>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-gray-400">Score: <span className="text-amber-400 font-medium">{data.systemic.score.toFixed(1)}/10</span></span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">IV overlay: <span className="text-amber-400">+{data.systemic.overlay.toFixed(1)}</span></span>
              </div>
              {data.systemic.activeChains > 0 && (
                <p className="text-[10px] text-gray-500">
                  Causal chains: {data.systemic.activeChains} active
                </p>
              )}
              {data.systemic.topRhyme && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1.5 mt-1">
                  <p className="text-[10px] text-purple-300 font-medium">
                    {Math.round(data.systemic.topRhyme.matchScore * 100)}% match to {data.systemic.topRhyme.crisisYear} {data.systemic.topRhyme.crisisName}
                  </p>
                  <p className="text-[9px] text-purple-400/70 mt-0.5">
                    Peak VIX: {data.systemic.topRhyme.peakVix} | Max DD: {data.systemic.topRhyme.maxDrawdown}%
                  </p>
                </div>
              )}
              {data.systemic.creditSignals > 0 && (
                <p className="text-[10px] text-red-400">
                  Credit signals: {data.systemic.creditSignals} in last 48h
                </p>
              )}
            </div>
          )}

          {/* V4: Next-session forecast */}
          {data.prediction && (
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-[var(--fintheon-accent)]" />
                <h5 className="text-xs font-semibold text-[var(--fintheon-accent)]">Next Session Forecast</h5>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-gray-500 ml-auto">
                  {data.prediction.source === 'mirofish' ? 'MiroFish' : 'Heuristic'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-gray-400">
                  Projected: <span className={`font-medium ${getScoreColor(data.prediction.nextSessionScore)}`}>
                    {data.prediction.nextSessionScore.toFixed(1)}/10
                  </span>
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">
                  Confidence: <span className="text-gray-300">{(data.prediction.confidence * 100).toFixed(0)}%</span>
                </span>
              </div>
              {data.prediction.regimeShiftProbability > 0.1 && (
                <p className="text-[10px] text-amber-400">
                  Regime shift probability: {(data.prediction.regimeShiftProbability * 100).toFixed(0)}%
                </p>
              )}
              {data.prediction.scenarios.length > 0 && (
                <div className="space-y-1 mt-1">
                  {data.prediction.scenarios.map((sc, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 truncate mr-2">{sc.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500">{(sc.probability * 100).toFixed(0)}%</span>
                        <span className={`font-medium ${getScoreColor(sc.projectedScore)}`}>
                          {sc.projectedScore.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timestamp + staleness */}
          <div className="text-[9px] text-gray-600 flex items-center gap-2">
            <span>Updated: {new Date(data.timestamp).toLocaleTimeString()}</span>
            {data.vix.staleMinutes > 5 && (
              <span className="text-yellow-600">VIX data {data.vix.staleMinutes}m old</span>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-2 mt-3 pt-3 border-t border-zinc-800">
            {[
              { range: '0-2', label: 'Calm Seas', color: 'bg-emerald-400' },
              { range: '2-4', label: 'Light Winds', color: 'bg-emerald-400' },
              { range: '4-6', label: 'Gathering Storm', color: 'bg-yellow-400' },
              { range: '6-8', label: 'Tipping Point', color: 'bg-orange-400' },
              { range: '8-10', label: 'Shit Show', color: 'bg-red-500' },
            ].map(item => (
              <div key={item.range} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-xs text-gray-300"><strong>{item.range}:</strong> {item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
