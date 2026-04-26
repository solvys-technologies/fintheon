// [claude-code 2026-04-18] S24-T4: Admin surface now wraps Refinement/Approvals/Monitor via AdminShell
// [claude-code 2026-04-03] Extracted from MainLayout.tsx — tab content rendering
import React from "react";
import { MinimalFeedSection } from "../feed/MinimalFeedSection";
import { RiskFlowMain } from "../feed/RiskFlowMain";
import { ConsiliumHub } from "../consilium/ConsiliumHub";
import { MainDashboard } from "../executive/MainDashboard";
import { EconCalendarProvider } from "../../contexts/EconCalendarContext";
// [claude-code 2026-04-26] Desktop Econ tab now embeds TradingView's calendar
// via EmbeddedBrowserFrame; native EconCalendar still mounted on mobile/chat.
import { TradingViewCalendar } from "../econ/TradingViewCalendar";
import { NarrativeProvider } from "../../contexts/NarrativeContext";
import { NarrativeMap } from "../narrative/NarrativeMap";
import { PerformanceJournal } from "../journal/PerformanceJournal";
import { ProposalWidget } from "../proposals/ProposalWidget";
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
}

export function TabRenderer({
  activeTab,
  tabTransitioning,
  prevTab,
  showRefinement,
  navigateTab,
}: TabRendererProps) {
  const animClass =
    tabTransitioning && prevTab
      ? "animate-fade-out-tab"
      : "animate-fade-in-tab";

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
          <RiskFlowMain />
        </div>
      )}
      {!showRefinement && activeTab === "econ" && (
        <div
          key="econ"
          data-tour-target="econ"
          className={`h-full w-full ${animClass}`}
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
            <NarrativeMap />
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
          data-tour-target="proposals"
          className={`h-full w-full ${animClass}`}
        >
          <ProposalWidget />
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
