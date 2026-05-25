import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ClipboardPlus,
  GitPullRequest,
  Pin,
  RefreshCw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NarrativeHypothesis } from "../../../backend-hono/src/services/narrative-orchestra/types";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

type ReviewAction = "accept" | "research" | "reject" | "pin" | "task";

interface NarrativeRoutingGateProps {
  hypothesis: NarrativeHypothesis | null;
  generatedAt: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const ACTIONS: Array<{
  action: ReviewAction;
  label: string;
  title: string;
  icon: LucideIcon;
  needsReason?: boolean;
}> = [
  { action: "accept", label: "Accept", title: "Accept as active", icon: Check },
  {
    action: "research",
    label: "Research",
    title: "Needs more research",
    icon: Search,
    needsReason: true,
  },
  {
    action: "reject",
    label: "Reject",
    title: "Reject with reason",
    icon: X,
    needsReason: true,
  },
  { action: "pin", label: "Pin", title: "Pin to Sanctum", icon: Pin },
  {
    action: "task",
    label: "Task",
    title: "Create research task",
    icon: ClipboardPlus,
    needsReason: true,
  },
];

export function NarrativeRoutingGate({
  hypothesis,
  generatedAt,
  isRefreshing,
  onRefresh,
}: NarrativeRoutingGateProps) {
  const decision = hypothesis?.routingDecision;
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function runAction(action: ReviewAction, needsReason?: boolean) {
    if (!hypothesis) return;
    if (needsReason && pendingAction !== action) {
      setPendingAction(action);
      setReason(decision?.rationale ?? "");
      setStatus("[DETAIL REQUIRED]");
      return;
    }
    if (needsReason && !reason.trim()) {
      setStatus("[ERROR: DETAIL REQUIRED]");
      return;
    }
    setStatus("[SAVING...]");

    const res = await fetch(
      `${API_BASE}/api/narrative/orchestra/${encodeURIComponent(hypothesis.id)}/${action}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      },
    );
    if (!res.ok) {
      console.error("[NarrativeRoutingGate] Review action failed", res.status);
      setStatus(`[ERROR: ${res.status}]`);
      return;
    }
    setPendingAction(null);
    setReason("");
    setStatus("[SAVED]");
    onRefresh();
  }

  return (
    <section className="t-panel-slide rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] p-3" data-open="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]/70">
            Routing Gate
          </p>
          <p className="truncate text-sm text-[var(--fintheon-text)]">
            {decision?.status.replace("_", " ") ?? "No route"}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {ACTIONS.map((item) => (
            <button
              key={item.action}
              type="button"
              disabled={!hypothesis || isRefreshing}
              onClick={() => runAction(item.action, item.needsReason)}
              title={item.title}
              className="inline-flex h-8 items-center gap-1 rounded border border-[var(--fintheon-accent)]/15 px-2 text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] transition hover:border-[var(--fintheon-accent)]/40 hover:text-[var(--fintheon-accent)] disabled:opacity-35"
            >
              <item.icon size={12} />
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh routing"
            className="inline-flex h-8 items-center gap-2 rounded border border-[var(--fintheon-accent)]/20 px-2 text-xs text-[var(--fintheon-accent)] transition hover:bg-[var(--fintheon-accent)]/10"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Sync
          </button>
        </div>
      </div>

      {pendingAction ? (
        <div className="mt-3 rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
              {reasonPrompt(pendingAction)}
            </p>
            <button
              type="button"
              onClick={() => {
                setPendingAction(null);
                setReason("");
                setStatus(null);
              }}
              className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-accent)]"
            >
              Clear
            </button>
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className="w-full resize-none rounded border border-[var(--fintheon-accent)]/15 bg-transparent px-2 py-2 text-xs leading-5 text-[var(--fintheon-text)] outline-none transition-colors focus:border-[var(--fintheon-accent)]/40"
          />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
        <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/55 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--fintheon-muted)]">
            <GitPullRequest size={14} />
            <span>{decision?.nextAction ?? "review"}</span>
          </div>
          <p className="text-xs leading-5 text-[var(--fintheon-text)]/85">
            {decision?.rationale ??
              "Select a story to inspect the routing state."}
          </p>
        </div>

        <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)]/55 p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--fintheon-muted)]">
            <CheckCircle2 size={14} />
            <span>{status ?? "Updated"}</span>
          </div>
          <p className="mt-2 text-xs tabular-nums text-[var(--fintheon-text)]/80">
            {formatTime(generatedAt)}
          </p>
        </div>
      </div>
    </section>
  );
}

function reasonPrompt(action: ReviewAction): string {
  if (action === "reject") return "Rejection reason";
  if (action === "task") return "Task reason";
  return "Research reason";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "pending";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
