// Individual Fed agent vote card — shows stance, conviction, and reasoning

interface FedVoteCardProps {
  agentName: string;
  archetype: string;
  stance: 'hawkish' | 'dovish' | 'neutral';
  conviction: number;
  statement: string;
}

const STANCE_CONFIG = {
  hawkish: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'HAWK', icon: '🦅' },
  dovish: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', label: 'DOVE', icon: '🕊️' },
  neutral: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', label: 'NEUTRAL', icon: '⚖️' },
};

export function FedVoteCard({ agentName, archetype, stance, conviction, statement }: FedVoteCardProps) {
  const config = STANCE_CONFIG[stance];

  return (
    <div
      className="rounded-lg p-3 transition-all duration-200 hover:translate-y-[-1px]"
      style={{
        backgroundColor: config.bg,
        border: `1px solid ${config.color}22`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.icon}</span>
          <div>
            <span className="text-[11px] font-semibold" style={{ color: 'var(--fintheon-text)' }}>
              {agentName}
            </span>
            <span className="text-[9px] ml-1.5" style={{ color: 'var(--fintheon-muted)' }}>
              {archetype}
            </span>
          </div>
        </div>
        <span
          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
          style={{ color: config.color, backgroundColor: `${config.color}15` }}
        >
          {config.label}
        </span>
      </div>

      {/* Conviction bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${conviction * 100}%`, backgroundColor: config.color }}
          />
        </div>
        <span className="text-[9px] font-medium" style={{ color: config.color }}>
          {(conviction * 100).toFixed(0)}%
        </span>
      </div>

      {/* Statement */}
      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--fintheon-text)', opacity: 0.75 }}>
        {statement}
      </p>
    </div>
  );
}
