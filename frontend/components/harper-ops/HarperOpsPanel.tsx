// [claude-code 2026-04-04] Harper Ops Panel — autonomous loop monitoring + control
// [claude-code 2026-04-06] Theme-sensitive: uses --fintheon-* vars for colors + inherited font-family
import { useState } from "react";
import {
  Bot,
  Heart,
  Zap,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { useHarperOps, type OpsEntry } from "../../hooks/useHarperOps";

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-red-400";
    case "warning":
      return "text-amber-400";
    default:
      return "text-zinc-400";
  }
}

function severityDot(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-400";
    case "warning":
      return "bg-amber-400";
    default:
      return "bg-emerald-400/60";
  }
}

function actionIcon(type: string) {
  switch (type) {
    case "heartbeat":
      return <Heart className="w-3 h-3 text-emerald-400" />;
    case "alert":
      return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case "error":
      return <X className="w-3 h-3 text-red-400" />;
    default:
      return <Zap className="w-3 h-3 text-[var(--fintheon-accent)]" />;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function OpsFeedItem({
  entry,
  onApprove,
  onDeny,
}: {
  entry: OpsEntry;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[var(--fintheon-accent)]/8 py-2 px-3 hover:bg-[var(--fintheon-accent)]/[0.03] transition-colors">
      <div
        className="flex items-start gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mt-0.5 shrink-0">{actionIcon(entry.actionType)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono ${severityColor(entry.severity)}`}
            >
              {formatTime(entry.createdAt)}
            </span>
            <div
              className={`w-1.5 h-1.5 rounded-full ${severityDot(entry.severity)}`}
            />
          </div>
          <p className="text-[11px] text-[var(--fintheon-text)]/80 mt-0.5 leading-snug truncate">
            {entry.title}
          </p>
        </div>
      </div>

      {expanded && entry.detail && (
        <div className="mt-2 ml-5 text-[10px] text-[var(--fintheon-muted)] font-mono whitespace-pre-wrap leading-relaxed border-l border-[var(--fintheon-accent)]/10 pl-3">
          {entry.detail.slice(0, 1000)}
        </div>
      )}

      {entry.requiresApproval && entry.approvalStatus === "pending" && (
        <div className="mt-2 ml-5 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove(entry.id);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors"
          >
            <Check className="w-2.5 h-2.5" /> Approve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeny(entry.id);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
          >
            <X className="w-2.5 h-2.5" /> Deny
          </button>
        </div>
      )}
    </div>
  );
}

export function HarperOpsPanel() {
  const {
    feed,
    status,
    loading,
    error,
    triggerHeartbeat,
    triggerTask,
    approve,
    deny,
  } = useHarperOps();

  const loopAlive = status?.loop?.alive ?? false;
  const lastHb = status?.ops?.lastHeartbeat;
  const pendingCount = status?.ops?.pendingApprovals ?? 0;
  const queueDepth = status?.loop?.queueDepth ?? 0;

  return (
    <div
      className="h-full flex flex-col text-[var(--fintheon-text)]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/8 bg-[var(--fintheon-accent)]/[0.02]">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--fintheon-accent)]">
            Harper Ops
          </span>
          <div
            className={`w-2 h-2 rounded-full ${loopAlive ? "bg-emerald-400 animate-pulse" : "bg-[var(--fintheon-muted)]/40"}`}
          />
          <span className="text-[9px] font-mono text-[var(--fintheon-muted)]">
            {loopAlive ? "ALIVE" : "OFFLINE"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[9px] font-mono text-[var(--fintheon-muted)]">
          {lastHb && <span>Last HB: {formatTime(lastHb)}</span>}
          {queueDepth > 0 && (
            <span className="text-amber-400">Q: {queueDepth}</span>
          )}
          {pendingCount > 0 && (
            <span className="text-[var(--fintheon-accent)]">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--fintheon-accent)]/8">
        <button
          onClick={triggerHeartbeat}
          className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-[var(--fintheon-accent)]/5 text-[var(--fintheon-muted)] rounded hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-text)] transition-colors"
        >
          <RefreshCw className="w-2.5 h-2.5" /> Heartbeat
        </button>
        <button
          onClick={() => triggerTask("scoring-qa")}
          className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-[var(--fintheon-accent)]/5 text-[var(--fintheon-muted)] rounded hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-text)] transition-colors"
        >
          <Zap className="w-2.5 h-2.5" /> Scoring QA
        </button>
        <button
          onClick={() => triggerTask("narrative-synthesis")}
          className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider bg-[var(--fintheon-accent)]/5 text-[var(--fintheon-muted)] rounded hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-text)] transition-colors"
        >
          <Zap className="w-2.5 h-2.5" /> Narrative
        </button>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-[10px] font-mono text-[var(--fintheon-muted)]">
            Loading Harper Ops...
          </div>
        )}

        {error && (
          <div className="p-4 text-center text-[10px] font-mono text-red-400">
            {error}
          </div>
        )}

        {!loading && feed.length === 0 && (
          <div className="p-4 text-center text-[10px] font-mono text-[var(--fintheon-muted)]">
            No ops activity yet. Enable HARPER_AUTONOMOUS_ENABLED=true to start.
          </div>
        )}

        {feed.map((entry) => (
          <OpsFeedItem
            key={entry.id}
            entry={entry}
            onApprove={approve}
            onDeny={deny}
          />
        ))}
      </div>
    </div>
  );
}
