// [claude-code 2026-04-20] [NO ALERTS] now distinguishes "feed is empty" from
//   "filters hid everything" — when any severity/source filter is active and
//   the result is empty, show a Clear Filters affordance so TP can recover
//   instead of staring at a blank screen. Source sheet also renders per-bucket
//   counts so zero-match selections are visible up front.
// [claude-code 2026-04-16] RiskFlow page — Agent Reach removed, pull-to-refresh is the only manual refresh
// [claude-code 2026-04-19] Source filter sheet wired into the filter bar — tapping "SOURCE"
//   opens the 5-bucket bottom sheet.
import { useState } from "react";
import { useMobileRiskFlow } from "../../contexts/RiskFlowContext";
import { useRiskFlowInfiniteScroll } from "../../hooks/useRiskFlowInfiniteScroll";
import { useRiskFlowFilters } from "../../hooks/useRiskFlowFilters";
import { PullToRefresh } from "../shared/PullToRefresh";
import { RiskFlowFilterBar } from "./RiskFlowFilterBar";
import { RiskFlowCard } from "./RiskFlowCard";
import { SourceFilterSheet } from "./SourceFilterSheet";

export function RiskFlowPage() {
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const {
    alerts,
    isLoading,
    loadingMore,
    hasMore,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    loadMore,
    refresh,
    removeAlert,
  } = useMobileRiskFlow();

  const {
    filtered,
    activeSeverities,
    activeBuckets,
    bucketCounts,
    toggleSeverity,
    clearSeverities,
    toggleBucket,
    clearBuckets,
    clearFilters,
  } = useRiskFlowFilters({ alerts });
  const filtersActive = activeSeverities.size > 0 || activeBuckets.size > 0;
  const { sentinelRef, scrollContainerRef } = useRiskFlowInfiniteScroll({
    hasMore,
    loadingMore,
    loadMore,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            letterSpacing: "0.15em",
            color: "var(--text-disabled)",
          }}
        >
          [LOADING FEED...]
        </span>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto">
      <PullToRefresh onRefresh={refresh} scrollRef={scrollContainerRef}>
        {/* Full-width segmented filter strip */}
        <RiskFlowFilterBar
          activeSeverities={activeSeverities}
          onToggleSeverity={toggleSeverity}
          onClearSeverities={clearSeverities}
          onOpenSourceSheet={() => setSourceSheetOpen(true)}
          sourceActive={activeBuckets.size > 0}
          counts={{
            all: alerts.length,
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
          }}
        />
        <SourceFilterSheet
          isOpen={sourceSheetOpen}
          onClose={() => setSourceSheetOpen(false)}
          selected={activeBuckets}
          bucketCounts={bucketCounts}
          onToggle={toggleBucket}
          onClear={clearBuckets}
        />

        {/* Card feed — zero gap, fade dividers between */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20"
            style={{ gap: 14 }}
          >
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.15em",
                color: "var(--text-disabled)",
              }}
            >
              {filtersActive && alerts.length > 0
                ? "[NO ALERTS MATCH FILTERS]"
                : "[NO ALERTS]"}
            </span>
            {filtersActive && alerts.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  background: "transparent",
                  border: "1px solid var(--accent)",
                  padding: "10px 18px",
                  borderRadius: 8,
                  minHeight: 44,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((alert, i) => (
              <div key={alert.id}>
                {i > 0 && <hr className="fade-divider" />}
                <RiskFlowCard alert={alert} onDismiss={removeAlert} />
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex items-center justify-center py-4">
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                letterSpacing: "0.12em",
                color: "var(--text-disabled)",
              }}
            >
              [LOADING...]
            </span>
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
