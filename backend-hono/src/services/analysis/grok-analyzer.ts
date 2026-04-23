/**
 * Grok Analyzer Service
 * Financial headline parsing and news analysis using Grok/AI models
 * Day 16 - Phase 5 Implementation
 */

import { invokeAgent } from "../strands/index.js";
import { parseHeadline } from "../headline-parser.js";
import { detectHotPrint } from "../hot-print-detector.js";
import type {
  ParsedHeadline,
  HotPrint,
  RawArticle,
  NewsSource,
} from "../../types/news-analysis.js";

const isDev = process.env.NODE_ENV !== "production";
const MAX_BATCH_SIZE = 10;
const TIMEOUT_MS = 15_000;

// Circuit breaker for OpenRouter credit exhaustion. RiskFlow scores every ~30s
// with parallel chunks, so a 402 from Grok creates 50+ failed calls/min — each
// one a wasted round-trip that also slows /health and stresses the event loop.
// When we see repeated 402s, trip the breaker and fall back to deterministic
// parsing (which analyzeHeadline already does on error). Auto-probes after the
// cooldown so it self-heals once credits are topped up.
const CB_FAILURE_THRESHOLD = 3;
const CB_COOLDOWN_MS = 5 * 60_000;
let cbFailures = 0;
let cbOpenUntil = 0;
let cbLastLoggedOpen = 0;

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    code?: number;
    message?: string;
    cause?: unknown;
  };
  if (e.status === 402 || e.code === 402) return true;
  const msg = typeof e.message === "string" ? e.message : "";
  if (/insufficient credits|402|circuit open|quota/i.test(msg)) return true;
  if (e.cause) return isQuotaError(e.cause);
  return false;
}

export interface AnalyzedHeadline {
  raw: string;
  source: NewsSource;
  parsed: ParsedHeadline;
  hotPrint: HotPrint | null;
  confidence: number;
  usedAi: boolean;
  latencyMs: number;
}

export interface BatchAnalysisResult {
  items: AnalyzedHeadline[];
  failedCount: number;
  totalLatencyMs: number;
}

/**
 * Analyze a single headline
 * Uses deterministic parsing first, falls back to AI for uncertain cases
 */
export async function analyzeHeadline(
  headline: string,
  source: NewsSource = "Custom",
): Promise<AnalyzedHeadline> {
  const startTime = Date.now();

  // Try deterministic parsing first
  const { parsed, isConfident } = parseHeadline(headline, { source });

  // Check for hot print using deterministic rules
  let hotPrint: HotPrint | null = null;
  if (
    parsed.numbers?.actual !== undefined &&
    parsed.numbers?.forecast !== undefined &&
    parsed.eventType
  ) {
    hotPrint = detectHotPrint({
      type: parsed.eventType,
      actual: parsed.numbers.actual,
      forecast: parsed.numbers.forecast,
      previous: parsed.numbers.previous,
      unit: parsed.numbers.unit,
    });
  }

  // If confident in deterministic parse, return early
  if (isConfident) {
    return {
      raw: headline,
      source,
      parsed,
      hotPrint,
      confidence: parsed.confidence,
      usedAi: false,
      latencyMs: Date.now() - startTime,
    };
  }

  // Use AI for uncertain headlines
  try {
    const aiParsed = await analyzeWithAi(headline, source);

    // Merge AI results with deterministic data
    const merged: ParsedHeadline = {
      ...parsed,
      ...aiParsed,
      // Keep deterministic symbols if AI didn't find any
      symbols: aiParsed.symbols?.length ? aiParsed.symbols : parsed.symbols,
      // Use higher confidence
      confidence: Math.max(parsed.confidence, aiParsed.confidence ?? 0),
    };

    // Re-check for hot print with AI-enhanced data
    if (
      !hotPrint &&
      merged.numbers?.actual !== undefined &&
      merged.numbers?.forecast !== undefined &&
      merged.eventType
    ) {
      hotPrint = detectHotPrint({
        type: merged.eventType,
        actual: merged.numbers.actual,
        forecast: merged.numbers.forecast,
        previous: merged.numbers.previous,
        unit: merged.numbers.unit,
      });
    }

    return {
      raw: headline,
      source,
      parsed: merged,
      hotPrint,
      confidence: merged.confidence,
      usedAi: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    // AI failed, return deterministic result. Quota errors are already
    // summarized by the circuit breaker; don't spam the log with stacks.
    if (!isQuotaError(error)) {
      console.error("[GrokAnalyzer] AI analysis failed:", error);
    }
    return {
      raw: headline,
      source,
      parsed,
      hotPrint,
      confidence: parsed.confidence,
      usedAi: false,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Analyze headline using AI model
 */
async function analyzeWithAi(
  headline: string,
  source: NewsSource,
): Promise<Partial<ParsedHeadline>> {
  // Circuit open: fail fast, caller falls back to deterministic parse.
  if (Date.now() < cbOpenUntil) {
    throw new Error("grok-analyzer: circuit open (OpenRouter quota)");
  }

  const prompt = buildAnalysisPrompt(headline, source);

  try {
    const { text } = await invokeAgent({
      systemPrompt:
        "You are a financial news parser. Extract structured data from headlines. Respond only with valid JSON.",
      userPrompt: prompt,
      model: { temperature: 0.1, maxTokens: 512 },
      provider: "grok",
    });

    // Success → reset breaker
    cbFailures = 0;
    return parseAiResponse(text);
  } catch (error) {
    if (isQuotaError(error)) {
      cbFailures += 1;
      if (cbFailures >= CB_FAILURE_THRESHOLD && Date.now() >= cbOpenUntil) {
        cbOpenUntil = Date.now() + CB_COOLDOWN_MS;
        // Log once per trip, not per request
        if (cbOpenUntil !== cbLastLoggedOpen) {
          cbLastLoggedOpen = cbOpenUntil;
          console.warn(
            `[GrokAnalyzer] OpenRouter quota exhausted — circuit open for ${Math.round(
              CB_COOLDOWN_MS / 1000,
            )}s. Deterministic parsing only until credits are restored.`,
          );
        }
      }
    }
    throw error;
  }
}

/**
 * Build prompt for AI analysis
 */
function buildAnalysisPrompt(headline: string, source: string): string {
  return `Parse this financial headline and extract structured data:

Headline: ${headline}
Source: ${source}

Return JSON with these fields:
{
  "entity": "organization/person mentioned (Fed, NVDA, etc.)",
  "action": "action taken (raises, cuts, announces, etc.)",
  "target": "target of action (rates, earnings, etc.)",
  "magnitude": number or null,
  "unit": "bps/%" or null,
  "symbols": ["related ticker symbols"],
  "isBreaking": true/false,
  "urgency": "immediate|high|normal",
  "direction": "up|down|mixed" or null,
  "eventType": "fedDecision|cpiPrint|earnings|etc." or null,
  "tags": ["relevant tags"],
  "marketReaction": {"direction": "up|down|mixed", "intensity": "mild|moderate|severe"} or null,
  "numbers": {"actual": number, "forecast": number, "previous": number, "unit": string} or null,
  "confidence": 0.0-1.0
}`;
}

/**
 * Parse AI response JSON
 */
function parseAiResponse(text: string): Partial<ParsedHeadline> {
  try {
    // Clean up potential markdown formatting
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      entity: parsed.entity,
      action: parsed.action,
      target: parsed.target,
      magnitude:
        typeof parsed.magnitude === "number" ? parsed.magnitude : undefined,
      unit: parsed.unit,
      symbols: Array.isArray(parsed.symbols) ? parsed.symbols : [],
      isBreaking: Boolean(parsed.isBreaking),
      urgency: parsed.urgency ?? "normal",
      direction: parsed.direction,
      eventType: parsed.eventType,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      marketReaction: parsed.marketReaction,
      numbers: parsed.numbers,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch {
    return { confidence: 0.4 };
  }
}

/**
 * Analyze a batch of articles
 */
export async function analyzeNewsBatch(
  articles: RawArticle[],
): Promise<BatchAnalysisResult> {
  const startTime = Date.now();
  const items: AnalyzedHeadline[] = [];
  let failedCount = 0;

  // Process in chunks
  const chunks = chunkArray(articles, MAX_BATCH_SIZE);

  for (const chunk of chunks) {
    const promises = chunk.map(async (article) => {
      try {
        const headline = article.headline ?? article.text ?? "";
        return await analyzeHeadline(headline, article.source);
      } catch {
        failedCount++;
        return null;
      }
    });

    const results = await Promise.all(promises);
    items.push(...results.filter((r): r is AnalyzedHeadline => r !== null));
  }

  return {
    items,
    failedCount,
    totalLatencyMs: Date.now() - startTime,
  };
}

/**
 * Check if headline is breaking news
 */
export function isBreakingNews(headline: string): boolean {
  const breakingPatterns = [
    /^BREAKING[:\s-]/i,
    /^JUST IN[:\s-]/i,
    /^ALERT[:\s-]/i,
    /^URGENT[:\s-]/i,
    /^FLASH[:\s-]/i,
  ];
  return breakingPatterns.some((p) => p.test(headline));
}

/**
 * Extract symbols from headline
 */
export function extractSymbols(headline: string): string[] {
  const symbolRegex = /\$[A-Z]{1,5}\b/g;
  const matches = headline.match(symbolRegex) ?? [];
  return [...new Set(matches.map((s) => s.replace("$", "").toUpperCase()))];
}

/**
 * Utility: chunk array into smaller pieces
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Mock analysis for dev mode
 */
export function mockAnalysis(
  headline: string,
  source: NewsSource,
): AnalyzedHeadline {
  const { parsed, isConfident } = parseHeadline(headline, { source });

  return {
    raw: headline,
    source,
    parsed,
    hotPrint: null,
    confidence: parsed.confidence,
    usedAi: false,
    latencyMs: 10,
  };
}
