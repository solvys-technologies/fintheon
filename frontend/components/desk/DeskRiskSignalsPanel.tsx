import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { useToast } from "../../contexts/ToastContext";
import { RiskSignalCards } from "../narrative/RiskSignalCards";
import { KanbanTitle } from "../ui/KanbanTitle";
import { RiskSignalsRefreshButton } from "../executive/DashboardKickstartButtons";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

export function DeskRiskSignalsPanel({
  onNavigateTab,
}: {
  onNavigateTab?: (tab: string) => void;
}) {
  const { addToast } = useToast();
  const { refresh, refreshing } = useRiskFlow();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshRiskSignals = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const apiBase = API_BASE.replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/riskflow/refresh`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refresh();
      addToast("Risk signals refreshed", "success");
    } catch (error) {
      console.warn("[Desk] Risk signal refresh failed:", error);
      addToast("Risk signal refresh failed", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [addToast, isRefreshing, refresh]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden px-2 py-1">
      <KanbanTitle
        title="Risk Signals"
        tone="gold"
        headerRight={
          <div className="flex items-center gap-1">
            {onNavigateTab ? (
              <button
                type="button"
                onClick={() => onNavigateTab("riskflow")}
                className="px-1 text-[9px] uppercase tracking-wider text-[var(--fintheon-accent)]/50 transition-colors hover:text-[var(--fintheon-accent)]"
              >
                Open
              </button>
            ) : null}
            <RiskSignalsRefreshButton
              isLoading={isRefreshing || refreshing}
              onClick={refreshRiskSignals}
            />
            <button
              type="button"
              onClick={() => setIsCollapsed((value) => !value)}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
              title={
                isCollapsed ? "Expand Risk Signals" : "Collapse Risk Signals"
              }
              aria-label={
                isCollapsed ? "Expand Risk Signals" : "Collapse Risk Signals"
              }
            >
              {isCollapsed ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </button>
          </div>
        }
      />
      <div
        className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isCollapsed ? "0px" : "9999px",
          opacity: isCollapsed ? 0 : 1,
          overflow: isCollapsed ? "hidden" : undefined,
        }}
      >
        <RiskSignalCards compact />
      </div>
    </section>
  );
}
