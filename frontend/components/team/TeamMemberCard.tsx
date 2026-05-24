// [claude-code 2026-04-03] S14-T6: Team member card with status dropdown + service lights + last seen
// [claude-code 2026-04-18] S25-T4: Unified News light + per-member time-ago + self-only Doctor button
import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, Stethoscope } from "lucide-react";
import type { TeamMember, UserStatus } from "../../types/team";
import { isStale, timeAgo } from "../../types/team";
import { useTeamPresence } from "../../contexts/TeamPresenceContext";
import { useToast } from "../../contexts/ToastContext";
import backend from "../../lib/backend";

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

/**
 * Compute the unified "News" light state for a team member.
 *  - GREEN  if newsfeedHealthy (any source alive <5 min)
 *  - ORANGE if degraded (healthy but ≥1 source tripped/rate-limited)
 *  - RED    only if backend reachable + ALL sources stale
 *  - GREY   if backend unreachable OR peer offline — don't flag as down
 */
function deriveNewsState(
  services: TeamMember["presence"]["services"],
  isOnline: boolean,
): { color: string; warning?: string } {
  if (!isOnline) {
    return { color: "var(--fintheon-muted)", warning: "Offline" };
  }
  if (!services.backendConnection) {
    return { color: "var(--fintheon-muted)", warning: "No Backend" };
  }
  if (services.newsfeedHealthy) {
    if (services.newsfeedDegraded) {
      return {
        color: "var(--fintheon-neutral-severe)",
        warning: "Degraded",
      };
    }
    return { color: "var(--fintheon-low)" };
  }
  return { color: "var(--fintheon-severe)" };
}

function PolledTimeAgo({
  lastSuccessAt,
  totalContributions,
}: {
  lastSuccessAt: string | null;
  totalContributions: number;
}) {
  if (!lastSuccessAt) {
    return (
      <span className="text-[9px] text-[var(--fintheon-muted)] font-mono">
        Not yet contributed
      </span>
    );
  }
  const ageMs = Date.now() - new Date(lastSuccessAt).getTime();
  const ageMin = ageMs / 60_000;
  const dotColor =
    ageMin < 5
      ? "var(--fintheon-low)"
      : ageMin < 15
        ? "var(--fintheon-neutral-severe)"
        : "var(--fintheon-muted)";
  return (
    <span className="flex items-center gap-1.5 text-[9px] text-[var(--fintheon-muted)] font-mono">
      <span
        className="inline-block w-1 h-1 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      Polled {timeAgo(lastSuccessAt)}
      {totalContributions > 0 && ` · ${totalContributions}`}
    </span>
  );
}

export function TeamMemberCard({ member, isSelf }: TeamMemberCardProps) {
  const { presence } = member;
  const { setUserStatus } = useTeamPresence();
  const { addToast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [doctorCooldownSec, setDoctorCooldownSec] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const newsfeedStale = isStale(
    presence.services.newsfeedPolling.lastUpdate,
    15,
  );

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

  useEffect(() => {
    if (doctorCooldownSec <= 0) return;
    const t = setTimeout(() => setDoctorCooldownSec((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [doctorCooldownSec]);

  const runDoctor = useCallback(async () => {
    if (doctorBusy || doctorCooldownSec > 0) return;
    setDoctorBusy(true);
    try {
      const result = await backend.riskflow.runDoctor();
      if (result.ok) {
        addToast(
          `Feed healthy — ${result.scored} scored, ${result.wroteItems} new`,
          "success",
          undefined,
          "system-update",
        );
        setDoctorCooldownSec(60);
      } else if (result.cooldownSec) {
        addToast(
          `Doctor cooling down — ${result.cooldownSec}s`,
          "info",
          undefined,
          "system-update",
        );
        setDoctorCooldownSec(result.cooldownSec);
      }
    } catch (err) {
      addToast("Doctor call failed", "error", undefined, "system-update");
    } finally {
      setDoctorBusy(false);
    }
  }, [doctorBusy, doctorCooldownSec, addToast]);

  const newsState = deriveNewsState(presence.services, presence.online);
  const xChip = presence.services.xHomeTimeline ? "X live" : null;

  return (
    <div
      className="rounded-lg border px-3 py-2.5 transition-all duration-300 hover:border-[var(--fintheon-accent)]/30"
      style={{
        background: "var(--fintheon-glass-bg)",
        borderColor: "var(--fintheon-glass-border)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        boxShadow: "var(--fintheon-glass-shadow)",
      }}
    >
      {/* Top row: name tag + last seen */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="relative flex items-center gap-2 min-w-0"
          ref={dropdownRef}
        >
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

          {dropdownOpen && isSelf && (
            <div className="fintheon-dropdown-surface absolute top-full left-0 mt-1 z-50 rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-lg min-w-[140px]">
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

      {/* Service status lights — unified News indicator + AI + Backend */}
      <div className="flex items-center gap-3 mt-2">
        <span
          className="flex items-center gap-1 text-[9px] text-[var(--fintheon-muted)] font-mono"
          title={
            newsState.warning
              ? `News: ${newsState.warning}`
              : presence.services.newsfeedHealthy
                ? "News: OK"
                : "News: Down"
          }
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${newsState.warning === "Degraded" ? "animate-pulse" : ""}`}
            style={{ backgroundColor: newsState.color }}
          />
          {newsState.warning || "News"}
        </span>
        <ServiceLight label="AI" active={presence.services.aiRuntime} />
        <ServiceLight
          label="Backend"
          active={presence.services.backendConnection}
        />
      </div>

      {/* Time-ago polling tracker — shown on every card */}
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <PolledTimeAgo
          lastSuccessAt={presence.services.lastSuccessAt}
          totalContributions={presence.services.totalContributions}
        />
        {xChip && !isSelf && (
          <span className="text-[9px] text-[var(--fintheon-muted)] font-mono opacity-60">
            {xChip}
          </span>
        )}
      </div>

      {/* Doctor button — self only, glass-styled, cooldown-aware */}
      {isSelf && (
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--fintheon-accent)]/10">
          {xChip && (
            <span
              className="text-[9px] font-mono tracking-wider text-[var(--fintheon-muted)] opacity-70"
              title="X Home Timeline — RiskFlow data source"
            >
              {xChip}
            </span>
          )}
          <button
            onClick={runDoctor}
            disabled={doctorBusy || doctorCooldownSec > 0}
            className="ml-auto flex items-center gap-1 text-[9px] font-mono tracking-wider text-[var(--fintheon-accent)] hover:text-[var(--fintheon-accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            title={
              doctorCooldownSec > 0
                ? `Cooldown ${doctorCooldownSec}s`
                : "Doctor: re-score backlog"
            }
          >
            <Stethoscope
              className={`w-3 h-3 ${doctorBusy ? "animate-spin" : ""}`}
            />
            {doctorBusy
              ? "RUNNING"
              : doctorCooldownSec > 0
                ? `${doctorCooldownSec}s`
                : "DOCTOR"}
          </button>
        </div>
      )}

      {/* Silent hidden staleness indicator for accessibility */}
      {newsfeedStale && <span className="sr-only">Feed stale</span>}
    </div>
  );
}
