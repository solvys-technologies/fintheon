// Federal Reserve FOMC Debate Board — main panel component
// Shows deliberation rounds, agent votes, coalition dynamics, and rate decision

import { useState, useCallback } from 'react';
import { Play, Loader2, CheckCircle, AlertCircle, Landmark, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { FedVoteCard } from './FedVoteCard';
import { FedDeliberationView } from './FedDeliberationView';

type SessionStatus = 'idle' | 'running' | 'complete' | 'error';

interface FedVote {
  agentId: string;
  agentName: string;
  decision: string;
  stance: 'hawkish' | 'dovish' | 'neutral';
  confidence: number;
  reasoning: string;
  dissent: boolean;
  dissentStatement?: string;
  dotPlotProjection: number;
}

interface FedRateDecision {
  decision: string;
  voteCount: Record<string, number>;
  totalVotes: number;
  dissentCount: number;
  consensusStrength: number;
  medianDotPlot: number;
  dotPlotRange: { low: number; high: number };
}

interface FedForwardGuidance {
  signal: string;
  hawkishProbability: number;
  dovishProbability: number;
  nextMeetingExpectation: string;
  keyRisks: string[];
  dissenterNarratives: string[];
}

interface DeliberationRound {
  round: number;
  phase: string;
  exchanges: Array<{
    speakerId: string;
    speakerName: string;
    content: string;
    stance: string;
    conviction: number;
  }>;
  stanceShifts: Array<{
    agentId: string;
    from: string;
    to: string;
    reason: string;
  }>;
  coalitions: Array<{
    name: string;
    stance: string;
    memberIds: string[];
    strength: number;
  }>;
}

interface FedSession {
  sessionId: string;
  status: string;
  rateDecision: FedRateDecision;
  forwardGuidance: FedForwardGuidance;
  deliberationRounds: DeliberationRound[];
  monetaryPolicySignal: number;
  signalConfidence: number;
  regimeShiftProbability: number;
  briefingSummary: string;
  agents: Array<{
    id: string;
    name: string;
    archetype: string;
    stance: string;
  }>;
}

interface FedReservePanelProps {
  compact?: boolean;
}

const DECISION_LABELS: Record<string, string> = {
  'hike-50': '+50bp',
  'hike-25': '+25bp',
  'hold': 'HOLD',
  'cut-25': '-25bp',
  'cut-50': '-50bp',
};

const STANCE_COLORS: Record<string, string> = {
  hawkish: '#ef4444',
  dovish: '#22c55e',
  neutral: '#eab308',
};

export function FedReservePanel({ compact = false }: FedReservePanelProps) {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [session, setSession] = useState<FedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'votes' | 'deliberation' | 'guidance'>('votes');

  const handleRun = useCallback(async () => {
    setStatus('running');
    setError(null);
    try {
      const res = await fetch('/api/fed-reserve/simulate', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setStatus('error');
        setError(data.error);
        return;
      }
      const sessionId = data.sessionId;

      // Poll for completion
      const poll = async () => {
        try {
          const sRes = await fetch(`/api/fed-reserve/session/${sessionId}`);
          const sData = await sRes.json();
          if (sData.status === 'complete') {
            setSession(sData);
            setStatus('complete');
          } else if (sData.status === 'error') {
            setStatus('error');
            setError(sData.error ?? 'FOMC simulation failed');
          } else {
            setTimeout(poll, 3000);
          }
        } catch {
          setStatus('error');
          setError('Lost connection to Federal Reserve board');
        }
      };
      setTimeout(poll, 2000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  const statusIcon = {
    idle: null,
    running: <Loader2 className="w-3 h-3 animate-spin text-[var(--fintheon-accent)]" />,
    complete: <CheckCircle className="w-3 h-3 text-emerald-400" />,
    error: <AlertCircle className="w-3 h-3 text-red-400" />,
  }[status];

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--fintheon-surface)',
        color: 'var(--fintheon-text)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--fintheon-border)' }}
      >
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4" style={{ color: 'var(--fintheon-accent)' }} />
          <span className="text-xs font-semibold">Federal Reserve Board</span>
          {statusIcon}
        </div>
        <button
          onClick={handleRun}
          disabled={status === 'running'}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium
            transition-colors duration-150 disabled:opacity-40"
          style={{
            backgroundColor: 'rgba(var(--fintheon-accent-rgb, 212, 175, 55), 0.15)',
            color: 'var(--fintheon-accent)',
          }}
        >
          <Play className="w-2.5 h-2.5" />
          {status === 'running' ? 'Deliberating…' : 'Run FOMC'}
        </button>
      </div>

      {/* Decision Banner */}
      {session?.rateDecision && status === 'complete' && (
        <div
          className="px-4 py-3 border-b"
          style={{ borderColor: 'var(--fintheon-border)', backgroundColor: 'rgba(var(--fintheon-accent-rgb, 212, 175, 55), 0.05)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fintheon-muted)' }}>
                Rate Decision
              </div>
              <div className="text-lg font-bold" style={{ color: 'var(--fintheon-accent)' }}>
                {DECISION_LABELS[session.rateDecision.decision] ?? session.rateDecision.decision}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px]" style={{ color: 'var(--fintheon-muted)' }}>
                Vote: {session.rateDecision.totalVotes - session.rateDecision.dissentCount}-{session.rateDecision.dissentCount}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--fintheon-muted)' }}>
                Consensus: {(session.rateDecision.consensusStrength * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Dot Plot Summary */}
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            <span style={{ color: 'var(--fintheon-muted)' }}>Dot Plot:</span>
            <span>
              {session.rateDecision.dotPlotRange.low}% — <strong>{session.rateDecision.medianDotPlot}%</strong> — {session.rateDecision.dotPlotRange.high}%
            </span>
          </div>

          {/* Policy Signal */}
          <div className="mt-2 flex items-center gap-3 text-[10px]">
            <span style={{ color: 'var(--fintheon-muted)' }}>Policy Signal:</span>
            <span
              className="font-medium"
              style={{
                color: session.monetaryPolicySignal >= 6.5 ? '#ef4444' :
                       session.monetaryPolicySignal <= 3.5 ? '#22c55e' :
                       'var(--fintheon-accent)',
              }}
            >
              {session.monetaryPolicySignal.toFixed(1)}/10
            </span>
            <span style={{ color: 'var(--fintheon-muted)' }}>
              ({session.forwardGuidance.signal})
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      {session && status === 'complete' && (
        <div className="flex px-4 pt-2 gap-1 shrink-0" style={{ borderBottom: `1px solid var(--fintheon-border)` }}>
          {(['votes', 'deliberation', 'guidance'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-3 py-1.5 text-[10px] font-medium rounded-t transition-colors"
              style={{
                color: activeTab === tab ? 'var(--fintheon-accent)' : 'var(--fintheon-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--fintheon-accent)' : '2px solid transparent',
              }}
            >
              {tab === 'votes' ? 'Votes' : tab === 'deliberation' ? 'Deliberation' : 'Guidance'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {status === 'idle' && (
          <p className="text-[11px] text-center py-8" style={{ color: 'var(--fintheon-muted)' }}>
            Run an FOMC simulation to model central bank deliberation dynamics.
          </p>
        )}

        {status === 'running' && (
          <div className="text-center py-8 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--fintheon-accent)' }} />
            <p className="text-[11px]" style={{ color: 'var(--fintheon-muted)' }}>
              FOMC members deliberating across {3} rounds…
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {session && status === 'complete' && activeTab === 'votes' && (
          <div className="space-y-2">
            {session.agents.map(agent => {
              const round = session.deliberationRounds[session.deliberationRounds.length - 1];
              const exchange = round?.exchanges.find(e => e.speakerId === agent.id);
              return (
                <FedVoteCard
                  key={agent.id}
                  agentName={agent.name}
                  archetype={agent.archetype}
                  stance={exchange?.stance as 'hawkish' | 'dovish' | 'neutral' ?? 'neutral'}
                  conviction={exchange?.conviction ?? 0.5}
                  statement={exchange?.content ?? ''}
                />
              );
            })}
          </div>
        )}

        {session && status === 'complete' && activeTab === 'deliberation' && (
          <FedDeliberationView rounds={session.deliberationRounds} />
        )}

        {session && status === 'complete' && activeTab === 'guidance' && (
          <div className="space-y-3">
            {/* Forward Guidance */}
            <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(var(--fintheon-accent-rgb, 212, 175, 55), 0.05)', border: '1px solid var(--fintheon-border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--fintheon-muted)' }}>
                Forward Guidance
              </div>
              <div className="flex items-center gap-2 mb-2">
                {session.forwardGuidance.signal === 'tightening' && <TrendingUp className="w-4 h-4 text-red-400" />}
                {session.forwardGuidance.signal === 'easing' && <TrendingDown className="w-4 h-4 text-green-400" />}
                {(session.forwardGuidance.signal === 'data-dependent' || session.forwardGuidance.signal === 'on-hold') && <Minus className="w-4 h-4 text-yellow-400" />}
                <span className="text-xs font-medium capitalize">{session.forwardGuidance.signal}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span style={{ color: 'var(--fintheon-muted)' }}>Hawkish prob:</span>{' '}
                  <span style={{ color: '#ef4444' }}>{(session.forwardGuidance.hawkishProbability * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span style={{ color: 'var(--fintheon-muted)' }}>Dovish prob:</span>{' '}
                  <span style={{ color: '#22c55e' }}>{(session.forwardGuidance.dovishProbability * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="mt-2 text-[10px]">
                <span style={{ color: 'var(--fintheon-muted)' }}>Next meeting:</span>{' '}
                <span>{DECISION_LABELS[session.forwardGuidance.nextMeetingExpectation] ?? session.forwardGuidance.nextMeetingExpectation}</span>
              </div>
            </div>

            {/* Dissenter Narratives */}
            {session.forwardGuidance.dissenterNarratives.length > 0 && (
              <div className="rounded-lg p-3" style={{ border: '1px solid var(--fintheon-border)' }}>
                <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--fintheon-muted)' }}>
                  Dissent Statements
                </div>
                {session.forwardGuidance.dissenterNarratives.map((d, i) => (
                  <p key={i} className="text-[11px] mb-1.5" style={{ color: 'var(--fintheon-text)', opacity: 0.8 }}>
                    &ldquo;{d}&rdquo;
                  </p>
                ))}
              </div>
            )}

            {/* Briefing */}
            <div className="rounded-lg p-3" style={{ border: '1px solid var(--fintheon-border)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--fintheon-muted)' }}>
                Session Briefing
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--fintheon-text)', opacity: 0.85 }}>
                {session.briefingSummary}
              </p>
            </div>

            {/* Regime Shift */}
            <div className="flex justify-between text-[10px] px-1">
              <span style={{ color: 'var(--fintheon-muted)' }}>Regime shift probability</span>
              <span style={{ color: session.regimeShiftProbability > 0.25 ? '#ef4444' : 'var(--fintheon-text)' }}>
                {(session.regimeShiftProbability * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
