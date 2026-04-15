// [claude-code 2026-03-05] Add filter tabs: All, High, Medium, Proposals
// [claude-code 2026-03-10] Dropdown filters (Priority + Source), X/FJ filter, X CLI status dot.
// [claude-code 2026-03-26] T4: Replace inline cards with RiskFlowDetailCard, remove dead helpers
// [claude-code 2026-04-03] Fix IntersectionObserver root for overflow container, add Critical/Low priority filters
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Bell, BellOff, RefreshCw, Loader2 } from "lucide-react";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useSourceStatus } from "../../hooks/useSourceStatus";
import { useBackend } from "../../lib/backend";
import { useToast } from "../../contexts/ToastContext";
import { RiskFlowDetailCard } from "./RiskFlowDetailCard";

type PriorityFilter = "all" | "critical" | "high" | "medium" | "low";
// [claude-code 2026-04-15] S16-T5: Expanded source filters for all pipeline sources
type SourceFilter =
  | "all"
  | "twitter"
  | "financial-juice"
  | "deitaone"
  | "osint"
  | "econ-calendar"
  | "polymarket-kalshi"
  | "hermes";

export function RiskFlowMain() {
  const {
    alerts,
    markAllSeen,
    isSeen,
    removeAlert,
    refresh,
    refreshing,
    loadMore,
    loadingMore,
    hasMore,
  } = useRiskFlow();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sourceStatus = useSourceStatus();
  const backend = useBackend();
  const { addToast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showProposals, setShowProposals] = useState(false);

  useEffect(() => {
    markAllSeen(alerts.map((a) => a.id));
  }, [alerts, markAllSeen]);

  // Infinite scroll — observe sentinel element at bottom of list
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          void loadMore();
        }
      },
      { root: scrollContainerRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  const requestNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
      if (permission === "granted") {
        new Notification("Fintheon RiskFlow Alerts", {
          body: "You will now receive notifications for breaking RiskFlow events",
          icon: "/favicon.ico",
        });
      }
    }
  };

  const handleGenerateNote = async (itemId: string) => {
    try {
      await backend.riskflow.generateNote(itemId);
    } catch (err) {
      console.warn("[RiskFlow] Failed to generate note:", err);
    }
  };

  // [claude-code 2026-04-15] S16-T5: Accept optional reason for dismissal feedback
  const handleNotRelevant = useCallback(
    async (id: string, reason?: string) => {
      removeAlert(id);
      addToast("Feedback recorded", "success");
      try {
        const apiBase = (
          import.meta.env.VITE_API_URL || "http://localhost:8080"
        ).replace(/\/$/, "");
        // [claude-code 2026-04-13] Strip backend- prefix so DB lookup matches actual tweet_id
        const rawId = id.replace(/^backend-/, "");
        await fetch(`${apiBase}/api/riskflow/${rawId}/not-relevant`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason ?? null }),
        });
      } catch (err) {
        console.warn("[RiskFlow] Not-relevant failed:", err);
      }
    },
    [removeAlert, addToast],
  );

  const critCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const medCount = alerts.filter((a) => a.severity === "medium").length;
  const lowCount = alerts.filter((a) => a.severity === "low").length;
  const proposalCount = alerts.filter(
    (a) => a.source === "notion-trade-idea",
  ).length;

  const items = useMemo(() => {
    if (showProposals)
      return alerts.filter((a) => a.source === "notion-trade-idea");
    let base = [...alerts];
    if (priorityFilter === "critical")
      base = base.filter((a) => a.severity === "critical");
    else if (priorityFilter === "high")
      base = base.filter((a) => a.severity === "high");
    else if (priorityFilter === "medium")
      base = base.filter((a) => a.severity === "medium");
    else if (priorityFilter === "low")
      base = base.filter((a) => a.severity === "low");
    // [claude-code 2026-04-15] S16-T5: Expanded source filter matching
    if (sourceFilter === "twitter")
      base = base.filter(
        (a) =>
          (a.source as string) === "TwitterCli" ||
          (a.source as string) === "rettiwt" ||
          (a.source as string) === "Rettiwt",
      );
    else if (sourceFilter === "financial-juice")
      base = base.filter(
        (a) =>
          (a.source as string) === "FinancialJuice" ||
          (a.source as string) === "financial-juice",
      );
    else if (sourceFilter === "deitaone")
      base = base.filter((a) => (a.source as string) === "DeItaOne");
    else if (sourceFilter === "osint")
      base = base.filter(
        (a) =>
          (a.source as string) === "OSINTSources" ||
          (a.source as string) === "osint-sources",
      );
    else if (sourceFilter === "econ-calendar")
      base = base.filter(
        (a) =>
          (a.source as string) === "EconomicCalendar" ||
          (a.source as string) === "economic-calendar",
      );
    else if (sourceFilter === "polymarket-kalshi")
      base = base.filter(
        (a) =>
          (a.source as string) === "Polymarket" ||
          (a.source as string) === "polymarket" ||
          (a.source as string) === "Kalshi" ||
          (a.source as string) === "kalshi-whale",
      );
    else if (sourceFilter === "hermes")
      base = base.filter((a) => (a.source as string) === "Hermes");
    return base;
  }, [alerts, priorityFilter, sourceFilter, showProposals]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto px-0 pt-0 pb-0"
    >
      <div className="flex items-center justify-between mb-2 mt-1 px-3">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em]">
          <span className="text-[var(--fintheon-accent)] font-semibold tracking-[0.15em]">
            RiskFlow
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${sourceStatus.rettiwt ? "bg-emerald-400" : "bg-zinc-600"}`}
            />
            <span
              className={
                sourceStatus.rettiwt ? "text-emerald-400/90" : "text-zinc-500"
              }
            >
              X
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={refreshing}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
            title="Refresh feeds"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={requestNotifications}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-[var(--fintheon-accent)] transition-colors px-2 py-1"
          >
            {notificationsEnabled ? (
              <Bell className="w-3.5 h-3.5" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
            {notificationsEnabled ? "Notifications On" : "Notifications"}
          </button>
        </div>
      </div>

      {/* Filter row: Priority dropdown + Source dropdown + Proposals tab */}
      <div className="flex items-center gap-2 mb-3 px-3">
        <select
          value={showProposals ? "all" : priorityFilter}
          onChange={(e) => {
            setShowProposals(false);
            setPriorityFilter(e.target.value as PriorityFilter);
          }}
          className="text-[10px] px-2 py-1 rounded bg-[var(--fintheon-bg)] border border-zinc-800 text-zinc-400 focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
        >
          <option value="all">Priority: All ({alerts.length})</option>
          <option value="critical">Critical ({critCount})</option>
          <option value="high">High ({highCount})</option>
          <option value="medium">Medium ({medCount})</option>
          <option value="low">Low ({lowCount})</option>
        </select>
        <select
          value={showProposals ? "all" : sourceFilter}
          onChange={(e) => {
            setShowProposals(false);
            setSourceFilter(e.target.value as SourceFilter);
          }}
          className="text-[10px] px-2 py-1 rounded bg-[var(--fintheon-bg)] border border-zinc-800 text-zinc-400 focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
        >
          <option value="all">All Sources</option>
          <option value="twitter">X (Twitter)</option>
          <option value="financial-juice">Financial Juice</option>
          <option value="deitaone">DeItaOne</option>
          <option value="osint">OSINT</option>
          <option value="econ-calendar">Econ Calendar</option>
          <option value="polymarket-kalshi">Prediction Markets</option>
          <option value="hermes">Hermes (Agent)</option>
        </select>
        <button
          onClick={() => setShowProposals((v) => !v)}
          className={`text-[10px] px-2.5 py-1 rounded transition-colors border ${
            showProposals
              ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/40"
              : "text-zinc-500 hover:text-[var(--fintheon-accent)] border-transparent"
          }`}
        >
          Proposals{proposalCount > 0 ? ` (${proposalCount})` : ""}
        </button>
      </div>

      <div>
        {items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>No RiskFlow items available</p>
            <p className="text-xs mt-2">
              Live feed is currently empty or disconnected
            </p>
          </div>
        ) : (
          items.map((item) => (
            <RiskFlowDetailCard
              key={item.id}
              alert={item}
              seen={isSeen(item.id)}
              onGenerateNote={handleGenerateNote}
              onNotRelevant={handleNotRelevant}
            />
          ))
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {loadingMore && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-4 h-4 text-[var(--fintheon-accent)] animate-spin" />
            <span className="text-[10px] text-[var(--fintheon-muted)]/40">
              Loading more items...
            </span>
          </div>
        )}

        {!hasMore && items.length > 0 && (
          <div className="text-center py-3">
            <span className="text-[9px] text-[var(--fintheon-muted)]/25">
              All items loaded
            </span>
          </div>
        )}
      </div>

      {/* Fintheon animation for high-severity rows */}
      <style>{`
        @keyframes riskflow-pulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.08); }
        }
        .riskflow-fintheon-row { animation: riskflow-pulse 3s ease-in-out infinite; }
        @keyframes riskflow-expand-pulse {
          0%, 100% { border-color: color-mix(in srgb, var(--fintheon-accent) 40%, transparent); }
          50% { border-color: color-mix(in srgb, var(--fintheon-accent) 80%, transparent); }
        }
        .riskflow-expand-pulse { animation: riskflow-expand-pulse 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
