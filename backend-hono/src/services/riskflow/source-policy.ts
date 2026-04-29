// [claude-code 2026-04-29] S53-T4B: Strict source-policy enforcement — allowlist-first,
// deny by default. Only approved X handles and official .gov domains may enter the feed.
// Policy is read from riskflow_source_accounts (active + category filter). Unapproved
// sources are blocked at the ingest boundary with logged rejection reason.
// Leak sentinel counters track every rejection for operator visibility.

import { createLogger } from "../../lib/logger.js";
import { getActiveAccounts } from "../source-accounts/source-accounts-service.js";

const log = createLogger("SourcePolicy");

const APPROVED_WEB_DOMAINS = [
  "bls.gov",
  "federalreserve.gov",
  "newyorkfed.org",
  "atlantafed.org",
  "fred.stlouisfed.org",
  "bea.gov",
  "census.gov",
  "treasury.gov",
];

let allowlistHandles = new Set<string>();
let allowlistDomains = new Set<string>();
let lastRefresh = 0;
const REFRESH_TTL_MS = 30_000;

function isWebDomain(handle: string): boolean {
  return handle.includes(".") && !handle.startsWith("@");
}

export async function refreshAllowlist(): Promise<void> {
  if (Date.now() - lastRefresh < REFRESH_TTL_MS && allowlistHandles.size > 0)
    return;

  try {
    const accounts = await getActiveAccounts();
    const handles = new Set<string>();
    const domains = new Set<string>(APPROVED_WEB_DOMAINS);

    for (const a of accounts) {
      if (isWebDomain(a.handle)) {
        domains.add(a.handle);
      } else {
        handles.add(a.handle.toLowerCase());
      }
    }

    allowlistHandles = handles;
    allowlistDomains = domains;
    lastRefresh = Date.now();
  } catch (err) {
    log.warn("Allowlist refresh failed, keeping stale", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function getAllowlistSnapshot(): {
  handles: string[];
  domains: string[];
} {
  return {
    handles: Array.from(allowlistHandles),
    domains: Array.from(allowlistDomains),
  };
}

export type PolicyDecision = "allowed" | "blocked_handle" | "blocked_domain" | "blocked_unknown_source";

export interface PolicyVerdict {
  decision: PolicyDecision;
  reason: string;
}

export function checkSourcePolicy(source: string, url?: string | null): PolicyVerdict {
  if (!source || source === "unknown") {
    return { decision: "blocked_unknown_source", reason: "source field empty or 'unknown'" };
  }

  // Check X handles (case-insensitive)
  const handle = source.replace(/^@/, "").toLowerCase();
  if (allowlistHandles.has(handle)) {
    return { decision: "allowed", reason: "approved X handle" };
  }

  // Check web domains
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
      for (const domain of allowlistDomains) {
        if (host === domain || host.endsWith("." + domain)) {
          return { decision: "allowed", reason: `approved domain: ${domain}` };
        }
      }
    } catch {
      // Bad URL — fall through to handle check
    }
  }

  // Check if source itself is a domain
  if (isWebDomain(source)) {
    const srcLower = source.toLowerCase();
    for (const domain of allowlistDomains) {
      if (srcLower === domain || srcLower.endsWith("." + domain)) {
        return { decision: "allowed", reason: `approved domain: ${domain}` };
      }
    }
    return { decision: "blocked_domain", reason: `domain not in allowlist: ${source}` };
  }

  return { decision: "blocked_handle", reason: `handle not in allowlist: ${source}` };
}
