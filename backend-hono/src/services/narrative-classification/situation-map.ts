import { getSupabaseClient } from "../../config/supabase.js";
import { resolveNarrativeDesk } from "../narrative-sessions/default-desk.js";
import {
  classifyCatalysts,
  readCatalystsByIds,
  readNarrativeThreads,
} from "./tag-classifier.js";
import type {
  NarrativeTagDecision,
  NarrativeThreadSeed,
  SituationMapEdge,
  SituationMapNode,
  SituationMapResponse,
} from "./types.js";

interface SelectedCatalystRow {
  riskflow_item_id: string;
  role: string | null;
}

export async function buildSituationMap(params: {
  deskId: string | null;
  actorId: string | null;
}): Promise<SituationMapResponse> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const threads = await readNarrativeThreads();
  const selection = await readDeskCatalystSelection(
    params.deskId,
    params.actorId,
  );
  const catalystIds = selection.catalystIds;
  const catalysts =
    catalystIds.length > 0
      ? await readCatalystsByIds(catalystIds)
      : await readFallbackCatalysts();
  const decisions = classifyCatalysts({ catalysts, threads });

  return {
    deskId: selection.deskId,
    generatedAt: new Date().toISOString(),
    nodes: buildNodes(threads, decisions, catalysts),
    edges: buildEdges(decisions),
    decisions,
  };
}

async function readDeskCatalystSelection(
  deskId: string | null,
  actorId: string | null,
): Promise<{ deskId: string | null; catalystIds: string[] }> {
  const sb = getSupabaseClient();
  if (!sb) return { deskId: null, catalystIds: [] };

  const desk = await resolveNarrativeDesk(deskId, actorId);
  const { data: sessions, error: sessionError } = await sb
    .from("narrative_sessions")
    .select("id")
    .eq("desk_id", desk.id)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (sessionError) {
    console.warn(
      "[NarrativeSituationMap] session table unavailable",
      sessionError,
    );
    return { deskId: desk.id, catalystIds: [] };
  }

  const sessionIds = (sessions ?? []).map((row) => String(row.id));
  if (sessionIds.length === 0) return { deskId: desk.id, catalystIds: [] };

  const { data, error } = await sb
    .from("narrative_session_catalysts")
    .select("riskflow_item_id, role")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (error) {
    console.warn("[NarrativeSituationMap] session catalyst read failed", error);
    return { deskId: desk.id, catalystIds: [] };
  }

  return {
    deskId: desk.id,
    catalystIds: uniqueIds((data ?? []) as SelectedCatalystRow[]),
  };
}

async function readFallbackCatalysts() {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data: links, error: linkError } = await sb
    .from("narrative_card_links")
    .select("card_id")
    .order("created_at", { ascending: false })
    .limit(80);
  if (linkError) {
    console.warn("[NarrativeSituationMap] fallback links failed", linkError);
    return [];
  }

  const ids = Array.from(
    new Set((links ?? []).map((row) => String(row.card_id))),
  );
  return ids.length > 0 ? readCatalystsByIds(ids.slice(0, 48)) : [];
}

function buildNodes(
  threads: NarrativeThreadSeed[],
  decisions: NarrativeTagDecision[],
  catalysts: Awaited<ReturnType<typeof readCatalystsByIds>>,
): SituationMapNode[] {
  const activeSlugs = new Set(
    decisions.flatMap((decision) => decision.narrativeSlugs),
  );
  const narrativeNodes = threads
    .filter((thread) => activeSlugs.has(thread.slug))
    .map((thread) => ({
      id: `narrative-${thread.slug}`,
      kind: "narrative" as const,
      label: thread.title,
      color: thread.color,
      summary: `${countBySlug(decisions, thread.slug)} catalyst links`,
      narrativeSlug: thread.slug,
    }));

  const byId = new Map(
    decisions.map((decision) => [decision.catalystId, decision]),
  );
  const catalystNodes = catalysts.map((catalyst) => {
    const decision = byId.get(catalyst.id);
    return {
      id: `catalyst-${catalyst.id}`,
      kind: "catalyst" as const,
      label: catalyst.headline,
      color: "#c79f4a",
      summary: decision?.reason ?? catalyst.summary,
      catalystId: catalyst.id,
      confidence: decision?.confidence ?? 0,
      conflictLabel: decision?.conflictLabel ?? "unclassified",
      publishedAt: catalyst.publishedAt,
    };
  });

  return [...narrativeNodes, ...catalystNodes];
}

function buildEdges(decisions: NarrativeTagDecision[]): SituationMapEdge[] {
  const membership = decisions.flatMap((decision) =>
    decision.narrativeSlugs.map((slug) => ({
      id: `edge-${decision.catalystId}-${slug}`,
      source: `catalyst-${decision.catalystId}`,
      target: `narrative-${slug}`,
      kind: "membership" as const,
      confidence: decision.confidence,
      label: decision.conflictLabel,
    })),
  );

  const relationships = buildRelationshipEdges(decisions);
  return [...membership, ...relationships];
}

function buildRelationshipEdges(
  decisions: NarrativeTagDecision[],
): SituationMapEdge[] {
  const edges: SituationMapEdge[] = [];
  for (let i = 0; i < decisions.length; i += 1) {
    for (let j = i + 1; j < decisions.length; j += 1) {
      const shared = intersect(
        decisions[i].narrativeSlugs,
        decisions[j].narrativeSlugs,
      );
      if (shared.length === 0) continue;
      edges.push({
        id: `edge-related-${decisions[i].catalystId}-${decisions[j].catalystId}`,
        source: `catalyst-${decisions[i].catalystId}`,
        target: `catalyst-${decisions[j].catalystId}`,
        kind: "relationship",
        confidence: Math.min(decisions[i].confidence, decisions[j].confidence),
        label: shared.slice(0, 2).join(", "),
      });
    }
  }
  return edges.slice(0, 80);
}

function uniqueIds(rows: SelectedCatalystRow[]): string[] {
  return Array.from(
    new Set(rows.map((row) => row.riskflow_item_id).filter(Boolean)),
  ).slice(0, 64);
}

function countBySlug(decisions: NarrativeTagDecision[], slug: string): number {
  return decisions.filter((decision) => decision.narrativeSlugs.includes(slug))
    .length;
}

function intersect(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return a.filter((item) => set.has(item));
}
