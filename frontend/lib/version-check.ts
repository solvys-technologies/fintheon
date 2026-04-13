// [claude-code 2026-04-13] Version check — polls /api/version/check (GitHub releases), not commits
import pkgJson from "../../package.json";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BUILD_VERSION = pkgJson.version ?? "0.0.0";

let intervalId: ReturnType<typeof setInterval> | null = null;
let alreadyNotified = false;

interface VersionCheckCallbacks {
  onUpdateAvailable: (serverVersion: string) => void;
}

async function checkOnce(cb: VersionCheckCallbacks) {
  if (alreadyNotified) return;
  try {
    const res = await fetch(`${API_BASE}/api/version/check`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      current: string;
      latest: string | null;
      updateAvailable: boolean;
    };
    // Only fire when a newer GitHub RELEASE exists (not just any server version mismatch)
    if (data.updateAvailable && data.latest) {
      alreadyNotified = true;
      cb.onUpdateAvailable(data.latest.replace(/^v/, ""));
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

/** Exported for footer display */
export { BUILD_VERSION };
