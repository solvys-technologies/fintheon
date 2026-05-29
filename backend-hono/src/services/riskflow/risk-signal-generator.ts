// [claude-code 2026-04-15] S16-T3: Risk Signal generator — AI-refined cards from bulletins + catalyst watches
import { getSupabaseClient } from "../../config/supabase.js";
import { listPosts } from "../bulletin/bulletin-store.js";
import { getCachedAssessment } from "../systemic/risk-detector.js";
import { invokeAgent } from "../strands/invoke-helper.js";
import { createLogger } from "../../lib/logger.js";
import type {
  CatalystCandidate,
  RiskSignal,
  RiskSignalResult,
} from "./risk-signal-types.js";
import { RISK_SIGNAL_SOURCE_WINDOW } from "./risk-signal-types.js";

const log = createLogger("RiskSignalGenerator");

// ── In-memory cache (10 min TTL) ─────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedResult: RiskSignalResult | null = null;

function severityFromScore(score: number): RiskSignal["severity"] {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

async function fetchRecentBulletins(): Promise<string[]> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const posts = await listPosts({ limit: 30 });
    return posts
      .filter((p) => new Date(p.createdAt) >= cutoff)
      .map((p) => p.content);
  } catch (err) {
    log.warn("Failed to fetch bulletins for risk signals", {
      error: String(err),
    });
    return [];
  }
}

async function fetchHighSeverityCatalysts(): Promise<CatalystCandidate[]> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return [];

    const cutoff = new Date(
      Date.now() - RISK_SIGNAL_SOURCE_WINDOW.catalystsHours * 60 * 60 * 1000,
    ).toISOString();
    const { data } = await sb
      .from("scored_riskflow_items")
      .select("headline, sentiment, iv_score, macro_level, published_at")
      .gte("published_at", cutoff)
      .order("iv_score", { ascending: false })
      .limit(60);

    if (!data || data.length === 0) return [];
    return data
      .map((r) => ({
        headline: String(r.headline ?? ""),
        sentiment: String(r.sentiment ?? "neutral"),
        ivScore: Number(r.iv_score ?? 0),
        macroLevel: Number(r.macro_level ?? 0),
        publishedAt: String(r.published_at ?? ""),
      }))
      .filter((r) => r.headline && (r.ivScore >= 6.5 || r.macroLevel >= 2))
      .slice(0, 25);
  } catch (err) {
    log.warn("Failed to fetch catalysts for risk signals", {
      error: String(err),
    });
    return [];
  }
}

function getSystemicContext(): string {
  const assessment = getCachedAssessment();
  if (!assessment) return "(no systemic assessment available)";
  const lines = [
    `Systemic score: ${assessment.systemicScore}/10`,
    `IV overlay: +${assessment.ivScoreOverlay}`,
    `Credit signals: ${assessment.creditSignalCount}`,
  ];
  if (assessment.rationale.length > 0) {
    lines.push(`Rationale: ${assessment.rationale.slice(0, 3).join("; ")}`);
  }
  return lines.join("\n");
}

function formatCatalysts(catalysts: CatalystCandidate[]): string[] {
  return catalysts.map(
    (r) => `[IV ${r.ivScore} ${r.sentiment} ML${r.macroLevel}] ${r.headline}`,
  );
}

function normalizeDirection(value: unknown): RiskSignal["direction"] {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "bullish" || raw === "bearish") return raw;
  return "neutral";
}

function normalizeStringList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function catalystCascadePremium(input: {
  title: string;
  summary: string;
  analysis: string;
  relatedHeadlines: string[];
  narrativeThreads: string[];
}): number {
  const text = [
    input.title,
    input.summary,
    input.analysis,
    ...input.relatedHeadlines,
    ...input.narrativeThreads,
  ]
    .join(" ")
    .toLowerCase();
  const themeHits = [
    /\bfed|fomc|powell|bowman|paulson|musalem|williams\b/,
    /\bpmi|ism|manufactur|growth\b/,
    /\binflation|cpi|pce|tariff|prices\b/,
    /\byield|treasur|rates?|duration\b/,
    /\bnq|nasdaq|tech|semis?|ai\b/,
    /\bvix|vol|gamma|squeeze|positioning|repric\b/,
  ].filter((pattern) => pattern.test(text)).length;
  const explicitCascade =
    /\b(snowball|cascade|cluster|chorus|feedback loop|pile[- ]?on)\b/.test(
      text,
    );
  if (input.relatedHeadlines.length >= 3 && themeHits >= 2) return 1.1;
  if (input.relatedHeadlines.length >= 2 && themeHits >= 3) return 0.7;
  if (explicitCascade) return 0.6;
  return 0;
}

function toResult(
  signals: RiskSignal[],
  status: RiskSignalResult["freshnessStatus"],
  counts: RiskSignalResult["inputCounts"],
  reason?: string,
): RiskSignalResult {
  return {
    signals,
    staleSignals: [],
    generatedAt: new Date().toISOString(),
    sourceWindow: RISK_SIGNAL_SOURCE_WINDOW,
    inputCounts: counts,
    cached: false,
    stale: false,
    freshnessStatus: status,
    diagnostics: reason ? { reason } : undefined,
  };
}

function buildFallbackSignals(catalysts: CatalystCandidate[]): RiskSignal[] {
  const now = new Date().toISOString();
  return catalysts.slice(0, 5).map((row, index) => {
    const score = Math.min(10, Math.max(row.ivScore, row.macroLevel * 2));
    const sourceTag =
      row.macroLevel >= 3 ? "macro-pressure" : row.sentiment || "riskflow";
    return {
      id: `riskflow-${index + 1}-${row.headline
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24)}`,
      title: row.headline.slice(0, 96),
      summary: `IV ${row.ivScore.toFixed(1)} / ML${row.macroLevel} catalyst`,
      analysis:
        "Pending Agentic Desk refinement. This catalyst met the desk-watch threshold and needs Herald/CAO synthesis before it should be treated as a full Risk Signal.",
      direction: normalizeDirection(row.sentiment),
      refinementStatus: "pending-refinement",
      score: Number(score.toFixed(1)),
      severity: severityFromScore(score),
      source: "catalyst-watch",
      relatedHeadlines: [row.headline],
      narrativeThreads: ["riskflow", sourceTag].filter(Boolean).slice(0, 2),
      generatedAt: now,
    };
  });
}

export async function generateRiskSignals(): Promise<RiskSignalResult> {
  const [bulletins, catalysts] = await Promise.all([
    fetchRecentBulletins(),
    fetchHighSeverityCatalysts(),
  ]);
  const counts = { bulletins: bulletins.length, catalysts: catalysts.length };

  const systemicContext = getSystemicContext();

  if (bulletins.length === 0 && catalysts.length === 0) {
    log.info("No bulletins or catalysts — returning empty risk signals");
    return toResult([], "empty", counts, "no_recent_signal_inputs");
  }

  const systemPrompt = `You are Herald, the news & sentiment analyst at Priced In Capital. You refine raw risk data into structured Risk Signals for the trading desk. Output ONLY valid JSON — no markdown fencing, no commentary.`;

  const userPrompt = `Analyze the following risk sources and produce 3-8 distinct Risk Signals.

ANALYST BULLETINS (last 24h):
${bulletins.length > 0 ? bulletins.join("\n") : "(none)"}

HIGH-SEVERITY CATALYSTS (last 24h, IV >= 6.5 or macro_level >= 2):
${catalysts.length > 0 ? formatCatalysts(catalysts).join("\n") : "(none)"}

SYSTEMIC RISK CONTEXT:
${systemicContext}

Return a JSON array with this exact structure:
[
  {
    "id": "<unique-short-id>",
    "title": "<clear concise title>",
    "summary": "<one-liner summary>",
    "analysis": "<2-4 sentence deep analysis>",
    "direction": "<bullish|bearish|neutral>",
    "score": <0-10 float>,
    "source": "<bulletin|catalyst-watch|risk-detector>",
    "relatedHeadlines": ["<headline1>", "<headline2>"],
    "narrativeThreads": ["<thread-tag1>", "<thread-tag2>"]
  }
]

Rules:
- score 0-10: market impact potential (0=negligible, 10=massive)
- direction must reflect the catalyst's likely market effect, not severity; use "neutral" when the evidence is mixed or insufficient
- source: "bulletin" if derived from analyst bulletins, "catalyst-watch" if from catalysts, "risk-detector" if from systemic context
- Deduplicate overlapping signals — merge related items into one signal
- If multiple headlines snowball into the same macro, rates, VIX, positioning, or index-beta theme, treat it as potential catalyst drift rather than isolated headlines
- For 3+ compounding catalysts, use at least 3 relatedHeadlines when available, add "catalyst-drift" or "headline-cascade" to narrativeThreads, and discuss Session Drift in the analysis
- relatedHeadlines: 1-3 original headlines that informed this signal
- narrativeThreads: 1-3 thematic tags (e.g. "fed-policy", "geopolitical", "earnings-season")
- Be concise but substantive in analysis`;

  try {
    const result = await invokeAgent({
      systemPrompt,
      userPrompt,
      provider: "deepseek-direct",
    });

    const raw = result.text
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "")
      .trim();

    const arrayStart = raw.indexOf("[");
    const arrayEnd = raw.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) {
      log.warn("Risk signal AI response had no JSON array", {
        preview: raw.slice(0, 200),
      });
      return toResult(
        buildFallbackSignals(catalysts),
        catalysts.length > 0 ? "fresh" : "generation-error",
        counts,
        "ai_response_missing_json",
      );
    }

    const parsed = JSON.parse(raw.slice(arrayStart, arrayEnd + 1)) as Array<
      Record<string, unknown>
    >;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return toResult(buildFallbackSignals(catalysts), "fresh", counts);
    }

    const now = new Date().toISOString();
    const signals: RiskSignal[] = parsed.map((item) => {
      const title = String(item.title || "Untitled Signal");
      const summary = String(item.summary || "");
      const relatedHeadlines = normalizeStringList(item.relatedHeadlines, 3);
      const baseThreads = normalizeStringList(item.narrativeThreads, 3);
      const rawAnalysis = String(item.analysis || "");
      const cascadePremium = catalystCascadePremium({
        title,
        summary,
        analysis: rawAnalysis,
        relatedHeadlines,
        narrativeThreads: baseThreads,
      });
      const score = Math.min(
        10,
        Math.max(0, Number(item.score) || 0) + cascadePremium,
      );
      const narrativeThreads =
        cascadePremium > 0 && !baseThreads.includes("catalyst-drift")
          ? [...baseThreads.slice(0, 2), "catalyst-drift"]
          : baseThreads;
      const analysis =
        cascadePremium > 0 && !/session drift/i.test(rawAnalysis)
          ? `${rawAnalysis} Session Drift watch: related catalysts are compounding, so follow-through can persist longer than a one-off headline.`
          : rawAnalysis;
      const source = String(item.source);
      return {
        id: String(item.id || crypto.randomUUID().slice(0, 8)),
        title,
        summary,
        analysis,
        direction: normalizeDirection(item.direction),
        refinementStatus: "agentic",
        score: Number(score.toFixed(1)),
        severity: severityFromScore(score),
        source: (["bulletin", "catalyst-watch", "risk-detector"].includes(
          source,
        )
          ? source
          : "catalyst-watch") as RiskSignal["source"],
        relatedHeadlines,
        narrativeThreads,
        generatedAt: now,
      };
    });
    return toResult(signals, "fresh", counts);
  } catch (err) {
    log.error("Risk signal generation failed", { error: String(err) });
    return toResult(
      buildFallbackSignals(catalysts),
      catalysts.length > 0 ? "fresh" : "generation-error",
      counts,
      "ai_refinement_failed",
    );
  }
}

export async function getRiskSignals(): Promise<RiskSignalResult> {
  if (
    cachedResult &&
    cachedResult.signals.length > 0 &&
    Date.now() - new Date(cachedResult.generatedAt).getTime() < CACHE_TTL_MS
  ) {
    return { ...cachedResult, cached: true };
  }

  const result = await generateRiskSignals();
  if (result.signals.length > 0) {
    cachedResult = result;
    return result;
  }

  const staleSignals = cachedResult?.signals ?? [];
  return {
    ...result,
    staleSignals,
    stale: staleSignals.length > 0,
    freshnessStatus:
      staleSignals.length > 0 ? "stale-cache" : result.freshnessStatus,
    diagnostics: {
      ...result.diagnostics,
      staleGeneratedAt: cachedResult?.generatedAt ?? null,
    },
  };
}
