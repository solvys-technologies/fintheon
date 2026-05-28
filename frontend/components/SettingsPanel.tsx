// [claude-code 2026-05-15] S66: instrument selector dropdown wired to TradingTab props.
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
} from "lucide-react";
import { useSettings, type APIKeys } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
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
import { DevPasswordGate } from "./settings/DevPasswordGate";
import { SettingsActionStatus } from "./settings/SettingsActionStatus";
import type { SurfaceCapabilities } from "../lib/surface-capabilities";

type SettingsTab =
  | "general"
  | "admin"
  | "appearance"
  | "desk"
  | "notifications"
  | "trading"
  | "api"
  | "iframes"
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
    id: "desk" as const,
    label: "Agentic Desk",
    icon: Users,
    description: "Hermes routing, agent personas, and CAO naming",
  },
  {
    id: "admin" as const,
    label: "Hermes Settings",
    icon: Cpu,
    description: "Gateway, agent status, backend dependencies, and diagnostics",
  },
  {
    id: "trading" as const,
    label: "Trading",
    icon: CreditCard,
    description: "Risk management, autopilot, and strategy toggles",
  },
  {
    id: "iframes" as const,
    label: "iFrames",
    icon: Globe,
    description: "Embed URLs for Boardroom, Research, and more",
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
    id: "appearance" as const,
    label: "Appearance",
    icon: Palette,
    description: "Theme and visual customization options",
  },
  {
    id: "developer" as const,
    label: "Developer",
    icon: Terminal,
    description:
      "RiskFlow calibration, mock data, test tools, and tier management",
  },
];
const DANGER_TAB = {
  id: "danger" as const,
  label: "Danger Zone",
  icon: AlertTriangle,
  description: "Reset analysts, clear data, and export config",
};
const ORDERED_TABS = [...TABS, DANGER_TAB];

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

export function SettingsPage({
  capabilities,
}: {
  capabilities?: SurfaceCapabilities;
}) {
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
    selectedInstrument,
    setSelectedInstrument,
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
  const [saveStatus, setSaveStatus] = useState<{
    label: string;
    detail?: string;
    tone?: "muted" | "success" | "error" | "warning";
  } | null>(null);
  const isMobileSettings = capabilities?.isMobile ?? false;
  const orderedTabs = ORDERED_TABS.filter((tab) => {
    if (!capabilities?.allowCustomIframes && tab.id === "iframes") return false;
    if (isMobileSettings && (tab.id === "admin" || tab.id === "developer")) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (orderedTabs.some((tab) => tab.id === activeTab)) return;
    setActiveTab("general");
    setShowLanding(true);
  }, [activeTab, orderedTabs]);

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
    setSaveStatus({
      label: "Saving",
      detail: "Syncing local settings and account preferences.",
      tone: "warning",
    });
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
              userName: apiKeys.topstepxUsername || undefined,
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
              setSaveStatus({
                label: "Saved Locally",
                detail: "ProjectX credential sync needs attention.",
                tone: "warning",
              });
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
        setSaveStatus({
          label: "Saved",
          detail: "Settings are current on this surface.",
          tone: "success",
        });
        setIsSaving(false);
      }, remaining);
    } catch (error) {
      console.error("Failed to save settings:", error);
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1200 - elapsed);
      setTimeout(() => {
        addToast("Settings saved locally. Backend sync unavailable.", "info");
        setSaveStatus({
          label: "Saved Locally",
          detail: "Backend sync was unavailable.",
          tone: "warning",
        });
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
            allowPsychAssist={capabilities?.allowPsychAssist ?? true}
            allowVoiceAssistant={capabilities?.allowVoiceAssistant ?? true}
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
            selectedInstrument={selectedInstrument}
            setSelectedInstrument={setSelectedInstrument}
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
      case "admin":
        return wrap(
          "admin",
          devAuthenticated ? (
            <HermesAdminTab />
          ) : (
            <DevPasswordGate
              onAuthenticated={() => setDevAuthenticated(true)}
            />
          ),
        );
      case "appearance":
        return wrap("appearance", <ThemeSettings />);
      case "desk":
        return wrap("desk", <AgenticDesk />);
      case "danger":
        return wrap("danger", <DangerTab />);
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
    <div
      className={`settings-pass-through h-full w-full flex relative ${isMobileSettings ? "settings-mobile-shell" : ""}`}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {showLanding ? (
          <div
            className={`flex-1 overflow-y-auto flex justify-center transition-all duration-200 ${
              isMobileSettings
                ? "items-start px-4 py-5"
                : "items-center px-8 py-8"
            } ${landingExiting ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"}`}
          >
            <div
              className={`${isMobileSettings ? "max-w-none" : "max-w-3xl"} w-full`}
            >
              <div
                className={
                  isMobileSettings ? "mb-5 text-left" : "text-center mb-8"
                }
              >
                <h1
                  className={`${isMobileSettings ? "text-[17px]" : "text-[22px]"} font-semibold text-white tracking-tight mb-1`}
                >
                  Settings
                </h1>
                <p
                  className={`${isMobileSettings ? "text-[11px]" : "text-[13px]"} text-gray-500`}
                >
                  User-synced Fintheon controls
                </p>
              </div>
              <div
                className={`grid ${
                  isMobileSettings
                    ? "grid-cols-1 gap-1.5"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                }`}
              >
                {orderedTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isDanger = tab.id === "danger";
                  return (
                    <React.Fragment key={tab.id}>
                      {isDanger && <div className="hidden lg:block" />}
                      <div
                        className={`group relative text-right rounded-md transition-all duration-200 hover:opacity-80 ${
                          isMobileSettings
                            ? "border border-[var(--fintheon-accent)]/10 px-3 py-2.5"
                            : "p-4"
                        } ${isDanger ? "text-red-400" : "text-[var(--fintheon-text)]"}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleTabChange(tab.id)}
                          className="flex w-full items-start justify-end gap-3 text-right"
                        >
                          <div
                            className={`mt-0.5 flex ${isMobileSettings ? "h-7 w-7" : "h-8 w-8"} shrink-0 items-center justify-center rounded-md ${isDanger ? "text-red-400" : "text-[var(--fintheon-accent)]/70"} transition-opacity duration-200`}
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
                        </button>
                      </div>
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
            <div
              className={`shrink-0 flex items-center gap-3 ${
                isMobileSettings ? "px-4 pt-4 pb-2" : "px-8 pt-5 pb-3"
              }`}
            >
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
                    orderedTabs.find((t) => t.id === activeTab)?.icon ??
                    Settings;
                  return (
                    <Icon className="w-4 h-4 text-[var(--fintheon-accent)]/60" />
                  );
                })()}
                <h2 className="text-[14px] font-semibold text-white tracking-tight">
                  {orderedTabs.find((t) => t.id === activeTab)?.label}
                </h2>
              </div>
            </div>
            <div
              className={`flex-1 overflow-y-auto ${
                isMobileSettings ? "px-4 py-3 pb-24" : "px-8 py-4 pb-28"
              } space-y-6 relative`}
            >
              {renderTabContent()}
            </div>
            <div
              className={`sticky bottom-0 bg-[var(--fintheon-bg)] ${
                isMobileSettings
                  ? "px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-3"
                  : "px-8 pb-7 pt-3"
              }`}
            >
              <div className="flex flex-col items-end justify-end gap-1 text-right">
                <button
                  onClick={handleSave}
                  className="fintheon-action-link text-right text-[11px] font-semibold uppercase tracking-[0.14em]"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                {saveStatus && (
                  <SettingsActionStatus
                    label={saveStatus.label}
                    detail={saveStatus.detail}
                    tone={saveStatus.tone}
                  />
                )}
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
                {orderedTabs.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all ${orderedTabs[i].id === activeTab ? "h-4 bg-[var(--fintheon-accent)]" : "h-1.5 bg-[var(--fintheon-accent)]/25"}`}
                  />
                ))}
              </div>
            </div>
          )}
          <div
            className={`h-full bg-[var(--fintheon-bg)] flex flex-col py-5 transition-all duration-200 ease-out overflow-hidden ${sidebarHovered ? "w-52 opacity-100" : "w-0 opacity-0"}`}
          >
            <div className="px-4 mb-4">
              <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-semibold">
                Subsections
              </span>
            </div>
            <div className="flex-1 space-y-0.5 px-2">
              {orderedTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center justify-end gap-3 px-3 py-2.5 rounded-md text-right transition-opacity duration-200 hover:opacity-80 ${isActive ? "text-[var(--fintheon-accent)]" : "text-gray-400"}`}
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
