// [claude-code 2026-04-03] MiroShark Deliberation v2 — 4 phases: Analysts → Officials? → Hermes → Harper
// Shows market analyst cards with subject tags, consensus gauge, devil's advocate badge
import { useState, useEffect, useRef } from 'react';
import { Shield, Users, Brain, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Loader2, Send, BarChart3, Zap } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ── Types ───────────────────────────────────────────────────────────────────

interface MarketAnalystAssessment {
  agentId: string;
  name: string;
  title: string;
  role: string;
  subjects: string[];
  assessment: string;
  confidence: number;
  keyConcern: string;
  projectedIVScore: number;
  regimeShiftProbability: number;
  categoryScores: Array<{ category: string; ivScore: number; confidence: number; delta: number }>;
  headlineCount: number;
}

interface GovOfficialAssessment {
  agentId: string;
  name: string;
  role: string;
  assessment: string;
  confidence: number;
  keyConcern: string;
  recommendedAction: string;
}

interface HermesDeliberation {
  agentId: string;
  name: string;
  verdict: 'agree' | 'disagree' | 'nuance';
  reasoning: string;
  confidence: number;
}

interface HarperOpusScoring {
  compositeIV: number;
  regimeShiftProbability: number;
  surfacedTheses: string[];
  downgradedTheses: string[];
  contestedTheses: string[];
  actionabilityScore: number;
  finalBriefing: string;
  consensusScore?: number;
  healthyDisagreementCount?: number;
  contrarianTriggered?: boolean;
}

type DeliberationPhase = 'idle' | 'market-analysts' | 'gov-officials' | 'hermes-deliberation' | 'harper-scoring' | 'complete' | 'interrupted';

interface DeliberationState {
  simulationId: string;
  phase: DeliberationPhase;
  phaseStartedAt: string;
  analystResults?: MarketAnalystAssessment[];
  mirosharkResults?: GovOfficialAssessment[];
  govOfficialsSkipped?: boolean;
  hermesResults?: HermesDeliberation[];
  harperScoring?: HarperOpusScoring;
  userInjection?: string;
  error?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function MiroSharkDebatePanel({ simulationId }: { simulationId: string | null }) {
  const [state, setState] = useState<DeliberationState | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [injectText, setInjectText] = useState('');
  const [injecting, setInjecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll deliberation state
  useEffect(() => {
    if (!simulationId) {
      setState(null);
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/miroshark/deliberation/${simulationId}`);
        if (res.ok) {
          const data = await res.json();
          setState(data);
          if (data.phase === 'complete' && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [simulationId]);

  const handleInject = async () => {
    if (!simulationId || !injectText.trim()) return;
    setInjecting(true);
    try {
      await fetch(`${API_BASE}/api/miroshark/deliberation/${simulationId}/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ take: injectText.trim() }),
      });
      setInjectText('');
    } catch {}
    setInjecting(false);
  };

  const phaseIndex = getPhaseIndex(state?.phase ?? 'idle');
  const isRunning = state?.phase && state.phase !== 'idle' && state.phase !== 'complete';

  return (
    <div className="h-full flex flex-col bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <span className="text-sm font-medium tracking-wide">MiroShark Deliberation</span>
          {state?.harperScoring?.contrarianTriggered && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-medium">
              CONTRARIAN
            </span>
          )}
        </div>
        <PhaseTimeline phase={state?.phase ?? 'idle'} govSkipped={state?.govOfficialsSkipped} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!simulationId && (
          <div className="text-xs text-[var(--fintheon-text)]/40 text-center py-8">
            Run a simulation to see deliberation results
          </div>
        )}

        {state?.phase === 'idle' && simulationId && (
          <div className="text-xs text-[var(--fintheon-text)]/40 text-center py-8">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-[var(--fintheon-accent)]" />
            Waiting for deliberation to start...
          </div>
        )}

        {/* Phase 1: Market Analyst Assessments */}
        {state?.analystResults && state.analystResults.length > 0 && (
          <PhaseSection
            index={0}
            title="Market Analysts"
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 0}
            isComplete={phaseIndex > 0}
            expanded={expandedPhase === 0}
            onToggle={() => setExpandedPhase(expandedPhase === 0 ? null : 0)}
          >
            <div className="space-y-2">
              {state.analystResults.map(a => (
                <AnalystCard key={a.agentId} assessment={a} />
              ))}
            </div>
          </PhaseSection>
        )}

        {/* Phase 1.5: Gov Official Assessments (conditional) */}
        {state?.mirosharkResults && state.mirosharkResults.length > 0 && (
          <PhaseSection
            index={1}
            title="Gov Officials"
            icon={<Users className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 1}
            isComplete={phaseIndex > 1}
            expanded={expandedPhase === 1}
            onToggle={() => setExpandedPhase(expandedPhase === 1 ? null : 1)}
          >
            <div className="space-y-2">
              {state.mirosharkResults.map(a => (
                <OfficialCard key={a.agentId} assessment={a} />
              ))}
            </div>
          </PhaseSection>
        )}
        {state?.govOfficialsSkipped && phaseIndex >= 1 && (
          <div className="rounded border border-[var(--fintheon-text)]/5 p-2">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[var(--fintheon-text)]/30" />
              <span className="text-xs text-[var(--fintheon-text)]/40">Gov Officials — Skipped (no geopolitical content)</span>
            </div>
          </div>
        )}

        {/* Phase 2: Hermes Deliberation */}
        {state?.hermesResults && state.hermesResults.length > 0 && (
          <PhaseSection
            index={2}
            title="Hermes Deliberation"
            icon={<Brain className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 2}
            isComplete={phaseIndex > 2}
            expanded={expandedPhase === 2}
            onToggle={() => setExpandedPhase(expandedPhase === 2 ? null : 2)}
          >
            <div className="space-y-2">
              {state.hermesResults.map(h => (
                <HermesCard key={h.agentId} result={h} />
              ))}
            </div>
          </PhaseSection>
        )}

        {/* Phase 3: Harper-Opus Scoring */}
        {state?.harperScoring && (
          <PhaseSection
            index={3}
            title="Harper-Opus Scoring"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 3}
            isComplete={state.phase === 'complete'}
            expanded={expandedPhase === 3}
            onToggle={() => setExpandedPhase(expandedPhase === 3 ? null : 3)}
          >
            <HarperCard scoring={state.harperScoring} />
          </PhaseSection>
        )}

        {/* Error display */}
        {state?.error && (
          <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 text-red-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {state.error}
          </div>
        )}
      </div>

      {/* Inject Take footer */}
      {isRunning && (
        <div className="flex-shrink-0 p-3 border-t border-[var(--fintheon-accent)]/10">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Inject your take..."
              value={injectText}
              onChange={e => setInjectText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInject()}
              className="flex-1 text-xs bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded px-2 py-1.5 text-[var(--fintheon-text)] placeholder:text-[var(--fintheon-text)]/30 focus:outline-none focus:border-[var(--fintheon-accent)]/40"
            />
            <button
              onClick={handleInject}
              disabled={injecting || !injectText.trim()}
              className="px-2 py-1.5 rounded bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] text-xs hover:bg-[var(--fintheon-accent)]/30 disabled:opacity-30 transition-colors"
            >
              {injecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PhaseTimeline({ phase, govSkipped }: { phase: DeliberationPhase; govSkipped?: boolean }) {
  const idx = getPhaseIndex(phase);
  const phases = [
    { label: 'Analysts', short: '1' },
    { label: govSkipped ? 'Officials (—)' : 'Officials', short: '1.5' },
    { label: 'Hermes', short: '2' },
    { label: 'Harper', short: '3' },
  ];

  return (
    <div className="flex items-center gap-1 mt-1">
      {phases.map((p, i) => {
        const isActive = idx === i;
        const isComplete = idx > i;
        const isSkipped = i === 1 && govSkipped;
        return (
          <div key={p.short} className="flex items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors ${
              isSkipped ? 'bg-[var(--fintheon-text)]/5 text-[var(--fintheon-text)]/20' :
              isActive ? 'bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)]' :
              isComplete ? 'bg-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]' :
              'bg-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/30'
            }`}>
              {isSkipped ? '—' : isComplete ? '✓' : p.short}
            </div>
            <span className={`text-[10px] ${
              isSkipped ? 'text-[var(--fintheon-text)]/20 line-through' :
              isActive ? 'text-[var(--fintheon-accent)]' :
              isComplete ? 'text-[var(--fintheon-text)]/60' :
              'text-[var(--fintheon-text)]/30'
            }`}>
              {p.label}
            </span>
            {i < 3 && <div className={`w-3 h-px ${isComplete ? 'bg-[var(--fintheon-accent)]/30' : 'bg-[var(--fintheon-text)]/10'}`} />}
          </div>
        );
      })}
      {phase === 'complete' && (
        <span className="text-[10px] text-emerald-400/80 ml-1">Complete</span>
      )}
      {phase !== 'idle' && phase !== 'complete' && phase !== 'interrupted' && (
        <Loader2 className="w-3 h-3 animate-spin text-[var(--fintheon-accent)] ml-1" />
      )}
    </div>
  );
}

function PhaseSection({
  index, title, icon, isActive, isComplete, expanded, onToggle, children,
}: {
  index: number;
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  isComplete: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded border transition-colors ${
      isActive ? 'border-[var(--fintheon-accent)]/30' :
      isComplete ? 'border-[var(--fintheon-accent)]/10' :
      'border-[var(--fintheon-text)]/5'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 text-left hover:bg-[var(--fintheon-text)]/5 transition-colors"
      >
        <span className={isActive ? 'text-[var(--fintheon-accent)]' : isComplete ? 'text-[var(--fintheon-accent)]/60' : 'text-[var(--fintheon-text)]/40'}>
          {icon}
        </span>
        <span className={`text-xs font-medium flex-1 ${isActive ? 'text-[var(--fintheon-accent)]' : 'text-[var(--fintheon-text)]/70'}`}>
          {title}
        </span>
        {isComplete && <CheckCircle2 className="w-3 h-3 text-emerald-400/60" />}
        {isActive && <Loader2 className="w-3 h-3 animate-spin text-[var(--fintheon-accent)]" />}
        {expanded ? <ChevronDown className="w-3 h-3 text-[var(--fintheon-text)]/40" /> : <ChevronRight className="w-3 h-3 text-[var(--fintheon-text)]/40" />}
      </button>
      {expanded && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

function AnalystCard({ assessment }: { assessment: MarketAnalystAssessment }) {
  const ivColor = assessment.projectedIVScore >= 6 ? 'text-red-400' : assessment.projectedIVScore >= 4 ? 'text-amber-400' : 'text-emerald-400';
  const isContrarian = assessment.assessment.startsWith('[CONTRARIAN]');

  return (
    <div className={`rounded bg-[var(--fintheon-text)]/5 p-2 ${isContrarian ? 'border border-amber-400/20' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--fintheon-accent)]">{assessment.name}</span>
          <span className="text-[9px] text-[var(--fintheon-text)]/40">{assessment.title}</span>
          {isContrarian && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-400/15 text-amber-400 font-medium">
              DEVIL'S ADVOCATE
            </span>
          )}
        </div>
        <span className={`text-xs font-medium ${ivColor}`}>IV {assessment.projectedIVScore.toFixed(1)}</span>
      </div>

      {/* Subject tag badges */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {assessment.subjects.map(s => (
          <span key={s} className="text-[8px] px-1 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/70">
            {s}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-[var(--fintheon-text)]/60 mb-1">{assessment.keyConcern}</p>

      {/* Top 3 category scores as mini bars */}
      <div className="flex gap-2 mt-1">
        {[...assessment.categoryScores]
          .sort((a, b) => b.ivScore - a.ivScore)
          .slice(0, 3)
          .map(c => (
            <div key={c.category} className="flex items-center gap-1">
              <span className="text-[8px] text-[var(--fintheon-text)]/30 truncate max-w-[50px]">{c.category.replace('-', ' ')}</span>
              <div className="w-8 h-1 rounded-full bg-[var(--fintheon-text)]/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--fintheon-accent)]/50"
                  style={{ width: `${(c.ivScore / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function OfficialCard({ assessment }: { assessment: GovOfficialAssessment }) {
  return (
    <div className="rounded bg-[var(--fintheon-text)]/5 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--fintheon-accent)]">{assessment.name}</span>
        <span className="text-[10px] text-[var(--fintheon-text)]/40">{(assessment.confidence * 100).toFixed(0)}% conf</span>
      </div>
      <p className="text-[10px] text-[var(--fintheon-text)]/60 mb-1">{assessment.keyConcern}</p>
      <p className="text-[10px] text-[var(--fintheon-text)]/40">{assessment.recommendedAction}</p>
    </div>
  );
}

function HermesCard({ result }: { result: HermesDeliberation }) {
  const verdictColor = result.verdict === 'agree' ? 'text-emerald-400' : result.verdict === 'disagree' ? 'text-red-400' : 'text-amber-400';
  const verdictBg = result.verdict === 'agree' ? 'bg-emerald-400/10' : result.verdict === 'disagree' ? 'bg-red-400/10' : 'bg-amber-400/10';

  return (
    <div className="rounded bg-[var(--fintheon-text)]/5 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-[var(--fintheon-text)]/80">{result.name}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${verdictColor} ${verdictBg}`}>
          {result.verdict.toUpperCase()}
        </span>
      </div>
      <p className="text-[10px] text-[var(--fintheon-text)]/60">{result.reasoning}</p>
    </div>
  );
}

function HarperCard({ scoring }: { scoring: HarperOpusScoring }) {
  const consensusColor = (scoring.consensusScore ?? 50) >= 70 ? 'text-emerald-400' :
    (scoring.consensusScore ?? 50) >= 40 ? 'text-[var(--fintheon-accent)]' : 'text-red-400';

  return (
    <div className="space-y-2">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        <KPI label="Composite IV" value={scoring.compositeIV.toFixed(1)} />
        <KPI label="Regime Risk" value={`${(scoring.regimeShiftProbability * 100).toFixed(0)}%`} />
        <KPI label="Actionability" value={scoring.actionabilityScore.toFixed(1)} />
        <KPI
          label="Consensus"
          value={scoring.consensusScore != null ? `${scoring.consensusScore}` : '—'}
          valueColor={consensusColor}
        />
      </div>

      {/* Healthy disagreement indicator */}
      {scoring.healthyDisagreementCount != null && scoring.healthyDisagreementCount > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--fintheon-accent)]/60">
          <Zap className="w-3 h-3" />
          {scoring.healthyDisagreementCount} analyst{scoring.healthyDisagreementCount > 1 ? 's' : ''} diverge significantly — healthy tension
        </div>
      )}

      {/* Briefing */}
      <div className="rounded bg-[var(--fintheon-text)]/5 p-2">
        <p className="text-[10px] text-[var(--fintheon-text)]/70 leading-relaxed">{scoring.finalBriefing}</p>
      </div>

      {/* Theses */}
      {scoring.surfacedTheses.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-emerald-400/80 block mb-1">Surfaced</span>
          {scoring.surfacedTheses.map((t, i) => (
            <p key={i} className="text-[10px] text-[var(--fintheon-text)]/60 pl-2 border-l border-emerald-400/20 mb-1">{t}</p>
          ))}
        </div>
      )}
      {scoring.contestedTheses.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-amber-400/80 block mb-1">Contested</span>
          {scoring.contestedTheses.map((t, i) => (
            <p key={i} className="text-[10px] text-[var(--fintheon-text)]/60 pl-2 border-l border-amber-400/20 mb-1">{t}</p>
          ))}
        </div>
      )}
      {scoring.downgradedTheses.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-red-400/80 block mb-1">Downgraded</span>
          {scoring.downgradedTheses.map((t, i) => (
            <p key={i} className="text-[10px] text-[var(--fintheon-text)]/60 pl-2 border-l border-red-400/20 mb-1">{t}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="rounded bg-[var(--fintheon-text)]/5 p-1.5 text-center">
      <div className={`text-xs font-medium ${valueColor ?? 'text-[var(--fintheon-accent)]'}`}>{value}</div>
      <div className="text-[9px] text-[var(--fintheon-text)]/40">{label}</div>
    </div>
  );
}

// ── Utilities ───────────────────────────────────────────────────────────────

function getPhaseIndex(phase: DeliberationPhase): number {
  switch (phase) {
    case 'market-analysts': return 0;
    case 'gov-officials': return 1;
    case 'hermes-deliberation': return 2;
    case 'harper-scoring': return 3;
    case 'complete': return 4;
    default: return -1;
  }
}
