// S13-T2: Team presence panel for FooterToolbar slide-up
import { useTeamPresence } from '../../contexts/TeamPresenceContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserCard } from './UserCard';

export function TeamPanel() {
  const { teamMembers, isConnected } = useTeamPresence();
  const { userId } = useAuth();

  // Current user first, then others
  const currentUser = teamMembers.find(m => m.userId === userId);
  const others = teamMembers.filter(m => m.userId !== userId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <h3 className="text-[11px] font-mono tracking-[0.14em] uppercase text-[var(--fintheon-accent)]">
          Team
        </h3>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/70">
          {teamMembers.length} online
        </span>
        {!isConnected && (
          <span className="text-[9px] font-mono text-zinc-600">connecting...</span>
        )}
      </div>

      {/* User cards */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {currentUser && (
          <UserCard member={currentUser} isCurrentUser />
        )}
        {others.map(member => (
          <UserCard key={member.userId} member={member} />
        ))}
        {teamMembers.length === 0 && isConnected && (
          <div className="text-center text-[11px] text-zinc-600 font-mono py-6">
            No team members online
          </div>
        )}
        {teamMembers.length <= 1 && teamMembers.length > 0 && isConnected && (
          <div className="text-center text-[10px] text-zinc-700 font-mono py-3">
            No other team members online
          </div>
        )}
      </div>
    </div>
  );
}
