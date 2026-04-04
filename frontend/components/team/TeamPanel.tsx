// [claude-code 2026-04-03] S14-T6: Team status panel — clean status card grid
import { useTeamPresence } from '../../contexts/TeamPresenceContext';
import { useAuth } from '../../contexts/AuthContext';
import { TeamMemberCard } from './TeamMemberCard';

export function TeamPanel() {
  const { teamMembers, isConnected } = useTeamPresence();
  const { userId } = useAuth();

  const self = teamMembers.find((m) => m.userId === userId);
  const others = teamMembers
    .filter((m) => m.userId !== userId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const onlineCount = teamMembers.filter((m) => m.presence.online).length;

  return (
    <div className="h-full flex flex-col px-3 py-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-[var(--fintheon-accent)] uppercase font-mono">
          Team
        </h3>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]/60">
          {onlineCount} online
        </span>
        {!isConnected && (
          <span className="text-[9px] text-zinc-600 font-mono italic">connecting...</span>
        )}
      </div>

      {/* Status card grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-2 gap-2">
          {self && <TeamMemberCard member={self} isSelf />}
          {others.map((member) => (
            <TeamMemberCard key={member.userId} member={member} />
          ))}
        </div>
        {others.length === 0 && self && (
          <div className="text-center text-[10px] text-zinc-600 font-mono py-4">
            No other team members online
          </div>
        )}
        {teamMembers.length === 0 && (
          <div className="text-center text-[10px] text-zinc-600 font-mono py-4">
            {isConnected ? 'No team members online' : 'Connecting to presence...'}
          </div>
        )}
      </div>
    </div>
  );
}
