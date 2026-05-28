export type SurfaceNavTab =
  | "feed"
  | "analysis"
  | "riskflow"
  | "dashboard"
  | "econ"
  | "narrative"
  | "apparatus"
  | "performance"
  | "proposals"
  | "desk-ops"
  | "settings";

export type SurfaceRuntime = "electron-desktop" | "web-pwa";
export type SurfaceFormFactor = "desktop" | "tablet" | "mobile";
export type ConsiliumMode = "full" | "chat-arbitrum";
export type NavigationMode = "sidebar" | "underlay-drawer";
export type DeskSecondPageMode = "all" | "feed-only";

export interface SurfaceCapabilities {
  runtime: SurfaceRuntime;
  formFactor: SurfaceFormFactor;
  isElectronDesktop: boolean;
  isMobile: boolean;
  allowCustomIframes: boolean;
  allowPerformance: boolean;
  allowVoiceAssistant: boolean;
  allowPsychAssist: boolean;
  allowStrategium: boolean;
  allowFooterToolbar: boolean;
  allowDesktopRail: boolean;
  consiliumMode: ConsiliumMode;
  navigationMode: NavigationMode;
  deskSecondPageMode: DeskSecondPageMode;
  allowedTabs: readonly SurfaceNavTab[];
  identityScope: "supabase-user";
}

const MOBILE_BP = 768;
const TABLET_BP = 1060;

const WEB_DESKTOP_TABS: readonly SurfaceNavTab[] = [
  "feed",
  "analysis",
  "riskflow",
  "dashboard",
  "econ",
  "narrative",
  "apparatus",
  "proposals",
  "settings",
];

const MOBILE_TABS: readonly SurfaceNavTab[] = [
  "dashboard",
  "riskflow",
  "econ",
  "analysis",
  "desk-ops",
  "settings",
];

const FULL_TABS: readonly SurfaceNavTab[] = [
  ...WEB_DESKTOP_TABS,
  "performance",
];

export function buildSurfaceCapabilities(
  viewportWidth: number,
): SurfaceCapabilities {
  const isElectronDesktop = isElectronRuntime();
  const formFactor = getFormFactor(viewportWidth);
  const isMobile = formFactor === "mobile";

  if (isElectronDesktop) {
    return {
      runtime: "electron-desktop",
      formFactor,
      isElectronDesktop,
      isMobile,
      allowCustomIframes: true,
      allowPerformance: true,
      allowVoiceAssistant: true,
      allowPsychAssist: true,
      allowStrategium: true,
      allowFooterToolbar: true,
      allowDesktopRail: true,
      consiliumMode: "full",
      navigationMode: "sidebar",
      deskSecondPageMode: "all",
      allowedTabs: FULL_TABS,
      identityScope: "supabase-user",
    };
  }

  return {
    runtime: "web-pwa",
    formFactor,
    isElectronDesktop,
    isMobile,
    allowCustomIframes: false,
    allowPerformance: false,
    allowVoiceAssistant: !isMobile,
    allowPsychAssist: !isMobile,
    allowStrategium: !isMobile,
    allowFooterToolbar: !isMobile,
    allowDesktopRail: !isMobile,
    consiliumMode: "chat-arbitrum",
    navigationMode: isMobile ? "underlay-drawer" : "sidebar",
    deskSecondPageMode: isMobile ? "feed-only" : "all",
    allowedTabs: isMobile ? MOBILE_TABS : WEB_DESKTOP_TABS,
    identityScope: "supabase-user",
  };
}

export function resolveSurfaceTab(
  tab: SurfaceNavTab,
  capabilities: SurfaceCapabilities,
): SurfaceNavTab {
  if (capabilities.allowedTabs.includes(tab)) return tab;
  if (tab === "performance") return "dashboard";
  if (tab === "proposals") return "dashboard";
  if (capabilities.isMobile) return "dashboard";
  return "dashboard";
}

function getFormFactor(viewportWidth: number): SurfaceFormFactor {
  if (viewportWidth < MOBILE_BP) return "mobile";
  if (viewportWidth < TABLET_BP) return "tablet";
  return "desktop";
}

function isElectronRuntime(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const electronWindow = window as typeof window & { electron?: unknown };
  return (
    /Electron/i.test(navigator.userAgent) || electronWindow.electron != null
  );
}
