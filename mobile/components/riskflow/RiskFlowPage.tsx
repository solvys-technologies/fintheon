// [claude-code 2026-04-15] T5: Mobile RiskFlow page — card feed with infinite scroll, filters, pull-to-refresh
import { useMobileRiskFlow } from "../../contexts/RiskFlowContext";
import { useRiskFlowInfiniteScroll } from "../../hooks/useRiskFlowInfiniteScroll";
import { useRiskFlowFilters } from "../../hooks/useRiskFlowFilters";
import { PullToRefresh } from "../shared/PullToRefresh";
import { RiskFlowFilterBar } from "./RiskFlowFilterBar";
import { RiskFlowCard } from "./RiskFlowCard";

export function RiskFlowPage() {
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

  const { filtered, activeSeverity, setSeverity } = useRiskFlowFilters({
    alerts,
  });
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
            fontSize: "12px",
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
        {/* Filter bar */}
        <RiskFlowFilterBar
          activeSeverity={activeSeverity}
          onSeverityChange={setSeverity}
          counts={{
            all: alerts.length,
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
          }}
        />

        {/* Card feed */}
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: "12px",
                letterSpacing: "0.15em",
                color: "var(--text-disabled)",
              }}
            >
              [NO ALERTS]
            </span>
          </div>
        ) : (
          <div>
            {filtered.map((alert) => (
              <RiskFlowCard
                key={alert.id}
                alert={alert}
                onDismiss={removeAlert}
              />
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
                fontSize: "11px",
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
