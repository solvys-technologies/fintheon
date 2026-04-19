// [claude-code 2026-04-19] S27-T4 (W1c): singleton Playwright pool — shared across
// screenshot-service, browser-harness, Harper Browser Operator, and the news worker.
// Max 4 concurrent pages, LIFO reuse, auto-reconnect on crash.

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("BrowserPool");

const MAX_CONCURRENT_PAGES = 4;
const IDLE_CONTEXT_TTL_MS = 15 * 60_000;
const NAV_TIMEOUT_MS = 30_000;
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

interface PooledPage {
  page: Page;
  context: BrowserContext;
  lastUsedMs: number;
  inUse: boolean;
}

interface PoolState {
  browser: Browser | null;
  pages: PooledPage[];
  launchInFlight: Promise<Browser> | null;
  totalAcquired: number;
  totalReleased: number;
  totalCreated: number;
  totalReconnects: number;
}

const state: PoolState = {
  browser: null,
  pages: [],
  launchInFlight: null,
  totalAcquired: 0,
  totalReleased: 0,
  totalCreated: 0,
  totalReconnects: 0,
};

async function launchBrowser(): Promise<Browser> {
  if (state.browser && state.browser.isConnected()) return state.browser;
  if (state.launchInFlight) return state.launchInFlight;

  state.launchInFlight = chromium
    .launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    })
    .then((browser) => {
      state.browser = browser;
      browser.on("disconnected", () => {
        log.warn("Pool browser disconnected — will relaunch on next acquire");
        state.browser = null;
        state.pages = [];
        state.totalReconnects++;
      });
      log.info("Pool browser launched", { max: MAX_CONCURRENT_PAGES });
      return browser;
    })
    .finally(() => {
      state.launchInFlight = null;
    });

  return state.launchInFlight;
}

async function waitForSlot(): Promise<void> {
  while (state.pages.filter((p) => p.inUse).length >= MAX_CONCURRENT_PAGES) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

function pickIdlePage(): PooledPage | null {
  for (let i = state.pages.length - 1; i >= 0; i--) {
    const entry = state.pages[i];
    if (!entry.inUse && !entry.page.isClosed()) {
      return entry;
    }
  }
  return null;
}

async function prunePage(entry: PooledPage): Promise<void> {
  const idx = state.pages.indexOf(entry);
  if (idx >= 0) state.pages.splice(idx, 1);
  try {
    if (!entry.page.isClosed()) await entry.page.close();
    await entry.context.close();
  } catch {
    // already torn down
  }
}

export interface PageHandle {
  page: Page;
  release: () => Promise<void>;
}

export async function acquirePage(
  opts?: { userAgent?: string; viewport?: { width: number; height: number } },
): Promise<PageHandle> {
  await waitForSlot();
  const browser = await launchBrowser();

  state.totalAcquired++;

  let entry = pickIdlePage();
  if (!entry) {
    const context = await browser.newContext({
      userAgent: opts?.userAgent,
      viewport: opts?.viewport ?? DEFAULT_VIEWPORT,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    entry = { page, context, lastUsedMs: Date.now(), inUse: true };
    state.pages.push(entry);
    state.totalCreated++;
  } else {
    entry.inUse = true;
    entry.lastUsedMs = Date.now();
  }

  const pooledEntry = entry;
  let released = false;

  const release = async () => {
    if (released) return;
    released = true;
    state.totalReleased++;
    pooledEntry.lastUsedMs = Date.now();
    pooledEntry.inUse = false;

    if (pooledEntry.page.isClosed()) {
      await prunePage(pooledEntry);
      return;
    }

    try {
      await pooledEntry.page.goto("about:blank", { timeout: 2000 }).catch(() => {});
    } catch {
      await prunePage(pooledEntry);
    }
  };

  return { page: pooledEntry.page, release };
}

export async function pruneIdlePages(): Promise<number> {
  const now = Date.now();
  let pruned = 0;
  for (const entry of [...state.pages]) {
    if (!entry.inUse && now - entry.lastUsedMs > IDLE_CONTEXT_TTL_MS) {
      await prunePage(entry);
      pruned++;
    }
  }
  return pruned;
}

export async function shutdownPool(): Promise<void> {
  for (const entry of [...state.pages]) {
    await prunePage(entry);
  }
  if (state.browser && state.browser.isConnected()) {
    await state.browser.close().catch(() => {});
  }
  state.browser = null;
  state.pages = [];
}

export function getPoolStats() {
  return {
    max: MAX_CONCURRENT_PAGES,
    open: state.pages.length,
    inUse: state.pages.filter((p) => p.inUse).length,
    idle: state.pages.filter((p) => !p.inUse).length,
    totalAcquired: state.totalAcquired,
    totalReleased: state.totalReleased,
    totalCreated: state.totalCreated,
    totalReconnects: state.totalReconnects,
    browserConnected: !!state.browser && state.browser.isConnected(),
  };
}

export async function isPlaywrightReady(): Promise<boolean> {
  try {
    const browser = await launchBrowser();
    return browser.isConnected();
  } catch {
    return false;
  }
}
