// [claude-code 2026-03-14] Auto-refresh twitter-cli cookies every 12h to prevent 429 rate limits from stale sessions

import { execFileNoThrow } from '../../utils/execFileNoThrow.js';
import { existsSync, unlinkSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const COOKIE_CACHE_PATH = join(homedir(), '.cache', 'twitter-cli', 'cookies.json');

// Python binary inside the uv-managed twitter-cli venv
const TWITTER_PYTHON =
  process.env.TWITTER_CLI_PYTHON ??
  join(homedir(), '.local', 'share', 'uv', 'tools', 'twitter-cli', 'bin', 'python3');

/**
 * Extract fresh cookies from the browser via twitter-cli's own auth module.
 * Deletes the stale cache first so browser_cookie3 re-reads from Chrome/Edge/Firefox.
 * Returns true if fresh cookies were saved successfully.
 */
async function refreshCookies(): Promise<boolean> {
  // 1. Delete stale cache
  if (existsSync(COOKIE_CACHE_PATH)) {
    try {
      unlinkSync(COOKIE_CACHE_PATH);
      console.log('[TwitterAuthRefresher] Deleted stale cookie cache');
    } catch (err) {
      console.warn('[TwitterAuthRefresher] Failed to delete cache:', err);
    }
  }

  // 2. Run twitter-cli's auth module to extract + cache fresh cookies
  //    This calls get_cookies() which: env vars → cache → browser extraction → verify → save cache
  const script = `
import json, sys
try:
    from twitter_cli.auth import extract_from_browser, _save_cookie_cache, verify_cookies
    cookies = extract_from_browser()
    if not cookies:
        print(json.dumps({"ok": False, "error": "No cookies found in any browser. Login to x.com first."}))
        sys.exit(1)
    # Verify before caching
    try:
        info = verify_cookies(cookies["auth_token"], cookies["ct0"], cookies.get("cookie_string"))
        screen_name = info.get("screen_name", "unknown")
    except RuntimeError as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)
    _save_cookie_cache(cookies)
    print(json.dumps({"ok": True, "screen_name": screen_name, "keys": len(cookies)}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
    sys.exit(1)
`;

  const result = await execFileNoThrow(TWITTER_PYTHON, ['-c', script], { timeout: 30_000 });

  if (!result || result.exitCode !== 0) {
    const stderr = result?.stderr?.slice(0, 300) ?? 'no output';
    console.error('[TwitterAuthRefresher] Cookie refresh failed:', stderr);
    return false;
  }

  try {
    const data = JSON.parse(result.stdout.trim());
    if (data.ok) {
      console.log(`[TwitterAuthRefresher] Fresh cookies saved (user: ${data.screen_name}, ${data.keys} keys)`);
      return true;
    }
    console.error('[TwitterAuthRefresher] Refresh error:', data.error);
    return false;
  } catch {
    console.error('[TwitterAuthRefresher] Unexpected output:', result.stdout.slice(0, 200));
    return false;
  }
}

/**
 * Check how old the current cookie cache is.
 * Returns age in hours, or Infinity if no cache exists.
 */
function cacheAgeHours(): number {
  try {
    if (!existsSync(COOKIE_CACHE_PATH)) return Infinity;
    const { mtimeMs } = statSync(COOKIE_CACHE_PATH);
    return (Date.now() - mtimeMs) / (1000 * 60 * 60);
  } catch {
    return Infinity;
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

let refreshInterval: ReturnType<typeof setInterval> | null = null;

export function startAuthRefresher(): void {
  if (refreshInterval) return;

  const ageH = cacheAgeHours();
  console.log(`[TwitterAuthRefresher] Starting (12h cycle). Cookie cache age: ${ageH === Infinity ? 'none' : ageH.toFixed(1) + 'h'}`);

  // Refresh immediately if cache is older than 12h or missing
  if (ageH >= 12) {
    refreshCookies().catch((err) =>
      console.warn('[TwitterAuthRefresher] Initial refresh error:', err)
    );
  }

  refreshInterval = setInterval(() => {
    console.log('[TwitterAuthRefresher] Scheduled 12h refresh triggered');
    refreshCookies().catch((err) =>
      console.warn('[TwitterAuthRefresher] Scheduled refresh error:', err)
    );
  }, REFRESH_INTERVAL_MS);
}

export function stopAuthRefresher(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[TwitterAuthRefresher] Stopped');
  }
}

/** Force an immediate cookie refresh (e.g. after a 429 rate limit). */
export async function forceRefreshCookies(): Promise<boolean> {
  console.log('[TwitterAuthRefresher] Force refresh requested');
  return refreshCookies();
}
