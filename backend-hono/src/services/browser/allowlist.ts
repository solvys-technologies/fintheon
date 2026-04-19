// [claude-code 2026-04-19] S27-T4 (W1c): tiered allow-list with per-domain daily quotas.
// Mirrored to browser_quota_ledger so counts survive restarts. UTC midnight reset.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("BrowserAllowlist");

export type BrowserAllowTier = "regulatory" | "market" | "social" | "news";

export interface BrowserAllowlistEntry {
  domain: string;
  tier: BrowserAllowTier;
  dailyQuota: number;
}

export const BROWSER_ALLOWLIST: BrowserAllowlistEntry[] = [
  { domain: "sec.gov", tier: "regulatory", dailyQuota: 200 },
  { domain: "federalreserve.gov", tier: "regulatory", dailyQuota: 50 },
  { domain: "bls.gov", tier: "regulatory", dailyQuota: 50 },
  { domain: "treasury.gov", tier: "regulatory", dailyQuota: 50 },
  { domain: "polymarket.com", tier: "market", dailyQuota: 100 },
  { domain: "kalshi.com", tier: "market", dailyQuota: 100 },
  { domain: "x.com", tier: "social", dailyQuota: 500 },
  { domain: "twitter.com", tier: "social", dailyQuota: 500 },
  { domain: "reuters.com", tier: "news", dailyQuota: 200 },
  { domain: "bloomberg.com", tier: "news", dailyQuota: 100 },
  { domain: "wsj.com", tier: "news", dailyQuota: 100 },
  { domain: "ft.com", tier: "news", dailyQuota: 100 },
];

const allowlistByDomain = new Map(BROWSER_ALLOWLIST.map((e) => [e.domain, e]));

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function findAllowlistEntry(url: string): BrowserAllowlistEntry | null {
  const host = hostname(url);
  if (!host) return null;
  // direct match
  const direct = allowlistByDomain.get(host);
  if (direct) return direct;
  // suffix match (subdomains)
  for (const entry of BROWSER_ALLOWLIST) {
    if (host === entry.domain || host.endsWith(`.${entry.domain}`)) {
      return entry;
    }
  }
  return null;
}

interface QuotaCounter {
  day: string; // YYYY-MM-DD UTC
  count: number;
}

const inMemoryQuota = new Map<string, QuotaCounter>();
let ledgerHydrated = false;

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function hydrateFromLedger(): Promise<void> {
  if (ledgerHydrated) return;
  ledgerHydrated = true;
  const sb = getSupabaseClient();
  if (!sb) return;
  const day = todayKey();
  try {
    const { data, error } = await sb
      .from("browser_quota_ledger")
      .select("domain, fetches")
      .eq("day", day);
    if (error || !data) return;
    for (const row of data as Array<{ domain: string; fetches: number }>) {
      inMemoryQuota.set(row.domain, { day, count: row.fetches ?? 0 });
    }
    log.info("Quota ledger hydrated", { day, rows: data.length });
  } catch (err) {
    log.warn("Ledger hydrate failed (continuing with in-memory)", {
      error: String(err),
    });
  }
}

function getCounter(domain: string): QuotaCounter {
  const today = todayKey();
  let counter = inMemoryQuota.get(domain);
  if (!counter || counter.day !== today) {
    counter = { day: today, count: 0 };
    inMemoryQuota.set(domain, counter);
  }
  return counter;
}

export async function hasQuotaRemaining(url: string): Promise<boolean> {
  const entry = findAllowlistEntry(url);
  if (!entry) return false;
  await hydrateFromLedger();
  const counter = getCounter(entry.domain);
  return counter.count < entry.dailyQuota;
}

export async function incrementQuota(url: string): Promise<void> {
  const entry = findAllowlistEntry(url);
  if (!entry) return;
  await hydrateFromLedger();
  const counter = getCounter(entry.domain);
  counter.count += 1;

  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb
      .from("browser_quota_ledger")
      .upsert(
        { domain: entry.domain, day: counter.day, fetches: counter.count },
        { onConflict: "domain,day" },
      );
  } catch (err) {
    log.warn("Quota ledger upsert failed (in-memory still incremented)", {
      domain: entry.domain,
      error: String(err),
    });
  }
}

export async function getQuotaSnapshot(): Promise<
  Array<{ domain: string; tier: BrowserAllowTier; used: number; quota: number }>
> {
  await hydrateFromLedger();
  return BROWSER_ALLOWLIST.map((entry) => {
    const counter = getCounter(entry.domain);
    return {
      domain: entry.domain,
      tier: entry.tier,
      used: counter.count,
      quota: entry.dailyQuota,
    };
  });
}
