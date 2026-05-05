// [claude-code 2026-05-05] Responsive shell compaction: icon-only header dropdown triggers, context-aware panel-toggle visibility by layout mode, and nametag suppression at marginal widths.
// [claude-code 2026-05-01] v6.0.5: removed toolbar's own border-t so it doesn't double-stroke the new MainContent top border
// [claude-code 2026-03-03] Toolbar items reorderable via getToolbarOrder/setToolbarOrder.
// [claude-code 2026-03-11] T2: IV score wired to backend /api/market-data/iv-score — replaces local quickIVScore
// [claude-code 2026-03-20] S3:T4b: Merge platform/layout into one toolbar slot; DND moves to header when iFrame active
// [claude-code 2026-03-20] S3:T4c: createPortal for platform/layout dropdowns — fixes z-index behind Strategium panel
// [claude-code 2026-03-20] S3:T5 — VIX spike toast trigger when VIX crosses above threshold
// [claude-code 2026-03-24] Change VIX risk toast from threshold-crossing to scheduled pre-market-open times (EST)
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { UpgradeModal } from "../UpgradeModal";
import { IVScoreCard } from "../IVScoreCard";
import { useBackend } from "../../lib/backend";
import { useSettings } from "../../contexts/SettingsContext";
import { useToast } from "../../contexts/ToastContext";
import {
  getToolbarOrder,
  setToolbarOrder,
  type ToolbarItemId,
} from "../../lib/layoutOrderStorage";
import { HeaderVoiceControl } from "../voice/HeaderVoiceControl";
import { PanelToggleGroup } from "./PanelToggleGroup";
import {
  GripVertical,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Tv,
  MessageCircle,
  Power,
  Bell,
  BellOff,
  ClipboardList,
  Zap,
} from "lucide-react";
import { WhatsNewButton } from "../onboarding/FirstTimeTour";
import { StickyBulletin } from "../StickyBulletin";
import { TraderNametag } from "../TraderNametag";
import { FluxerCallWidget } from "../consilium/FluxerCallWidget";
import type { IVScoreResponse } from "../../types/market-data";
import type { TradingPlatform } from "../TradingBrowser";
import { useDND } from "../../contexts/DNDContext";
import { useServerNotifications } from "../../contexts/NotificationsContext";

type NavTab =
  | "feed"
  | "analysis"
  | "riskflow"
  | "dashboard"
  | "econ"
  | "narrative"
  | "performance"
  | "proposals"
  | "apparatus"
  | "settings";

const TAB_LABELS: Record<NavTab, string> = {
  dashboard: "Dashboard",
  feed: "Dashboard", // feed section removed; fallback for history
  analysis: "Consilium",
  proposals: "Proposals",
  apparatus: "Apparatus",
  riskflow: "RiskFlow",
  econ: "Economic Calendar",
  narrative: "NarrativeMap",
  performance: "Performance",
  settings: "Settings",
};

type LayoutOption = "tickers-only" | "combined";

interface TopHeaderProps {
  topStepXEnabled?: boolean;
  onTopStepXToggle?: () => void;
  onTopStepXDisable?: () => void;
  selectedPlatform?: TradingPlatform;
  onPlatformSelect?: (platform: TradingPlatform) => void;
  layoutOption?: LayoutOption;
  onLayoutOptionChange?: (option: LayoutOption) => void;
  chatOpen?: boolean;
  onChatToggle?: () => void;
  activeTab?: NavTab;
  tabHistory?: NavTab[];
  historyIndex?: number;
  onBack?: () => void;
  onForward?: () => void;
  hideBranding?: boolean;
  psychAssistHeadingWidget?: React.ReactNode;
  voiceRoomWidget?: React.ReactNode;
  performanceChatWidget?: React.ReactNode;
  econCountdownWidget?: React.ReactNode;
  toolbarEditMode?: boolean;
  compactLevel?: 0 | 1 | 2;
}

export function TopHeader({
  topStepXEnabled = false,
  onTopStepXToggle,
  onTopStepXDisable,
  selectedPlatform = "topstepx",
  onPlatformSelect,
  layoutOption = "combined",
  onLayoutOptionChange,
  chatOpen = false,
  onChatToggle,
  activeTab = "dashboard",
  tabHistory = [],
  historyIndex = 0,
  onBack,
  onForward,
  hideBranding = false,
  psychAssistHeadingWidget,
  voiceRoomWidget,
  performanceChatWidget,
  econCountdownWidget,
  toolbarEditMode = false,
  compactLevel = 0,
}: TopHeaderProps) {
  const { tier } = useAuth();
  const backend = useBackend();
  const { selectedSymbol, traderName, alertConfig, proposerIframeSources } =
    useSettings();
  const { addToast } = useToast();
  const instanceName =
    import.meta.env.VITE_FINTHEON_INSTANCE_NAME || "Fintheon";
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [ivData, setIvData] = useState<IVScoreResponse | null>(null);
  const [ivLoading, setIvLoading] = useState(true);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [toolbarOrder, setToolbarOrderState] = useState<ToolbarItemId[]>(() =>
    getToolbarOrder(),
  );
  const [showBulletin, setShowBulletin] = useState(false);
  const bulletinBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const platformDropdownRef = useRef<HTMLDivElement>(null);
  const layoutPortalRef = useRef<HTMLDivElement>(null);
  const platformPortalRef = useRef<HTMLDivElement>(null);
  const [layoutDropdownPos, setLayoutDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [platformDropdownPos, setPlatformDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const { dndActive, toggleManualDnd, queueCount } = useDND();
  // [claude-code 2026-04-25] S35-Unified: badge counts server-side notifications + local queue.
  const { unreadCount: serverUnread } = useServerNotifications();
  // [claude-code 2026-04-29] S53-T3: Econ watch health moved to FooterToolbar (S55)
  const totalBadgeCount = queueCount + serverUnread;
  const [quickClockPulse, setQuickClockPulse] = useState(false);
  const panelToggleMode = topStepXEnabled
    ? layoutOption === "tickers-only"
      ? "hidden"
      : "right-only"
    : "full";
  const handleQuickClock = useCallback(async () => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dayOfWeek = now.getDay();
    setQuickClockPulse(true);
    setTimeout(() => setQuickClockPulse(false), 600);
    try {
      const apiBase = (
        import.meta.env.VITE_API_URL || "http://localhost:8080"
      ).replace(/\/$/, "");
      await fetch(`${apiBase}/api/sticky-bulletin/antilag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time, dayOfWeek, instrument: "ES", notes: "" }),
      });
    } catch {}
  }, []);
  useEffect(() => {
    setToolbarOrderState(getToolbarOrder());
  }, []);

  const handleToolbarDragStart = useCallback(
    (e: React.DragEvent, id: ToolbarItemId) => {
      e.dataTransfer.setData("text/plain", id);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleToolbarDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleToolbarDrop = useCallback(
    (e: React.DragEvent, targetId: ToolbarItemId) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain") as
        | ToolbarItemId
        | "";
      if (!sourceId || sourceId === targetId) return;
      setToolbarOrderState((prev) => {
        const next = [...prev];
        const si = next.indexOf(sourceId);
        const ti = next.indexOf(targetId);
        if (si === -1 || ti === -1) return prev;
        next.splice(si, 1);
        next.splice(ti, 0, sourceId);
        setToolbarOrder(next);
        return next;
      });
    },
    [],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showLayoutDropdown) {
        const inTrigger = dropdownRef.current?.contains(target);
        const inPortal = layoutPortalRef.current?.contains(target);
        if (!inTrigger && !inPortal) setShowLayoutDropdown(false);
      }
      if (showPlatformDropdown) {
        const inTrigger = platformDropdownRef.current?.contains(target);
        const inPortal = platformPortalRef.current?.contains(target);
        if (!inTrigger && !inPortal) setShowPlatformDropdown(false);
      }
    };

    if (showLayoutDropdown || showPlatformDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showLayoutDropdown, showPlatformDropdown]);

  // Calculate fixed position for portaled dropdowns
  useEffect(() => {
    if (!showLayoutDropdown || !dropdownRef.current) {
      setLayoutDropdownPos(null);
      return;
    }
    const rect = dropdownRef.current.getBoundingClientRect();
    const dropdownW = 288; // w-72 = 18rem
    let left = rect.right - dropdownW;
    if (left < 16) left = 16;
    setLayoutDropdownPos({ top: rect.bottom + 8, left });
  }, [showLayoutDropdown]);

  useEffect(() => {
    if (!showPlatformDropdown || !platformDropdownRef.current) {
      setPlatformDropdownPos(null);
      return;
    }
    const rect = platformDropdownRef.current.getBoundingClientRect();
    const dropdownW = 288;
    let left = rect.right - dropdownW;
    if (left < 16) left = 16;
    setPlatformDropdownPos({ top: rect.bottom + 8, left });
  }, [showPlatformDropdown]);

  // [claude-code 2026-04-24] Header dropdown is fully driven by the user-managed
  // iFrame catalogue (Settings → iFrames). No hardcoded list — adding/removing
  // entries there is what changes what shows up here.
  const platformOptions: Array<{
    value: TradingPlatform;
    label: string;
    description: string;
  }> = proposerIframeSources.map((s) => ({
    value: s.id as TradingPlatform,
    label: s.label,
    description: s.url,
  }));

  const selectedPlatformLabel =
    platformOptions.find((opt) => opt.value === selectedPlatform)?.label ??
    platformOptions[0]?.label ??
    "—";

  const layoutOptions: Array<{
    value: LayoutOption;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "combined",
      label: "Castra",
      description: "Mission Control and RiskFlow stacked on the right",
      icon: <Layers className="w-4 h-4" />,
    },
    {
      value: "tickers-only",
      label: "Zen",
      description: "Supports split-frame browser view",
      icon: <GripVertical className="w-4 h-4" />,
    },
  ];

  // Fetch blended IV score from backend — SSE first, 60s polling fallback
  useEffect(() => {
    let es: EventSource | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:8080"
    ).replace(/\/$/, "");

    const fetchIVScore = async () => {
      try {
        const data = await backend.marketData.getIVScore(selectedSymbol.symbol);
        setIvData(data);
      } catch (error) {
        console.warn("[IV] Failed to fetch IV score:", error);
      } finally {
        setIvLoading(false);
      }
    };

    const startFallbackPolling = () => {
      if (fallbackInterval) return;
      fallbackInterval = setInterval(fetchIVScore, 60_000);
    };

    fetchIVScore();

    try {
      es = new EventSource(
        `${apiBase}/api/market-data/iv-score/stream?symbol=${encodeURIComponent(selectedSymbol.symbol)}`,
      );

      es.addEventListener("iv-score", (event) => {
        try {
          const data = JSON.parse(
            (event as MessageEvent).data,
          ) as IVScoreResponse;
          setIvData(data);
          setIvLoading(false);
        } catch {
          // Ignore malformed stream payloads
        }
      });

      es.onerror = () => {
        es?.close();
        es = null;
        startFallbackPolling();
      };
    } catch {
      startFallbackPolling();
    }

    return () => {
      es?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [backend, selectedSymbol.symbol]);

  // VIX risk toast — fires ~5-10 min before each market session open (EST), only when VIX is elevated
  // Sessions: 9:30 AM, 10:00 AM(?), 11:30 AM(?), 12:25 PM(?), 6:00 PM Sun futures open
  const firedWindowsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ivData) return;
    const threshold = alertConfig.vixSpikeThreshold ?? 22;
    const vixLevel = ivData.vix.level;

    const checkSchedule = () => {
      if (vixLevel < threshold) return;

      const now = new Date();
      // Convert to EST (UTC-5) / EDT (UTC-4)
      const estStr = now.toLocaleString("en-US", {
        timeZone: "America/New_York",
      });
      const est = new Date(estStr);
      const h = est.getHours();
      const m = est.getMinutes();
      const day = est.getDay(); // 0=Sun

      // Pre-market-open alert windows (EST): 9:20, 9:50, 11:20, 12:15, 5:50 (Sun only)
      const windows: Array<{
        h: number;
        m: number;
        sunOnly?: boolean;
        label: string;
      }> = [
        { h: 9, m: 20, label: "9:30 AM open" },
        { h: 9, m: 50, label: "10:00 AM session" },
        { h: 11, m: 20, label: "11:30 AM session" },
        { h: 12, m: 15, label: "12:25 PM session" },
        { h: 17, m: 50, sunOnly: true, label: "6:00 PM futures open" },
      ];

      const dateKey = `${est.getFullYear()}-${est.getMonth()}-${est.getDate()}`;

      for (const w of windows) {
        if (w.sunOnly && day !== 0) continue;
        // Fire within a 3-minute window (e.g. 9:20-9:22)
        if (h === w.h && m >= w.m && m <= w.m + 2) {
          const key = `${dateKey}-${w.h}:${w.m}`;
          if (!firedWindowsRef.current.has(key)) {
            firedWindowsRef.current.add(key);
            addToast(
              `VIX at ${vixLevel.toFixed(1)} — consider reducing risk`,
              "vix",
              `Elevated ahead of ${w.label}`,
              "vix-spike",
              "top-right",
            );
            break; // one toast per check
          }
        }
      }

      // Clean stale keys from previous days
      for (const key of firedWindowsRef.current) {
        if (!key.startsWith(dateKey)) firedWindowsRef.current.delete(key);
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 30_000); // check every 30s
    return () => clearInterval(interval);
  }, [ivData, alertConfig.vixSpikeThreshold, addToast]);

  const getTierDisplayName = () => {
    switch (tier) {
      case "free":
        return "Pleb";
      case "fintheon":
        return "Equestrian";
      case "fintheon_plus":
        return "Equestrian+";
      case "fintheon_pro":
        return "Consul";
      default:
        return "Pleb";
    }
  };

  return (
    <div
      id="fintheon-heading-toolbar"
      data-tour-target="toolbar"
      className={`relative bg-[var(--fintheon-surface)] flex items-center justify-between px-3 ${topStepXEnabled && layoutOption === "tickers-only" ? "h-[47px]" : "h-[50px]"}`}
    >
      <div className="flex items-center gap-2 lg:gap-4 xl:gap-6">
        <div
          className={`flex items-center gap-3 transition-opacity duration-150 ${hideBranding ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          {/* [claude-code 2026-04-25] S38: "Priced In Capital" brand string removed from
              header — now lives in the FooterToolbar desk-name slot. Leaves the instance
              name + time-of-day greeting. */}
          <div className="flex flex-col leading-tight">
            {compactLevel < 2 && (
              <span className="text-[12px] font-semibold tracking-[0.22em] text-[var(--fintheon-accent)] uppercase">
                {instanceName}
              </span>
            )}
            {compactLevel < 1 && (
              <span className="text-[9px] text-gray-600 italic hidden xl:block">
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return "Ave. The markets stir.";
                  if (h < 17) return "The Forum is active.";
                  return "The day's battles are done.";
                })()}
              </span>
            )}
          </div>

          {/* Breadcrumb navigation — back/forward + section name */}
          {!topStepXEnabled && compactLevel < 2 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={onBack}
                disabled={historyIndex <= 0}
                className="p-1 rounded text-gray-500 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
                title="Back"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onForward}
                disabled={historyIndex >= tabHistory.length - 1}
                className="p-1 rounded text-gray-500 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
                title="Forward"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              {compactLevel < 1 && (
                <span className="text-[10px] tracking-[0.18em] uppercase text-gray-300 ml-2">
                  {TAB_LABELS[activeTab] || activeTab}
                </span>
              )}
            </div>
          )}

          {compactLevel < 1 && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="relative bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg px-2.5 h-7 hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/40 transition-colors cursor-pointer flex items-center hidden xl:flex"
            >
              <span className="text-[13px] text-gray-300">
                {getTierDisplayName()}
              </span>
            </button>
          )}
          {traderName && compactLevel < 1 && (
            <TraderNametag
              name={traderName}
              disablePulse={!(alertConfig.nametagEmoPulse ?? true)}
            />
          )}
          {compactLevel < 1 && (
            <FluxerCallWidget />
          )}
          {topStepXEnabled && (
            <button
              onClick={toggleManualDnd}
              className={`relative toolbar-icon-btn ${dndActive ? "toolbar-active" : ""}`}
              title={dndActive ? "Do Not Disturb (ON)" : "Notifications"}
            >
              {dndActive ? (
                <BellOff className="w-3 h-3" />
              ) : (
                <Bell className="w-3 h-3" />
              )}
              {totalBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500/80 text-white text-[8px] font-bold leading-none">
                  {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
                </span>
              )}
            </button>
          )}
          {compactLevel < 2 && (
            <button
              onClick={handleQuickClock}
              className={`toolbar-icon-btn ${quickClockPulse ? "toolbar-active" : ""}`}
              title="Quick clock antilag"
            >
              <Zap className="w-3 h-3" />
            </button>
          )}
          {compactLevel < 2 && voiceRoomWidget}
        </div>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-3 min-w-0 shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          {compactLevel < 1 && <WhatsNewButton />}
          {psychAssistHeadingWidget}
          {econCountdownWidget}
          {activeTab === "performance" && performanceChatWidget}
          {/* [claude-code 2026-04-26] Per TP: layout buttons sit FIRST, then
              the iFrame/Browser dropdown, then the VIX ticker, then the rest
              of the toolbar. PanelToggleGroup is transparent (no bg/border).
              The platform/iFrame slot is rendered inline here so the order is
              fixed; toolbarOrder.map skips id==="platform" further down. */}
          <PanelToggleGroup mode={panelToggleMode} />
          {topStepXEnabled && onLayoutOptionChange ? (
            // iFrame active → Castra/Zen layout dropdown
            <div className="relative" ref={dropdownRef}>
              {/* [claude-code 2026-04-27] S46.4/F: chip chrome stripped per TP —
                  trigger sits flush with the toolbar like other icon buttons.
                  Resting state: no bg + no border. Hover keeps the accent flash. */}
              <button
                onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                className="px-2.5 h-7 rounded-lg text-xs font-medium text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border hover:border-[var(--fintheon-accent)]/40 transition-colors flex items-center gap-1.5"
                title="Layout Options"
              >
                {layoutOptions.find((opt) => opt.value === layoutOption)?.icon}
                {compactLevel < 1 && (
                  <span>
                    {
                      layoutOptions.find((opt) => opt.value === layoutOption)
                        ?.label
                    }
                  </span>
                )}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${showLayoutDropdown ? "rotate-180" : ""}`}
                />
              </button>
              {showLayoutDropdown &&
                layoutDropdownPos &&
                createPortal(
                  <div
                    ref={layoutPortalRef}
                    style={{
                      position: "fixed",
                      top: layoutDropdownPos.top,
                      left: layoutDropdownPos.left,
                      zIndex: 9999,
                    }}
                    className="w-72 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl overflow-hidden animate-dropdown-enter"
                  >
                    {layoutOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onLayoutOptionChange(option.value);
                          setShowLayoutDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-[var(--fintheon-accent)]/10 transition-colors flex items-start gap-3 ${
                          layoutOption === option.value
                            ? "bg-[var(--fintheon-accent)]/20"
                            : ""
                        }`}
                      >
                        <div className="mt-0.5 text-[var(--fintheon-accent)]">
                          {option.icon}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--fintheon-accent)] mb-1">
                            {option.label}
                          </div>
                          <div className="text-xs text-gray-400">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </div>
          ) : (
            // iFrame off → platform/browser selection dropdown
            <div className="relative" ref={platformDropdownRef}>
              {/* [claude-code 2026-04-27] S46.4/F: chip chrome stripped per TP. */}
              <button
                onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                className="px-2.5 h-7 rounded-lg text-xs font-medium text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border hover:border-[var(--fintheon-accent)]/40 transition-colors flex items-center gap-1.5"
                title="Select trading platform"
              >
                {selectedPlatformLabel.toLowerCase().includes("tradingview") ? (
                  <Tv className="w-3 h-3" />
                ) : (
                  <Monitor className="w-3 h-3" />
                )}
                {compactLevel < 1 && <span>{selectedPlatformLabel}</span>}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${showPlatformDropdown ? "rotate-180" : ""}`}
                />
              </button>
              {showPlatformDropdown &&
                platformDropdownPos &&
                createPortal(
                  <div
                    ref={platformPortalRef}
                    style={{
                      position: "fixed",
                      top: platformDropdownPos.top,
                      left: platformDropdownPos.left,
                      zIndex: 9999,
                    }}
                    className="w-72 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl overflow-hidden py-1 animate-dropdown-enter"
                  >
                    {platformOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onPlatformSelect?.(option.value);
                          setShowPlatformDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          selectedPlatform === option.value
                            ? "bg-[var(--fintheon-accent)]/15"
                            : "hover:bg-[var(--fintheon-accent)]/8"
                        }`}
                      >
                        <div
                          className={`text-xs font-semibold tracking-[0.14em] uppercase ${
                            selectedPlatform === option.value
                              ? "text-[var(--fintheon-accent)]"
                              : "text-gray-200"
                          }`}
                        >
                          {option.label}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            selectedPlatform === option.value
                              ? "text-[var(--fintheon-accent)]/60"
                              : "text-gray-500"
                          }`}
                        >
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
            </div>
          )}
          <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg px-2.5 h-7 flex items-center flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {compactLevel < 2 && (
                <span className="text-[9px] text-gray-500">VIX</span>
              )}
              <span className="text-xs font-mono text-gray-300">
                {ivData ? ivData.vix.level.toFixed(2) : "--"}
              </span>
            </div>
          </div>
          {toolbarOrder.map((id) => {
            const wrapper = (node: React.ReactNode) => (
              <div
                key={id}
                draggable={toolbarEditMode}
                onDragStart={
                  toolbarEditMode
                    ? (e) => handleToolbarDragStart(e, id)
                    : undefined
                }
                onDragOver={toolbarEditMode ? handleToolbarDragOver : undefined}
                onDrop={
                  toolbarEditMode ? (e) => handleToolbarDrop(e, id) : undefined
                }
                className="flex items-center gap-0.5 group/toolbar"
              >
                {toolbarEditMode && (
                  <div
                    className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 text-gray-600 hover:text-[var(--fintheon-accent)]"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-3 h-3" />
                  </div>
                )}
                {node}
              </div>
            );
            // [claude-code 2026-04-26] platform slot rendered inline above
            // (before VIX) to enforce: layout buttons → browser dropdown → VIX.
            if (id === "platform") return null;
            if (id === "power" && onTopStepXDisable) {
              return wrapper(
                <button
                  onClick={onTopStepXDisable}
                  className={`toolbar-icon-btn ${
                    topStepXEnabled
                      ? "!border-emerald-500/30 !bg-emerald-500/10 !text-emerald-400"
                      : ""
                  }`}
                  title={
                    topStepXEnabled
                      ? "Hide iFrame layouts"
                      : "Show iFrame layouts"
                  }
                >
                  <Power className="w-3 h-3" />
                </button>,
              );
            }
            if (id === "layout") {
              return null; // Layout dropdown is rendered in the 'platform' slot
            }
            if (id === "chat" && onChatToggle) {
              return wrapper(
                <button
                  onClick={onChatToggle}
                  className={`toolbar-icon-btn ${
                    chatOpen
                      ? "!bg-[#6366f1]/15 !border-[#6366f1]/30 !text-[#6366f1]"
                      : "!border-[#6366f1]/20 !text-[#6366f1]/50"
                  }`}
                  title="Convene"
                >
                  <MessageCircle className="w-3 h-3" />
                </button>,
              );
            }
            if (id === "voice") {
              return wrapper(
                <HeaderVoiceControl
                  compact={topStepXEnabled && layoutOption === "tickers-only"}
                />,
              );
            }
            if (id === "bulletin") {
              return wrapper(
                <>
                  <button
                    ref={bulletinBtnRef}
                    onClick={() => setShowBulletin(!showBulletin)}
                    className={`toolbar-icon-btn ${showBulletin ? "toolbar-active" : ""}`}
                    title="Bulletin"
                  >
                    <ClipboardList className="w-3 h-3" />
                  </button>
                  <StickyBulletin
                    open={showBulletin}
                    onClose={() => setShowBulletin(false)}
                    anchorRef={bulletinBtnRef}
                  />
                </>,
              );
            }
            if (id === "ivScore") {
              return wrapper(
                <IVScoreCard
                  data={ivData}
                  loading={ivLoading}
                  layoutOption={layoutOption}
                  compactCopy={!topStepXEnabled && compactLevel >= 1}
                />,
              );
            }
            return null;
          })}
        </div>
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
