// S13-T2: Individual user presence card
import { Phone } from "lucide-react";
import type { TeamMember } from "../../types/team";

interface UserCardProps {
  member: TeamMember;
  isSelf?: boolean;
}

export function UserCard({ member, isSelf }: UserCardProps) {
  const { presence } = member;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0b0b08] px-3 py-2.5 transition-colors hover:border-[var(--fintheon-accent)]/30">
      {/* Status light */}
      <div className="relative shrink-0">
        <div
          className={`w-2 h-2 rounded-full ${presence.online ? "bg-emerald-400" : "bg-zinc-600"}`}
        />
        {presence.online && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-40" />
        )}
      </div>

      {/* Nametag + info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-[var(--fintheon-accent)] uppercase truncate font-mono">
            {member.displayName}
          </span>
          {isSelf && (
            <span className="text-[9px] text-zinc-500 font-mono">(You)</span>
          )}
          {presence.twitterCliPolling && (
            <span className="text-[9px] text-[var(--fintheon-accent)]/60 font-mono italic">
              (polling)
            </span>
          )}
        </div>

        {/* CAO status */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-zinc-500 font-mono">CAO:</span>
          <span className="text-[9px] text-zinc-400 font-mono truncate">
            {member.caoName}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              presence.caoOnline ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
        </div>
      </div>

      {/* In-call indicator — wired by T4 */}
      {presence.inCall && (
        <div className="flex items-center gap-1 shrink-0 text-[9px] text-emerald-400 font-mono">
          <Phone className="w-3 h-3" />
          <span>In Call</span>
        </div>
      )}
    </div>
  );
}
