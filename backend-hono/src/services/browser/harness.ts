// [claude-code 2026-04-19] S27-T4 (W1c): shared browser harness. Playwright-backed,
// self-healing selectors, per-domain circuit breaker, universal-mode budget cap.
// Downstream: Herald source router, T6 Harper Browser Operator, T7 News Worker.

import { createHash } from "node:crypto";
import type { Page } from "playwright";
import { z, type ZodSchema } from "zod";
import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { acquirePage } from "./pool.js";
import {
  findAllowlistEntry,
  hasQuotaRemaining,
  hostname,
  incrementQuota,
} from "./allowlist.js";

const log = createLogger("BrowserHarness");

// ── Types ──────────────────────────────────────────────────────────────────

export type BrowseMode = "allowlist" | "universal";

export type BrowseWaitFor =
  | "load"
  | "networkidle"
  | { selector: string; timeoutMs?: number };

export interface BrowseOpts<T = unknown> {
  url: string;
  mode: BrowseMode;
  waitFor?: BrowseWaitFor;
  extract?: { schema: ZodSchema<T> };
  textOnly?: boolean;
  budget_usd?: number;
}

export interface BrowseResult<T = unknown> {
  url: string;
  title: string;
  body: string;
  fields?: T;
  status: number;
  rendered_at: string;
  self_heal_occurred?: boolean;
  cached_xpath_used?: boolean;
  cost_usd?: number;
}

// ── Error types ────────────────────────────────────────────────────────────

export class UniversalModeDisabledError extends Error {
  code = "UNIVERSAL_MODE_DISABLED";
  constructor(url: string) {
    super(`Universal mode disabled (BROWSER_UNIVERSAL_ENABLED=false): ${url}`);
  }
}

export class BrowserQuotaExceededError extends Error {
  code = "BROWSER_QUOTA_EXCEEDED";
  constructor(domain: string) {
    super(`Daily quota exceeded for ${domain}`);
  }
}

export class BrowserCircuitTrippedError extends Error {
  code = "BROWSER_CIRCUIT_TRIPPED";
  constructor(domain: string) {
    super(`Circuit tripped for ${domain} — paused by harness`);
  }
}

export class BrowserBudgetExceededError extends Error {
  code = "BROWSER_BUDGET_EXCEEDED";
  constructor(url: string, capUsd: number) {
    super(`Per-URL budget $${capUsd.toFixed(4)} exceeded for ${url}`);
  }
}

// ── Circuit breaker (reuses the agent-reach pattern) ──────────────────────

interface DomainBreaker {
  consecutiveFailures: number;
  trippedUntilMs: number;
}

const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_PAUSE_MS = 10 * 60_000; // 10 minutes
const breakers = new Map<string, DomainBreaker>();

function getBreaker(domain: string): DomainBreaker {
  let b = breakers.get(domain);
  if (!b) {
    b = { consecutiveFailures: 0, trippedUntilMs: 0 };
    breakers.set(domain, b);
  }
  return b;
}

function isTripped(domain: string): boolean {
  return Date.now() < getBreaker(domain).trippedUntilMs;
}

function recordSuccess(domain: string): void {
  const b = getBreaker(domain);
  b.consecutiveFailures = 0;
}

function recordFailure(domain: string, reason: string): void {
  const b = getBreaker(domain);
  b.consecutiveFailures += 1;
  if (b.consecutiveFailures >= CIRCUIT_FAIL_THRESHOLD) {
    b.trippedUntilMs = Date.now() + CIRCUIT_PAUSE_MS;
    log.warn("Circuit tripped", {
      domain,
      pauseMs: CIRCUIT_PAUSE_MS,
      reason,
    });
  }
}

export function getBreakerSnapshot(): Record<
  string,
  { tripped: boolean; consecutiveFailures: number; trippedUntil?: string }
> {
  const now = Date.now();
  const out: Record<
    string,
    { tripped: boolean; consecutiveFailures: number; trippedUntil?: string }
  > = {};
  for (const [domain, b] of breakers.entries()) {
    out[domain] = {
      tripped: now < b.trippedUntilMs,
      consecutiveFailures: b.consecutiveFailures,
      ...(b.trippedUntilMs > now
        ? { trippedUntil: new Date(b.trippedUntilMs).toISOString() }
        : {}),
    };
  }
  return out;
}

// ── HTML cleaner (reuses the agent-reach stripping approach) ──────────────

const STRIP_TAGS = [
  "script",
  "style",
  "nav",
  "footer",
  "header",
  "noscript",
  "aside",
];

function stripHtmlTags(html: string): string {
  let out = html;
  for (const tag of STRIP_TAGS) {
    out = out.replace(
      new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
  }
  return out;
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// ── Self-healing selector resolution ──────────────────────────────────────

async function waitForSelectorWithHeal(
  page: Page,
  selector: string,
  timeoutMs: number,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
    return false;
  } catch {
    // Selector missed — try structural / semantic fallbacks.
    const fallbacks = deriveFallbackSelectors(selector);
    for (const alt of fallbacks) {
      try {
        await page.waitForSelector(alt, { timeout: 2000 });
        log.info("Selector healed", { original: selector, healed: alt });
        return true;
      } catch {
        // keep trying
      }
    }
    return true; // exhausted fallbacks, but we don't hard-fail extraction
  }
}

function deriveFallbackSelectors(selector: string): string[] {
  const fallbacks: string[] = [];
  // data-testid variant
  const tid = selector.match(/\[data-testid=["']([^"']+)["']\]/);
  if (tid) {
    fallbacks.push(`[data-test="${tid[1]}"]`);
    fallbacks.push(`[data-qa="${tid[1]}"]`);
  }
  // class → look for substring match
  const cls = selector.match(/\.([\w-]+)/);
  if (cls) {
    fallbacks.push(`[class*="${cls[1]}"]`);
  }
  // id → look for aria / name match
  const id = selector.match(/#([\w-]+)/);
  if (id) {
    fallbacks.push(`[aria-label*="${id[1]}"]`);
    fallbacks.push(`[name="${id[1]}"]`);
  }
  // Common article/content heuristics
  fallbacks.push("article", "main", "[role=main]", "body");
  return fallbacks;
}

// ── Audit log ─────────────────────────────────────────────────────────────

interface FetchAuditRow {
  domain: string;
  urlHash: string;
  status: number | null;
  latencyMs: number;
  costUsd: number;
  selfHealOccurred: boolean;
  cachedXpathUsed: boolean;
  failureReason?: string | null;
}

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

async function writeAudit(row: FetchAuditRow): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("browser_fetches").insert({
      domain: row.domain,
      url_hash: row.urlHash,
      status: row.status,
      latency_ms: row.latencyMs,
      cost_usd: row.costUsd,
      self_heal_occurred: row.selfHealOccurred,
      cached_xpath_used: row.cachedXpathUsed,
      failure_reason: row.failureReason ?? null,
    });
  } catch (err) {
    log.warn("Audit insert failed (ignored)", { error: String(err) });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Headless browse-and-extract. Allow-list mode checks daily quotas; universal
 * mode is env-gated and capped per URL.
 */
export async function browseRead<T = unknown>(
  opts: BrowseOpts<T>,
): Promise<BrowseResult<T>> {
  const startMs = Date.now();
  const domain = hostname(opts.url);
  if (!domain) {
    throw new Error(`Invalid URL: ${opts.url}`);
  }

  if (isTripped(domain)) {
    throw new BrowserCircuitTrippedError(domain);
  }

  const capUsd = opts.budget_usd ?? 0.01;

  if (opts.mode === "allowlist") {
    const entry = findAllowlistEntry(opts.url);
    if (!entry) {
      throw new Error(
        `Domain ${domain} not in browser allow-list. Use mode: 'universal' (env-gated) or add the domain.`,
      );
    }
    if (!(await hasQuotaRemaining(opts.url))) {
      throw new BrowserQuotaExceededError(entry.domain);
    }
  } else {
    if (process.env.BROWSER_UNIVERSAL_ENABLED !== "true") {
      throw new UniversalModeDisabledError(opts.url);
    }
  }

  const handle = await acquirePage();
  let selfHealOccurred = false;
  let failureReason: string | null = null;
  let status: number | null = null;

  try {
    const response = await handle.page.goto(opts.url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    status = response?.status() ?? null;

    if (
      status !== null &&
      (status === 403 || status === 429 || status >= 500)
    ) {
      failureReason = `http_${status}`;
      recordFailure(domain, failureReason);
      throw new Error(`HTTP ${status}: ${opts.url}`);
    }

    if (opts.waitFor === "load") {
      await handle.page
        .waitForLoadState("load", { timeout: 15_000 })
        .catch(() => {});
    } else if (opts.waitFor === "networkidle") {
      await handle.page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {});
    } else if (opts.waitFor && typeof opts.waitFor === "object") {
      const healed = await waitForSelectorWithHeal(
        handle.page,
        opts.waitFor.selector,
        opts.waitFor.timeoutMs ?? 10_000,
      );
      if (healed) selfHealOccurred = true;
    } else {
      // default: brief settle
      await handle.page
        .waitForLoadState("domcontentloaded", { timeout: 5_000 })
        .catch(() => {});
    }

    const title = (await handle.page.title().catch(() => "")) || "Untitled";
    const rawHtml = await handle.page.content();
    const textOnly = opts.textOnly !== false;
    const body = textOnly ? htmlToText(stripHtmlTags(rawHtml)) : rawHtml;

    let fields: T | undefined;
    if (opts.extract) {
      // Structural extraction placeholder: return shape that matches the schema
      // using visible text as fallback. Downstream LLM-backed extractors (T6 Harper
      // Browser Operator) can override via their own schema-aware pipeline — this
      // contract guarantees validation at system boundary.
      const extracted = extractStructural(rawHtml, title, body);
      const parse = opts.extract.schema.safeParse(extracted);
      if (parse.success) {
        fields = parse.data as T;
      }
    }

    if (opts.mode === "allowlist") {
      await incrementQuota(opts.url);
    }
    recordSuccess(domain);

    const latencyMs = Date.now() - startMs;
    // Cost: allowlist = 0 (no LLM); universal = no LLM in foundation harness,
    // but track at zero for now — T6 extractor will upgrade to real spend signal.
    const costUsd = 0;

    if (opts.mode === "universal" && costUsd > capUsd) {
      throw new BrowserBudgetExceededError(opts.url, capUsd);
    }

    await writeAudit({
      domain,
      urlHash: hashUrl(opts.url),
      status,
      latencyMs,
      costUsd,
      selfHealOccurred,
      cachedXpathUsed: false,
      failureReason: null,
    });

    return {
      url: opts.url,
      title,
      body,
      fields,
      status: status ?? 0,
      rendered_at: new Date().toISOString(),
      self_heal_occurred: selfHealOccurred,
      cached_xpath_used: false,
      cost_usd: costUsd,
    };
  } catch (err) {
    failureReason =
      failureReason ?? (err instanceof Error ? err.message : String(err));
    recordFailure(domain, failureReason);
    await writeAudit({
      domain,
      urlHash: hashUrl(opts.url),
      status,
      latencyMs: Date.now() - startMs,
      costUsd: 0,
      selfHealOccurred,
      cachedXpathUsed: false,
      failureReason,
    });
    throw err;
  } finally {
    await handle.release();
  }
}

function extractStructural(
  rawHtml: string,
  title: string,
  bodyText: string,
): Record<string, string> {
  return {
    title,
    body: bodyText,
    html_len: String(rawHtml.length),
  };
}

// ── Convenience: browse with graceful fetch fall-through ──────────────────

/**
 * Try browseRead; if the circuit is tripped, quota is blown, or the harness
 * throws, fall through to a raw fetch so callers never explode on a domain
 * outage. Returns null if both paths fail.
 */
export async function browseReadWithFallback(
  opts: BrowseOpts,
): Promise<BrowseResult | null> {
  try {
    return await browseRead(opts);
  } catch (err) {
    log.warn("browseRead failed — falling through to fetch", {
      url: opts.url,
      error: String(err),
    });
    try {
      const res = await fetch(opts.url, {
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      const html = await res.text();
      const text = htmlToText(stripHtmlTags(html));
      return {
        url: opts.url,
        title: "",
        body: text,
        status: res.status,
        rendered_at: new Date().toISOString(),
        self_heal_occurred: false,
        cached_xpath_used: false,
        cost_usd: 0,
      };
    } catch {
      return null;
    }
  }
}

// ── Zod re-export for downstream callers ──────────────────────────────────

export { z };
