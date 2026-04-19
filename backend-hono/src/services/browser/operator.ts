// [claude-code 2026-04-19] S27-T6 (W2d): Harper Browser Operator — browseTask()
// with Supabase-backed action cache. Cache hit = zero-LLM XPath replay. Cache
// miss = LLM-driven extraction (OpenRouter Haiku) capped by budget_usd. Logs
// every run to browse_task_runs for cache-hit-rate surfacing on /api/diagnostics.

import { createHash } from "node:crypto";
import type { Page } from "playwright";
import { z, type ZodSchema } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import { acquirePage } from "./pool.js";
import {
  findAllowlistEntry,
  hasQuotaRemaining,
  hostname,
  incrementQuota,
} from "./allowlist.js";

const log = createLogger("BrowserOperator");

// ── Constants ─────────────────────────────────────────────────────────────

const DEFAULT_BUDGET_USD = 0.1;
const DEFAULT_USE_CACHE = true;
const REPLAY_FAILURE_THRESHOLD = 3;
const STALE_EVICTION_DAYS = 30;
const NAV_TIMEOUT_MS = 30_000;
const TEXT_TRUNCATE = 6_000;

// Haiku pricing (claude-haiku-4-5): used for cache-miss extraction only.
const HAIKU_IN_PER_MTOK = 1.0;
const HAIKU_OUT_PER_MTOK = 5.0;

// ── Types ─────────────────────────────────────────────────────────────────

export type ExtractFieldMap = Record<string, string>;

export interface BrowseTaskOpts {
  url: string;
  objective: string;
  extract_schema?: ZodSchema<unknown>;
  extract_fields?: ExtractFieldMap;
  budget_usd?: number;
  use_cache?: boolean;
}

export interface BrowseTaskAction {
  action: "navigate" | "click" | "fill" | "waitFor" | "extract";
  xpath?: string;
  value?: string;
  waitFor?: string;
}

export interface BrowseTaskResult {
  success: boolean;
  cache_hit: boolean;
  url: string;
  objective: string;
  extracted_data?: unknown;
  body_preview?: string;
  cost_usd: number;
  duration_ms: number;
  failure_reason?: string;
  error_code?: "URL_NOT_ALLOWED" | "BUDGET_EXCEEDED" | "REPLAY_FAILED" | "LLM_UNAVAILABLE" | "NAV_FAILED";
  allowed_domain_suggestion?: string;
}

// ── Cache key + hashing ───────────────────────────────────────────────────

function schemaHash(
  schema: ZodSchema<unknown> | undefined,
  fields: ExtractFieldMap | undefined,
): string | null {
  if (!schema && !fields) return null;
  const source = fields
    ? JSON.stringify(Object.keys(fields).sort().map((k) => [k, fields[k]]))
    : (schema as unknown as { _def?: unknown })?._def
      ? JSON.stringify((schema as unknown as { _def: unknown })._def).slice(0, 2000)
      : "schema";
  return createHash("sha256").update(source).digest("hex").slice(0, 16);
}

function makeCacheKey(
  url: string,
  objective: string,
  schema: string | null,
): string {
  const input = `${url}::${objective.trim().toLowerCase()}::${schema ?? ""}`;
  return createHash("sha256").update(input).digest("hex");
}

// ── Allow-list gate (universal mode is permitted; allowlist still fast-path) ──

function checkAllowlist(url: string): { allowed: boolean; suggestion?: string } {
  if (process.env.BROWSER_UNIVERSAL_ENABLED === "true") {
    return { allowed: true };
  }
  const entry = findAllowlistEntry(url);
  if (entry) return { allowed: true };
  // Not on allow list + universal mode off. Suggest the nearest allowed news/regulator.
  return { allowed: false, suggestion: "sec.gov" };
}

// ── Cache lookup + maintenance ────────────────────────────────────────────

interface ActionCacheRow {
  cache_key: string;
  url: string;
  objective: string;
  schema_hash: string | null;
  xpath_sequence: BrowseTaskAction[];
  extracted_data: unknown;
  success_count: number;
  failure_count: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  updated_at: string;
}

async function readCache(key: string): Promise<ActionCacheRow | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("action_cache")
    .select("*")
    .eq("cache_key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ActionCacheRow;
}

function isStale(row: ActionCacheRow): boolean {
  // 3 consecutive failures since last success → stale.
  if (row.failure_count >= REPLAY_FAILURE_THRESHOLD) {
    if (!row.last_success_at) return true;
    if (row.last_failure_at && row.last_failure_at > row.last_success_at) {
      return true;
    }
  }
  // 30 days with no success → auto-evict.
  if (row.last_success_at) {
    const ageMs = Date.now() - new Date(row.last_success_at).getTime();
    if (ageMs > STALE_EVICTION_DAYS * 24 * 60 * 60_000) return true;
  }
  return false;
}

async function evictStale(key: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  await sb.from("action_cache").delete().eq("cache_key", key);
  log.info("evicted stale cache entry", { cache_key: key.slice(0, 12) });
}

async function persistSuccess(
  key: string,
  opts: BrowseTaskOpts,
  sequence: BrowseTaskAction[],
  extracted: unknown,
  schema: string | null,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("action_cache").upsert(
      {
        cache_key: key,
        url: opts.url,
        objective: opts.objective,
        schema_hash: schema,
        xpath_sequence: sequence,
        extracted_data: extracted ?? null,
        success_count: 1,
        failure_count: 0,
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key", ignoreDuplicates: false },
    );
  } catch (err) {
    log.warn("action_cache upsert failed", { error: String(err) });
  }
}

async function persistReplayFailure(key: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    const { data } = await sb
      .from("action_cache")
      .select("failure_count")
      .eq("cache_key", key)
      .maybeSingle();
    const next = ((data?.failure_count as number | undefined) ?? 0) + 1;
    await sb
      .from("action_cache")
      .update({
        failure_count: next,
        last_failure_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("cache_key", key);
  } catch (err) {
    log.warn("action_cache failure update failed", { error: String(err) });
  }
}

async function recordRun(row: {
  cache_key: string;
  cache_hit: boolean;
  url: string;
  objective: string;
  cost_usd: number;
  duration_ms: number;
  success: boolean;
  failure_reason?: string;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("browse_task_runs").insert({
      cache_key: row.cache_key,
      cache_hit: row.cache_hit,
      url: row.url,
      objective: row.objective,
      cost_usd: row.cost_usd,
      duration_ms: row.duration_ms,
      success: row.success,
      failure_reason: row.failure_reason ?? null,
    });
  } catch (err) {
    log.warn("browse_task_runs insert failed", { error: String(err) });
  }
}

// ── Replay (zero-LLM cache hit) ───────────────────────────────────────────

async function replayAction(page: Page, action: BrowseTaskAction): Promise<void> {
  switch (action.action) {
    case "navigate": {
      const target = action.value ?? action.xpath ?? "";
      if (!target) throw new Error("navigate action missing target");
      await page.goto(target, { timeout: NAV_TIMEOUT_MS, waitUntil: "domcontentloaded" });
      return;
    }
    case "click": {
      if (!action.xpath) throw new Error("click missing xpath");
      await page.locator(`xpath=${action.xpath}`).click({ timeout: 10_000 });
      return;
    }
    case "fill": {
      if (!action.xpath) throw new Error("fill missing xpath");
      await page
        .locator(`xpath=${action.xpath}`)
        .fill(action.value ?? "", { timeout: 10_000 });
      return;
    }
    case "waitFor": {
      const selector = action.waitFor ?? action.xpath;
      if (selector) {
        await page.waitForSelector(selector, { timeout: 10_000 }).catch(() => {});
      } else {
        await page
          .waitForLoadState("domcontentloaded", { timeout: 8_000 })
          .catch(() => {});
      }
      return;
    }
    case "extract":
      return;
    default:
      throw new Error(`unknown action: ${(action as { action: string }).action}`);
  }
}

async function replaySequence(
  page: Page,
  sequence: BrowseTaskAction[],
): Promise<void> {
  for (const action of sequence) {
    await replayAction(page, action);
  }
}

// ── LLM extraction (cache-miss path) ──────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function promptForExtract(
  objective: string,
  url: string,
  fields: ExtractFieldMap | undefined,
  bodyText: string,
): string {
  const shape =
    fields && Object.keys(fields).length > 0
      ? `Return JSON matching this field map (keys are the JSON keys, values describe what to capture):\n${JSON.stringify(fields, null, 2)}`
      : `Return a compact JSON object summarising the relevant information.`;
  return `You are a deterministic web-page extractor.

URL: ${url}
Objective: ${objective}

${shape}

Only output raw JSON — no prose, no markdown fences.

--- PAGE BODY (truncated) ---
${bodyText.slice(0, TEXT_TRUNCATE)}`;
}

interface LlmExtractionOutcome {
  data: unknown;
  cost_usd: number;
}

async function runLlmExtraction(
  opts: BrowseTaskOpts,
  bodyText: string,
  budget: number,
): Promise<LlmExtractionOutcome> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OperatorLlmUnavailableError("OPENROUTER_API_KEY not set");
  }

  const prompt = promptForExtract(
    opts.objective,
    opts.url,
    opts.extract_fields,
    bodyText,
  );

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = json.choices?.[0]?.message?.content ?? "";
  const input_tokens = json.usage?.prompt_tokens ?? Math.ceil(prompt.length / 4);
  const output_tokens = json.usage?.completion_tokens ?? Math.ceil(content.length / 4);
  const cost_usd = Number(
    ((input_tokens / 1_000_000) * HAIKU_IN_PER_MTOK +
      (output_tokens / 1_000_000) * HAIKU_OUT_PER_MTOK).toFixed(6),
  );

  if (cost_usd > budget) {
    throw new OperatorBudgetExceededError(opts.url, budget, cost_usd);
  }

  let data: unknown = null;
  try {
    const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    data = JSON.parse(stripped);
  } catch {
    data = { raw: content };
  }

  if (opts.extract_schema) {
    const parsed = opts.extract_schema.safeParse(data);
    if (!parsed.success) {
      data = { ...(data as Record<string, unknown>), _schema_errors: parsed.error.issues };
    } else {
      data = parsed.data;
    }
  }

  return { data, cost_usd };
}

// ── Errors ────────────────────────────────────────────────────────────────

export class OperatorBudgetExceededError extends Error {
  code = "BUDGET_EXCEEDED" as const;
  constructor(url: string, cap: number, spend: number) {
    super(`Budget $${cap.toFixed(4)} exceeded for ${url} (spent $${spend.toFixed(4)})`);
  }
}

export class OperatorLlmUnavailableError extends Error {
  code = "LLM_UNAVAILABLE" as const;
  constructor(reason: string) {
    super(`LLM extractor unavailable: ${reason}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function browseTask(opts: BrowseTaskOpts): Promise<BrowseTaskResult> {
  const started = Date.now();
  const budget = opts.budget_usd ?? DEFAULT_BUDGET_USD;
  const useCache = opts.use_cache !== false && DEFAULT_USE_CACHE;
  const domain = hostname(opts.url);

  if (!domain) {
    return {
      success: false,
      cache_hit: false,
      url: opts.url,
      objective: opts.objective,
      cost_usd: 0,
      duration_ms: 0,
      failure_reason: "invalid url",
      error_code: "NAV_FAILED",
    };
  }

  const gate = checkAllowlist(opts.url);
  if (!gate.allowed) {
    const result: BrowseTaskResult = {
      success: false,
      cache_hit: false,
      url: opts.url,
      objective: opts.objective,
      cost_usd: 0,
      duration_ms: Date.now() - started,
      failure_reason: "URL outside allow-list and BROWSER_UNIVERSAL_ENABLED=false",
      error_code: "URL_NOT_ALLOWED",
      allowed_domain_suggestion: gate.suggestion,
    };
    return result;
  }

  const allowEntry = findAllowlistEntry(opts.url);
  if (allowEntry && !(await hasQuotaRemaining(opts.url))) {
    return {
      success: false,
      cache_hit: false,
      url: opts.url,
      objective: opts.objective,
      cost_usd: 0,
      duration_ms: Date.now() - started,
      failure_reason: `daily quota exhausted for ${allowEntry.domain}`,
      error_code: "NAV_FAILED",
    };
  }

  const schemaKey = schemaHash(opts.extract_schema, opts.extract_fields);
  const cacheKey = makeCacheKey(opts.url, opts.objective, schemaKey);

  let cached: ActionCacheRow | null = null;
  if (useCache) {
    cached = await readCache(cacheKey);
    if (cached && isStale(cached)) {
      await evictStale(cacheKey);
      cached = null;
    }
  }

  // ── Cache-hit replay (zero-LLM) ─────────────────────────────────────────
  if (cached) {
    const handle = await acquirePage();
    try {
      await replaySequence(handle.page, cached.xpath_sequence);
      const result: BrowseTaskResult = {
        success: true,
        cache_hit: true,
        url: opts.url,
        objective: opts.objective,
        extracted_data: cached.extracted_data ?? undefined,
        cost_usd: 0,
        duration_ms: Date.now() - started,
      };
      if (allowEntry) await incrementQuota(opts.url);
      await recordRun({
        cache_key: cacheKey,
        cache_hit: true,
        url: opts.url,
        objective: opts.objective,
        cost_usd: 0,
        duration_ms: result.duration_ms,
        success: true,
      });
      return result;
    } catch (err) {
      await persistReplayFailure(cacheKey);
      log.warn("replay failed — falling back to LLM path", {
        cache_key: cacheKey.slice(0, 12),
        error: String(err),
      });
      cached = null;
    } finally {
      await handle.release();
    }
  }

  // ── Cache-miss: navigate + LLM-driven extraction ───────────────────────
  const handle = await acquirePage();
  let failure: string | undefined;
  let errorCode: BrowseTaskResult["error_code"];
  let cost_usd = 0;
  let extracted: unknown;
  let sequence: BrowseTaskAction[] = [
    { action: "navigate", value: opts.url },
    { action: "waitFor" },
    { action: "extract" },
  ];
  let success = false;
  let bodyPreview: string | undefined;

  try {
    const response = await handle.page.goto(opts.url, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    const status = response?.status() ?? 0;
    if (status === 0 || status >= 500 || status === 403 || status === 429) {
      throw new Error(`HTTP ${status}`);
    }
    await handle.page.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => {});
    const rawHtml = await handle.page.content();
    const body = stripHtml(rawHtml);
    bodyPreview = body.slice(0, 400);

    if (opts.extract_schema || opts.extract_fields) {
      const outcome = await runLlmExtraction(opts, body, budget);
      cost_usd = outcome.cost_usd;
      extracted = outcome.data;
    } else {
      extracted = { title: await handle.page.title().catch(() => ""), body_preview: bodyPreview };
    }

    if (allowEntry) await incrementQuota(opts.url);
    success = true;

    await persistSuccess(cacheKey, opts, sequence, extracted, schemaKey);
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
    if (err instanceof OperatorBudgetExceededError) {
      errorCode = "BUDGET_EXCEEDED";
      cost_usd = budget; // hard cap so downstream budgeting stays honest
    } else if (err instanceof OperatorLlmUnavailableError) {
      errorCode = "LLM_UNAVAILABLE";
    } else {
      errorCode = "NAV_FAILED";
    }
  } finally {
    await handle.release();
  }

  const result: BrowseTaskResult = {
    success,
    cache_hit: false,
    url: opts.url,
    objective: opts.objective,
    extracted_data: extracted,
    body_preview: bodyPreview,
    cost_usd,
    duration_ms: Date.now() - started,
    failure_reason: failure,
    error_code: errorCode,
  };

  await recordRun({
    cache_key: cacheKey,
    cache_hit: false,
    url: opts.url,
    objective: opts.objective,
    cost_usd,
    duration_ms: result.duration_ms,
    success,
    failure_reason: failure,
  });

  return result;
}

// ── MCP tool schema (consumed by Harper MCP bridge) ───────────────────────

export const BROWSE_TASK_TOOL_SCHEMA = {
  name: "browse_task",
  description:
    "Navigate a webpage and complete a task (read, extract, interact). Uses cached XPath replays for zero LLM cost when available. Max budget $0.10 per task (override with budget_usd).",
  input_schema: {
    type: "object" as const,
    required: ["url", "objective"] as const,
    properties: {
      url: { type: "string", description: "Full URL to navigate to" },
      objective: {
        type: "string",
        description: "Natural-language task in 1-2 sentences",
      },
      extract_fields: {
        type: "object",
        description:
          "Optional field map for structured extraction. Keys become JSON keys; values describe what to capture.",
        additionalProperties: { type: "string" },
      },
      budget_usd: {
        type: "number",
        description: "Max spend for this task (default 0.10). Hard cap.",
      },
      use_cache: {
        type: "boolean",
        description: "Prefer cached XPath replay when available (default true).",
      },
    },
  },
} as const;

export const BrowseTaskInputSchema = z.object({
  url: z.string().url(),
  objective: z.string().min(1).max(2000),
  extract_fields: z.record(z.string(), z.string()).optional(),
  budget_usd: z.number().positive().max(5).optional(),
  use_cache: z.boolean().optional(),
});

export type BrowseTaskInput = z.infer<typeof BrowseTaskInputSchema>;

// ── Cache-hit rate (for diagnostics) ──────────────────────────────────────

export async function getBrowseTaskStats24h(): Promise<{
  runs_24h: number;
  hits_24h: number;
  cache_hit_rate_24h: number;
  cost_usd_24h: number;
}> {
  const sb = getSupabaseClient();
  if (!sb) {
    return { runs_24h: 0, hits_24h: 0, cache_hit_rate_24h: 0, cost_usd_24h: 0 };
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  try {
    const { data, error } = await sb
      .from("browse_task_runs")
      .select("cache_hit, cost_usd")
      .gte("created_at", cutoff);
    if (error || !data) {
      return { runs_24h: 0, hits_24h: 0, cache_hit_rate_24h: 0, cost_usd_24h: 0 };
    }
    const runs = data.length;
    const hits = data.filter((r) => (r as { cache_hit?: boolean }).cache_hit).length;
    const cost = data.reduce(
      (sum, r) => sum + Number((r as { cost_usd?: number }).cost_usd ?? 0),
      0,
    );
    return {
      runs_24h: runs,
      hits_24h: hits,
      cache_hit_rate_24h: runs > 0 ? Number((hits / runs).toFixed(3)) : 0,
      cost_usd_24h: Number(cost.toFixed(4)),
    };
  } catch {
    return { runs_24h: 0, hits_24h: 0, cache_hit_rate_24h: 0, cost_usd_24h: 0 };
  }
}
