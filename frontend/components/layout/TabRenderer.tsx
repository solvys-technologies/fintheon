// [codex 2026-05-20] ECON navtab uses the full TradingView calendar page, not
// the lightweight widget, because the main calendar needs TradingView's full
// Economic/Earnings/Revenue/Dividend/IPO tabs and country filters. It stays
// mounted after first visit so the embedded frame preserves in-page history.
// [claude-code 2026-04-18] S24-T4: Admin surface now wraps Refinement/Approvals/Monitor via AdminShell
// [claude-code 2026-04-03] Extracted from MainLayout.tsx — tab content rendering
// [claude-code 2026-04-30] RiskFlow tab accepts the shared Ask AI catalyst callback.
import React, { useEffect, useState } from "react";
import { MinimalFeedSection } from "../feed/MinimalFeedSection";
import { RiskFlowMain } from "../feed/RiskFlowMain";
import { ConsiliumHub } from "../consilium/ConsiliumHub";
import { MainDashboard } from "../executive/MainDashboard";
import { EconCalendarProvider } from "../../contexts/EconCalendarContext";
import { TradingViewCalendar } from "../econ/TradingViewCalendar";
import { NarrativeProvider } from "../../contexts/NarrativeContext";
import { DeskMap } from "../narrative/DeskMap";
import { fetchNarrativeSessions } from "../../lib/narrative-session-api";
import type { NarrativeSessionSummary } from "../narrative/NarrativeSessionHistory";
import { PerformanceJournal } from "../journal/PerformanceJournal";
import { DeskRail } from "../desk/DeskRail";
import { ApparatusMap } from "../apparatus/ApparatusMap";
import { AdminShell } from "../admin/AdminShell";
import { SettingsPage } from "../SettingsPanel";

type NavTab =
  | "feed"
  | "analysis"
  | "riskflow"
  | "dashboard"
  | "econ"
  | "narrative"
  | "apparatus"
  | "performance"
  | "proposals"
  | "settings";

interface TabRendererProps {
  activeTab: NavTab;
  tabTransitioning: boolean;
  prevTab: NavTab | null;
  showRefinement: boolean;
  navigateTab: (tab: NavTab) => void;
  onChatAlert?: (alert: {
    headline: string;
    summary?: string | null;
    source?: string;
    ivScore?: number | null;
    publishedAt?: string;
  }) => void;
}

export function TabRenderer({
  activeTab,
  tabTransitioning,
  prevTab,
  showRefinement,
  navigateTab,
  onChatAlert,
}: TabRendererProps) {
  const [hasMountedEcon, setHasMountedEcon] = useState(activeTab === "econ");
  const animClass =
    tabTransitioning && prevTab
      ? "animate-fade-out-tab"
      : "animate-fade-in-tab";

  useEffect(() => {
    if (activeTab === "econ") setHasMountedEcon(true);
  }, [activeTab]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {showRefinement && (
        <div key="admin" className="h-full w-full animate-fade-in-tab">
          <AdminShell />
        </div>
      )}
      {!showRefinement && activeTab === "dashboard" && (
        <div
          key="dashboard"
          data-tour-target="dashboard"
          className={`h-full w-full section-fade-corners ${animClass}`}
        >
          <MainDashboard onNavigateTab={(tab) => navigateTab(tab as NavTab)} />
        </div>
      )}
      {!showRefinement && activeTab === "analysis" && (
        <div
          key="analysis"
          data-tour-target="chat"
          className={`h-full w-full section-fade-corners ${animClass}`}
        >
          <ConsiliumHub />
        </div>
      )}
      {!showRefinement && activeTab === "riskflow" && (
        <div
          key="riskflow"
          data-tour-target="riskflow"
          className={`h-full w-full section-fade-corners ${animClass}`}
        >
          <RiskFlowMain onChatAlert={onChatAlert} />
        </div>
      )}
      {!showRefinement && (activeTab === "econ" || hasMountedEcon) && (
        <div
          key="econ"
          data-tour-target="econ"
          className={`h-full w-full ${activeTab === "econ" ? animClass : "hidden"}`}
        >
          <EconCalendarProvider>
            <TradingViewCalendar />
          </EconCalendarProvider>
        </div>
      )}
      {!showRefinement && activeTab === "narrative" && (
        <div
          key="narrative"
          data-tour-target="narrative"
          className={`h-full w-full ${animClass}`}
        >
          <NarrativeProvider>
            <DeskNarrativeMapSurface />
          </NarrativeProvider>
        </div>
      )}
      {!showRefinement && activeTab === "apparatus" && (
        <div
          key="apparatus"
          data-tour-target="apparatus"
          className={`h-full w-full ${animClass}`}
        >
          <ApparatusMap />
        </div>
      )}
      {/* S14-T5: scriptorium, documents, memory tabs removed — now in ConsiliumHub dropdowns */}
      {!showRefinement && activeTab === "proposals" && (
        <div
          key="proposals"
          data-tour-target="desk-rail"
          className={`h-full w-full ${animClass}`}
        >
          <DeskRail />
        </div>
      )}
      {!showRefinement && activeTab === "performance" && (
        <div
          key="performance"
          data-tour-target="performance"
          className={`h-full w-full ${animClass}`}
        >
          <PerformanceJournal />
        </div>
      )}
      {/* S14-T5: research tab removed — now in ConsiliumHub Boardroom > Imperium */}
      {!showRefinement && activeTab === "settings" && (
        <div key="settings" className={`h-full w-full ${animClass}`}>
          <SettingsPage />
        </div>
      )}
    </div>
  );
}

function DeskNarrativeMapSurface() {
  const [sessions, setSessions] = useState<NarrativeSessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNarrativeSessions()
      .then((items) => {
        if (cancelled) return;
        setSessions(items);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setSessions([]);
        setError(
          err instanceof Error
            ? err.message
            : "Narrative sessions failed to load.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <DeskMap sessions={sessions} activeSessionId={null} />
      {error ? (
        <div className="fintheon-popover-surface pointer-events-none absolute left-4 top-4 z-50 max-w-sm px-3 py-2 text-xs text-[var(--fintheon-muted)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
