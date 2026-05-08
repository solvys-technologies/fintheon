// [claude-code 2026-04-29] Worker-owned persistent browser session for X intake.
// Keeps cookies/session state outside the shared pooled pages so RiskFlow can use
// browser-harness as the primary X source without falling back to Rettiwt or Agent Reach.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("BrowserPersistentSession");
const DEFAULT_VIEWPORT = { width: 1440, height: 1200 };
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface PersistentState {
  context: BrowserContext | null;
  page: Page | null;
  launchInFlight: Promise<BrowserContext> | null;
  lock: Promise<void>;
  launches: number;
  reconnects: number;
}

const state: PersistentState = {
  context: null,
  page: null,
  launchInFlight: null,
  lock: Promise.resolve(),
  launches: 0,
  reconnects: 0,
};

function sessionDir(): string {
  return (
    process.env.BROWSER_WORKER_SESSION_DIR ??
    join("/tmp", "fintheon-browser-sessions", "riskflow-x")
  );
}

async function launchContext(): Promise<BrowserContext> {
  if (state.context) return state.context;
  if (state.launchInFlight) return state.launchInFlight;

  const dir = sessionDir();
  await mkdir(dir, { recursive: true });
  const headed = process.env.BROWSER_WORKER_HEADLESS === "false";
  state.launchInFlight = chromium
    .launchPersistentContext(dir, {
      headless: !headed,
      channel: headed ? "chrome" : undefined,
      viewport: DEFAULT_VIEWPORT,
      userAgent: process.env.BROWSER_WORKER_USER_AGENT ?? DEFAULT_USER_AGENT,
      ignoreHTTPSErrors: true,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
      ],
    })
    .then(async (context) => {
      state.context = context;
      state.launches++;
      context.on("close", () => {
        state.context = null;
        state.page = null;
        state.reconnects++;
      });
      // Inject X auth cookie from env ONLY if the persistent context
      // doesn't already have one (from a previous disk-persisted login).
      // When the worker's attemptXLogin() succeeds, cookies save to the
      // user-data-dir on disk — the next context launch picks them up.
      // Injecting the stale env token overrides the fresh disk cookie.
      const existingCookies = await context.cookies("https://x.com");
      const hasAuthCookie = existingCookies.some(
        (c) => c.name === "auth_token" && c.value.length > 10,
      );

      if (hasAuthCookie) {
        log.info(
          "Using existing X auth cookie from persistent profile — skipping env token injection",
        );
      } else {
        const authToken = process.env.X_AUTH_TOKEN?.trim();
        if (authToken) {
          try {
            await context.addCookies([
              {
                name: "auth_token",
                value: authToken,
                domain: ".x.com",
                path: "/",
                httpOnly: true,
                secure: true,
                sameSite: "None" as const,
              },
            ]);
            const ct0 = process.env.X_CT0_TOKEN?.trim();
            if (ct0) {
              await context.addCookies([
                {
                  name: "ct0",
                  value: ct0,
                  domain: ".x.com",
                  path: "/",
                  secure: true,
                  sameSite: "Lax" as const,
                },
              ]);
            }
            log.info("X auth cookies injected from env", { domain: ".x.com" });
          } catch (err) {
            log.warn("X auth cookie injection failed", { error: String(err) });
          }
        } else {
          log.info("No X_AUTH_TOKEN set — X will be unauthenticated");
        }
      }
      log.info("Persistent browser context launched", { dir });
      return context;
    })
    .finally(() => {
      state.launchInFlight = null;
    });

  return state.launchInFlight;
}

async function getPage(): Promise<Page> {
  const context = await launchContext();
  if (state.page && !state.page.isClosed()) return state.page;
  state.page = context.pages()[0] ?? (await context.newPage());
  state.page.setDefaultNavigationTimeout(45_000);
  return state.page;
}

export async function withPersistentBrowserPage<T>(
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const previous = state.lock;
  let release!: () => void;
  state.lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  try {
    const page = await getPage();
    return await fn(page);
  } finally {
    release();
  }
}

export function getPersistentBrowserSessionStats(): {
  active: boolean;
  launches: number;
  reconnects: number;
  sessionDir: string;
} {
  return {
    active: Boolean(state.context && state.page && !state.page.isClosed()),
    launches: state.launches,
    reconnects: state.reconnects,
    sessionDir: sessionDir(),
  };
}
