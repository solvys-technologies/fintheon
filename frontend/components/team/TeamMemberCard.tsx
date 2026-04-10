// [claude-code 2026-04-03] S14-T6: Team member card with status dropdown + service lights + last seen
import { useState, useRef, useEffect } from "react";
import { Phone } from "lucide-react";
import type { TeamMember, UserStatus } from "../../types/team";
import { isStale, timeAgo } from "../../types/team";
import { useTeamPresence } from "../../contexts/TeamPresenceContext";

interface TeamMemberCardProps {
  member: TeamMember;
  isSelf?: boolean;
}

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: "online", label: "Online", color: "bg-emerald-400" },
  { value: "away", label: "Away", color: "bg-amber-400" },
  { value: "busy", label: "Busy", color: "bg-red-400" },
  { value: "dnd", label: "Do Not Disturb", color: "bg-red-600" },
  { value: "offline", label: "Offline", color: "bg-zinc-500" },
];

function statusDotColor(status: UserStatus): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color ?? "bg-zinc-500";
}

function ServiceLight({
  label,
  active,
  warning,
}: {
  label: string;
  active: boolean;
  warning?: string;
}) {
  const color = warning
    ? "bg-amber-400"
    : active
      ? "bg-emerald-400"
      : "bg-red-400";
  const displayLabel = warning || label;
  const titleText = warning
    ? `${label}: ${warning}`
    : `${label}: ${active ? "OK" : "Down"}`;
  return (
    <span
      className="flex items-center gap-1 text-[9px] text-[var(--fintheon-muted)] font-mono"
      title={titleText}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${color} ${warning ? "animate-pulse" : ""}`}
      />
      {displayLabel}
    </span>
  );
}

export function TeamMemberCard({ member, isSelf }: TeamMemberCardProps) {
  const { presence } = member;
  const { setUserStatus } = useTeamPresence();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const newsfeedStale = isStale(
    presence.services.newsfeedPolling.lastUpdate,
    15,
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <div className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0b0b08] px-3 py-2.5 transition-colors hover:border-[var(--fintheon-accent)]/30">
      {/* Top row: name tag + last seen */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="relative flex items-center gap-2 min-w-0"
          ref={dropdownRef}
        >
          {/* Status dot */}
          <div className="relative shrink-0">
            <div
              className={`w-2 h-2 rounded-full ${statusDotColor(presence.userStatus)}`}
            />
            {presence.online && presence.userStatus === "online" && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-40" />
            )}
          </div>

          {/* Name — clickable for self to open status dropdown */}
          <button
            onClick={() => isSelf && setDropdownOpen((v) => !v)}
            className={`text-[11px] font-semibold tracking-[0.12em] text-[var(--fintheon-accent)] uppercase truncate font-mono ${isSelf ? "cursor-pointer hover:underline" : "cursor-default"}`}
          >
            {member.displayName}
          </button>

          {isSelf && (
            <span className="text-[9px] text-[var(--fintheon-muted)] font-mono shrink-0">
              (You)
            </span>
          )}

          {/* Status dropdown — only for self */}
          {dropdownOpen && isSelf && (
            <div className="absolute top-full left-0 mt-1 z-50 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-lg min-w-[140px]">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setUserStatus(opt.value);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono transition-colors hover:bg-[var(--fintheon-accent)]/10 ${
                    presence.userStatus === opt.value
                      ? "text-[var(--fintheon-accent)]"
                      : "text-zinc-400"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Last seen + in-call */}
        <div className="flex items-center gap-2 shrink-0">
          {presence.inCall && (
            <div className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
              <Phone className="w-3 h-3" />
            </div>
          )}
          <span className="text-[9px] text-[var(--fintheon-muted)] font-mono">
            {timeAgo(presence.lastSeen)}
          </span>
        </div>
      </div>

      {/* Service status lights */}
      <div className="flex items-center gap-3 mt-2">
        <ServiceLight
          label="Twitter"
          active={presence.services.twitterCli}
          warning={
            presence.services.twitterRateLimited ? "Rate Limited" : undefined
          }
        />
        <ServiceLight label="AI" active={presence.services.aiRuntime} />
        <ServiceLight
          label="Feed"
          active={presence.services.newsfeedPolling.active && !newsfeedStale}
        />
        <ServiceLight
          label="Backend"
          active={presence.services.backendConnection}
        />
      </div>
    </div>
  );
}
