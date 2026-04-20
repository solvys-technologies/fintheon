// [claude-code 2026-04-19] S25-T7: Ops chips in the Sanctum header — Aquarium last-run timer + next-brief countdown. Polls GET /api/ops/schedule-status every 60s. Countdown is replaced with an ERROR badge when the brief's status is "stale" or "failed" (missed its cadence window), matching the spec's 'error handling replacing the countdown if the brief fails to generate'.
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Activity } from "@/components/shared/iso-icons";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const POLL_MS = 60_000;

interface BriefStatus {
  type: string;
  description: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  ageMinutes: number | null;
  countdownMinutes: number | null;
  status: "ok" | "due-soon" | "stale" | "failed" | "unknown";
}

interface AgentDeskStatus {
  lastRunAt: string | null;
  ageMinutes: number | null;
  status: "ok" | "stale" | "unknown";
}

interface ScheduleStatus {
  generatedAt: string;
  schedulerActive: boolean;
  agentDesk: AgentDeskStatus;
  briefs: BriefStatus[];
}

function formatAgo(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatCountdown(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 48) return `${hours}h${rem ? ` ${rem}m` : ""}`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Pick the soonest non-failed brief for the countdown chip. */
function nextBrief(briefs: BriefStatus[]): BriefStatus | null {
  const candidates = briefs
    .filter((b) => b.countdownMinutes != null)
    .sort((a, b) => (a.countdownMinutes ?? 0) - (b.countdownMinutes ?? 0));
  return candidates[0] ?? null;
}

/** Pick the "most failed" brief for the error chip. */
function failingBrief(briefs: BriefStatus[]): BriefStatus | null {
  return (
    briefs.find((b) => b.status === "failed") ??
    briefs.find((b) => b.status === "stale") ??
    null
  );
}

export function SanctumOpsChips() {
  const [status, setStatus] = useState<ScheduleStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/ops/schedule-status`);
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as ScheduleStatus;
        if (!cancelled) setStatus(data);
      } catch {
        /* silent */
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Also tick the local clock every 30s so the "ago"/countdown labels feel live
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const agentDeskColor =
    status.agentDesk.status === "stale"
      ? "var(--fintheon-neutral-severe)"
      : status.agentDesk.status === "ok"
        ? "var(--fintheon-low)"
        : "var(--fintheon-muted)";

  const failing = failingBrief(status.briefs);
  const upcoming = nextBrief(status.briefs);

  return (
    <div className="flex items-center gap-2">
      {/* Aquarium last-run chip */}
      <div
        className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--fintheon-border)]/15 text-[9px]"
        title={
          status.agentDesk.lastRunAt
            ? `Aquarium last ran ${new Date(status.agentDesk.lastRunAt).toLocaleString()}`
            : "Aquarium has not run yet"
        }
      >
        <Activity
          size={10}
          style={{ color: agentDeskColor }}
          className={status.agentDesk.status === "ok" ? "animate-pulse" : ""}
        />
        <span
          className="tracking-[0.18em] uppercase text-[var(--fintheon-muted)]/60"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Aquarium
        </span>
        <span
          className="font-bold"
          style={{
            color: agentDeskColor,
            fontFamily: "Doto, ui-monospace, monospace",
            letterSpacing: "0.02em",
          }}
        >
          {formatAgo(status.agentDesk.ageMinutes)}
        </span>
      </div>

      {/* Brief chip — countdown OR error */}
      {failing ? (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--fintheon-severe)]/40 bg-[var(--fintheon-severe)]/10 text-[9px]"
          title={`${failing.description} — ${failing.status.toUpperCase()}`}
        >
          <AlertTriangle size={10} className="text-[var(--fintheon-severe)]" />
          <span
            className="tracking-[0.18em] uppercase"
            style={{
              color: "var(--fintheon-severe)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {failing.type}
          </span>
          <span
            className="font-bold"
            style={{
              color: "var(--fintheon-severe)",
              fontFamily: "Doto, ui-monospace, monospace",
              letterSpacing: "0.02em",
            }}
          >
            {failing.status === "failed" ? "FAILED" : "STALE"}
          </span>
        </div>
      ) : upcoming ? (
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--fintheon-border)]/15 text-[9px]"
          title={
            upcoming.nextRunAt
              ? `${upcoming.description} runs ${new Date(upcoming.nextRunAt).toLocaleString()}`
              : upcoming.description
          }
        >
          <Clock size={10} className="text-[var(--fintheon-accent)]/70" />
          <span
            className="tracking-[0.18em] uppercase text-[var(--fintheon-muted)]/60"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Next {upcoming.type}
          </span>
          <span
            className="font-bold"
            style={{
              color: "var(--fintheon-accent)",
              fontFamily: "Doto, ui-monospace, monospace",
              letterSpacing: "0.02em",
            }}
          >
            {formatCountdown(upcoming.countdownMinutes)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
