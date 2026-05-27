export const SURFACE_TARGETS = {
  desktop: "desktop",
  mobile: "mobile",
} as const;

export type SurfaceTarget =
  (typeof SURFACE_TARGETS)[keyof typeof SURFACE_TARGETS];

export interface SurfaceRouteOptions {
  currentSurface: SurfaceTarget;
  desktopUrl?: string;
  mobileUrl?: string;
}

interface ClientSnapshot {
  hasCoarsePointer: boolean;
  isElectron: boolean;
  maxTouchPoints: number;
  screenHeight: number;
  screenWidth: number;
  userAgent: string;
}

const DEFAULT_DESKTOP_URL = "https://fintheon-alpha.vercel.app";
const DEFAULT_MOBILE_URL = "https://fintheon.pricedinresearch.io";
const MOBILE_USER_AGENT =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|BB10|IEMobile|Opera Mini|Mobile|Silk|Kindle|Tablet/i;

export function detectPreferredSurface(
  snapshot: ClientSnapshot,
): SurfaceTarget {
  if (snapshot.isElectron) return SURFACE_TARGETS.desktop;
  if (MOBILE_USER_AGENT.test(snapshot.userAgent)) return SURFACE_TARGETS.mobile;

  const isIpadDesktopUa =
    /Macintosh/i.test(snapshot.userAgent) && snapshot.maxTouchPoints > 1;
  if (isIpadDesktopUa) return SURFACE_TARGETS.mobile;

  const shortestSide = Math.min(
    ...[snapshot.screenWidth, snapshot.screenHeight].filter((n) => n > 0),
  );
  if (snapshot.hasCoarsePointer && shortestSide > 0 && shortestSide <= 1024) {
    return SURFACE_TARGETS.mobile;
  }

  return SURFACE_TARGETS.desktop;
}

export function getSurfaceRedirectUrl(
  options: SurfaceRouteOptions,
): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  const currentUrl = new URL(window.location.href);
  const override = readSurfaceOverride(currentUrl.searchParams);
  const snapshot = getClientSnapshot();
  const preferredSurface = override ?? detectPreferredSurface(snapshot);

  if (preferredSurface === options.currentSurface) return null;

  const destinationBase = getDestinationBaseUrl(preferredSurface, options);
  const destinationUrl = new URL(destinationBase);
  destinationUrl.pathname = currentUrl.pathname;
  destinationUrl.search = currentUrl.search;
  destinationUrl.hash = currentUrl.hash;

  if (destinationUrl.toString() === currentUrl.toString()) return null;

  return destinationUrl.toString();
}

export function routeSurfaceForClient(options: SurfaceRouteOptions): boolean {
  const redirectUrl = getSurfaceRedirectUrl(options);
  if (!redirectUrl) return false;

  window.location.replace(redirectUrl);
  return true;
}

function getClientSnapshot(): ClientSnapshot {
  const electronWindow = window as typeof window & { electron?: unknown };
  const hasCoarsePointer =
    window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;

  return {
    hasCoarsePointer,
    isElectron:
      /Electron/i.test(navigator.userAgent) || electronWindow.electron != null,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    screenHeight: window.screen?.height ?? window.innerHeight ?? 0,
    screenWidth: window.screen?.width ?? window.innerWidth ?? 0,
    userAgent: navigator.userAgent,
  };
}

function getDestinationBaseUrl(
  target: SurfaceTarget,
  options: SurfaceRouteOptions,
): string {
  const configuredUrl =
    target === SURFACE_TARGETS.desktop ? options.desktopUrl : options.mobileUrl;
  const normalizedUrl = normalizeUrl(configuredUrl);
  if (normalizedUrl) return normalizedUrl;

  if (isLocalNetworkHostname(window.location.hostname)) {
    const port = target === SURFACE_TARGETS.desktop ? "7777" : "7778";
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }

  return target === SURFACE_TARGETS.desktop
    ? DEFAULT_DESKTOP_URL
    : DEFAULT_MOBILE_URL;
}

function normalizeUrl(value?: string): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function readSurfaceOverride(params: URLSearchParams): SurfaceTarget | null {
  const value = params.get("surface")?.toLowerCase();
  if (!value) return null;

  if (["desktop", "web", "web-pwa"].includes(value)) {
    return SURFACE_TARGETS.desktop;
  }
  if (["mobile", "compact", "mobile-pwa"].includes(value)) {
    return SURFACE_TARGETS.mobile;
  }

  return null;
}

function isLocalNetworkHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "");
  const ipv4Parts = normalizedHostname.split(".").map(Number);
  const isPrivateIpv4 =
    ipv4Parts.length === 4 &&
    ipv4Parts.every(
      (part) => Number.isInteger(part) && part >= 0 && part <= 255,
    ) &&
    (ipv4Parts[0] === 10 ||
      (ipv4Parts[0] === 100 && ipv4Parts[1] >= 64 && ipv4Parts[1] <= 127) ||
      (ipv4Parts[0] === 172 && ipv4Parts[1] >= 16 && ipv4Parts[1] <= 31) ||
      (ipv4Parts[0] === 192 && ipv4Parts[1] === 168) ||
      (ipv4Parts[0] === 169 && ipv4Parts[1] === 254));

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1" ||
    normalizedHostname.endsWith(".local") ||
    isPrivateIpv4
  );
}
