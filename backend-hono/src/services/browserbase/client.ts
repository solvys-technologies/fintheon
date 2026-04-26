// [claude-code 2026-04-26] Per TP: replaced Browserbase entirely with Steel
// Browser (https://github.com/steel-dev/steel-browser). Steel is a self-
// hostable open-source browser-as-a-service with CDP-compatible sessions
// and a `/v1/scrape` one-shot endpoint. We keep this file's path + exported
// names (`createSession`, `endSession`, `isBrowserbaseAvailable`,
// `BrowserbaseSession`) so every consumer (session-manager, agent-iframe,
// harper-tools, sse, routes) keeps working without an import-rename pass.
// Only the underlying transport changed.
//
// Configure (consuming app's secrets):
//   STEEL_API_BASE — required, e.g. "https://fintheon-steel.fly.dev" (or
//                    self-host port 3000 inside your VPC)
//   STEEL_API_KEY  — optional, only if Steel is run behind an auth proxy
//   STEEL_PROXY_URL — optional, format "user:pass@host:port"; forwarded to
//                     Steel's session-create body
//   STEEL_REGION   — optional, used only when STEEL_API_BASE is the hosted
//                    Steel cloud; ignored on self-hosted instances

import { createLogger } from "../../lib/logger.js";

const log = createLogger("Steel:Client");

const FETCH_TIMEOUT_MS = 25_000;

function steelBase(): string | null {
  const raw = process.env.STEEL_API_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const key = process.env.STEEL_API_KEY?.trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export function isBrowserbaseAvailable(): boolean {
  // Naming preserved for backward-compat with all existing callers; the
  // underlying check is now Steel's STEEL_API_BASE.
  return Boolean(steelBase());
}

export interface BrowserbaseSession {
  id: string;
  liveUrl: string;
  connectUrl: string;
  status: "active" | "ended";
  createdAt: string;
}

interface SteelCreateResponse {
  id?: string;
  sessionId?: string;
  connectUrl?: string;
  websocketUrl?: string;
  debugUrl?: string;
  liveViewUrl?: string;
  sessionViewerUrl?: string;
  ui?: { url?: string };
}

function deriveLiveUrl(base: string, payload: SteelCreateResponse): string {
  if (payload.liveViewUrl) return payload.liveViewUrl;
  if (payload.sessionViewerUrl) return payload.sessionViewerUrl;
  if (payload.ui?.url) return payload.ui.url;
  // Self-hosted Steel exposes a UI per session at /ui/sessions/<id>.
  const id = payload.id ?? payload.sessionId ?? "";
  return id ? `${base}/ui/sessions/${id}` : `${base}/ui`;
}

function deriveConnectUrl(base: string, payload: SteelCreateResponse): string {
  if (payload.connectUrl) return payload.connectUrl;
  if (payload.websocketUrl) return payload.websocketUrl;
  if (payload.debugUrl) return payload.debugUrl;
  // Steel default CDP path: ws on port 9223.
  const id = payload.id ?? payload.sessionId ?? "";
  const host = base
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "")
    .replace(/\/+$/, "");
  return id ? `ws://${host}:9223/devtools/browser/${id}` : "";
}

export async function createSession(): Promise<BrowserbaseSession | null> {
  const base = steelBase();
  if (!base) {
    log.warn("STEEL_API_BASE missing — session not created");
    return null;
  }
  const proxyUrl = process.env.STEEL_PROXY_URL?.trim() || undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/v1/sessions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders(),
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
    const json = (await res.json()) as SteelCreateResponse;
    const id = json.id ?? json.sessionId;
    if (!id) {
      log.warn("Steel session response missing id", {
        keys: Object.keys(json),
      });
      return null;
    }
    return {
      id,
      liveUrl: deriveLiveUrl(base, json),
      connectUrl: deriveConnectUrl(base, json),
      status: "active",
      createdAt: new Date().toISOString(),
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

export async function endSession(sessionId: string): Promise<boolean> {
  const base = steelBase();
  if (!base) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/v1/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "DELETE",
        signal: controller.signal,
        headers: { Accept: "application/json", ...authHeaders() },
      },
    );
    return res.ok;
  } catch (err) {
    log.warn("Steel session end threw", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
