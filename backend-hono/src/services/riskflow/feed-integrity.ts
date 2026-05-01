// [claude-code 2026-04-30] S55: Read-time feed integrity guard. Reusable at
// feed read boundary, write boundary, scorer boundary, and bulk purge/audit.
// Ensures blocked publisher URLs never render in the feed regardless of whether
// earlier pipeline stages (normalizeSource, persist, central-scorer) slipped.
//
// Trust model:
//   source bucket: display grouping (Wire, Econ, OSINT, Polymarket)
//   publisher/provenance: actual origin (host, handle)
//   ingest pipeline: transport path
//   print status: scheduled, provisional, confirmed, corrected, missed

import { BLOCKED_HOST_LIST } from "./publisher-blocklist.js";

export interface IntegrityHostCheck {
  url?: string | null;
  source?: string | null;
}

export interface IntegrityBlockResult {
  blocked: boolean;
  reason: string | null;
  blockedHost: string | null;
}

function extractHost(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function hostMatches(host: string, blocked: string): boolean {
  return host === blocked || host.endsWith("." + blocked);
}

export function checkReadTimeIntegrity(
  item: IntegrityHostCheck,
): IntegrityBlockResult {
  const host = extractHost(item.url);
  if (!host) return { blocked: false, reason: null, blockedHost: null };

  for (const blocked of BLOCKED_HOST_LIST) {
    if (hostMatches(host, blocked)) {
      return {
        blocked: true,
        reason: `blocked publisher host: ${blocked}`,
        blockedHost: blocked,
      };
    }
  }

  return { blocked: false, reason: null, blockedHost: null };
}

export function filterBlockedAtReadTime<T extends IntegrityHostCheck>(
  items: T[],
): { clean: T[]; dropped: number; blockedHosts: string[] } {
  const clean: T[] = [];
  let dropped = 0;
  const blockedHosts = new Set<string>();

  for (const item of items) {
    const result = checkReadTimeIntegrity(item);
    if (result.blocked) {
      dropped++;
      if (result.blockedHost) blockedHosts.add(result.blockedHost);
    } else {
      clean.push(item);
    }
  }

  return { clean, dropped, blockedHosts: Array.from(blockedHosts) };
}

export const blockedPublisherHosts = BLOCKED_HOST_LIST;
