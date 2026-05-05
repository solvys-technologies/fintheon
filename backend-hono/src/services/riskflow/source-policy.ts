// [claude-code 2026-05-05] Allowlist loaded from Supabase riskflow_source_accounts
// table (active browser-method handles managed by Refinement UI). Falls back to
// APPROVED_X_HANDLES when DB unavailable. The X Following tab IS the primary filter.
// [claude-code 2026-04-29] S53-T4B: Strict source-policy — allowlist-first, deny by
// default. Leak sentinel counters track every rejection for operator visibility.

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient, isSupabaseConfigured } from "../../config/supabase.js";

const log = createLogger("SourcePolicy");

const APPROVED_X_HANDLES = [
  "unusual_whales",
  "financialjuice",
  "deitaone",
  "macroedgeRes",
  "OSINTTechnical",
  "nicktimiraos",
  "michaeljburry",
  "spotgamma",
  "trendspider",
];

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

const BLOCKED_WEB_DOMAINS = [
  "seekingalpha.com",
  "bloomberg.com",
  "cnbc.com",
  "reuters.com",
  "marketwatch.com",
  "wsj.com",
  "ft.com",
  "barrons.com",
  "investing.com",
];

const SOCIAL_PERMALINK_DOMAINS = ["x.com", "twitter.com"];

const allowlistHandles = new Set<string>();
const allowlistDomains = new Set<string>(APPROVED_WEB_DOMAINS);
let lastRefresh = 0;
const REFRESH_TTL_MS = 30_000;

function normalizeHandle(value: string): string {
  return value.replace(/^@/, "").toLowerCase().trim();
}

function isWebDomain(handle: string): boolean {
  return handle.includes(".") && !handle.startsWith("@");
}

function extractHandleFromSubmittedBy(
  submittedBy?: string | null,
): string | null {
  if (!submittedBy) return null;
  const match = submittedBy.match(/@?([a-z0-9_]{2,32})$/i);
  return match ? normalizeHandle(match[1]) : null;
}

function extractHandleFromSource(source: string): string | null {
  const normalized = source.trim();
  if (normalized.toLowerCase().startsWith("twitter:")) {
    return normalizeHandle(normalized.slice("twitter:".length));
  }
  if (normalized.startsWith("@")) return normalizeHandle(normalized);
  return null;
}

function getHostname(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isDomainMatch(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

function isBlockedHost(host: string): string | null {
  return (
    BLOCKED_WEB_DOMAINS.find((domain) => isDomainMatch(host, domain)) ?? null
  );
}

function isApprovedDataHost(host: string): string | null {
  return (
    Array.from(allowlistDomains).find((domain) =>
      isDomainMatch(host, domain),
    ) ?? null
  );
}

function isSocialPermalinkHost(host: string): boolean {
  return SOCIAL_PERMALINK_DOMAINS.some((domain) => isDomainMatch(host, domain));
}

export async function refreshAllowlist(): Promise<void> {
  if (Date.now() - lastRefresh < REFRESH_TTL_MS) return;

  lastRefresh = Date.now();

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseClient()!;
      const { data } = await sb
        .from("riskflow_source_accounts")
        .select("handle")
        .eq("active", true)
        .eq("method", "browser");
      if (data) {
        allowlistHandles.clear();
        for (const row of data) {
          allowlistHandles.add(normalizeHandle(row.handle));
        }
      }
    } catch {
      for (const h of APPROVED_X_HANDLES) {
        allowlistHandles.add(normalizeHandle(h));
      }
    }
  } else {
    for (const h of APPROVED_X_HANDLES) {
      allowlistHandles.add(normalizeHandle(h));
    }
  }

  log.info("RiskFlow source allowlist refreshed", {
    handles: allowlistHandles.size,
    domains: allowlistDomains.size,
  });
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

export type PolicyDecision =
  | "allowed"
  | "blocked_handle"
  | "blocked_domain"
  | "blocked_unknown_source";

export interface PolicyVerdict {
  decision: PolicyDecision;
  reason: string;
}

export interface SourcePolicyContext {
  submittedBy?: string | null;
  pipeline?: string | null;
  sourceDomain?: string | null;
  tags?: string[] | null;
}

export function checkSourcePolicy(
  source: string,
  url?: string | null,
  context: SourcePolicyContext = {},
): PolicyVerdict {
  if (!source || source === "unknown") {
    return {
      decision: "blocked_unknown_source",
      reason: "source field empty or 'unknown'",
    };
  }

  const urlHost = getHostname(url);
  const sourceDomain =
    context.sourceDomain?.replace(/^www\./, "").toLowerCase() ?? null;
  const candidateHost = urlHost ?? sourceDomain;
  if (candidateHost) {
    const blocked = isBlockedHost(candidateHost);
    if (blocked) {
      return {
        decision: "blocked_domain",
        reason: `blocked publisher domain: ${blocked}`,
      };
    }
  }

  if (
    source === "EconomicCalendar" ||
    context.pipeline === "economic-calendar"
  ) {
    return { decision: "allowed", reason: "internal economic calendar bridge" };
  }

  const sourceHandle = extractHandleFromSource(source);
  if (sourceHandle && allowlistHandles.has(sourceHandle)) {
    return {
      decision: "allowed",
      reason: `approved X handle: @${sourceHandle}`,
    };
  }

  const submittedHandle = extractHandleFromSubmittedBy(context.submittedBy);

  const handle = normalizeHandle(source);
  if (allowlistHandles.has(handle)) {
    return { decision: "allowed", reason: "approved X handle" };
  }

  if (url) {
    const host = urlHost;
    if (host) {
      const approved = isApprovedDataHost(host);
      if (approved) {
        return { decision: "allowed", reason: `approved domain: ${approved}` };
      }
      if (!isSocialPermalinkHost(host) && !sourceHandle && !submittedHandle) {
        return {
          decision: "blocked_domain",
          reason: `domain not in allowlist: ${host}`,
        };
      }
    }
  }

  if (isWebDomain(source)) {
    const srcLower = source.toLowerCase();
    const blocked = isBlockedHost(srcLower);
    if (blocked) {
      return {
        decision: "blocked_domain",
        reason: `blocked publisher domain: ${blocked}`,
      };
    }
    const approved = isApprovedDataHost(srcLower);
    if (approved) {
      return { decision: "allowed", reason: `approved domain: ${approved}` };
    }
    return {
      decision: "blocked_domain",
      reason: `domain not in allowlist: ${source}`,
    };
  }

  return {
    decision: "blocked_handle",
    reason: `handle not in allowlist: ${source}`,
  };
}
