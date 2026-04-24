// [claude-code 2026-04-23] S32-T8 browser_harness — Harper-callable wrapper
// around the shared Playwright pool. Exposes search/open/read/click/fill/
// screenshot/close. Rate-limited to 20 actions per minute per user and logs
// every invocation to browser_harness_audit so we can replay what Harper did.

import type { Page } from "playwright";
import { acquirePage } from "./pool.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("BrowserHarness");

const RATE_LIMIT_PER_MIN = 20;
const RATE_WINDOW_MS = 60_000;

type HarnessAction =
  | "search"
  | "open"
  | "read"
  | "click"
  | "fill"
  | "screenshot"
  | "close";

export interface BrowserHarnessInput {
  action: HarnessAction;
  query?: string;
  url?: string;
  selector?: string;
  text?: string;
}

export interface BrowserHarnessResult {
  ok: boolean;
  action: HarnessAction;
  data?: unknown;
  error?: string;
  rate_limited?: boolean;
  duration_ms: number;
}

// ── Rate limiting ──────────────────────────────────────────────────────────

const windowsByUser = new Map<string, number[]>();

export function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const window = (windowsByUser.get(userId) ?? []).filter(
    (ts) => now - ts < RATE_WINDOW_MS,
  );
  if (window.length >= RATE_LIMIT_PER_MIN) {
    windowsByUser.set(userId, window);
    return true;
  }
  window.push(now);
  windowsByUser.set(userId, window);
  return false;
}

// ── Per-user page handles ──────────────────────────────────────────────────
// Each user gets a single long-lived page + release handle so click/fill can
// operate against the same page that `open` navigated to. Stored in memory;
// cleared on `close`.

interface PageHandle {
  page: Page;
  release: () => Promise<void>;
}

const pagesByUser = new Map<string, PageHandle>();

async function getOrOpenPage(userId: string): Promise<PageHandle> {
  const existing = pagesByUser.get(userId);
  if (existing) return existing;
  const handle = await acquirePage();
  pagesByUser.set(userId, handle);
  return handle;
}

async function releasePage(userId: string): Promise<void> {
  const existing = pagesByUser.get(userId);
  if (!existing) return;
  pagesByUser.delete(userId);
  try {
    await existing.release();
  } catch {
    /* already released */
  }
}

// ── Audit ──────────────────────────────────────────────────────────────────

async function writeAudit(row: {
  userId: string;
  tool: string;
  input: unknown;
  result_summary: string;
  duration_ms: number;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("browser_harness_audit").insert({
      user_id: row.userId,
      tool: row.tool,
      input: row.input,
      result_summary: row.result_summary.slice(0, 2000),
      duration_ms: row.duration_ms,
    });
  } catch (err) {
    log.warn("audit insert failed", { error: String(err) });
  }
}

// ── Action handlers ────────────────────────────────────────────────────────

function buildSearchUrl(q: string): string {
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

async function doOpen(page: Page, url: string): Promise<unknown> {
  const resp = await page.goto(url, {
    timeout: 30_000,
    waitUntil: "domcontentloaded",
  });
  return {
    url,
    status: resp?.status() ?? 0,
    title: await page.title().catch(() => ""),
  };
}

async function doRead(page: Page, selector?: string): Promise<unknown> {
  const loc = selector ? page.locator(selector) : page.locator("body");
  const count = await loc.count().catch(() => 0);
  if (count === 0) return { text: "", matched: 0 };
  const text = await loc
    .first()
    .innerText({ timeout: 5_000 })
    .catch(() => "");
  return {
    text: text.slice(0, 6_000),
    matched: count,
    truncated: text.length > 6_000,
  };
}

async function doClick(page: Page, selector: string): Promise<unknown> {
  await page.locator(selector).click({ timeout: 10_000 });
  return { clicked: selector, url: page.url() };
}

async function doFill(
  page: Page,
  selector: string,
  value: string,
): Promise<unknown> {
  await page.locator(selector).fill(value, { timeout: 10_000 });
  return { filled: selector, length: value.length };
}

async function doScreenshot(page: Page): Promise<unknown> {
  const buf = await page.screenshot({ type: "png", fullPage: false });
  return {
    url: page.url(),
    bytes: buf.length,
    data_url: `data:image/png;base64,${buf.toString("base64").slice(0, 500_000)}`,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function browserHarness(
  userId: string,
  input: BrowserHarnessInput,
): Promise<BrowserHarnessResult> {
  const started = Date.now();

  if (isRateLimited(userId)) {
    return {
      ok: false,
      action: input.action,
      error: `Rate limit exceeded: max ${RATE_LIMIT_PER_MIN} actions per minute`,
      rate_limited: true,
      duration_ms: 0,
    };
  }

  try {
    let data: unknown;

    switch (input.action) {
      case "search": {
        if (!input.query) throw new Error("search requires { query }");
        const handle = await getOrOpenPage(userId);
        data = await doOpen(handle.page, buildSearchUrl(input.query));
        break;
      }
      case "open": {
        if (!input.url) throw new Error("open requires { url }");
        const handle = await getOrOpenPage(userId);
        data = await doOpen(handle.page, input.url);
        break;
      }
      case "read": {
        const handle = pagesByUser.get(userId);
        if (!handle) throw new Error("no open page — call open() first");
        data = await doRead(handle.page, input.selector);
        break;
      }
      case "click": {
        if (!input.selector) throw new Error("click requires { selector }");
        const handle = pagesByUser.get(userId);
        if (!handle) throw new Error("no open page — call open() first");
        data = await doClick(handle.page, input.selector);
        break;
      }
      case "fill": {
        if (!input.selector || typeof input.text !== "string") {
          throw new Error("fill requires { selector, text }");
        }
        const handle = pagesByUser.get(userId);
        if (!handle) throw new Error("no open page — call open() first");
        data = await doFill(handle.page, input.selector, input.text);
        break;
      }
      case "screenshot": {
        const handle = pagesByUser.get(userId);
        if (!handle) throw new Error("no open page — call open() first");
        data = await doScreenshot(handle.page);
        break;
      }
      case "close": {
        await releasePage(userId);
        data = { closed: true };
        break;
      }
      default: {
        const exhaustive: never = input.action;
        throw new Error(
          `unknown browser_harness action: ${String(exhaustive)}`,
        );
      }
    }

    const duration_ms = Date.now() - started;
    const summary = summarise(input.action, data);
    void writeAudit({
      userId,
      tool: input.action,
      input: sanitiseInput(input),
      result_summary: summary,
      duration_ms,
    });

    return { ok: true, action: input.action, data, duration_ms };
  } catch (err) {
    const duration_ms = Date.now() - started;
    const error = err instanceof Error ? err.message : String(err);
    void writeAudit({
      userId,
      tool: input.action,
      input: sanitiseInput(input),
      result_summary: `error: ${error}`,
      duration_ms,
    });
    return { ok: false, action: input.action, error, duration_ms };
  }
}

function sanitiseInput(input: BrowserHarnessInput): Record<string, unknown> {
  const out: Record<string, unknown> = { action: input.action };
  if (input.url) out.url = input.url.slice(0, 512);
  if (input.query) out.query = input.query.slice(0, 256);
  if (input.selector) out.selector = input.selector.slice(0, 256);
  if (typeof input.text === "string") out.text_length = input.text.length;
  return out;
}

function summarise(action: HarnessAction, data: unknown): string {
  if (!data || typeof data !== "object") return `${action}: ok`;
  const d = data as Record<string, unknown>;
  switch (action) {
    case "search":
    case "open":
      return `${d.status ?? "?"} ${String(d.url ?? "")} — ${String(d.title ?? "")}`.slice(
        0,
        500,
      );
    case "read":
      return `matched=${d.matched ?? 0} chars=${String((d.text as string | undefined)?.length ?? 0)}`;
    case "click":
      return `clicked ${String(d.clicked ?? "")} → ${String(d.url ?? "")}`.slice(
        0,
        500,
      );
    case "fill":
      return `filled ${String(d.filled ?? "")} (${d.length ?? 0} chars)`;
    case "screenshot":
      return `shot ${d.bytes ?? 0}B`;
    case "close":
      return "page closed";
    default:
      return `${action}: ok`;
  }
}

// ── Diagnostics ─────────────────────────────────────────────────────────────

export async function getBrowserHarnessStats24h(): Promise<{
  calls_24h: number;
  errors_24h: number;
  rate_limit_per_min: number;
}> {
  const sb = getSupabaseClient();
  if (!sb) {
    return {
      calls_24h: 0,
      errors_24h: 0,
      rate_limit_per_min: RATE_LIMIT_PER_MIN,
    };
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  try {
    const { data, error } = await sb
      .from("browser_harness_audit")
      .select("result_summary")
      .gte("ts", cutoff);
    if (error || !data) {
      return {
        calls_24h: 0,
        errors_24h: 0,
        rate_limit_per_min: RATE_LIMIT_PER_MIN,
      };
    }
    const calls = data.length;
    const errors = data.filter((r) =>
      String(
        (r as { result_summary?: string }).result_summary ?? "",
      ).startsWith("error:"),
    ).length;
    return {
      calls_24h: calls,
      errors_24h: errors,
      rate_limit_per_min: RATE_LIMIT_PER_MIN,
    };
  } catch {
    return {
      calls_24h: 0,
      errors_24h: 0,
      rate_limit_per_min: RATE_LIMIT_PER_MIN,
    };
  }
}
