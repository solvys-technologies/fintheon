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

  // [claude-code 2026-04-26] Per TP: all iframes preserve history. Switched
  // from conditional render (which unmounts the previous tab on every switch
  // and resets every iframe inside) to display:none toggling on persistent
  // siblings. The DOM stays mounted, browsers retain each iframe's history
  // stack and scroll position automatically. Cost is upfront mount of every
  // tab on first paint — acceptable for a desktop trading surface.
  const tabStyle = (tab: NavTab): React.CSSProperties => ({
    display: !showRefinement && activeTab === tab ? "block" : "none",
    height: "100%",
    width: "100%",
  });

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {showRefinement && (
        <div key="admin" className="h-full w-full animate-fade-in-tab">
          <AdminShell />
        </div>
      )}

      <div
        key="dashboard"
        data-tour-target="dashboard"
        className={`section-fade-corners ${animClass}`}
        style={tabStyle("dashboard")}
      >
        <MainDashboard onNavigateTab={(tab) => navigateTab(tab as NavTab)} />
      </div>

      <div
        key="analysis"
        data-tour-target="chat"
        className={`section-fade-corners ${animClass}`}
        style={tabStyle("analysis")}
      >
        <ConsiliumHub />
      </div>

      <div
        key="riskflow"
        data-tour-target="riskflow"
        className={`section-fade-corners ${animClass}`}
        style={tabStyle("riskflow")}
      >
        <RiskFlowMain />
      </div>

      <div
        key="econ"
        data-tour-target="econ"
        className={animClass}
        style={tabStyle("econ")}
      >
        <EconCalendarProvider>
          <TradingViewCalendar />
        </EconCalendarProvider>
      </div>

      <div
        key="narrative"
        data-tour-target="narrative"
        className={animClass}
        style={tabStyle("narrative")}
      >
        <NarrativeProvider>
          <NarrativeMap />
        </NarrativeProvider>
      </div>

      <div
        key="apparatus"
        data-tour-target="apparatus"
        className={animClass}
        style={tabStyle("apparatus")}
      >
        <ApparatusMap />
      </div>

      <div
        key="proposals"
        data-tour-target="proposals"
        className={animClass}
        style={tabStyle("proposals")}
      >
        <ProposalWidget />
      </div>

      <div
        key="performance"
        data-tour-target="performance"
        className={animClass}
        style={tabStyle("performance")}
      >
        <PerformanceJournal />
      </div>

      <div key="settings" className={animClass} style={tabStyle("settings")}>
        <SettingsPage />
      </div>
    </div>
  );
}
