import { getSupabaseClient } from "../../config/supabase.js";
import * as themeStore from "../theme-tracker/persistence.js";
import type { Theme } from "../theme-tracker/types.js";
import type { NarrativeHypothesis } from "./types.js";

export interface PromotedRiskflowCatalyst {
  id: string;
  headline: string;
  body: string;
  symbols: string[];
  tags: string[];
  sentiment: string;
  ivScore: number;
  publishedAt: string;
  promotedAt: string;
  category: string;
  marketImpact: string | null;
  agentNote: string | null;
}

export interface NarrativeSourceSnapshot {
  loungeHypotheses: NarrativeHypothesis[];
  themes: Theme[];
  catalysts: PromotedRiskflowCatalyst[];
  fallbackReason: string | null;
}

let hasLoggedLoungeMiss = false;

export async function loadNarrativeSources(): Promise<NarrativeSourceSnapshot> {
  const [loungeHypotheses, catalysts] = await Promise.all([
    readLoungeHypotheses(),
    readPromotedCatalysts(),
  ]);
  const themes = themeStore.listThemes();
  const fallbackReason =
    loungeHypotheses.length > 0
      ? null
      : "S69 lounge projection data unavailable; using Theme Tracker and promoted RiskFlow catalysts.";

  return { loungeHypotheses, themes, catalysts, fallbackReason };
}

async function readLoungeHypotheses(): Promise<NarrativeHypothesis[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("narrative_orchestra_projections")
    .select("hypothesis")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (!hasLoggedLoungeMiss) {
      console.warn("[NarrativeOrchestra] Lounge projection table unavailable", {
        message: error.message,
      });
      hasLoggedLoungeMiss = true;
    }
    return [];
  }

  return (data ?? [])
    .map((row) => row.hypothesis as NarrativeHypothesis | null)
    .filter((hypothesis): hypothesis is NarrativeHypothesis =>
      Boolean(hypothesis?.id),
    );
}

async function readPromotedCatalysts(): Promise<PromotedRiskflowCatalyst[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select(
      "tweet_id, headline, body, symbols, tags, sentiment, iv_score, published_at, promoted_at, category, market_impact, agent_note",
    )
    .not("promoted_at", "is", null)
    .gte("iv_score", 5.0)
    .order("published_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[NarrativeOrchestra] RiskFlow catalyst read failed", {
      message: error.message,
    });
    return [];
  }

  return (data ?? []).map((item) => ({
    id: item.tweet_id,
    headline: item.headline ?? "Untitled catalyst",
    body: item.body ?? item.headline ?? "",
    symbols: item.symbols ?? [],
    tags: item.tags ?? [],
    sentiment: item.sentiment ?? "neutral",
    ivScore: item.iv_score ?? 0,
    publishedAt: item.published_at ?? new Date().toISOString(),
    promotedAt: item.promoted_at ?? new Date().toISOString(),
    category: item.category ?? "macroeconomic",
    marketImpact: item.market_impact ?? null,
    agentNote: item.agent_note ?? null,
  }));
}
