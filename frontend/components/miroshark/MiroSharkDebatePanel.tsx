// [claude-code 2026-03-28] S8-T5: MiroShark Deliberation slide-out panel — 3 phases with interrupt
import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Users, Brain, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Loader2, Send, Pause } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ── Types ───────────────────────────────────────────────────────────────────

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
}

type DeliberationPhase = 'idle' | 'miroshark-sim' | 'hermes-deliberation' | 'harper-scoring' | 'complete' | 'interrupted';

interface DeliberationState {
  simulationId: string;
  phase: DeliberationPhase;
  phaseStartedAt: string;
  mirosharkResults?: GovOfficialAssessment[];
  hermesResults?: HermesDeliberation[];
  harperScoring?: HarperOpusScoring;
  userInjection?: string;
  error?: string;
}

interface GovOfficial {
  id: string;
  name: string;
  role: string;
  weight: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export function MiroSharkDebatePanel({ simulationId }: { simulationId: string | null }) {
  const [state, setState] = useState<DeliberationState | null>(null);
  const [officials, setOfficials] = useState<GovOfficial[]>([]);
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [injectText, setInjectText] = useState('');
  const [injecting, setInjecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch officials list once
  useEffect(() => {
    fetch(`${API_BASE}/api/miroshark/officials`)
      .then(r => r.json())
      .then(d => setOfficials(d.officials ?? []))
      .catch(() => {});
  }, []);

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
          // Stop polling when complete
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
        </div>
        <PhaseTimeline phase={state?.phase ?? 'idle'} />
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

        {/* Phase 1: Gov Official Assessments */}
        {state?.mirosharkResults && state.mirosharkResults.length > 0 && (
          <PhaseSection
            index={0}
            title="Gov Official Assessments"
            icon={<Users className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 0}
            isComplete={phaseIndex > 0}
            expanded={expandedPhase === 0}
            onToggle={() => setExpandedPhase(expandedPhase === 0 ? null : 0)}
          >
            <div className="space-y-2">
              {state.mirosharkResults.map(a => (
                <OfficialCard key={a.agentId} assessment={a} />
              ))}
            </div>
          </PhaseSection>
        )}

        {/* Phase 2: Hermes Deliberation */}
        {state?.hermesResults && state.hermesResults.length > 0 && (
          <PhaseSection
            index={1}
            title="Hermes Deliberation"
            icon={<Brain className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 1}
            isComplete={phaseIndex > 1}
            expanded={expandedPhase === 1}
            onToggle={() => setExpandedPhase(expandedPhase === 1 ? null : 1)}
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
            index={2}
            title="Harper-Opus Scoring"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            isActive={phaseIndex === 2}
            isComplete={state.phase === 'complete'}
            expanded={expandedPhase === 2}
            onToggle={() => setExpandedPhase(expandedPhase === 2 ? null : 2)}
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

function PhaseTimeline({ phase }: { phase: DeliberationPhase }) {
  const idx = getPhaseIndex(phase);
  const phases = [
    { label: 'Officials', short: '1' },
    { label: 'Hermes', short: '2' },
    { label: 'Harper', short: '3' },
  ];

  return (
    <div className="flex items-center gap-1 mt-1">
      {phases.map((p, i) => {
        const isActive = idx === i;
        const isComplete = idx > i;
        const isPending = idx < i;
        return (
          <div key={p.short} className="flex items-center gap-1">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors ${
              isActive ? 'bg-[var(--fintheon-accent)] text-[var(--fintheon-bg)]' :
              isComplete ? 'bg-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]' :
              'bg-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/30'
            }`}>
              {isComplete ? '✓' : p.short}
            </div>
            <span className={`text-[10px] ${isActive ? 'text-[var(--fintheon-accent)]' : isPending ? 'text-[var(--fintheon-text)]/30' : 'text-[var(--fintheon-text)]/60'}`}>
              {p.label}
            </span>
            {i < 2 && <div className={`w-4 h-px ${isComplete ? 'bg-[var(--fintheon-accent)]/30' : 'bg-[var(--fintheon-text)]/10'}`} />}
          </div>
        );
      })}
      {phase === 'complete' && (
        <span className="text-[10px] text-emerald-400/80 ml-1">Complete</span>
      )}
      {(phase === 'miroshark-sim' || phase === 'hermes-deliberation' || phase === 'harper-scoring') && (
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
  return (
    <div className="space-y-2">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <KPI label="Composite IV" value={scoring.compositeIV.toFixed(1)} />
        <KPI label="Regime Risk" value={`${(scoring.regimeShiftProbability * 100).toFixed(0)}%`} />
        <KPI label="Actionability" value={scoring.actionabilityScore.toFixed(1)} />
      </div>

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

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-[var(--fintheon-text)]/5 p-1.5 text-center">
      <div className="text-xs font-medium text-[var(--fintheon-accent)]">{value}</div>
      <div className="text-[9px] text-[var(--fintheon-text)]/40">{label}</div>
    </div>
  );
}

// ── Utilities ───────────────────────────────────────────────────────────────

function getPhaseIndex(phase: DeliberationPhase): number {
  switch (phase) {
    case 'miroshark-sim': return 0;
    case 'hermes-deliberation': return 1;
    case 'harper-scoring': return 2;
    case 'complete': return 3;
    default: return -1;
  }
}
