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
      Date.now() -
        RISK_SIGNAL_SOURCE_WINDOW.catalystsHours * 60 * 60 * 1000,
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
      .filter(
        (r) => r.headline && (r.ivScore >= 6.5 || r.macroLevel >= 2),
      )
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
    (r) =>
      `[IV ${r.ivScore} ${r.sentiment} ML${r.macroLevel}] ${r.headline}`,
  );
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
        "Recent RiskFlow input cleared the signal threshold before the AI refinement layer produced a card. Treat this as a desk-watch signal until the next analyst pass merges or dismisses it.",
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
    "score": <0-10 float>,
    "source": "<bulletin|catalyst-watch|risk-detector>",
    "relatedHeadlines": ["<headline1>", "<headline2>"],
    "narrativeThreads": ["<thread-tag1>", "<thread-tag2>"]
  }
]

Rules:
- score 0-10: market impact potential (0=negligible, 10=massive)
- source: "bulletin" if derived from analyst bulletins, "catalyst-watch" if from catalysts, "risk-detector" if from systemic context
- Deduplicate overlapping signals — merge related items into one signal
- relatedHeadlines: 1-3 original headlines that informed this signal
- narrativeThreads: 1-3 thematic tags (e.g. "fed-policy", "geopolitical", "earnings-season")
- Be concise but substantive in analysis`;

  try {
    const result = await invokeAgent({
      systemPrompt,
      userPrompt,
      provider: "nous",
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
    const signals = parsed.map((item) => {
      const score = Math.min(10, Math.max(0, Number(item.score) || 0));
      const source = String(item.source);
      return {
        id: String(item.id || crypto.randomUUID().slice(0, 8)),
        title: String(item.title || "Untitled Signal"),
        summary: String(item.summary || ""),
        analysis: String(item.analysis || ""),
        score: Number(score.toFixed(1)),
        severity: severityFromScore(score),
        source: (["bulletin", "catalyst-watch", "risk-detector"].includes(
          source,
        )
          ? source
          : "catalyst-watch") as RiskSignal["source"],
        relatedHeadlines: Array.isArray(item.relatedHeadlines)
          ? (item.relatedHeadlines as string[]).slice(0, 3)
          : [],
        narrativeThreads: Array.isArray(item.narrativeThreads)
          ? (item.narrativeThreads as string[]).slice(0, 3)
          : [],
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
