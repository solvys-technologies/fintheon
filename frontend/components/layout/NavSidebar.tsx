import { useState, useCallback, useEffect, useRef } from 'react';
import { Newspaper, Settings, LogOut, Landmark, LayoutDashboard, MessagesSquare, NotebookText, CalendarDays, GripVertical, ChevronsRight, ChevronsLeft, BookOpenCheck, Bell, BellOff, Wrench } from 'lucide-react';
import { useDND } from '../../contexts/DNDContext';
import { getSidebarOrder, setSidebarOrder, type NavTabId } from '../../lib/layoutOrderStorage';

type NavTab = 'feed' | 'analysis' | 'news' | 'executive' | 'notion' | 'econ' | 'narrative' | 'apparatus' | 'earnings' | 'proposals' | 'settings';

interface NavSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  topStepXEnabled?: boolean;
  onOverlayVisibilityChange?: (visible: boolean) => void;
  onEditModeChange?: (editing: boolean) => void;
  onNotificationCenterToggle?: () => void;
  onRefinementClick?: () => void;
  refinementEnabled?: boolean;
  refinementActive?: boolean;
}

const NAV_ITEMS_MAP: Record<Exclude<NavTabId, 'chatroom' | 'narrative' | 'apparatus' | 'proposals'>, { id: NavTab; icon: typeof LayoutDashboard; label: string; description: string }> = {
  executive: { id: 'executive', icon: LayoutDashboard, label: 'Dashboard', description: 'KPIs, calendar, RiskFlow' },
  analysis: { id: 'analysis', icon: Landmark, label: 'Consilium', description: 'Narrative analytics center' },
  news: { id: 'news', icon: Newspaper, label: 'RiskFlow', description: 'Market news & events' },
  econ: { id: 'econ', icon: CalendarDays, label: 'Calendar', description: 'Economic calendar' },
  notion: { id: 'notion', icon: NotebookText, label: 'Scriptorium', description: 'The knowledge archive' },
  earnings: { id: 'earnings', icon: BookOpenCheck, label: 'Performance', description: 'PsychAssist ER history & performance KPIs' },
};

// Icon size: original was w-6 h-6 (24px). 35% smaller = ~15.6px → w-4 h-4 (16px)
// Button size: original was w-12 h-12 (48px). 35% smaller = ~31px → w-8 h-8 (32px)
// Sidebar collapsed width: original w-16 (64px). 35% smaller = ~42px → w-11 (44px)

export function NavSidebar({
  activeTab,
  onTabChange,
  onLogout,
  topStepXEnabled = false,
  onOverlayVisibilityChange,
  onEditModeChange,
  onNotificationCenterToggle,
  onRefinementClick,
  refinementEnabled = false,
  refinementActive = false,
}: NavSidebarProps) {
  const { dndActive, toggleManualDnd, queueCount } = useDND();
  const [hovered, setHovered] = useState(false);
  const [manualExpand, setManualExpand] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [order, setOrder] = useState<NavTabId[]>(() => getSidebarOrder());

  const expanded = hovered || manualExpand;

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setHovered(true), 3000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHovered(false);
    setManualExpand(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setOrder(getSidebarOrder());
  }, []);

  useEffect(() => {
    onOverlayVisibilityChange?.(topStepXEnabled && expanded);
  }, [onOverlayVisibilityChange, topStepXEnabled, expanded]);

  useEffect(() => {
    onEditModeChange?.(editMode);
  }, [editMode, onEditModeChange]);

  useEffect(() => {
    return () => onEditModeChange?.(false);
  }, [onEditModeChange]);

  const handleDragStart = useCallback((e: React.DragEvent, id: NavTabId) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: NavTabId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') as NavTabId | '';
    if (!sourceId || sourceId === targetId) return;
    setOrder((prev) => {
      const next = [...prev];
      const si = next.indexOf(sourceId);
      const ti = next.indexOf(targetId);
      if (si === -1 || ti === -1) return prev;
      next.splice(si, 1);
      next.splice(ti, 0, sourceId);
      setSidebarOrder(next);
      return next;
    });
  }, []);

  const orderedItems = order
    .filter((id): id is keyof typeof NAV_ITEMS_MAP => id in NAV_ITEMS_MAP && id !== 'earnings')
    .map((tabId) => ({
      tabId,
      icon: NAV_ITEMS_MAP[tabId].icon,
      label: NAV_ITEMS_MAP[tabId].label,
      description: NAV_ITEMS_MAP[tabId].description,
    }));

  const sidebarContent = (
    <div
      style={{ backgroundColor: 'var(--fintheon-surface)' }}
      className={`h-full border-r fintheon-accent-border flex flex-col py-3 transition-all duration-200 ease-out ${
        expanded ? 'w-48' : 'w-11'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Expand/collapse toggle */}
      <div className="px-1.5 mb-1">
        <button
          type="button"
          onClick={() => setManualExpand((v) => !v)}
          className="w-full flex items-center justify-center py-1 rounded-md fintheon-nav-inactive transition-colors"
          title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="px-2 mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              editMode
                ? 'fintheon-accent-border fintheon-nav-active-light'
                : 'border-zinc-700 text-zinc-400 fintheon-accent-hover'
            }`}
            title={editMode ? 'Finish reordering' : 'Enable drag reorder'}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
      )}
      <div className="flex-1 space-y-1 px-1.5">
        {orderedItems.map(({ tabId, icon: Icon, label, description }) => {
          const isActive = activeTab === tabId;
          return (
            <div
              key={tabId}
              draggable={expanded && editMode}
              onDragStart={editMode ? (e) => handleDragStart(e, tabId) : undefined}
              onDragOver={editMode ? handleDragOver : undefined}
              onDrop={editMode ? (e) => handleDrop(e, tabId) : undefined}
              className={`flex items-center gap-1 rounded-md transition-colors ${expanded ? 'group' : ''}`}
            >
              {expanded && editMode && (
                <div
                  className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-0.5 text-gray-500 fintheon-accent-hover"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-3 h-3" />
                </div>
              )}
              <button
                onClick={() => onTabChange(tabId as NavTab)}
                data-tour-target={tabId}
                className={`flex-1 w-full flex items-center gap-2.5 rounded-md transition-colors min-w-0 ${
                  expanded ? 'px-2 py-1.5' : 'justify-center py-1.5 px-0'
                } ${
                  isActive
                    ? 'fintheon-nav-active'
                    : 'fintheon-nav-inactive'
                }`}
                title={expanded ? undefined : label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {expanded && (
                  <div className="min-w-0 text-left">
                    <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-black' : ''}`}>
                      {label}
                    </div>
                    <div className={`text-[9px] truncate ${isActive ? 'text-black/60' : 'text-gray-500'}`}>
                      {description}
                    </div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 px-1.5">
        {/* Refinement Engine — conditionally visible via Developer Settings toggle */}
        {refinementEnabled && (
          <button
            onClick={onRefinementClick}
            className={`w-full flex items-center gap-2.5 rounded-md transition-colors ${
              expanded ? 'px-2 py-1.5' : 'justify-center py-1.5'
            } ${
              refinementActive
                ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
                : 'fintheon-nav-inactive'
            }`}
            title={expanded ? undefined : 'Refinement Engine'}
          >
            <Wrench className="w-4 h-4 shrink-0" />
            {expanded && (
              <div className="min-w-0 text-left">
                <div className={`text-[11px] font-semibold truncate ${refinementActive ? 'text-[var(--fintheon-accent)]' : ''}`}>
                  Refinement
                </div>
                <div className={`text-[9px] truncate ${refinementActive ? 'text-[var(--fintheon-accent)]/60' : 'text-gray-500'}`}>
                  Scoring calibration
                </div>
              </div>
            )}
          </button>
        )}
        {/* DND / Notification Center — hidden when iFrame active (moved to TopHeader) */}
        {!topStepXEnabled && <button
          onClick={() => {
            if (queueCount > 0) {
              onNotificationCenterToggle?.();
            } else {
              toggleManualDnd();
            }
          }}
          className={`w-full flex items-center gap-2.5 rounded-md transition-colors relative ${
            expanded ? 'px-2 py-1.5' : 'justify-center py-1.5'
          } ${
            dndActive
              ? 'bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]'
              : 'fintheon-nav-inactive'
          }`}
          title={expanded ? undefined : dndActive ? 'Do Not Disturb (ON)' : 'Notifications'}
        >
          {dndActive ? (
            <BellOff className="w-4 h-4 shrink-0" />
          ) : (
            <Bell className="w-4 h-4 shrink-0" />
          )}
          {queueCount > 0 && (
            <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500/80 text-white text-[9px] font-bold leading-none">
              {queueCount > 99 ? '99+' : queueCount}
            </span>
          )}
          {expanded && (
            <div className="min-w-0 text-left">
              <div className={`text-[11px] font-semibold truncate ${dndActive ? 'text-[var(--fintheon-accent)]' : ''}`}>
                {dndActive ? 'Do Not Disturb' : 'Notifications'}
              </div>
              <div className={`text-[9px] truncate ${dndActive ? 'text-[var(--fintheon-accent)]/60' : 'text-gray-500'}`}>
                {dndActive ? `${queueCount} queued` : 'Click to enable DND'}
              </div>
            </div>
          )}
        </button>}
        {/* Performance */}
        <button
          onClick={() => onTabChange('earnings')}
          data-tour-target="earnings"
          className={`w-full flex items-center gap-2.5 rounded-md transition-colors ${
            expanded ? 'px-2 py-1.5' : 'justify-center py-1.5'
          } ${
            activeTab === 'earnings'
              ? 'fintheon-nav-active'
              : 'fintheon-nav-inactive'
          }`}
          title={expanded ? undefined : 'Performance'}
        >
          <BookOpenCheck className="w-4 h-4 shrink-0" />
          {expanded && (
            <div className="min-w-0 text-left">
              <div className={`text-[11px] font-semibold truncate ${activeTab === 'earnings' ? 'text-black' : ''}`}>
                Performance
              </div>
              <div className={`text-[9px] truncate ${activeTab === 'earnings' ? 'text-black/60' : 'text-gray-500'}`}>
                ER history & KPIs
              </div>
            </div>
          )}
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full flex items-center gap-2.5 rounded-md transition-colors ${
            expanded ? 'px-2 py-1.5' : 'justify-center py-1.5'
          } ${
            activeTab === 'settings'
              ? 'fintheon-nav-active'
              : 'fintheon-nav-inactive'
          }`}
          title={expanded ? undefined : 'Settings'}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {expanded && (
            <div className="min-w-0 text-left">
              <div className={`text-[11px] font-semibold truncate ${activeTab === 'settings' ? 'text-black' : ''}`}>
                Settings
              </div>
              <div className={`text-[9px] truncate ${activeTab === 'settings' ? 'text-black/60' : 'text-gray-500'}`}>
                Preferences & configuration
              </div>
            </div>
          )}
        </button>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-2.5 rounded-md text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors ${
            expanded ? 'px-2 py-1.5' : 'justify-center py-1.5'
          }`}
          title={expanded ? undefined : 'Logout'}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {expanded && <span className="text-[11px] font-semibold">Logout</span>}
        </button>
      </div>
    </div>
  );

  // When TopStepX/iframe is enabled, sidebar is completely hidden — no hover zones, no trigger strips
  if (topStepXEnabled) {
    return null;
  }

  // Normal sidebar
  return sidebarContent;
}
