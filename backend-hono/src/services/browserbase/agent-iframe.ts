// [claude-code 2026-04-25] S42-T5: Browserbase session manager. Provisions a
// remote Chromium session via @browserbasehq/sdk and returns the
// debuggerFullscreenUrl that the frontend ArtifactPane mounts as a live iframe
// the user watches in real time. Falls back to the Playwright operator +
// 1.5s screenshot stream when BROWSERBASE_API_KEY is missing.
//
// Streaming protocol: events are published on `browserbaseEventBus` (an
// EventEmitter) so the bridge layer (T1) can convert them into BridgeStreamEvent
// union members `artifact` and `tool_call`. We do NOT widen BridgeStreamEvent
// here — T1 owns that union; T5 only emits the canonical shape.
//
// SDK reference: client.sessions.create() → Session, client.sessions.debug(id)
// → SessionLiveURLs (debuggerFullscreenUrl is the user-visible iframe target).

import { EventEmitter } from "node:events";
import Browserbase from "@browserbasehq/sdk";
import { createLogger } from "../../lib/logger.js";
import { browseTask } from "../browser/operator.js";
import { acquirePage } from "../browser/pool.js";

const log = createLogger("Browserbase");

// ── Types (forward-compatible with T1 BridgeStreamEvent additions) ─────────

export interface BrowserbaseArtifactEvent {
  type: "artifact";
  kind: "browserbase";
  payload: {
    sessionId: string;
    sessionUrl: string;
    conversationId?: string;
  };
}

export interface BrowserbaseScreenshotEvent {
  type: "artifact";
  kind: "report";
  payload: {
    sessionId: string;
    conversationId?: string;
    /** Inline HTML containing a base64 <img>. Rendered by the artifact pane. */
    html: string;
  };
}

export type BrowserbaseToolCallStatus = "running" | "done" | "error";

export interface BrowserbaseToolCallEvent {
  type: "tool_call";
  status: BrowserbaseToolCallStatus;
  name: string;
  detail?: unknown;
  conversationId?: string;
}

export type BrowserbaseEvent =
  | BrowserbaseArtifactEvent
  | BrowserbaseScreenshotEvent
  | BrowserbaseToolCallEvent;

export interface CreatedSession {
  sessionId: string;
  sessionUrl: string;
}

export interface FallbackSession {
  fallback: true;
  mode: "screenshot-stream";
}

export type SessionResult = CreatedSession | FallbackSession;

export type RunTaskEvent =
  | { event: "navigated"; detail: { url: string } }
  | { event: "clicked"; detail: { selector: string } }
  | { event: "scrolled"; detail: { y: number } }
  | { event: "done"; detail: { url?: string; title?: string } };

// ── Event bus (T1 attaches its bridge converter here) ──────────────────────

export const browserbaseEventBus = new EventEmitter();
browserbaseEventBus.setMaxListeners(50);

function publish(event: BrowserbaseEvent): void {
  browserbaseEventBus.emit("event", event);
}

// ── Client + env ───────────────────────────────────────────────────────────

let client: Browserbase | null = null;

export function hasBrowserbaseKey(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

function getClient(): Browserbase {
  if (client) return client;
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new Error("BROWSERBASE_API_KEY missing");
  }
  client = new Browserbase({ apiKey });
  return client;
}

function getProjectId(): string | undefined {
  return process.env.BROWSERBASE_PROJECT_ID || undefined;
}

// ── Session lifecycle ──────────────────────────────────────────────────────

/**
 * Provision a new Browserbase session. Returns the live `debuggerFullscreenUrl`
 * the frontend iframe will mount. Caller is responsible for closing the session
 * when done; sessions also auto-expire on the project's default timeout.
 *
 * Throws if BROWSERBASE_API_KEY is missing — callers must check
 * `hasBrowserbaseKey()` first and pick the fallback path.
 */
export async function createSession(task: string): Promise<CreatedSession> {
  const c = getClient();
  const projectId = getProjectId();
  log.info("createSession", { task: task.slice(0, 120), projectId });

  const session = await c.sessions.create(
    projectId ? { projectId } : ({} as { projectId?: string }),
  );
  const live = await c.sessions.debug(session.id);
  return {
    sessionId: session.id,
    sessionUrl: live.debuggerFullscreenUrl,
  };
}

export async function closeSession(sessionId: string): Promise<void> {
  if (!hasBrowserbaseKey()) return;
  try {
    const c = getClient();
    const projectId = getProjectId();
    await c.sessions.update(sessionId, {
      status: "REQUEST_RELEASE",
      ...(projectId ? { projectId } : {}),
    });
    log.info("closeSession", { sessionId });
  } catch (err) {
    log.warn("closeSession failed", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Task driver ────────────────────────────────────────────────────────────

const URL_HINT = /(https?:\/\/[^\s)]+)/i;

function extractUrl(task: string): string | null {
  const match = task.match(URL_HINT);
  return match ? match[1] : null;
}

/**
 * Drive a Browserbase session through a task. For T5 we keep this minimal:
 * navigate to the URL hinted in the task (or a Google search if none) and
 * yield navigation events. Deeper LLM-driven action selection remains
 * operator.ts's territory.
 *
 * When the API key is absent, falls through to operator.browseTask() with
 * 1.5s screenshot dispatch via the report-artifact channel.
 */
export async function* runTask(
  sessionId: string,
  instruction: string,
  conversationId?: string,
): AsyncGenerator<RunTaskEvent> {
  const target =
    extractUrl(instruction) ??
    `https://www.google.com/search?q=${encodeURIComponent(instruction)}`;

  // Browserbase path — drive via Playwright over the SDK connectUrl. The
  // session was already created in createSession(); we just navigate the
  // user-visible browser. Errors yield a `done` so the agent can move on.
  try {
    const c = getClient();
    const session = await c.sessions.retrieve(sessionId);
    const connectUrl = session.connectUrl;
    if (!connectUrl) {
      throw new Error("session has no connectUrl");
    }

    const playwright = await import("playwright");
    const browser = await playwright.chromium.connectOverCDP(connectUrl);
    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());

      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
      yield { event: "navigated", detail: { url: target } };
      publish({
        type: "tool_call",
        status: "running",
        name: "browse_visible.navigated",
        detail: { url: target },
        conversationId,
      });

      const finalUrl = page.url();
      const title = await page.title().catch(() => "");
      yield { event: "done", detail: { url: finalUrl, title } };
      publish({
        type: "tool_call",
        status: "done",
        name: "browse_visible.done",
        detail: { url: finalUrl, title },
        conversationId,
      });
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err) {
    log.warn("runTask failed", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    publish({
      type: "tool_call",
      status: "error",
      name: "browse_visible.error",
      detail: { message: err instanceof Error ? err.message : String(err) },
      conversationId,
    });
    yield { event: "done", detail: { url: target } };
  }
}

// ── Fallback: Playwright + screenshot stream ───────────────────────────────

const SCREENSHOT_INTERVAL_MS = 1_500;

/**
 * Fallback path used when BROWSERBASE_API_KEY is absent. Uses the local
 * Playwright pool (operator.ts) and emits one report artifact per 1.5s with a
 * base64 screenshot embedded in HTML so the artifact pane shows a slideshow.
 *
 * Returns when navigation completes; emits a final `done` tool_call event.
 */
export async function runFallbackScreenshotStream(
  task: string,
  conversationId?: string,
): Promise<void> {
  const url = extractUrl(task);
  publish({
    type: "tool_call",
    status: "running",
    name: "browse_visible.fallback",
    detail: { reason: "no_api_key" },
    conversationId,
  });

  const handle = await acquirePage();
  let stopped = false;
  const sessionId = `fallback-${Date.now().toString(36)}`;

  const ticker = setInterval(async () => {
    if (stopped) return;
    try {
      const buf = await handle.page.screenshot({ type: "png", fullPage: false });
      const b64 = buf.toString("base64");
      publish({
        type: "artifact",
        kind: "report",
        payload: {
          sessionId,
          conversationId,
          html: `<img alt="browser screenshot" src="data:image/png;base64,${b64}" style="width:100%;display:block" />`,
        },
      });
    } catch (err) {
      log.warn("fallback screenshot failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, SCREENSHOT_INTERVAL_MS);

  try {
    if (url) {
      await handle.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
    } else {
      // No URL in task — run the operator's LLM-driven path against a
      // Google query so the agent still produces a screenshot stream.
      await browseTask({
        url: `https://www.google.com/search?q=${encodeURIComponent(task)}`,
        objective: task,
        budget_usd: 0.05,
        use_cache: false,
      });
    }
  } catch (err) {
    log.warn("fallback navigation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    stopped = true;
    clearInterval(ticker);
    await handle.release().catch(() => {});
    publish({
      type: "tool_call",
      status: "done",
      name: "browse_visible.fallback.done",
      conversationId,
    });
  }
}

// ── Tool entry ─────────────────────────────────────────────────────────────

export interface BrowseVisibleResult {
  ok: boolean;
  mode: "browserbase" | "fallback";
  sessionId?: string;
  sessionUrl?: string;
  finalUrl?: string;
  title?: string;
  error?: string;
}

/**
 * High-level entry used by the `browse_visible` agent tool and the
 * `/api/browserbase/session` route. Returns once the initial navigation has
 * settled; further progress (clicks, scrolls) streams through
 * `browserbaseEventBus`.
 */
export async function browseVisible(
  task: string,
  conversationId?: string,
): Promise<BrowseVisibleResult> {
  if (!hasBrowserbaseKey()) {
    // Fire-and-forget the screenshot loop so the agent can return immediately
    // with a fallback marker; the artifact stream continues in the background.
    void runFallbackScreenshotStream(task, conversationId);
    return { ok: true, mode: "fallback" };
  }

  try {
    const session = await createSession(task);
    publish({
      type: "artifact",
      kind: "browserbase",
      payload: {
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
        conversationId,
      },
    });
    publish({
      type: "tool_call",
      status: "running",
      name: "browse_visible.session_open",
      detail: { sessionUrl: session.sessionUrl },
      conversationId,
    });

    let finalUrl: string | undefined;
    let finalTitle: string | undefined;
    for await (const ev of runTask(session.sessionId, task, conversationId)) {
      if (ev.event === "done") {
        finalUrl = ev.detail.url;
        finalTitle = ev.detail.title;
      }
    }

    return {
      ok: true,
      mode: "browserbase",
      sessionId: session.sessionId,
      sessionUrl: session.sessionUrl,
      finalUrl,
      title: finalTitle,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("browseVisible failed", { error: message });
    publish({
      type: "tool_call",
      status: "error",
      name: "browse_visible.error",
      detail: { message },
      conversationId,
    });
    return { ok: false, mode: "browserbase", error: message };
  }
}
