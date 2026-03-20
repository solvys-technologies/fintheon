// [claude-code 2026-03-20] 8c: Compact proposal card for Strategium — one-liner under Regime Tracker
import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { useBackend } from '../../lib/backend';

interface MiniProposal {
  instrument: string;
  direction: 'long' | 'short' | 'flat';
  entryPrice?: number;
  confidence: number;
}

interface MiniProposalCardProps {
  /** Navigate to full proposals tab */
  onExpand?: () => void;
}

export function MiniProposalCard({ onExpand }: MiniProposalCardProps) {
  const backend = useBackend();
  const [proposal, setProposal] = useState<MiniProposal | null>(null);

  const fetchProposal = useCallback(async () => {
    try {
      const res = await backend.autopilot.getPendingProposals();
      if (res.proposals?.length > 0) {
        const p = res.proposals[0];
        setProposal({
          instrument: p.instrument,
          direction: p.direction,
          entryPrice: p.entryPrice,
          confidence: p.confidence,
        });
      } else {
        setProposal(null);
      }
    } catch {
      // silent — widget is supplementary
    }
  }, [backend]);

  useEffect(() => {
    fetchProposal();
    const interval = setInterval(fetchProposal, 30_000);
    return () => clearInterval(interval);
  }, [fetchProposal]);

  if (!proposal) return null;

  const isLong = proposal.direction === 'long';
  const isShort = proposal.direction === 'short';
  const DirectionIcon = isLong ? TrendingUp : isShort ? TrendingDown : Target;
  const dirColor = isLong ? 'text-emerald-400' : isShort ? 'text-red-400' : 'text-zinc-400';

  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full bg-[var(--fintheon-accent)]/5 border border-[var(--fintheon-accent)]/20 rounded px-2.5 py-1.5 flex items-center gap-2 hover:bg-[var(--fintheon-accent)]/10 transition-colors group"
      title="Click to expand in Proposals tab"
    >
      <Target className="w-3 h-3 text-[var(--fintheon-accent)] flex-shrink-0" />

      <span className="text-[10px] font-mono font-bold text-[var(--fintheon-accent)] flex-shrink-0">
        {proposal.instrument}
      </span>

      <DirectionIcon className={`w-3 h-3 ${dirColor} flex-shrink-0`} />
      <span className={`text-[9px] font-semibold ${dirColor} uppercase flex-shrink-0`}>
        {proposal.direction}
      </span>

      {proposal.entryPrice && (
        <span className="text-[9px] font-mono text-zinc-400 flex-shrink-0">
          @{proposal.entryPrice.toFixed(2)}
        </span>
      )}

      <span className={`text-[9px] font-bold ml-auto flex-shrink-0 ${
        proposal.confidence >= 70 ? 'text-emerald-400' : proposal.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
      }`}>
        {proposal.confidence}%
      </span>
    </button>
  );
}
