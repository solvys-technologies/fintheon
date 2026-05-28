// [claude-code 2026-05-27] Desktop Portless resolver.
// Prefer a proven named backend URL when Portless is installed, but never block
// desktop startup if the proxy or aliases are missing.
const http = require("http");
const https = require("https");

const DEFAULT_LOCAL_API_BASE = "http://localhost:8080";
const DEFAULT_PORTLESS_API_BASE = "http://fintheon.test";

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function probeHealth(baseUrl, timeoutMs = 1200) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return Promise.resolve(false);

  return new Promise((resolve) => {
    const target = new URL("/healthz", normalized);
    const client = target.protocol === "https:" ? https : http;
    const req = client.get(target, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode != null && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function resolveDesktopApiBase(options) {
  const remoteBackendUrl = normalizeBaseUrl(options.remoteBackendUrl);
  const localBackendUrl =
    normalizeBaseUrl(options.localBackendUrl) || DEFAULT_LOCAL_API_BASE;

  if (!options.isMac) {
    return { apiBase: remoteBackendUrl, source: "remote" };
  }
  if (!options.localBackendHealthy) {
    return { apiBase: remoteBackendUrl, source: "remote-fallback" };
  }

  const override = normalizeBaseUrl(process.env.FINTHEON_DESKTOP_API_BASE);
  if (override) return { apiBase: override, source: "override" };

  if (process.env.FINTHEON_PORTLESS_ENABLED === "false") {
    return { apiBase: localBackendUrl, source: "localhost-disabled" };
  }

  const portlessBase =
    normalizeBaseUrl(process.env.FINTHEON_PORTLESS_API_BASE) ||
    DEFAULT_PORTLESS_API_BASE;
  const isPortlessHealthy = await probeHealth(portlessBase);
  if (isPortlessHealthy) {
    return { apiBase: portlessBase, source: "portless" };
  }

  return { apiBase: localBackendUrl, source: "localhost" };
}

module.exports = {
  DEFAULT_LOCAL_API_BASE,
  DEFAULT_PORTLESS_API_BASE,
  probeHealth,
  resolveDesktopApiBase,
};
