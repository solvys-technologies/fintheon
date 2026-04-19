// [claude-code 2026-04-19] S25: app-icon badge count helpers. Uses the W3C Badging API
//   (`navigator.setAppBadge`) where available — silently no-ops elsewhere (desktop Safari,
//   non-PWA Android Chrome). Counter lives in the main thread (no IndexedDB) because the
//   mobile app polls /api/notifications/history every 30s anyway; we just mirror unread
//   into the badge. The SW increment path is a secondary signal — see sw.js.
type NavigatorWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function isBadgeSupported(): boolean {
  return typeof (navigator as NavigatorWithBadge).setAppBadge === "function";
}

export async function setBadge(count: number): Promise<void> {
  const nav = navigator as NavigatorWithBadge;
  if (typeof nav.setAppBadge !== "function") return;
  try {
    if (count <= 0) {
      await nav.clearAppBadge?.();
    } else {
      await nav.setAppBadge(count);
    }
  } catch {
    /* permissions or platform doesn't support — silent */
  }
}

export async function clearBadge(): Promise<void> {
  const nav = navigator as NavigatorWithBadge;
  if (typeof nav.clearAppBadge !== "function") return;
  try {
    await nav.clearAppBadge();
  } catch {
    /* silent */
  }
}

/** Notify SW to reset any SW-side increment counter it was tracking. */
export function notifyServiceWorkerClear(): void {
  if (!("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.controller?.postMessage({ type: "clear-badge" });
  } catch {
    /* ignore */
  }
}
