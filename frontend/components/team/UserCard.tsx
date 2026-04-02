// S13-T2: Individual user presence card
import type { TeamMember } from '../../types/team';

interface UserCardProps {
  member: TeamMember;
  isCurrentUser?: boolean;
}

export function UserCard({ member, isCurrentUser }: UserCardProps) {
  const { presence } = member;

  return (
    <div
      className="flex items-center gap-3 border border-[var(--fintheon-accent)]/15 bg-[#0b0b08] rounded-lg px-3 py-2.5 transition-colors hover:border-[var(--fintheon-accent)]/30"
    >
      {/* Online status light */}
      <div className="relative shrink-0">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            presence.online ? 'bg-emerald-400' : 'bg-zinc-600'
          }`}
        />
        {presence.online && (
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-30" />
        )}
      </div>

      {/* Nametag + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--fintheon-accent)] uppercase truncate">
            {member.displayName}
          </span>
          {isCurrentUser && (
            <span className="text-[9px] text-zinc-500 font-mono">(You)</span>
          )}
          {presence.twitterCliPolling && (
            <span className="text-[9px] text-[var(--fintheon-accent)]/60 font-mono">(polling)</span>
          )}
          {presence.inCall && (
            <span className="text-[9px] text-indigo-400 font-mono">In Call</span>
          )}
        </div>

        {/* CAO status row */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-zinc-500 font-mono">CAO:</span>
          <span className="text-[9px] text-zinc-400 font-mono truncate">{member.caoName}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              presence.caoOnline ? 'bg-emerald-400' : 'bg-zinc-600'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
