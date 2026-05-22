import { useState, useCallback, useEffect, useRef } from "react";
import {
  Newspaper,
  Settings,
  LogOut,
  Landmark,
  LayoutDashboard,
  CalendarDays,
  GripVertical,
  BookOpenCheck,
  Bell,
  BellOff,
  Wrench,
} from "lucide-react";
import { useDND } from "../../contexts/DNDContext";
import { useServerNotifications } from "../../contexts/NotificationsContext";
import { FadingRuler } from "../shared/FadingRuler";
import {
  getSidebarOrder,
  setSidebarOrder,
  type NavTabId,
} from "../../lib/layoutOrderStorage";

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

interface NavSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onLogout: () => void;
  topStepXEnabled?: boolean;
  onOverlayVisibilityChange?: (visible: boolean) => void;
  onEditModeChange?: (editing: boolean) => void;
  /** Controlled edit mode — when provided, overrides the internal local state (so the Strategium Edit button can drive reorder across the whole shell). */
  editMode?: boolean;
  onNotificationCenterToggle?: () => void;
  onRefinementClick?: () => void;
  refinementEnabled?: boolean;
  refinementActive?: boolean;
}

const NAV_ITEMS_MAP: Record<
  Exclude<
    NavTabId,
    | "feed"
    | "narrative"
    | "apparatus"
    | "proposals"
    | "performance"
    | "settings"
  >,
  {
    id: NavTab;
    icon: typeof LayoutDashboard;
    label: string;
    description: string;
  }
> = {
  dashboard: {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Desk",
    description: "KPIs, calendar, RiskFlow",
  },
  analysis: {
    id: "analysis",
    icon: Landmark,
    label: "Consilium",
    description: "Narrative analytics center",
  },
  riskflow: {
    id: "riskflow",
    icon: Newspaper,
    label: "RiskFlow",
    description: "Market news & events",
  },
  econ: {
    id: "econ",
    icon: CalendarDays,
    label: "Calendar",
    description: "Economic calendar",
  },
};

// Icon size: original was w-6 h-6 (24px). 35% smaller = ~15.6px → w-4 h-4 (16px)
// Button size: original was w-12 h-12 (48px). 35% smaller = ~31px → w-8 h-8 (32px)
// Sidebar collapsed width: original w-16 (64px). 35% smaller = ~42px → w-11 (44px)
const SIDEBAR_BUTTON_CLASS =
  "flex items-center gap-2.5 rounded-md transition-colors min-w-0 px-2 py-1.5 justify-start";
const SIDEBAR_ICON_CLASS = "w-4 h-4 shrink-0";

export function NavSidebar({
  activeTab,
  onTabChange,
  onLogout,
  topStepXEnabled = false,
  onOverlayVisibilityChange,
  onEditModeChange,
  editMode: controlledEditMode,
  onNotificationCenterToggle,
  onRefinementClick,
  refinementEnabled = false,
  refinementActive = false,
}: NavSidebarProps) {
  const { dndActive, toggleManualDnd, queueCount } = useDND();
  // [claude-code 2026-04-25] S35-Unified: badge reflects server unread + local queue.
  const { unreadCount: serverUnread } = useServerNotifications();
  const totalBadgeCount = queueCount + serverUnread;
  const [hovered, setHovered] = useState(false);
  const [manualExpand, setManualExpand] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localEditMode, setLocalEditMode] = useState(false);
  const editMode = controlledEditMode ?? localEditMode;
  const setEditMode = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(editMode) : next;
      if (controlledEditMode === undefined) setLocalEditMode(resolved);
      onEditModeChange?.(resolved);
    },
    [controlledEditMode, editMode, onEditModeChange],
  );
  const [order, setOrder] = useState<NavTabId[]>(() => getSidebarOrder());

  const expanded = hovered || manualExpand;
  const sidebarWidthPx = topStepXEnabled ? 0 : 44;

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

  // [claude-code 2026-04-26] Listen for the header PanelToggleGroup left button.
  // Toggles manualExpand (mirrors the click-to-expand path) so the rail can be
  // pinned-open from anywhere; emits state back so the icon reflects open/closed.
  useEffect(() => {
    const onToggle = () => setManualExpand((v) => !v);
    window.addEventListener("fintheon:toggle-nav-sidebar", onToggle);
    return () =>
      window.removeEventListener("fintheon:toggle-nav-sidebar", onToggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("fintheon:nav-sidebar-state", {
        detail: { open: expanded },
      }),
    );
  }, [expanded]);

  useEffect(() => {
    setOrder(getSidebarOrder());
  }, []);

  useEffect(() => {
    onOverlayVisibilityChange?.(topStepXEnabled && expanded);
  }, [onOverlayVisibilityChange, topStepXEnabled, expanded]);

  // Keep sibling surfaces aligned to the physical rail footprint; expansion now layers under main content.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--fintheon-sidebar-width",
      `${sidebarWidthPx}px`,
    );
    return () => {
      document.documentElement.style.setProperty(
        "--fintheon-sidebar-width",
        "0px",
      );
    };
  }, [sidebarWidthPx]);

  // NOTE: edit-mode sync happens in the setEditMode wrapper above.
  // Unmount clears edit mode so stray reorder state doesn't leak across route changes.
  useEffect(() => {
    return () => {
      if (controlledEditMode === undefined) onEditModeChange?.(false);
    };
  }, [onEditModeChange, controlledEditMode]);

  const handleDragStart = useCallback((e: React.DragEvent, id: NavTabId) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: NavTabId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") as NavTabId | "";
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
    .filter(
      (id): id is keyof typeof NAV_ITEMS_MAP =>
        id in NAV_ITEMS_MAP && id !== "performance",
    )
    .map((tabId) => ({
      tabId,
      icon: NAV_ITEMS_MAP[tabId].icon,
      label: NAV_ITEMS_MAP[tabId].label,
      description: NAV_ITEMS_MAP[tabId].description,
    }));

  // [claude-code 2026-04-30] S56-shell: relative positioning so the wrapper grows
  // with width, pushing main content right (flex displaces siblings instead of
  // overlapping). Previously absolute + z-0 hid the expanded panel under main
  // content (z-10).
  const sidebarContent = (
    <div
      style={{ backgroundColor: "var(--fintheon-surface)" }}
      className={`relative h-full border-r-0 flex flex-col py-3 transition-[width] duration-300 ease-in-out ${
        expanded ? "w-48" : "w-11"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* [claude-code 2026-04-26] Sidebar expand/collapse chevron removed per TP.
          Hover-driven expansion (handleMouseEnter/Leave) is the only trigger;
          the layout buttons in the heading toolbar control visibility. */}

      <div className="flex-1 space-y-1 px-1.5">
        {orderedItems.map(({ tabId, icon: Icon, label, description }, idx) => {
          const isActive = activeTab === tabId;
          const isDashboard = tabId === "dashboard";
          return (
            <div
              key={tabId}
              draggable={expanded && editMode}
              onDragStart={
                editMode ? (e) => handleDragStart(e, tabId) : undefined
              }
              onDragOver={editMode ? handleDragOver : undefined}
              onDrop={editMode ? (e) => handleDrop(e, tabId) : undefined}
              className={`flex items-center gap-1 rounded-md transition-colors ${expanded ? "group" : ""}`}
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
                className={`${expanded && isDashboard ? "flex-1" : "w-full"} ${SIDEBAR_BUTTON_CLASS} ${
                  isActive ? "fintheon-nav-active" : "fintheon-nav-inactive"
                }`}
                title={expanded ? undefined : label}
              >
                <Icon className={SIDEBAR_ICON_CLASS} />
                {expanded && (
                  <div className="min-w-0 text-left">
                    <div
                      className={`text-[11px] font-semibold truncate ${isActive ? "text-black" : ""}`}
                    >
                      {label}
                    </div>
                    <div
                      className={`text-[9px] truncate ${isActive ? "text-black/60" : "text-gray-500"}`}
                    >
                      {description}
                    </div>
                  </div>
                )}
              </button>
              {expanded && isDashboard && (
                <button
                  type="button"
                  onClick={() => setEditMode((v) => !v)}
                  className="shrink-0 px-1 py-0.5 text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/55 hover:text-[var(--fintheon-accent)] transition-colors"
                  title={editMode ? "Finish reordering" : "Enable drag reorder"}
                >
                  {editMode ? "Done" : "Edit"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1 px-1.5">
        {/* Refinement Engine — conditionally visible via Developer Settings toggle */}
        {refinementEnabled && (
          <button
            onClick={onRefinementClick}
            className={`w-full flex items-center gap-2.5 rounded-md transition-colors px-2 py-1.5 justify-start ${
              refinementActive
                ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                : "fintheon-nav-inactive"
            }`}
            title={expanded ? undefined : "Refinement Engine"}
          >
            <Wrench className="w-4 h-4 shrink-0" />
            {expanded && (
              <div className="min-w-0 text-left">
                <div
                  className={`text-[11px] font-semibold truncate ${refinementActive ? "text-[var(--fintheon-accent)]" : ""}`}
                >
                  Refinement
                </div>
                <div
                  className={`text-[9px] truncate ${refinementActive ? "text-[var(--fintheon-accent)]/60" : "text-gray-500"}`}
                >
                  Scoring calibration
                </div>
              </div>
            )}
          </button>
        )}
        {/* DND / Notification Center — hidden when iFrame active (moved to TopHeader) */}
        {!topStepXEnabled && (
          <button
            onClick={() => {
              if (totalBadgeCount > 0) {
                onNotificationCenterToggle?.();
              } else {
                toggleManualDnd();
              }
            }}
            className={`w-full flex items-center gap-2.5 rounded-md transition-colors relative px-2 py-1.5 justify-start ${
              dndActive
                ? "bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]"
                : "fintheon-nav-inactive"
            }`}
            title={
              expanded
                ? undefined
                : dndActive
                  ? "Do Not Disturb (ON)"
                  : "Notifications"
            }
          >
            {dndActive ? (
              <BellOff className="w-4 h-4 shrink-0" />
            ) : (
              <Bell className="w-4 h-4 shrink-0" />
            )}
            {totalBadgeCount > 0 && (
              <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500/80 text-white text-[9px] font-bold leading-none">
                {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
              </span>
            )}
            {expanded && (
              <div className="min-w-0 text-left">
                <div
                  className={`text-[11px] font-semibold truncate ${dndActive ? "text-[var(--fintheon-accent)]" : ""}`}
                >
                  {dndActive ? "Do Not Disturb" : "Notifications"}
                </div>
                <div
                  className={`text-[9px] truncate ${dndActive ? "text-[var(--fintheon-accent)]/60" : "text-gray-500"}`}
                >
                  {dndActive
                    ? `${totalBadgeCount} queued`
                    : "Click to enable DND"}
                </div>
              </div>
            )}
          </button>
        )}
        {/* Performance */}
        <button
          onClick={() => onTabChange("performance")}
          data-tour-target="performance"
          className={`w-full flex items-center gap-2.5 rounded-md transition-colors px-2 py-1.5 justify-start ${
            activeTab === "performance"
              ? "fintheon-nav-active"
              : "fintheon-nav-inactive"
          }`}
          title={expanded ? undefined : "Performance"}
        >
          <BookOpenCheck className="w-4 h-4 shrink-0" />
          {expanded && (
            <div className="min-w-0 text-left">
              <div
                className={`text-[11px] font-semibold truncate ${activeTab === "performance" ? "text-black" : ""}`}
              >
                Performance
              </div>
              <div
                className={`text-[9px] truncate ${activeTab === "performance" ? "text-black/60" : "text-gray-500"}`}
              >
                ER history & KPIs
              </div>
            </div>
          )}
        </button>
        <button
          onClick={() => onTabChange("settings")}
          className={`w-full flex items-center gap-2.5 rounded-md transition-colors px-2 py-1.5 justify-start ${
            activeTab === "settings"
              ? "fintheon-nav-active"
              : "fintheon-nav-inactive"
          }`}
          title={expanded ? undefined : "Settings"}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {expanded && (
            <div className="min-w-0 text-left">
              <div
                className={`text-[11px] font-semibold truncate ${activeTab === "settings" ? "text-black" : ""}`}
              >
                Settings
              </div>
              <div
                className={`text-[9px] truncate ${activeTab === "settings" ? "text-black/60" : "text-gray-500"}`}
              >
                Preferences & configuration
              </div>
            </div>
          )}
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 rounded-md text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-colors px-2 py-1.5 justify-start"
          title={expanded ? undefined : "Logout"}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {expanded && (
            <span className="text-[11px] font-semibold">Logout</span>
          )}
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
