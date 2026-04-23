// [claude-code 2026-04-03] Discord-style reaction pills — compact, only show non-zero, gold active state
import {
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Plus,
} from "lucide-react";

export type VoteType = "up" | "down" | "check" | "x";

interface VotingControlsProps {
  bulletinId: string;
  votes: { up: number; down: number; check: number; x: number };
  userVote: VoteType | null;
  onVote: (type: VoteType) => void;
}

const BUTTONS: { type: VoteType; Icon: typeof Check; label: string }[] = [
  { type: "check", Icon: Check, label: "Approve" },
  { type: "x", Icon: X, label: "Reject" },
  { type: "up", Icon: ArrowUp, label: "Bullish" },
  { type: "down", Icon: ArrowDown, label: "Bearish" },
];

export function VotingControls({
  bulletinId,
  votes,
  userVote,
  onVote,
}: VotingControlsProps) {
  const visibleButtons = BUTTONS.filter(({ type }) => votes[type] > 0);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleButtons.map(({ type, Icon, label }) => {
        const isActive = userVote === type;
        return (
          <button
            key={type}
            onClick={() => onVote(type)}
            title={label}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] transition-colors ${
              isActive
                ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] border border-[var(--fintheon-accent)]/30"
                : "bg-[var(--fintheon-surface)] text-[var(--fintheon-text)]/40 border border-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/25 hover:text-[var(--fintheon-text)]/60"
            }`}
          >
            <Icon className="h-2.5 w-2.5" />
            <span>{votes[type]}</span>
          </button>
        );
      })}
      {/* Add reaction button */}
      <button
        onClick={() => onVote("up")}
        title="Add reaction"
        className="inline-flex items-center justify-center rounded-full border border-dashed border-[var(--fintheon-accent)]/10 px-1 py-0.5 text-[var(--fintheon-text)]/20 transition-colors hover:border-[var(--fintheon-accent)]/25 hover:text-[var(--fintheon-accent)]/50"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
