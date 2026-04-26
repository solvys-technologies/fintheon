// [claude-code 2026-04-25] S40-P9: Browserbase SDK client. Dynamic import keeps
// the dep optional — if @browserbasehq/sdk isn't installed or the keys aren't
// set, the service degrades gracefully (returns null, never throws).
//
// Configure:
//   BROWSERBASE_API_KEY      — required
//   BROWSERBASE_PROJECT_ID   — required
//   BROWSERBASE_REGION       — defaults to "us-east-1"

import { createLogger } from "../../lib/logger.js";

const log = createLogger("Browserbase:Client");

let sdkCache: any | null = null;
let sdkAttempted = false;

async function loadSdk(): Promise<any | null> {
  if (sdkAttempted) return sdkCache;
  sdkAttempted = true;
  try {
    // Dynamic specifier prevents tsc from statically resolving the optional
    // dep. The SDK is loaded at runtime only when BROWSERBASE_API_KEY is set.
    const specifier = "@browserbasehq/sdk";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(specifier).catch(() => null);
    if (!mod) {
      log.warn("@browserbasehq/sdk not installed — browserbase unavailable");
      return null;
    }
    sdkCache = mod;
    return sdkCache;
  } catch (err) {
    log.warn("Browserbase SDK load failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function credentialsAvailable(): boolean {
  return Boolean(
    process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID,
  );
}

export interface BrowserbaseSession {
  id: string;
  liveUrl: string;
  connectUrl: string;
  status: "active" | "ended";
  createdAt: string;
}

export async function createSession(): Promise<BrowserbaseSession | null> {
  if (!credentialsAvailable()) {
    log.warn("BROWSERBASE_API_KEY/PROJECT_ID missing — session not created");
    return null;
  }
  const sdk = await loadSdk();
  if (!sdk) return null;

  try {
    const Browserbase =
      sdk.Browserbase ?? sdk.default?.Browserbase ?? sdk.default;
    const client = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });

    const res = await client.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      region: process.env.BROWSERBASE_REGION ?? "us-east-1",
      proxies: false,
      browserSettings: {
        fingerprint: { devices: ["desktop"] },
      },
    });

    // Pull liveURL via debug endpoint.
    const debug = await client.sessions.debug(res.id).catch(() => null);

    return {
      id: res.id,
      liveUrl: debug?.debuggerFullscreenUrl ?? debug?.debuggerUrl ?? "",
      connectUrl: res.connectUrl ?? "",
      status: "active",
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    log.warn("Browserbase create threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function endSession(sessionId: string): Promise<boolean> {
  if (!credentialsAvailable()) return false;
  const sdk = await loadSdk();
  if (!sdk) return false;

  try {
    const Browserbase =
      sdk.Browserbase ?? sdk.default?.Browserbase ?? sdk.default;
    const client = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    await client.sessions.update(sessionId, {
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      status: "REQUEST_RELEASE",
    });
    return true;
  } catch (err) {
    log.warn("Browserbase end threw", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function isBrowserbaseAvailable(): boolean {
  return credentialsAvailable();
}
