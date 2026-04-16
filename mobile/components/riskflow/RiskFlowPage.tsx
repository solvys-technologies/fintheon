// [claude-code 2026-04-16] Agent Reach button — deliberate fetch+score action, separate from pull-to-refresh
// [claude-code 2026-04-15] RiskFlow page — zero-gap X-feed style, fade dividers, full-width filter strip
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
    isReaching,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    loadMore,
    refresh,
    agentReach,
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
        {/* Agent Reach — fetch + score new items from sources */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "6px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={agentReach}
            disabled={isReaching}
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: isReaching
                ? "var(--text-disabled)"
                : "var(--accent, #c79f4a)",
              background: "transparent",
              border: `1px solid ${isReaching ? "var(--border)" : "var(--accent, #c79f4a)"}`,
              borderRadius: 4,
              padding: "4px 10px",
              cursor: isReaching ? "default" : "pointer",
              opacity: isReaching ? 0.5 : 1,
              transition: "opacity 150ms, color 150ms, border-color 150ms",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {isReaching ? "[REACHING...]" : "[AGENT REACH]"}
          </button>
        </div>

        {/* Full-width segmented filter strip */}
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

        {/* Card feed — zero gap, fade dividers between */}
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 12,
                letterSpacing: "0.15em",
                color: "var(--text-disabled)",
              }}
            >
              [NO ALERTS]
            </span>
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
