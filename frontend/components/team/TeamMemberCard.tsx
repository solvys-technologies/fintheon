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

const STATUS_OPTIONS: { value: UserStatus; label: string; cssColor: string }[] =
  [
    { value: "online", label: "Online", cssColor: "var(--fintheon-low)" },
    {
      value: "away",
      label: "Away",
      cssColor: "var(--fintheon-neutral-severe)",
    },
    { value: "busy", label: "Busy", cssColor: "var(--fintheon-severe)" },
    {
      value: "dnd",
      label: "Do Not Disturb",
      cssColor: "var(--fintheon-severe)",
    },
    { value: "offline", label: "Offline", cssColor: "var(--fintheon-muted)" },
  ];

function statusDotCssColor(status: UserStatus): string {
  return (
    STATUS_OPTIONS.find((s) => s.value === status)?.cssColor ??
    "var(--fintheon-muted)"
  );
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
  const bgColor = warning
    ? "var(--fintheon-neutral-severe)"
    : active
      ? "var(--fintheon-low)"
      : "var(--fintheon-severe)";
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
        className={`inline-block w-1.5 h-1.5 rounded-full ${warning ? "animate-pulse" : ""}`}
        style={{ backgroundColor: bgColor }}
      />
      {displayLabel}
    </span>
  );
}

export function TeamMemberCard({ member, isSelf }: TeamMemberCardProps) {
  const { presence } = member;
  const { setUserStatus, riskflowKilled, toggleRiskFlow } = useTeamPresence();
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
    <div className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] px-3 py-2.5 transition-colors hover:border-[var(--fintheon-accent)]/30">
      {/* Top row: name tag + last seen */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="relative flex items-center gap-2 min-w-0"
          ref={dropdownRef}
        >
          {/* Status dot */}
          <div className="relative shrink-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: statusDotCssColor(presence.userStatus),
              }}
            />
            {presence.online && presence.userStatus === "online" && (
              <div
                className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-40"
                style={{ backgroundColor: "var(--fintheon-low)" }}
              />
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
                      : "text-[var(--fintheon-muted)]"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: opt.cssColor }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Last seen + in-call */}
        <div className="flex items-center gap-2 shrink-0">
          {presence.inCall && (
            <div className="flex items-center gap-1 text-[9px] text-[var(--fintheon-low)] font-mono">
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
          label="RiskFlow"
          active={presence.services.rettiwt}
          warning={
            presence.services.riskflowKilled
              ? "Killed"
              : presence.services.rettiwtRateLimited
                ? "Rate Limited"
                : undefined
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

      {/* RiskFlow killswitch — self only */}
      {isSelf && (
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--fintheon-accent)]/10">
          <span
            className="text-[9px] font-mono tracking-wider"
            style={{
              color: riskflowKilled
                ? "var(--fintheon-severe)"
                : "var(--fintheon-muted)",
            }}
          >
            {riskflowKilled ? "Feed Polling Killed" : "Feed Polling Active"}
          </span>
          <button
            onClick={toggleRiskFlow}
            className="relative w-7 h-[14px] rounded-full transition-colors duration-300"
            style={{
              backgroundColor: riskflowKilled
                ? "var(--fintheon-severe)"
                : "var(--fintheon-low)",
              opacity: 0.7,
            }}
            title={riskflowKilled ? "Resume RiskFlow" : "Kill RiskFlow"}
          >
            <span
              className="absolute top-[2px] w-[10px] h-[10px] rounded-full bg-white transition-all duration-300"
              style={{
                left: riskflowKilled ? "2px" : "15px",
              }}
            />
          </button>
        </div>
      )}
    </div>
  );
}
