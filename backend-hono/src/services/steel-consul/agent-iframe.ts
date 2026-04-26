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
// [claude-code 2026-04-26] Browserbase SDK removed — Steel REST replaces it.
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

// ── Steel client (replaces Browserbase per TP) ─────────────────────────────
// [claude-code 2026-04-26] Swapped Browserbase SDK for Steel REST. We keep
// `hasBrowserbaseKey()` / `createSession()` / `closeSession()` names so
// every consumer (harper-tools, browse_visible, ChatInterface) keeps its
// imports unchanged — only the underlying transport flipped.

const STEEL_FETCH_TIMEOUT_MS = 25_000;

function steelBase(): string | null {
  const raw = process.env.STEEL_API_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function steelAuthHeaders(): Record<string, string> {
  const key = process.env.STEEL_API_KEY?.trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export function hasBrowserbaseKey(): boolean {
  // Naming preserved for back-compat. Steel is the actual provider now.
  return Boolean(steelBase());
}

interface SteelSessionPayload {
  id?: string;
  sessionId?: string;
  connectUrl?: string;
  websocketUrl?: string;
  debugUrl?: string;
  liveViewUrl?: string;
  sessionViewerUrl?: string;
}

function deriveSteelLiveUrl(
  base: string,
  payload: SteelSessionPayload,
): string {
  if (payload.liveViewUrl) return payload.liveViewUrl;
  if (payload.sessionViewerUrl) return payload.sessionViewerUrl;
  const id = payload.id ?? payload.sessionId ?? "";
  return id ? `${base}/ui/sessions/${id}` : `${base}/ui`;
}

function deriveSteelConnectUrl(
  base: string,
  payload: SteelSessionPayload,
): string {
  if (payload.connectUrl) return payload.connectUrl;
  if (payload.websocketUrl) return payload.websocketUrl;
  if (payload.debugUrl) return payload.debugUrl;
  const id = payload.id ?? payload.sessionId ?? "";
  const host = base
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "")
    .replace(/\/+$/, "");
  return id ? `ws://${host}:9223/devtools/browser/${id}` : "";
}

async function steelCreateSession(): Promise<{
  id: string;
  connectUrl: string;
  liveUrl: string;
} | null> {
  const base = steelBase();
  if (!base) return null;
  const proxyUrl = process.env.STEEL_PROXY_URL?.trim() || undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEEL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v1/sessions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...steelAuthHeaders(),
      },
      body: JSON.stringify({
        blockAds: true,
        ...(proxyUrl ? { proxyUrl } : {}),
        dimensions: { width: 1280, height: 800 },
      }),
    });
    if (!res.ok) {
      log.warn("Steel /v1/sessions non-OK", { status: res.status });
      return null;
    }
    const json = (await res.json()) as SteelSessionPayload;
    const id = json.id ?? json.sessionId;
    if (!id) return null;
    return {
      id,
      connectUrl: deriveSteelConnectUrl(base, json),
      liveUrl: deriveSteelLiveUrl(base, json),
    };
  } catch (err) {
    log.warn("Steel session create threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function steelGetSession(
  sessionId: string,
): Promise<{ connectUrl: string } | null> {
  const base = steelBase();
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEEL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/v1/sessions/${encodeURIComponent(sessionId)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json", ...steelAuthHeaders() },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as SteelSessionPayload;
    return {
      connectUrl: deriveSteelConnectUrl(base, { ...json, id: sessionId }),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function steelDeleteSession(sessionId: string): Promise<boolean> {
  const base = steelBase();
  if (!base) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEEL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/v1/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
        signal: controller.signal,
        headers: { Accept: "application/json", ...steelAuthHeaders() },
      },
    );
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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
  log.info("createSession (Steel)", { task: task.slice(0, 120) });
  const session = await steelCreateSession();
  if (!session) {
    throw new Error("STEEL_API_BASE missing or session-create failed");
  }
  return {
    sessionId: session.id,
    sessionUrl: session.liveUrl,
  };
}

export async function closeSession(sessionId: string): Promise<void> {
  if (!hasBrowserbaseKey()) return;
  const ok = await steelDeleteSession(sessionId);
  if (!ok) {
    log.warn("closeSession (Steel) returned non-OK", { sessionId });
  } else {
    log.info("closeSession (Steel)", { sessionId });
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

  // Steel path — drive via Playwright over the CDP connectUrl Steel returned
  // when the session was created. Errors yield a `done` so the agent can
  // move on.
  try {
    const session = await steelGetSession(sessionId);
    const connectUrl = session?.connectUrl;
    if (!connectUrl) {
      throw new Error("session has no connectUrl");
    }

    const playwright = await import("playwright");
    const browser = await playwright.chromium.connectOverCDP(connectUrl);
    try {
      const context = browser.contexts()[0] ?? (await browser.newContext());
      const page = context.pages()[0] ?? (await context.newPage());

      await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
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
      const buf = await handle.page.screenshot({
        type: "png",
        fullPage: false,
      });
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
