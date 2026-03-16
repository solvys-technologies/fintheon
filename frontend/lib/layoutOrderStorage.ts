/**
 * Persisted order for menu sidebar and heading toolbar.
 * Sidebar and toolbar orders are independent; items cannot move between them.
 */

const SIDEBAR_ORDER_KEY = 'pulse_sidebar_nav_order';
const TOOLBAR_ORDER_KEY = 'pulse_toolbar_order';
const MISSION_WIDGET_ORDER_KEY = 'pulse_mission_widget_order_v3'; // v3: calendar added
const MISSION_WIDGET_VISIBILITY_KEY = 'pulse_mission_widget_visibility';
const RIGHT_PANEL_ORDER_KEY = 'pulse_right_panel_order';

export type NavTabId = 'executive' | 'analysis' | 'news' | 'chatroom' | 'notion' | 'econ' | 'narrative' | 'earnings';

export const DEFAULT_SIDEBAR_ORDER: NavTabId[] = [
  'executive',
  'analysis',
  'news',
  'econ',
  'chatroom',
  'notion',
  'narrative',
  'earnings',
];

export type ToolbarItemId = 'platform' | 'power' | 'layout' | 'chat' | 'voice' | 'heartbeat' | 'ivScore';

export const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'platform',
  'power',
  'layout',
  'chat',
  'voice',
  'heartbeat',
  'ivScore',
];

export type MissionWidgetId = 'er' | 'autopilot' | 'regime' | 'account' | 'blindspots' | 'calendar';

export const DEFAULT_MISSION_WIDGET_ORDER: MissionWidgetId[] = [
  'er',
  'autopilot',
  'regime',
  'account',
  'blindspots',
  'calendar',
];

export type RightPanelId = 'mission';

export const DEFAULT_RIGHT_PANEL_ORDER: RightPanelId[] = [
  'mission',
];

function loadOrder<T>(key: string, defaultOrder: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultOrder;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultOrder;
    const ordered = parsed.filter((id: unknown) => defaultOrder.includes(id as T)) as T[];
    const deduped = ordered.filter((id, index) => ordered.indexOf(id) === index);
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
    er: true, autopilot: true, regime: true, account: true, blindspots: true, calendar: true,
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

export function setMissionWidgetVisibility(vis: Record<MissionWidgetId, boolean>): void {
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
