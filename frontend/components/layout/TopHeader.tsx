// [claude-code 2026-02-26] Add heading toolbar dock zone + optional docked widgets slot.
// [claude-code 2026-03-03] Toolbar items reorderable via getToolbarOrder/setToolbarOrder.
// [claude-code 2026-03-11] T2: IV score wired to backend /api/market-data/iv-score — replaces local quickIVScore
// [claude-code 2026-03-20] S3:T4b: Merge platform/layout into one toolbar slot; DND moves to header when iFrame active
// [claude-code 2026-03-20] S3:T4c: createPortal for platform/layout dropdowns — fixes z-index behind Strategium panel
// [claude-code 2026-03-20] S3:T5 — VIX spike toast trigger when VIX crosses above threshold
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UpgradeModal } from '../UpgradeModal';
import { IVScoreCard } from '../IVScoreCard';
import { useBackend } from '../../lib/backend';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { isElectron } from '../../lib/platform';
import { getToolbarOrder, setToolbarOrder, type ToolbarItemId } from '../../lib/layoutOrderStorage';
import { HeaderVoiceControl } from '../voice/HeaderVoiceControl';
import { GripVertical, Layers, ChevronDown, ChevronLeft, ChevronRight, Monitor, MessageCircle, Power, Bell, BellOff } from 'lucide-react';
import { WhatsNewButton } from '../onboarding/FirstTimeTour';
import { TraderNametag } from '../TraderNametag';
import type { IVScoreResponse } from '../../types/market-data';
import type { TradingPlatform } from '../TopStepXBrowser';
import { useDND } from '../../contexts/DNDContext';

type NavTab = 'feed' | 'analysis' | 'news' | 'executive' | 'notion' | 'econ' | 'narrative' | 'earnings' | 'proposals' | 'apparatus' | 'settings';

const TAB_LABELS: Record<NavTab, string> = {
  executive: 'Dashboard',
  feed: 'Dashboard', // feed section removed; fallback for history
  analysis: 'Consilium',
  proposals: 'Proposals',
  apparatus: 'Apparatus',
  news: 'RiskFlow',
  notion: 'Scriptorium',
  econ: 'Economic Calendar',
  narrative: 'NarrativeFlow',
  earnings: 'Performance',
  settings: 'Settings',
};

type LayoutOption = 'tickers-only' | 'combined';

interface TopHeaderProps {
  topStepXEnabled?: boolean;
  onTopStepXToggle?: () => void;
  onTopStepXDisable?: () => void;
  selectedPlatform?: TradingPlatform;
  onPlatformSelect?: (platform: TradingPlatform) => void;
  layoutOption?: LayoutOption;
  onLayoutOptionChange?: (option: LayoutOption) => void;
  askHarpOpen?: boolean;
  onAskHarpToggle?: () => void;
  activeTab?: NavTab;
  tabHistory?: NavTab[];
  historyIndex?: number;
  onBack?: () => void;
  onForward?: () => void;
  hideBranding?: boolean;
  psychAssistHeadingWidget?: React.ReactNode;
  toolbarEditMode?: boolean;
}

export function TopHeader({
  topStepXEnabled = false,
  onTopStepXToggle,
  onTopStepXDisable,
  selectedPlatform = 'topstepx',
  onPlatformSelect,
  layoutOption = 'combined',
  onLayoutOptionChange,
  askHarpOpen = false,
  onAskHarpToggle,
  activeTab = 'executive',
  tabHistory = [],
  historyIndex = 0,
  onBack,
  onForward,
  hideBranding = false,
  psychAssistHeadingWidget,
  toolbarEditMode = false,
}: TopHeaderProps) {
  const { tier } = useAuth();
  const backend = useBackend();
  const { selectedSymbol, traderName, alertConfig } = useSettings();
  const { addToast } = useToast();
  const instanceName = import.meta.env.VITE_FINTHEON_INSTANCE_NAME || 'Fintheon';
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [ivData, setIvData] = useState<IVScoreResponse | null>(null);
  const [ivLoading, setIvLoading] = useState(true);
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [toolbarOrder, setToolbarOrderState] = useState<ToolbarItemId[]>(() => getToolbarOrder());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const platformDropdownRef = useRef<HTMLDivElement>(null);
  const layoutPortalRef = useRef<HTMLDivElement>(null);
  const platformPortalRef = useRef<HTMLDivElement>(null);
  const [layoutDropdownPos, setLayoutDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [platformDropdownPos, setPlatformDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const { dndActive, toggleManualDnd, queueCount } = useDND();
  const vixWasBelowRef = useRef(true);

  useEffect(() => {
    setToolbarOrderState(getToolbarOrder());
  }, []);

  const handleToolbarDragStart = useCallback((e: React.DragEvent, id: ToolbarItemId) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleToolbarDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleToolbarDrop = useCallback((e: React.DragEvent, targetId: ToolbarItemId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') as ToolbarItemId | '';
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
  }, []);

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
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLayoutDropdown, showPlatformDropdown]);

  // Calculate fixed position for portaled dropdowns
  useEffect(() => {
    if (!showLayoutDropdown || !dropdownRef.current) { setLayoutDropdownPos(null); return; }
    const rect = dropdownRef.current.getBoundingClientRect();
    const dropdownW = 288; // w-72 = 18rem
    let left = rect.right - dropdownW;
    if (left < 16) left = 16;
    setLayoutDropdownPos({ top: rect.bottom + 8, left });
  }, [showLayoutDropdown]);

  useEffect(() => {
    if (!showPlatformDropdown || !platformDropdownRef.current) { setPlatformDropdownPos(null); return; }
    const rect = platformDropdownRef.current.getBoundingClientRect();
    const dropdownW = 288;
    let left = rect.right - dropdownW;
    if (left < 16) left = 16;
    setPlatformDropdownPos({ top: rect.bottom + 8, left });
  }, [showPlatformDropdown]);

  const platformOptions: Array<{ value: TradingPlatform; label: string; description: string }> = [
    { value: 'tradesea', label: 'TradeSea', description: 'TradeSea Trading' },
    { value: 'topstepx', label: 'TopStepX', description: 'Real-Time Futures Trading Platform' },
    { value: 'mmt', label: 'MMT', description: 'Market Monkey Terminal — Crypto Order Flow' },
    { value: 'kalshi', label: 'Kalshi', description: 'Prediction Market' },
    { value: 'tradovate', label: 'Tradovate', description: 'Futures Trading Platform' },
    { value: 'research', label: 'Research', description: 'Notion Research iFrame' },
  ];

  const selectedPlatformLabel =
    platformOptions.find((opt) => opt.value === selectedPlatform)?.label ?? 'TradeSea';

  const layoutOptions: Array<{ value: LayoutOption; label: string; description: string; icon: React.ReactNode }> = [
    {
      value: 'combined',
      label: 'Castra',
      description: 'Mission Control and RiskFlow stacked on the right',
      icon: <Layers className="w-4 h-4" />
    },
    {
      value: 'tickers-only',
      label: 'Zen',
      description: 'Supports split-frame browser view',
      icon: <GripVertical className="w-4 h-4" />
    }
  ];

  // Fetch blended IV score from backend — updates every 60 seconds
  useEffect(() => {
    const fetchIVScore = async () => {
      try {
        const data = await backend.marketData.getIVScore(selectedSymbol.symbol);
        setIvData(data);
      } catch (error) {
        console.warn('[IV] Failed to fetch IV score:', error);
      } finally {
        setIvLoading(false);
      }
    };

    fetchIVScore();
    const interval = setInterval(fetchIVScore, 60_000);
    return () => clearInterval(interval);
  }, [backend, selectedSymbol.symbol]);

  // VIX spike toast — fires once when VIX crosses above threshold, resets when it drops below
  useEffect(() => {
    if (!ivData) return;
    const threshold = alertConfig.vixSpikeThreshold ?? 22;
    const vixLevel = ivData.vix.level;

    if (vixLevel >= threshold && vixWasBelowRef.current) {
      vixWasBelowRef.current = false;
      addToast(
        `VIX at ${vixLevel.toFixed(1)} — consider reducing risk`,
        'vix',
        `Crossed above ${threshold} threshold`,
        'vix-spike',
      );
    } else if (vixLevel < threshold) {
      vixWasBelowRef.current = true;
    }
  }, [ivData, alertConfig.vixSpikeThreshold, addToast]);

  const getTierDisplayName = () => {
    switch (tier) {
      case 'free': return 'Pleb';
      case 'fintheon': return 'Equestrian';
      case 'fintheon_plus': return 'Equestrian+';
      case 'fintheon_pro': return 'Consul';
      default: return 'Pleb';
    }
  };

  return (
    <div
      id="fintheon-heading-toolbar"
      data-tour-target="toolbar"
      className={`relative bg-[var(--fintheon-surface)] flex items-center justify-between pl-6 pr-6 ${topStepXEnabled && layoutOption === 'tickers-only' ? 'h-[52px]' : 'h-[56px]'}`}
    >
      <div className="flex items-center gap-6">
        <div className={`flex items-center gap-3 transition-opacity duration-150 ${hideBranding ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold tracking-[0.22em] text-[var(--fintheon-accent)] uppercase">
              {instanceName}
            </span>
            <span className="text-[10px] tracking-[0.18em] text-gray-500 uppercase">
              Priced In Capital
            </span>
            <span className="text-[9px] text-gray-600 italic">
              {(() => { const h = new Date().getHours(); if (h < 12) return 'Ave. The markets stir.'; if (h < 17) return 'The Forum is active.'; return "The day's battles are done."; })()}
            </span>
          </div>

          {/* Breadcrumb navigation — back/forward + section name */}
          {!topStepXEnabled && (
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
              <span className="text-[10px] tracking-[0.18em] uppercase text-gray-300 ml-2">
                {TAB_LABELS[activeTab] || activeTab}
              </span>
            </div>
          )}

          <button
            onClick={() => setShowUpgrade(true)}
            className="relative bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg px-3 h-8 hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/40 transition-colors cursor-pointer flex items-center hidden xl:flex"
          >
            <span className="text-[13px] text-gray-300">{getTierDisplayName()}</span>
          </button>
          {traderName && <TraderNametag name={traderName} disablePulse={!(alertConfig.nametagEmoPulse ?? true)} />}
          {topStepXEnabled && (
            <button
              onClick={toggleManualDnd}
              className={`relative p-1.5 rounded-lg transition-colors ${
                dndActive
                  ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-zinc-800/50'
              }`}
              title={dndActive ? 'Do Not Disturb (ON)' : 'Notifications'}
            >
              {dndActive ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              {queueCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500/80 text-white text-[8px] font-bold leading-none">
                  {queueCount > 99 ? '99+' : queueCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4 min-w-0 overflow-x-auto overflow-y-hidden flex-shrink">
        <div className="flex items-center gap-2 flex-shrink-0">
          <WhatsNewButton />
          {psychAssistHeadingWidget}
          <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg px-3 h-8 flex items-center flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-500">VIX</span>
              <span className="text-xs font-mono text-gray-300">
                {ivData ? ivData.vix.level.toFixed(2) : '--'}
              </span>
            </div>
          </div>
          {toolbarOrder.map((id) => {
            const wrapper = (node: React.ReactNode) => (
              <div
                key={id}
                draggable={toolbarEditMode}
                onDragStart={toolbarEditMode ? (e) => handleToolbarDragStart(e, id) : undefined}
                onDragOver={toolbarEditMode ? handleToolbarDragOver : undefined}
                onDrop={toolbarEditMode ? (e) => handleToolbarDrop(e, id) : undefined}
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
            if (id === 'platform') {
              if (topStepXEnabled && onLayoutOptionChange) {
                // iFrame active → show layout dropdown (Castra/Zen) in the platform slot
                return wrapper(
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowLayoutDropdown(!showLayoutDropdown)}
                      className="px-3 h-8 rounded-lg text-xs font-medium bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/40 transition-colors flex items-center gap-1.5"
                      title="Layout Options"
                    >
                      {layoutOptions.find(opt => opt.value === layoutOption)?.icon}
                      <span>{layoutOptions.find(opt => opt.value === layoutOption)?.label}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showLayoutDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showLayoutDropdown && layoutDropdownPos && createPortal(
                      <div
                        ref={layoutPortalRef}
                        style={{ position: 'fixed', top: layoutDropdownPos.top, left: layoutDropdownPos.left, zIndex: 9999 }}
                        className="w-72 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl overflow-hidden"
                      >
                        {layoutOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              onLayoutOptionChange(option.value);
                              setShowLayoutDropdown(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-[var(--fintheon-accent)]/10 transition-colors flex items-start gap-3 ${
                              layoutOption === option.value ? 'bg-[var(--fintheon-accent)]/20' : ''
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
                      document.body
                    )}
                  </div>
                );
              }
              // iFrame off → platform selection dropdown (select FIRST, then power ON)
              return wrapper(
                <div className="relative" ref={platformDropdownRef}>
                  <button
                    onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                    className="px-3 h-8 rounded-lg text-xs font-medium bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 hover:border-[var(--fintheon-accent)]/40 transition-colors flex items-center gap-1.5"
                    title="Select trading platform"
                  >
                    {!isElectron() && <Monitor className="w-3 h-3" />}
                    <span>{selectedPlatformLabel}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showPlatformDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showPlatformDropdown && platformDropdownPos && createPortal(
                    <div
                      ref={platformPortalRef}
                      style={{ position: 'fixed', top: platformDropdownPos.top, left: platformDropdownPos.left, zIndex: 9999 }}
                      className="w-72 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl overflow-hidden py-1"
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
                              ? 'bg-[var(--fintheon-accent)]/15'
                              : 'hover:bg-[var(--fintheon-accent)]/8'
                          }`}
                        >
                          <div className={`text-xs font-semibold tracking-[0.14em] uppercase ${
                            selectedPlatform === option.value ? 'text-[var(--fintheon-accent)]' : 'text-gray-200'
                          }`}>
                            {option.label}
                          </div>
                          <div className={`text-[10px] mt-0.5 ${
                            selectedPlatform === option.value ? 'text-[var(--fintheon-accent)]/60' : 'text-gray-500'
                          }`}>
                            {option.description}
                          </div>
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}
                </div>
              );
            }
            if (id === 'power' && onTopStepXDisable) {
              return wrapper(
                <button
                  onClick={onTopStepXDisable}
                  className={`px-2.5 h-8 rounded-lg text-xs font-medium bg-[var(--fintheon-bg)] border transition-colors flex items-center gap-1.5 ${
                    topStepXEnabled
                      ? 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                      : 'text-zinc-500 border-zinc-700/50 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                  title={topStepXEnabled ? 'Hide iFrame layouts' : 'Show iFrame layouts'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              );
            }
            if (id === 'layout') {
              return null; // Layout dropdown is rendered in the 'platform' slot
            }
            if (id === 'chat' && onAskHarpToggle) {
              return wrapper(
                <button
                  onClick={onAskHarpToggle}
                  className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                    askHarpOpen
                      ? 'bg-[#6366f1] text-white hover:bg-[#6366f1]/90'
                      : 'bg-[var(--fintheon-bg)] border border-[#6366f1]/30 text-[#6366f1] hover:bg-[#6366f1]/10 hover:border-[#6366f1]/50'
                  }`}
                  title="Convene"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </button>
              );
            }
            if (id === 'voice') {
              return wrapper(
                <HeaderVoiceControl compact={topStepXEnabled && layoutOption === 'tickers-only'} />
              );
            }
            if (id === 'ivScore') {
              return wrapper(<IVScoreCard data={ivData} loading={ivLoading} layoutOption={layoutOption} />);
            }
            return null;
          })}
        </div>
      </div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
