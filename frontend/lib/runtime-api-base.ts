// [claude-code 2026-05-27] Desktop runtime API-base resolver.
// Electron injects the active backend URL at runtime; it must beat Vite's
// build-time VITE_API_URL so packaged Desktop can use local or Portless routes.

interface RuntimeWindow extends Window {
  __FINTHEON_API_BASE__?: string;
  __FINTHEON_FETCH_BRIDGE_INSTALLED__?: boolean;
}

const LOCAL_API_BASES = ["http://localhost:8080", "http://127.0.0.1:8080"];

export function getRuntimeApiBase(fallback = "http://localhost:8080"): string {
  const runtimeBase = readRuntimeApiBase();
  if (runtimeBase) return runtimeBase;

  const envBase = import.meta.env.VITE_API_URL;
  if (envBase) return stripTrailingSlash(envBase);

  return fallback;
}

export function installRuntimeApiBaseFetchBridge(): void {
  if (typeof window === "undefined") return;

  const runtimeWindow = window as RuntimeWindow;
  if (runtimeWindow.__FINTHEON_FETCH_BRIDGE_INSTALLED__) return;

  const runtimeBase = readRuntimeApiBase();
  if (!runtimeBase) return;

  const rewriteOrigins = buildRewriteOrigins(runtimeBase);
  if (rewriteOrigins.size === 0) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    return originalFetch(
      rewriteFetchInput(input, runtimeBase, rewriteOrigins),
      init,
    );
  };
  runtimeWindow.__FINTHEON_FETCH_BRIDGE_INSTALLED__ = true;
}

function readRuntimeApiBase(): string | null {
  if (typeof window === "undefined") return null;

  const runtimeWindow = window as RuntimeWindow;
  const electronBase = window.electron?.apiBase;
  const raw = runtimeWindow.__FINTHEON_API_BASE__ || electronBase;
  if (!raw) return null;

  return stripTrailingSlash(raw);
}

function buildRewriteOrigins(runtimeBase: string): Set<string> {
  const runtimeOrigin = toOrigin(runtimeBase);
  const origins = new Set<string>();

  const envOrigin = toOrigin(import.meta.env.VITE_API_URL);
  if (envOrigin && envOrigin !== runtimeOrigin) origins.add(envOrigin);

  for (const base of LOCAL_API_BASES) {
    const origin = toOrigin(base);
    if (origin && origin !== runtimeOrigin) origins.add(origin);
  }

  return origins;
}

function rewriteFetchInput(
  input: RequestInfo | URL,
  runtimeBase: string,
  rewriteOrigins: Set<string>,
): RequestInfo | URL {
  const rewritten = rewriteUrl(input, runtimeBase, rewriteOrigins);
  if (!rewritten) return input;

  if (typeof input === "string") return rewritten;
  if (input instanceof URL) return new URL(rewritten);
  if (input instanceof Request) {
    return new Request(rewritten, {
      body: input.body,
      cache: input.cache,
      credentials: input.credentials,
      headers: input.headers,
      integrity: input.integrity,
      keepalive: input.keepalive,
      method: input.method,
      mode: input.mode,
      redirect: input.redirect,
      referrer: input.referrer,
      referrerPolicy: input.referrerPolicy,
      signal: input.signal,
    });
  }

  return input;
}

function rewriteUrl(
  input: RequestInfo | URL,
  runtimeBase: string,
  rewriteOrigins: Set<string>,
): string | null {
  const raw =
    typeof input === "string" || input instanceof URL
      ? String(input)
      : input.url;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (!rewriteOrigins.has(url.origin)) return null;

  const target = new URL(runtimeBase);
  target.pathname = url.pathname;
  target.search = url.search;
  target.hash = url.hash;
  return target.toString();
}

function toOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}
