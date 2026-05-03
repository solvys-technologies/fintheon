// [claude-code 2026-04-19] S24 unify: compare against BUILD_VERSION locally (don't trust backend
//   updateAvailable blindly), skip versions the user already dismissed, and cool down for 24h
//   after any dismissal. Kills the "already on latest but still nagged" class TP flagged.
// [claude-code 2026-04-13] Version check — polls /api/version/check (GitHub releases), not commits
import pkgJson from "../../package.json";

// Always check against the production Fly.io backend for version delta.
// The desktop app's VITE_API_URL points to localhost:8080, which is always
// rebuilt to latest — so it would never detect an update. Fly.io is the
// canonical deployed version; comparing against it means any new GitHub
// release triggers the toast regardless of what's running locally.
const API_BASE = "https://fintheon.fly.dev";
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BUILD_VERSION = pkgJson.version ?? "0.0.0";

const DISMISS_KEY_PREFIX = "fintheon:update-dismissed:";
const LAST_NAG_KEY = "fintheon:update-last-nag-at";
const NAG_COOLDOWN_MS = 24 * 60 * 60 * 1000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let alreadyNotified = false;

interface VersionCheckCallbacks {
  onUpdateAvailable: (serverVersion: string) => void;
}

function isDismissedForVersion(v: string): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY_PREFIX + v) === "1";
  } catch {
    return false;
  }
}

function recentlyNagged(): boolean {
  try {
    const raw = localStorage.getItem(LAST_NAG_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < NAG_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function recordNag(): void {
  try {
    localStorage.setItem(LAST_NAG_KEY, String(Date.now()));
  } catch {
    /* localStorage can be disabled — best-effort only */
  }
}

function isNewerThan(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.-]/)
      .map((p) => parseInt(p, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const a = parse(candidate);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
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

    if (!data.updateAvailable || !data.latest) return;

    // Defense in depth: only nag when the latest release is STRICTLY newer than
    // the running build. Prevents the "already latest" nag loop TP flagged.
    const latestClean = data.latest.replace(/^v/, "");
    if (!isNewerThan(latestClean, BUILD_VERSION)) return;

    // Respect per-version dismissals
    if (isDismissedForVersion(latestClean)) return;

    // Global 24h cooldown after ANY dismissal — user said no, don't ask again soon
    if (recentlyNagged()) return;

    alreadyNotified = true;
    recordNag();
    cb.onUpdateAvailable(latestClean);
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

/** Dismiss the banner for a specific version (persists across sessions). */
export function dismissVersion(version: string): void {
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + version, "1");
    recordNag();
  } catch {
    /* localStorage can be disabled — best-effort only */
  }
}

/** Exported for footer display */
export { BUILD_VERSION };
