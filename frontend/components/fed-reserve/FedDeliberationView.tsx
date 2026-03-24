// Deliberation rounds view — shows multi-round FOMC discussion, stance shifts, and coalitions

import { ArrowRight, Users } from 'lucide-react';

interface Exchange {
  speakerId: string;
  speakerName: string;
  content: string;
  stance: string;
  conviction: number;
}

interface StanceShift {
  agentId: string;
  from: string;
  to: string;
  reason: string;
}

interface Coalition {
  name: string;
  stance: string;
  memberIds: string[];
  strength: number;
}

interface Round {
  round: number;
  phase: string;
  exchanges: Exchange[];
  stanceShifts: StanceShift[];
  coalitions: Coalition[];
}

interface FedDeliberationViewProps {
  rounds: Round[];
}

const PHASE_LABELS: Record<string, string> = {
  'opening-statements': 'Opening Statements',
  'deliberation': 'Deliberation',
  'coalition-forming': 'Coalition Forming',
  'final-vote': 'Final Vote',
};

const STANCE_DOT: Record<string, string> = {
  hawkish: '#ef4444',
  dovish: '#22c55e',
  neutral: '#eab308',
};

export function FedDeliberationView({ rounds }: FedDeliberationViewProps) {
  return (
    <div className="space-y-4">
      {rounds.map(round => (
        <div key={round.round}>
          {/* Round Header */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: 'rgba(var(--fintheon-accent-rgb, 212, 175, 55), 0.2)', color: 'var(--fintheon-accent)' }}
            >
              {round.round}
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fintheon-accent)' }}>
              {PHASE_LABELS[round.phase] ?? round.phase}
            </span>
          </div>

          {/* Exchanges */}
          <div className="space-y-2 ml-2.5 border-l-2 pl-3" style={{ borderColor: 'var(--fintheon-border)' }}>
            {round.exchanges.map((ex, i) => (
              <div key={i} className="relative">
                {/* Stance dot on the timeline */}
                <div
                  className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    backgroundColor: STANCE_DOT[ex.stance] ?? '#6b7280',
                    borderColor: 'var(--fintheon-surface)',
                  }}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--fintheon-text)' }}>
                      {ex.speakerName}
                    </span>
                    <span
                      className="text-[8px] uppercase px-1 rounded"
                      style={{ color: STANCE_DOT[ex.stance], backgroundColor: `${STANCE_DOT[ex.stance]}15` }}
                    >
                      {ex.stance}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--fintheon-text)', opacity: 0.7 }}>
                    {ex.content}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Stance Shifts */}
          {round.stanceShifts.length > 0 && (
            <div className="mt-2 space-y-1">
              {round.stanceShifts.map((shift, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[9px] px-2 py-1 rounded"
                  style={{ backgroundColor: 'rgba(234, 179, 8, 0.08)' }}
                >
                  <ArrowRight className="w-3 h-3" style={{ color: '#eab308' }} />
                  <span style={{ color: 'var(--fintheon-text)' }}>
                    <strong>{shift.agentId}</strong> shifted{' '}
                    <span style={{ color: STANCE_DOT[shift.from] }}>{shift.from}</span>
                    {' → '}
                    <span style={{ color: STANCE_DOT[shift.to] }}>{shift.to}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Coalitions */}
          {round.coalitions.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {round.coalitions.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[9px] px-2 py-1 rounded"
                  style={{ border: `1px solid ${STANCE_DOT[c.stance]}30`, backgroundColor: `${STANCE_DOT[c.stance]}08` }}
                >
                  <Users className="w-3 h-3" style={{ color: STANCE_DOT[c.stance] }} />
                  <span style={{ color: STANCE_DOT[c.stance] }}>
                    {c.name} ({c.memberIds.length}) — {(c.strength * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
