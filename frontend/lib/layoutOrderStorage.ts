/**
 * Persisted order for menu sidebar and heading toolbar.
 * Sidebar and toolbar orders are independent; items cannot move between them.
 */

const SIDEBAR_ORDER_KEY = "fintheon:sidebar-nav-order";
const TOOLBAR_ORDER_KEY = "fintheon:toolbar-order";
// v6 (S46.4/G): added deskTheme widget, autopilot moved to last slot. Bumped
// key acts as the normalize-on-mount per feedback_persisted_state_normalize_on_mount.md
// — users with v5 persisted order get the new default automatically.
const MISSION_WIDGET_ORDER_KEY = "fintheon:mission-widget-order:v6";
const MISSION_WIDGET_VISIBILITY_KEY = "fintheon:mission-widget-visibility";
const RIGHT_PANEL_ORDER_KEY = "fintheon:right-panel-order";

export type NavTabId =
  | "dashboard"
  | "analysis"
  | "riskflow"
  | "feed"
  | "econ"
  | "narrative"
  | "apparatus"
  | "performance"
  | "proposals"
  | "settings";

export const DEFAULT_SIDEBAR_ORDER: NavTabId[] = [
  "dashboard",
  "analysis",
  "riskflow",
  "econ",
  "performance",
  "settings",
];

export type ToolbarItemId =
  | "platform"
  | "power"
  | "layout"
  | "chat"
  | "voice"
  | "heartbeat"
  | "bulletin"
  | "ivScore";

export const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  "platform",
  "power",
  "layout",
  "chat",
  "voice",
  "heartbeat",
  "bulletin",
  "ivScore",
];

export type MissionWidgetId =
  | "er"
  | "autopilot"
  | "regime"
  | "account"
  | "weekly"
  | "calendar"
  | "deskTheme";

// [claude-code 2026-04-27] S46.4/G: autopilot moved to LAST. New deskTheme
// widget inserted between calendar and autopilot per TP brief (final
// strategium order: Mission Control surfaces → Calendar → DeskTheme → Autopilot).
export const DEFAULT_MISSION_WIDGET_ORDER: MissionWidgetId[] = [
  "er",
  "regime",
  "account",
  "weekly",
  "calendar",
  "deskTheme",
  "autopilot",
];

// S30-T2: "blindspots" widget replaced by "weekly" (WeeklyPerformanceWidget).
// v5 localStorage key forces re-read so existing users pick up the swap.

export type RightPanelId = "mission";

export const DEFAULT_RIGHT_PANEL_ORDER: RightPanelId[] = ["mission"];

function loadOrder<T>(key: string, defaultOrder: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultOrder;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultOrder;
    const ordered = parsed.filter((id: unknown) =>
      defaultOrder.includes(id as T),
    ) as T[];
    const deduped = ordered.filter(
      (id, index) => ordered.indexOf(id) === index,
    );
    const missing = defaultOrder.filter((id) => !deduped.includes(id));
    return [...deduped, ...missing];
  } catch {
    return defaultOrder;
  }
}

function saveOrder(key: string, order: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignore
  }
}

export function getSidebarOrder(): NavTabId[] {
  return loadOrder(SIDEBAR_ORDER_KEY, DEFAULT_SIDEBAR_ORDER);
}

export function setSidebarOrder(order: NavTabId[]): void {
  saveOrder(SIDEBAR_ORDER_KEY, order);
}

export function getToolbarOrder(): ToolbarItemId[] {
  return loadOrder(TOOLBAR_ORDER_KEY, DEFAULT_TOOLBAR_ORDER);
}

export function setToolbarOrder(order: ToolbarItemId[]): void {
  saveOrder(TOOLBAR_ORDER_KEY, order);
}

export function getMissionWidgetOrder(): MissionWidgetId[] {
  return loadOrder(MISSION_WIDGET_ORDER_KEY, DEFAULT_MISSION_WIDGET_ORDER);
}

export function setMissionWidgetOrder(order: MissionWidgetId[]): void {
  saveOrder(MISSION_WIDGET_ORDER_KEY, order);
}

export function getMissionWidgetVisibility(): Record<MissionWidgetId, boolean> {
  const defaults: Record<MissionWidgetId, boolean> = {
    er: true,
    autopilot: true,
    regime: true,
    account: true,
    weekly: true,
    calendar: true,
    deskTheme: true,
  };
  try {
    const raw = localStorage.getItem(MISSION_WIDGET_VISIBILITY_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function setMissionWidgetVisibility(
  vis: Record<MissionWidgetId, boolean>,
): void {
  try {
    localStorage.setItem(MISSION_WIDGET_VISIBILITY_KEY, JSON.stringify(vis));
  } catch {
    // ignore
  }
}

export function getRightPanelOrder(): RightPanelId[] {
  return loadOrder(RIGHT_PANEL_ORDER_KEY, DEFAULT_RIGHT_PANEL_ORDER);
}

export function setRightPanelOrder(order: RightPanelId[]): void {
  saveOrder(RIGHT_PANEL_ORDER_KEY, order);
}

// [claude-code 2026-04-17] Strategium pane state: 3-way toggle between balanced / feedOnly / widgetsOnly
export type StrategiumPaneMode = "balanced" | "feedOnly" | "widgetsOnly";
const STRATEGIUM_PANE_MODE_KEY = "fintheon:strategium-pane-mode";

export function getStrategiumPaneMode(): StrategiumPaneMode {
  try {
    const raw = localStorage.getItem(STRATEGIUM_PANE_MODE_KEY);
    if (raw === "feedOnly" || raw === "widgetsOnly" || raw === "balanced") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "balanced";
}

export function setStrategiumPaneMode(mode: StrategiumPaneMode): void {
  try {
    localStorage.setItem(STRATEGIUM_PANE_MODE_KEY, mode);
  } catch {
    // ignore
  }
}
