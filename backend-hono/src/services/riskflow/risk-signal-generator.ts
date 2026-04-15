// [claude-code 2026-04-15] S16-T3: Risk Signal generator — AI-refined cards from bulletins + catalyst watches
import { getSupabaseClient } from "../../config/supabase.js";
import { listPosts } from "../bulletin/bulletin-store.js";
import { getCachedAssessment } from "../systemic/risk-detector.js";
import { invokeAgent } from "../strands/invoke-helper.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("RiskSignalGenerator");

export interface RiskSignal {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  score: number;
  severity: "critical" | "high" | "medium" | "low";
  source: "bulletin" | "catalyst-watch" | "risk-detector";
  relatedHeadlines: string[];
  narrativeThreads: string[];
  generatedAt: string;
}

// ── In-memory cache (10 min TTL) ─────────────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;
let cachedSignals: RiskSignal[] = [];
let cachedAt = 0;

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

async function fetchHighSeverityCatalysts(): Promise<string[]> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return [];

    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("scored_riskflow_items")
      .select("headline, sentiment, iv_score, macro_level")
      .gte("published_at", cutoff)
      .gte("macro_level", 3)
      .order("iv_score", { ascending: false })
      .limit(25);

    if (!data || data.length === 0) return [];
    return data.map(
      (r) =>
        `[IV ${r.iv_score} ${r.sentiment ?? "neutral"} ML${r.macro_level}] ${r.headline}`,
    );
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

export async function generateRiskSignals(): Promise<RiskSignal[]> {
  const [bulletins, catalysts] = await Promise.all([
    fetchRecentBulletins(),
    fetchHighSeverityCatalysts(),
  ]);

  const systemicContext = getSystemicContext();

  if (bulletins.length === 0 && catalysts.length === 0) {
    log.info("No bulletins or catalysts — returning empty risk signals");
    return [];
  }

  const systemPrompt = `You are Herald, the news & sentiment analyst at Priced In Capital. You refine raw risk data into structured Risk Signals for the trading desk. Output ONLY valid JSON — no markdown fencing, no commentary.`;

  const userPrompt = `Analyze the following risk sources and produce 3-8 distinct Risk Signals.

ANALYST BULLETINS (last 24h):
${bulletins.length > 0 ? bulletins.join("\n") : "(none)"}

HIGH-SEVERITY CATALYSTS (last 12h, macro_level >= 3):
${catalysts.length > 0 ? catalysts.join("\n") : "(none)"}

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
      return [];
    }

    const parsed = JSON.parse(raw.slice(arrayStart, arrayEnd + 1)) as Array<
      Record<string, unknown>
    >;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const now = new Date().toISOString();
    return parsed.map((item) => {
      const score = Math.min(10, Math.max(0, Number(item.score) || 0));
      return {
        id: String(item.id || crypto.randomUUID().slice(0, 8)),
        title: String(item.title || "Untitled Signal"),
        summary: String(item.summary || ""),
        analysis: String(item.analysis || ""),
        score: Number(score.toFixed(1)),
        severity: severityFromScore(score),
        source: (["bulletin", "catalyst-watch", "risk-detector"].includes(
          String(item.source),
        )
          ? String(item.source)
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
  } catch (err) {
    log.error("Risk signal generation failed", { error: String(err) });
    return [];
  }
}

export async function getRiskSignals(): Promise<RiskSignal[]> {
  if (Date.now() - cachedAt < CACHE_TTL_MS && cachedSignals.length > 0) {
    return cachedSignals;
  }

  const signals = await generateRiskSignals();
  if (signals.length > 0) {
    cachedSignals = signals;
    cachedAt = Date.now();
  }
  return signals.length > 0 ? signals : cachedSignals;
}
