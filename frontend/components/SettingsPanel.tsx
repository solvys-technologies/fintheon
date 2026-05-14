// [claude-code 2026-05-13] S63 T1: Wired lockoutDefaultDuration + quickAccessUrl props to TradingTab
// [claude-code 2026-04-25] Settings tab content swap now uses t-panel-slide (solvys-transitions)
//   for translate-Y + blur + fade entry per tab. Replaces animate-fade-in-tab / animate-fade-out-tab.
// [claude-code 2026-04-03] Refactored: thin shell that imports tab sub-components
// [claude-code 2026-03-22] T5: Wire Change Plan -> UpgradeModal, add logout button in Danger Zone
import React from "react";
import type { ReactNode } from "react";
import {
  Settings,
  Bell,
  CreditCard,
  Cpu,
  Code,
  Terminal,
  Palette,
  Users,
  AlertTriangle,
  ArrowLeft,
  Globe,
  Shield,
} from "lucide-react";
import { useSettings, type APIKeys } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button } from "./ui/Button";
import { useState, useEffect } from "react";
import { useBackend } from "../lib/backend";
import { useVoiceMemory } from "../hooks/useVoiceMemory";

import { AgenticDesk } from "./settings/AgenticDesk";
import { ThemeSettings } from "./settings/ThemeSettings";
import { HermesAdminTab } from "./settings/HermesAdminTab";
import { UpgradeModal } from "./UpgradeModal";
import { isDevAuthenticated } from "../lib/dev-settings-auth";
import { NotificationsTab } from "./settings/NotificationsTab";
import { TradingTab } from "./settings/TradingTab";
import { GeneralTab } from "./settings/GeneralTab";
import { ApiTab } from "./settings/ApiTab";
import { IframesTab } from "./settings/IframesTab";
import { DangerTab } from "./settings/DangerTab";
import { DeveloperTab } from "./settings/DeveloperTab";
import { BlockerTab } from "./settings/BlockerTab";

type SettingsTab =
  | "general"
  | "hermes-admin"
  | "appearance"
  | "desk"
  | "notifications"
  | "trading"
  | "api"
  | "iframes"
  | "blocker"
  | "developer"
  | "danger";

const AVAILABLE_SYMBOLS = [
  {
    symbol: "MNQ",
    contractName: "MNQ Z25",
    description: "E-mini Micro Nasdaq Futures",
  },
  {
    symbol: "ES",
    contractName: "ES Z25",
    description: "E-mini S&P 500 Futures",
  },
  {
    symbol: "NQ",
    contractName: "NQ Z25",
    description: "E-mini Nasdaq-100 Futures",
  },
  {
    symbol: "YM",
    contractName: "YM Z25",
    description: "E-mini Dow Jones Futures",
  },
  {
    symbol: "RTY",
    contractName: "RTY Z25",
    description: "E-mini Russell 2000 Futures",
  },
];

const TABS = [
  {
    id: "general" as const,
    label: "Profile",
    icon: Settings,
    description: "Trading symbol, billing, and account preferences",
  },
  {
    id: "hermes-admin" as const,
    label: "Hermes:Admin",
    icon: Cpu,
    description: "Gateway, agent status, backend dependencies, and diagnostics",
  },
  {
    id: "appearance" as const,
    label: "Appearance",
    icon: Palette,
    description: "Theme and visual customization options",
  },
  {
    id: "desk" as const,
    label: "Agentic Desk",
    icon: Users,
    description: "Agent persona configuration and CAO naming",
  },
  {
    id: "trading" as const,
    label: "Trading",
    icon: CreditCard,
    description: "Risk management, autopilot, and strategy toggles",
  },
  {
    id: "notifications" as const,
    label: "Notifications",
    icon: Bell,
    description: "Alerts, sounds, and notification preferences",
  },
  {
    id: "api" as const,
    label: "API",
    icon: Code,
    description: "API keys and external service credentials",
  },
  {
    id: "iframes" as const,
    label: "iFrames",
    icon: Globe,
    description: "Embed URLs for Boardroom, Research, and more",
  },
  {
    id: "blocker" as const,
    label: "Blocker",
    icon: Shield,
    description: "Block TopStepX across all apps and browsers",
  },
  {
    id: "developer" as const,
    label: "Developer",
    icon: Terminal,
    description:
      "RiskFlow calibration, mock data, test tools, and tier management",
  },
  {
    id: "danger" as const,
    label: "Danger Zone",
    icon: AlertTriangle,
    description: "Reset analysts, clear data, and export config",
  },
];

// Per-tab wrapper that drives t-panel-slide entry on mount via a one-frame rAF so
// the new tab content tweens in from the closed (translate-Y + blur + opacity:0)
// resting state. When SettingsPage flips `tabTransitioning`, every mounted panel
// flips data-open back to "false" for a synchronized exit.
function SettingsTabPanel({
  transitioning,
  children,
}: {
  transitioning: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (transitioning) {
      setOpen(false);
      return;
    }
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, [transitioning]);
  return (
    <div className="t-panel-slide" data-open={open ? "true" : "false"}>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { tier, setTier, isAuthenticated } = useAuth();
  const {
    apiKeys,
    setAPIKeys,
    tradingModels,
    setTradingModels,
    alertConfig,
    setAlertConfig,
    mockDataEnabled,
    setMockDataEnabled,
    selectedSymbol,
    setSelectedSymbol,
    riskSettings,
    setRiskSettings,
    developerSettings,
    setDeveloperSettings,
    autoPilotSettings,
    setAutoPilotSettings,
    primaryBroker,
    setPrimaryBroker,
    iframeUrls,
    setIframeUrls,
    traderName,
    setTraderName,
    defaultLayout,
    setDefaultLayout,
    defaultPlatform,
    setDefaultPlatform,
    proposerIframeSources,
    setProposerIframeSources,
    proposerDefaultIframe,
    setProposerDefaultIframe,
    lockoutDefaultDuration,
    setLockoutDefaultDuration,
    lockoutAutoReleaseMinutes,
    setLockoutAutoReleaseMinutes,
    persistentLockout,
    setPersistentLockout,
    quickAccessUrl,
    setQuickAccessUrl,
  } = useSettings();
  const backend = useBackend();
  const voiceMemory = useVoiceMemory();
  const [contractsPerTrade, setContractsPerTrade] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [showLanding, setShowLanding] = useState(true);
  const [devAuthenticated, setDevAuthenticated] =
    useState(isDevAuthenticated());
  const [landingExiting, setLandingExiting] = useState(false);
  const [landingTransition, setLandingTransition] = useState(false);
  const [prevTab, setPrevTab] = useState<SettingsTab | null>(null);
  const [tabTransitioning, setTabTransitioning] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleTabChange = (tab: SettingsTab) => {
    if (!showLanding && tab === activeTab && !tabTransitioning) return;
    if (showLanding) {
      setLandingExiting(true);
      setActiveTab(tab);
      setTimeout(() => {
        setShowLanding(false);
        setLandingExiting(false);
      }, 200);
      return;
    }
    if (tab === activeTab) return;
    setTabTransitioning(true);
    setPrevTab(activeTab);
    setTimeout(() => {
      setActiveTab(tab);
      setTimeout(() => {
        setTabTransitioning(false);
        setPrevTab(null);
      }, 50);
    }, 300);
  };

  const handleBackToLanding = () => {
    setLandingTransition(true);
    setTimeout(() => {
      setShowLanding(true);
      setLandingTransition(false);
    }, 250);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const startTime = Date.now();
    try {
      if (isAuthenticated) {
        try {
          await backend.account.updateSettings({
            dailyTarget: riskSettings.dailyProfitTarget,
            dailyLossLimit: riskSettings.dailyLossLimit,
            topstepxUsername: apiKeys.topstepxUsername,
            topstepxApiKey: apiKeys.topstepxApiKey,
            selectedSymbol: selectedSymbol.symbol,
            contractsPerTrade: contractsPerTrade,
          });
        } catch (backendErr) {
          console.warn(
            "Backend settings sync failed (saved locally):",
            backendErr,
          );
        }
        if (apiKeys.topstepxUsername || apiKeys.topstepxApiKey) {
          try {
            await backend.account.updateProjectXCredentials({
              username: apiKeys.topstepxUsername || undefined,
              apiKey: apiKeys.topstepxApiKey || undefined,
            });
          } catch (pxError) {
            console.warn("ProjectX credential sync failed:", pxError);
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 1200 - elapsed);
            setTimeout(() => {
              addToast(
                "Settings saved. ProjectX credentials failed — check API key.",
                "info",
              );
              setIsSaving(false);
            }, remaining);
            return;
          }
        }
      }
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1200 - elapsed);
      setTimeout(() => {
        addToast("Settings saved successfully", "success");
        setIsSaving(false);
      }, remaining);
    } catch (error) {
      console.error("Failed to save settings:", error);
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1200 - elapsed);
      setTimeout(() => {
        addToast("Settings saved locally. Backend sync unavailable.", "info");
        setIsSaving(false);
      }, remaining);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    async function fetchData() {
      try {
        const account = await backend.account.get();
        if (account.contractsPerTrade)
          setContractsPerTrade(account.contractsPerTrade);
        if (account.projectxUsername) {
          setAPIKeys((prev: APIKeys) => ({
            ...prev,
            topstepxUsername: account.projectxUsername || "",
          }));
        }
      } catch (error) {
        console.warn("Failed to load settings data:", error);
      }
    }
    fetchData();
  }, [backend, isAuthenticated, setAPIKeys]);

  const renderTabContent = () => {
    const wrap = (key: SettingsTab, child: ReactNode) => (
      <SettingsTabPanel key={key} transitioning={tabTransitioning}>
        {child}
      </SettingsTabPanel>
    );
    switch (activeTab) {
      case "notifications":
        return wrap(
          "notifications",
          <NotificationsTab
            alertConfig={alertConfig}
            setAlertConfig={setAlertConfig}
            voiceMemory={voiceMemory}
          />,
        );
      case "trading":
        return wrap(
          "trading",
          <TradingTab
            riskSettings={riskSettings}
            setRiskSettings={setRiskSettings}
            contractsPerTrade={contractsPerTrade}
            setContractsPerTrade={setContractsPerTrade}
            primaryBroker={primaryBroker}
            setPrimaryBroker={setPrimaryBroker}
            autoPilotSettings={autoPilotSettings}
            setAutoPilotSettings={setAutoPilotSettings}
            tradingModels={tradingModels}
            setTradingModels={setTradingModels}
            lockoutDefaultDuration={lockoutDefaultDuration}
            setLockoutDefaultDuration={setLockoutDefaultDuration}
            lockoutAutoReleaseMinutes={lockoutAutoReleaseMinutes}
            setLockoutAutoReleaseMinutes={setLockoutAutoReleaseMinutes}
            persistentLockout={persistentLockout}
            setPersistentLockout={setPersistentLockout}
            quickAccessUrl={quickAccessUrl}
            setQuickAccessUrl={setQuickAccessUrl}
          />,
        );
      case "general":
        return wrap(
          "general",
          <GeneralTab
            traderName={traderName}
            setTraderName={setTraderName}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
            availableSymbols={AVAILABLE_SYMBOLS}
            tier={tier}
            onShowUpgradeModal={() => setShowUpgradeModal(true)}
          />,
        );
      case "api":
        return wrap(
          "api",
          <ApiTab apiKeys={apiKeys} setAPIKeys={setAPIKeys} />,
        );
      case "iframes":
        return wrap(
          "iframes",
          <IframesTab
            iframeUrls={iframeUrls}
            setIframeUrls={setIframeUrls}
            defaultLayout={defaultLayout}
            setDefaultLayout={setDefaultLayout}
            defaultPlatform={defaultPlatform}
            setDefaultPlatform={setDefaultPlatform}
            proposerIframeSources={proposerIframeSources}
            setProposerIframeSources={setProposerIframeSources}
            proposerDefaultIframe={proposerDefaultIframe}
            setProposerDefaultIframe={setProposerDefaultIframe}
          />,
        );
      case "hermes-admin":
        return wrap("hermes-admin", <HermesAdminTab />);
      case "appearance":
        return wrap("appearance", <ThemeSettings />);
      case "desk":
        return wrap("desk", <AgenticDesk />);
      case "danger":
        return wrap("danger", <DangerTab />);
      case "blocker":
        return wrap("blocker", <BlockerTab />);
      case "developer":
        return wrap(
          "developer",
          <DeveloperTab
            devAuthenticated={devAuthenticated}
            onAuthenticated={() => setDevAuthenticated(true)}
            tier={tier}
            setTier={setTier}
            mockDataEnabled={mockDataEnabled}
            setMockDataEnabled={setMockDataEnabled}
            developerSettings={developerSettings}
            setDeveloperSettings={setDeveloperSettings}
          />,
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full flex relative">
      <div className="flex-1 flex flex-col min-h-0">
        {showLanding ? (
          <div
            className={`flex-1 overflow-y-auto px-8 py-8 flex items-center justify-center transition-all duration-200 ${landingExiting ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"}`}
          >
            <div className="max-w-3xl w-full">
              <div className="text-center mb-8">
                <h1 className="text-[22px] font-semibold text-white tracking-tight mb-1">
                  Settings
                </h1>
                <p className="text-[13px] text-gray-500">
                  Configure your Fintheon environment
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isDanger = tab.id === "danger";
                  return (
                    <React.Fragment key={tab.id}>
                      {isDanger && <div className="hidden lg:block" />}
                      <button
                        onClick={() => handleTabChange(tab.id)}
                        className={`group text-left p-4 rounded-lg border transition-all hover:scale-[1.01] ${isDanger ? "border-red-500/15 hover:border-red-500/30 hover:bg-red-500/5" : "fintheon-accent-border fintheon-accent-border-hover"}`}
                        style={{ backgroundColor: "rgba(10,10,0,0.4)" }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDanger ? "bg-red-500/10 text-red-400 group-hover:bg-red-500/20" : "fintheon-settings-icon"} transition-colors`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-[13px] font-semibold ${isDanger ? "text-red-400" : "text-white"}`}
                            >
                              {tab.label}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                              {tab.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`flex-1 flex flex-col min-h-0 transition-all duration-200 ${landingTransition ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}
          >
            <div className="shrink-0 flex items-center gap-3 px-8 pt-5 pb-3">
              <button
                onClick={handleBackToLanding}
                className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors"
                title="Back to Settings"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon =
                    TABS.find((t) => t.id === activeTab)?.icon ?? Settings;
                  return (
                    <Icon className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
                  );
                })()}
                <h2 className="text-[14px] font-semibold text-white tracking-tight">
                  {TABS.find((t) => t.id === activeTab)?.label}
                </h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-4 pb-20 space-y-6 relative">
              {renderTabContent()}
            </div>
            <div className="sticky bottom-0 bg-[var(--fintheon-bg)] backdrop-blur-sm border-t border-[var(--fintheon-accent)]/10 px-8 py-3">
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="primary"
                  onClick={handleSave}
                  className="px-6 py-2"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!showLanding && (
        <div
          className="absolute right-0 top-0 bottom-0 z-30"
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          {!sidebarHovered && (
            <div className="absolute right-0 top-0 bottom-0 w-3 bg-transparent cursor-pointer">
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
                {TABS.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${TABS[i].id === activeTab ? "h-4 bg-[var(--fintheon-accent)]" : "h-1.5 bg-[var(--fintheon-accent)]/25"}`}
                  />
                ))}
              </div>
            </div>
          )}
          <div
            className={`h-full bg-[var(--fintheon-bg)] border-l border-[var(--fintheon-accent)]/15 flex flex-col py-5 transition-all duration-200 ease-out overflow-hidden ${sidebarHovered ? "w-52 opacity-100" : "w-0 opacity-0"}`}
          >
            <div className="px-4 mb-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-semibold">
                Subsections
              </span>
            </div>
            <div className="flex-1 space-y-0.5 px-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]" : "text-gray-400 hover:bg-[var(--fintheon-accent)]/8 hover:text-gray-200"}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span
                      className={`text-[12px] font-medium truncate ${isActive ? "text-[var(--fintheon-accent)]" : ""}`}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
    </div>
  );
}
