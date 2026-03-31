// [claude-code 2026-03-31] S12-T1: Voting controls — check/x/up/down with counts
import { Check, X, ArrowUp, ArrowDown } from 'lucide-react';

export type VoteType = 'up' | 'down' | 'check' | 'x';

interface VotingControlsProps {
  bulletinId: string;
  votes: { up: number; down: number; check: number; x: number };
  userVote: VoteType | null;
  onVote: (type: VoteType) => void;
}

const BUTTONS: { type: VoteType; Icon: typeof Check; label: string }[] = [
  { type: 'check', Icon: Check, label: 'Approve' },
  { type: 'x', Icon: X, label: 'Reject' },
  { type: 'up', Icon: ArrowUp, label: 'Bullish' },
  { type: 'down', Icon: ArrowDown, label: 'Bearish' },
];

export function VotingControls({ bulletinId, votes, userVote, onVote }: VotingControlsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {BUTTONS.map(({ type, Icon, label }) => {
        const isActive = userVote === type;
        return (
          <button
            key={type}
            onClick={() => onVote(type)}
            title={label}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors ${
              isActive
                ? 'border-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                : 'border-zinc-700/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            <Icon className="h-3 w-3" />
            <span>{votes[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
