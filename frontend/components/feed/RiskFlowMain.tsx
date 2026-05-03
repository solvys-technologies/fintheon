// [claude-code 2026-03-05] Add filter tabs: All, High, Medium, Proposals
// [claude-code 2026-03-10] Dropdown filters (Priority + Source), X/FJ filter, X CLI status dot.
// [claude-code 2026-03-26] T4: Replace inline cards with RiskFlowDetailCard, remove dead helpers
// [claude-code 2026-04-03] Fix IntersectionObserver root for overflow container, add Critical/Low priority filters
// [claude-code 2026-04-19] Source filter collapsed to 5 buckets via SourceFilterMenu;
//   priority filter replaced by PriorityFilterMenu (multi-select, already wired elsewhere).
// [claude-code 2026-04-19] Refresh motion uses Unicode spinners: CIRCLE-QUARTERS in the
//   header button, METER→ARROW-3 as a top-bar shimmer during refresh, ARROW-3 for loadingMore.
// [claude-code 2026-04-24] S34-T8: mount EconCountdownModal overlay inside feed pane.
// [claude-code 2026-04-30] RiskFlow post redesign: full feed cards now expose the
//   same Ask AI catalyst-to-chat callback used by Strategium mini cards.
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { EconCountdownModal } from "./EconCountdownModal";
import { Bell, BellOff } from "lucide-react";
import { CircleQuarters, MeterToShimmer } from "../icon-bank/UnicodeSpinners";
import { Loader2 } from "lucide-react";
import { withViewTransition } from "../../lib/view-transition";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useSourceStatus } from "../../hooks/useSourceStatus";
import { useBackend } from "../../lib/backend";
import { useToast } from "../../contexts/ToastContext";
import { RiskFlowDetailCard } from "./RiskFlowDetailCard";
import { PriorityFilterMenu } from "../shared/PriorityFilterMenu";
import { SourceFilterMenu } from "./SourceFilterMenu";
import { useRiskFlowFilters } from "../../hooks/useRiskFlowFilters";
import { bucketOf, SOURCE_BUCKETS } from "../../lib/source-buckets";

interface RiskFlowMainProps {
  onChatAlert?: (alert: {
    headline: string;
    summary?: string | null;
    source?: string;
    ivScore?: number | null;
    publishedAt?: string;
  }) => void;
}

export function RiskFlowMain({ onChatAlert }: RiskFlowMainProps) {
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
  const {
    severitySet,
    toggleSeverity,
    clearSeverities,
    bucketSet,
    toggleBucket,
    clearBuckets,
    showProposals,
    setShowProposals,
    filterAlerts,
  } = useRiskFlowFilters();

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
  const proposalCount = alerts.filter((a) => a.source === "trade-idea").length;

  const items = useMemo(() => filterAlerts(alerts), [alerts, filterAlerts]);

  // Pre-compute bucket counts for the filter menu badges.
  const bucketCounts = useMemo(() => {
    const counts: Partial<Record<(typeof SOURCE_BUCKETS)[number], number>> = {};
    for (const a of alerts) {
      const b = bucketOf({
        source: a.source as string,
        riskType: a.riskType,
      });
      counts[b] = (counts[b] ?? 0) + 1;
      if (a.riskType === "Geopolitical" && b !== "Geopolitical") {
        counts.Geopolitical = (counts.Geopolitical ?? 0) + 1;
      }
    }
    return counts;
  }, [alerts]);

  return (
    <div
      ref={scrollContainerRef}
      className="relative h-full overflow-y-auto px-0 pt-0 pb-0"
    >
      <EconCountdownModal />
      <div className="flex items-center justify-between mb-2 mt-1 px-3">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em]">
          <span className="text-[var(--fintheon-accent)] font-semibold tracking-[0.15em]">
            RiskFlow
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${sourceStatus.xHomeTimeline ? "bg-emerald-400" : "bg-zinc-600"}`}
            />
            <span
              className={
                sourceStatus.xHomeTimeline ? "text-emerald-400/90" : "text-zinc-500"
              }
            >
              X
            </span>
          </span>
          <span
            aria-hidden={!refreshing}
            style={{
              opacity: refreshing ? 1 : 0,
              transition: "opacity 180ms ease",
              minWidth: 60,
            }}
          >
            <MeterToShimmer active={refreshing} size={11} cells={6} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={refreshing}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40 flex items-center justify-center w-6 h-6"
            title="Refresh feeds"
          >
            <CircleQuarters active={refreshing} size={14} />
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

      {/* Filter row: Priority popover + Source bucket popover + Proposals tab */}
      <div className="flex items-center gap-2 mb-3 px-3">
        <PriorityFilterMenu
          selected={showProposals ? new Set() : severitySet}
          onToggle={(s) =>
            withViewTransition(() => {
              setShowProposals(false);
              toggleSeverity(s);
            })
          }
          onClear={() =>
            withViewTransition(() => {
              setShowProposals(false);
              clearSeverities();
            })
          }
          counts={{
            critical: critCount,
            high: highCount,
            medium: medCount,
            low: lowCount,
          }}
        />
        <SourceFilterMenu
          selected={showProposals ? new Set() : bucketSet}
          onToggle={(b) =>
            withViewTransition(() => {
              setShowProposals(false);
              toggleBucket(b);
            })
          }
          onClear={() =>
            withViewTransition(() => {
              setShowProposals(false);
              clearBuckets();
            })
          }
          counts={bucketCounts}
        />
        <button
          onClick={() => withViewTransition(() => setShowProposals((v) => !v))}
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
              onAskAI={onChatAlert}
              surface="full"
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
