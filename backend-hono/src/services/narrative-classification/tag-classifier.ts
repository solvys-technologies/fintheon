import { getSupabaseClient } from "../../config/supabase.js";
import { putSessionArtifact } from "../narrative-sessions/artifact-store.js";
import { addSessionTags, addWorkEvent } from "../narrative-sessions/history-store.js";
import { normalizeCatalystId } from "../narrative-sensemaking/catalyst-reader.js";
import type { SensemakingCatalyst } from "../narrative-sensemaking/types.js";
import {
  DEFAULT_FIRST_RUN_NARRATIVES,
  type CatalystConflictLabel,
  type ClassificationInput,
  type NarrativeTagDecision,
  type NarrativeThreadSeed,
} from "./types.js";

const FALLBACK_TAGS = ["macro", "riskflow", "watch"];

export async function classifyNarrativeSession(params: {
  sessionId: string;
  actorId: string | null;
}): Promise<NarrativeTagDecision[]> {
  const [catalysts, threads] = await Promise.all([
    readSessionCatalysts(params.sessionId),
    readNarrativeThreads(),
  ]);
  const decisions = classifyCatalysts({ catalysts, threads });
  await persistClassification(params.sessionId, decisions, params.actorId);
  return decisions;
}

export function classifyCatalysts(input: ClassificationInput): NarrativeTagDecision[] {
  return input.catalysts.map((catalyst) => {
    const matched = matchThreads(catalyst, input.threads);
    const tags = buildTags(catalyst, matched);
    const confidence = scoreConfidence(catalyst, matched);
    const conflictLabel = labelConflict(catalyst, confidence, matched.length);

    return {
      catalystId: catalyst.id,
      tags,
      narrativeSlugs: matched.map((thread) => thread.slug),
      confidence,
      conflictLabel,
      reason: buildReason(catalyst, matched, conflictLabel, confidence),
    };
  });
}

export async function readNarrativeThreads(): Promise<NarrativeThreadSeed[]> {
  const sb = getSupabaseClient();
  if (!sb) return DEFAULT_FIRST_RUN_NARRATIVES;

  const { data, error } = await sb
    .from("narrative_threads")
    .select("slug, title, color, keywords")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[NarrativeClassification] thread read failed", error);
    return DEFAULT_FIRST_RUN_NARRATIVES;
  }

  const rows = (data ?? []).map((row) => ({
    slug: String(row.slug),
    title: String(row.title),
    color: String(row.color ?? "#c79f4a"),
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
  }));
  return mergeDefaultThreads(rows);
}

async function readSessionCatalysts(sessionId: string): Promise<SensemakingCatalyst[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data: rows, error } = await sb
    .from("narrative_session_catalysts")
    .select("riskflow_item_id, role")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Session catalyst read failed: ${error.message}`);

  const ids = (rows ?? []).map((row) => String(row.riskflow_item_id));
  if (ids.length === 0) return [];
  return readCatalystsByIds(ids);
}

export async function readCatalystsByIds(ids: string[]): Promise<SensemakingCatalyst[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const normalized = Array.from(new Set(ids.map(normalizeCatalystId)));
  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("tweet_id, headline, body, source, symbols, tags, sentiment, iv_score, published_at, promoted_at, category, market_impact, agent_note")
    .in("tweet_id", normalized);
  if (error) throw new Error(`Catalyst read failed: ${error.message}`);

  const links = await readCardLinks(normalized);
  return (data ?? []).map((row) => ({
    id: String(row.tweet_id),
    headline: String(row.headline ?? "Untitled catalyst"),
    summary: String(row.body ?? row.agent_note ?? ""),
    source: String(row.source ?? "riskflow"),
    category: String(row.category ?? "macroeconomic"),
    sentiment: String(row.sentiment ?? "neutral"),
    ivScore: Number(row.iv_score ?? 0),
    publishedAt: String(row.published_at ?? new Date().toISOString()),
    promotedAt: row.promoted_at ? String(row.promoted_at) : null,
    symbols: Array.isArray(row.symbols) ? row.symbols.map(String) : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    narrativeThreads: links.get(String(row.tweet_id)) ?? [],
    marketImpact: row.market_impact ? String(row.market_impact) : null,
    agentNote: row.agent_note ? String(row.agent_note) : null,
    role: "anchor",
    relationScore: 100,
    relationReason: "Desk-selected catalyst",
  }));
}

async function persistClassification(sessionId: string, decisions: NarrativeTagDecision[], actorId: string | null): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  await putSessionArtifact({
    sessionId,
    artifactType: "agent-work",
    payload: { classification: decisions, generatedAt: new Date().toISOString() },
    createdBy: actorId,
  });
  await addSessionTags(sessionId, toSessionTags(decisions));
  await Promise.all(decisions.map((decision) => updateCatalystLabel(sessionId, decision)));
  await Promise.all([
    addWorkEvent({
      sessionId,
      agentName: "NarrativeFlow",
      eventType: "classification",
      summary: `Classified ${decisions.length} catalysts for tags, conflicts, and narrative membership.`,
      payload: { decisionCount: decisions.length },
    }),
    addWorkEvent({
      sessionId,
      agentName: "Consul",
      eventType: "contradiction-check",
      summary: "Checked catalyst labels for confirming, conflicting, noisy, and unclassified evidence.",
      payload: summarizeLabels(decisions),
    }),
    addWorkEvent({
      sessionId,
      agentName: "Harper",
      eventType: "report-generation",
      summary: "Prepared classification reasons for the Flow work surface.",
      payload: { reasonCount: decisions.filter((item) => item.reason).length },
    }),
    addWorkEvent({
      sessionId,
      agentName: "Herald",
      eventType: "notable-catalyst-promotion",
      summary: "Promoted high-confidence catalysts for Situation Map visibility.",
      payload: { promotedCount: decisions.filter((item) => item.confidence >= 0.7).length },
    }),
  ]);
}

async function updateCatalystLabel(sessionId: string, decision: NarrativeTagDecision): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const { error } = await sb
    .from("narrative_session_catalysts")
    .update({
      conflict_label: decision.conflictLabel,
      conflict_score: Number((1 - decision.confidence).toFixed(2)),
    })
    .eq("session_id", sessionId)
    .eq("riskflow_item_id", decision.catalystId);
  if (error) throw new Error(`Catalyst label update failed: ${error.message}`);
}

async function readCardLinks(ids: string[]): Promise<Map<string, string[]>> {
  const sb = getSupabaseClient();
  const links = new Map<string, string[]>();
  if (!sb || ids.length === 0) return links;

  const { data, error } = await sb
    .from("narrative_card_links")
    .select("card_id, thread_slug")
    .in("card_id", ids);
  if (error) return links;

  for (const row of data ?? []) {
    const next = links.get(row.card_id) ?? [];
    next.push(row.thread_slug);
    links.set(row.card_id, next);
  }
  return links;
}

function matchThreads(catalyst: SensemakingCatalyst, threads: NarrativeThreadSeed[]): NarrativeThreadSeed[] {
  const text = searchableText(catalyst);
  const existing = new Set(catalyst.narrativeThreads);
  return threads.filter((thread) => {
    if (existing.has(thread.slug)) return true;
    return thread.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  });
}

function buildTags(catalyst: SensemakingCatalyst, threads: NarrativeThreadSeed[]): string[] {
  const tags = new Set([
    ...FALLBACK_TAGS,
    catalyst.category,
    ...catalyst.tags,
    ...catalyst.symbols,
    ...threads.map((thread) => thread.slug),
  ]);
  return Array.from(tags).filter(Boolean).slice(0, 10);
}

function scoreConfidence(catalyst: SensemakingCatalyst, threads: NarrativeThreadSeed[]): number {
  const base = threads.length > 0 ? 0.52 : 0.22;
  const linkBoost = Math.min(catalyst.narrativeThreads.length * 0.12, 0.24);
  const tagBoost = Math.min(catalyst.tags.length * 0.025, 0.12);
  const ivBoost = Math.min(catalyst.ivScore / 100, 0.12);
  return Number(Math.min(0.96, base + linkBoost + tagBoost + ivBoost).toFixed(2));
}

function labelConflict(catalyst: SensemakingCatalyst, confidence: number, threadCount: number): CatalystConflictLabel {
  if (confidence < 0.34 || threadCount === 0) return "unclassified";
  if (catalyst.ivScore < 3 && catalyst.tags.length < 2) return "noise";
  if (["bearish", "negative"].includes(catalyst.sentiment.toLowerCase())) return "conflicting";
  return "confirming";
}

function buildReason(catalyst: SensemakingCatalyst, threads: NarrativeThreadSeed[], label: CatalystConflictLabel, confidence: number): string {
  if (threads.length === 0) {
    return `No active narrative keywords matched ${catalyst.source}; held as ${label} at ${confidence}.`;
  }
  const titles = threads.slice(0, 3).map((thread) => thread.title).join(", ");
  return `Matched ${titles} from keywords, existing links, or tags; labeled ${label} at ${confidence}.`;
}

function searchableText(catalyst: SensemakingCatalyst): string {
  return [
    catalyst.headline,
    catalyst.summary,
    catalyst.category,
    catalyst.marketImpact,
    catalyst.agentNote,
    ...catalyst.tags,
    ...catalyst.symbols,
  ].join(" ").toLowerCase();
}

function toSessionTags(decisions: NarrativeTagDecision[]) {
  const tags = new Map<string, number>();
  for (const decision of decisions) {
    for (const tag of [...decision.tags, ...decision.narrativeSlugs]) {
      tags.set(tag, Math.max(tags.get(tag) ?? 0, decision.confidence));
    }
  }
  return Array.from(tags.entries()).map(([tag, confidence]) => ({
    tag,
    confidence,
    source: "classification",
  }));
}

function summarizeLabels(decisions: NarrativeTagDecision[]) {
  return decisions.reduce<Record<string, number>>((acc, decision) => {
    acc[decision.conflictLabel] = (acc[decision.conflictLabel] ?? 0) + 1;
    return acc;
  }, {});
}

function mergeDefaultThreads(rows: NarrativeThreadSeed[]): NarrativeThreadSeed[] {
  const seen = new Set(rows.map((row) => row.slug));
  return [...rows, ...DEFAULT_FIRST_RUN_NARRATIVES.filter((row) => !seen.has(row.slug))];
}
