// [claude-code 2026-04-01] Version check — polls /api/version, fires update-available toast on mismatch
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BUILD_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

let intervalId: ReturnType<typeof setInterval> | null = null;
let alreadyNotified = false;

interface VersionCheckCallbacks {
  onUpdateAvailable: (serverVersion: string) => void;
}

async function checkOnce(cb: VersionCheckCallbacks) {
  if (alreadyNotified) return;
  try {
    const res = await fetch(`${API_BASE}/api/version`);
    if (!res.ok) return;
    const { version } = (await res.json()) as { version: string };
    if (version && version !== BUILD_VERSION) {
      alreadyNotified = true;
      cb.onUpdateAvailable(version);
    }
  } catch {
    // Silently ignore — backend may be offline
  }
}

export function startVersionCheck(cb: VersionCheckCallbacks) {
  if (intervalId) return;
  // Initial check after 10s delay (let app settle)
  setTimeout(() => void checkOnce(cb), 10_000);
  intervalId = setInterval(() => void checkOnce(cb), CHECK_INTERVAL_MS);
}

export function stopVersionCheck() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
