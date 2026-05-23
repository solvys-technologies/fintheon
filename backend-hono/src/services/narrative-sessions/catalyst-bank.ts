import { getSupabaseClient } from "../../config/supabase.js";
import { normalizeCatalystId } from "../narrative-sensemaking/catalyst-reader.js";
import { addSessionTags, addWorkEvent } from "./history-store.js";
import {
  attachSessionCatalysts,
  getNarrativeSessionDetail,
} from "./session-store.js";
import type { NarrativeSessionDetail } from "./types.js";

const CATALYST_FIELDS =
  "tweet_id, source, headline, body, url, symbols, tags, sentiment, iv_score, macro_level, published_at, promoted_at, category, status, risk_type, market_impact, agent_note, created_at";

export interface CatalystBankSearchParams {
  q?: string | null;
  deskId?: string | null;
  sessionId?: string | null;
  tag?: string | null;
  minIv?: number | null;
  days?: number | null;
  limit?: number | null;
  actorId?: string | null;
}

export interface CatalystBankAssignmentInput {
  sessionId: string;
  catalystIds: string[];
  role?: string | null;
  tags?: string[];
  deskFit?: string | null;
  notes?: string | null;
  actorId?: string | null;
}

export interface CatalystBankItem {
  id: string;
  headline: string;
  body: string;
  source: string;
  url: string | null;
  symbols: string[];
  tags: string[];
  sentiment: string | null;
  ivScore: number | null;
  macroLevel: number | null;
  publishedAt: string | null;
  promotedAt: string | null;
  category: string | null;
  status: string | null;
  riskType: string | null;
  marketImpact: unknown;
  agentNote: string | null;
  assignments: CatalystNarrativeAssignment[];
  bank: CatalystUserBankEntry[];
  createdAt: string | null;
  updatedAt: string | null;
}

interface CatalystNarrativeAssignment {
  sessionId: string;
  sessionTitle: string | null;
  deskId: string | null;
  deskName: string | null;
  deskSlug: string | null;
  role: string | null;
  conflictLabel: string | null;
  assignedAt: string | null;
}

interface CatalystUserBankEntry {
  userId: string;
  deskId: string | null;
  sessionId: string | null;
  role: string;
  tags: string[];
  deskFit: string | null;
  status: string;
  notes: string | null;
  updatedAt: string | null;
}

export async function searchCatalystBank(
  params: CatalystBankSearchParams,
): Promise<CatalystBankItem[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const limit = clamp(params.limit ?? 80, 1, 200);
  const scopedIds = params.q
    ? []
    : await readScopedCatalystIds({
        deskId: params.deskId ?? null,
        sessionId: params.sessionId ?? null,
        actorId: params.actorId ?? null,
      });

  let query = sb
    .from("scored_riskflow_items")
    .select(CATALYST_FIELDS)
    .order("published_at", { ascending: false })
    .limit(scopedIds.length > 0 ? Math.min(scopedIds.length, 500) : 500);

  if (scopedIds.length > 0) query = query.in("tweet_id", scopedIds);
  if (params.minIv != null) query = query.gte("iv_score", params.minIv);
  if (params.days != null) {
    const since = new Date(
      Date.now() - clamp(params.days, 1, 365) * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.gte("published_at", since);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Catalyst bank read failed: ${error.message}`);

  const filtered = (data ?? [])
    .map(toCatalystBankBase)
    .filter((item) => matchesSearch(item, params))
    .slice(0, limit);
  const ids = filtered.map((item) => item.id);
  const [assignments, bankEntries] = await Promise.all([
    readNarrativeAssignments(ids),
    readUserBankEntries(ids, params.actorId ?? null),
  ]);

  return filtered.map((item) => ({
    ...item,
    assignments: assignments.get(item.id) ?? [],
    bank: bankEntries.get(item.id) ?? [],
  }));
}

export async function assignCatalystsToBankAndSession(
  input: CatalystBankAssignmentInput,
): Promise<{ session: NarrativeSessionDetail; bankRows: Record<string, unknown>[] }> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const catalystIds = Array.from(
    new Set(input.catalystIds.map(normalizeCatalystId).filter(Boolean)),
  );
  if (catalystIds.length === 0) {
    throw new Error("At least one catalyst id is required");
  }

  const session = await getNarrativeSessionDetail(input.sessionId);
  await attachSessionCatalysts({
    sessionId: input.sessionId,
    actorId: input.actorId ?? null,
    catalysts: catalystIds.map((riskflowItemId) => ({
      riskflowItemId,
      role: input.role ?? "supporting",
    })),
  });

  const tags = sanitizeTags(input.tags ?? []);
  if (tags.length > 0) {
    await addSessionTags(
      input.sessionId,
      tags.map((tag) => ({ tag, confidence: 0.75, source: "catalyst-bank" })),
    );
  }

  const bankRows = await upsertUserBankRows({
    userId: input.actorId ?? "system",
    deskId: session.deskId,
    sessionId: input.sessionId,
    catalystIds,
    role: input.role ?? "supporting",
    tags,
    deskFit: input.deskFit ?? null,
    notes: input.notes ?? null,
  });

  await addWorkEvent({
    sessionId: input.sessionId,
    agentName: "NarrativeFlow",
    eventType: "catalyst-bank-assigned",
    summary: "Assigned catalyst bank items to this NF-Workspace session.",
    payload: {
      catalystIds,
      tags,
      deskFit: input.deskFit ?? null,
      userBankRows: bankRows.length,
    },
  });

  return {
    session: await getNarrativeSessionDetail(input.sessionId),
    bankRows,
  };
}

async function readScopedCatalystIds(params: {
  deskId: string | null;
  sessionId: string | null;
  actorId: string | null;
}): Promise<string[]> {
  const ids = new Set<string>();
  const sb = getSupabaseClient();
  if (!sb) return [];

  if (params.sessionId) {
    const { data } = await sb
      .from("narrative_session_catalysts")
      .select("riskflow_item_id")
      .eq("session_id", params.sessionId);
    for (const row of data ?? []) ids.add(String(row.riskflow_item_id));
  }

  if (params.deskId) {
    const { data: sessions } = await sb
      .from("narrative_sessions")
      .select("id")
      .eq("desk_id", params.deskId);
    const sessionIds = (sessions ?? []).map((row) => String(row.id));
    if (sessionIds.length > 0) {
      const { data } = await sb
        .from("narrative_session_catalysts")
        .select("riskflow_item_id")
        .in("session_id", sessionIds);
      for (const row of data ?? []) ids.add(String(row.riskflow_item_id));
    }
  }

  const userId = params.actorId ?? "system";
  try {
    let bankQuery = sb
      .from("narrative_user_catalyst_bank")
      .select("riskflow_item_id")
      .eq("user_id", userId)
      .limit(500);
    if (params.deskId) bankQuery = bankQuery.eq("desk_id", params.deskId);
    const { data: bankRows } = await bankQuery;
    for (const row of bankRows ?? []) ids.add(String(row.riskflow_item_id));
  } catch {
    // The migration may not be applied yet; the default scored catalyst DB still works.
  }

  return Array.from(ids);
}

async function readNarrativeAssignments(
  ids: string[],
): Promise<Map<string, CatalystNarrativeAssignment[]>> {
  const sb = getSupabaseClient();
  const map = new Map<string, CatalystNarrativeAssignment[]>();
  if (!sb || ids.length === 0) return map;

  const { data: rows } = await sb
    .from("narrative_session_catalysts")
    .select("riskflow_item_id, session_id, role, conflict_label, created_at")
    .in("riskflow_item_id", ids);
  const sessionIds = Array.from(
    new Set((rows ?? []).map((row) => String(row.session_id))),
  );
  const sessions = await readSessionLookup(sessionIds);

  for (const row of rows ?? []) {
    const itemId = String(row.riskflow_item_id);
    const session = sessions.get(String(row.session_id));
    const list = map.get(itemId) ?? [];
    list.push({
      sessionId: String(row.session_id),
      sessionTitle: session?.title ?? null,
      deskId: session?.deskId ?? null,
      deskName: session?.deskName ?? null,
      deskSlug: session?.deskSlug ?? null,
      role: row.role ? String(row.role) : null,
      conflictLabel: row.conflict_label ? String(row.conflict_label) : null,
      assignedAt: row.created_at ? String(row.created_at) : null,
    });
    map.set(itemId, list);
  }
  return map;
}

async function readSessionLookup(sessionIds: string[]) {
  const sb = getSupabaseClient();
  const map = new Map<string, {
    title: string;
    deskId: string | null;
    deskName: string | null;
    deskSlug: string | null;
  }>();
  if (!sb || sessionIds.length === 0) return map;
  const { data } = await sb
    .from("narrative_sessions")
    .select("id,title,desk_id,narrative_desks(name,slug)")
    .in("id", sessionIds);
  for (const row of data ?? []) {
    const desk = Array.isArray(row.narrative_desks)
      ? row.narrative_desks[0]
      : row.narrative_desks;
    map.set(String(row.id), {
      title: String(row.title ?? "Untitled narrative"),
      deskId: row.desk_id ? String(row.desk_id) : null,
      deskName: desk?.name ? String(desk.name) : null,
      deskSlug: desk?.slug ? String(desk.slug) : null,
    });
  }
  return map;
}

async function readUserBankEntries(
  ids: string[],
  actorId: string | null,
): Promise<Map<string, CatalystUserBankEntry[]>> {
  const sb = getSupabaseClient();
  const map = new Map<string, CatalystUserBankEntry[]>();
  if (!sb || ids.length === 0) return map;
  const userIds = ["system", actorId].filter(Boolean) as string[];
  const { data, error } = await sb
    .from("narrative_user_catalyst_bank")
    .select("*")
    .in("riskflow_item_id", ids)
    .in("user_id", userIds)
    .limit(500);
  if (error) return map;

  for (const row of data ?? []) {
    const itemId = String(row.riskflow_item_id);
    const list = map.get(itemId) ?? [];
    list.push({
      userId: String(row.user_id),
      deskId: row.desk_id ? String(row.desk_id) : null,
      sessionId: row.narrative_session_id ? String(row.narrative_session_id) : null,
      role: String(row.role ?? "candidate"),
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      deskFit: row.desk_fit ? String(row.desk_fit) : null,
      status: String(row.status ?? "active"),
      notes: row.notes ? String(row.notes) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    });
    map.set(itemId, list);
  }
  return map;
}

async function upsertUserBankRows(input: {
  userId: string;
  deskId: string;
  sessionId: string;
  catalystIds: string[];
  role: string;
  tags: string[];
  deskFit: string | null;
  notes: string | null;
}): Promise<Record<string, unknown>[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];
  const rows = input.catalystIds.map((riskflowItemId) => ({
    user_id: input.userId,
    desk_id: input.deskId,
    narrative_session_id: input.sessionId,
    riskflow_item_id: riskflowItemId,
    role: input.role,
    tags: input.tags,
    desk_fit: input.deskFit,
    notes: input.notes,
    status: "active",
    source: "riskflow",
  }));
  const { data, error } = await sb
    .from("narrative_user_catalyst_bank")
    .upsert(rows, { onConflict: "user_id,desk_id,riskflow_item_id" })
    .select("*");
  if (error) {
    console.warn("[CatalystBank] user bank upsert skipped", error.message);
    return [];
  }
  return data ?? [];
}

function toCatalystBankBase(row: Record<string, unknown>): CatalystBankItem {
  return {
    id: normalizeCatalystId(String(row.tweet_id)),
    headline: String(row.headline ?? "Untitled catalyst"),
    body: String(row.body ?? ""),
    source: String(row.source ?? "riskflow"),
    url: row.url ? String(row.url) : null,
    symbols: Array.isArray(row.symbols) ? row.symbols.map(String) : [],
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    sentiment: row.sentiment ? String(row.sentiment) : null,
    ivScore: row.iv_score == null ? null : Number(row.iv_score),
    macroLevel: row.macro_level == null ? null : Number(row.macro_level),
    publishedAt: row.published_at ? String(row.published_at) : null,
    promotedAt: row.promoted_at ? String(row.promoted_at) : null,
    category: row.category ? String(row.category) : null,
    status: row.status ? String(row.status) : null,
    riskType: row.risk_type ? String(row.risk_type) : null,
    marketImpact: row.market_impact ?? null,
    agentNote: row.agent_note ? String(row.agent_note) : null,
    assignments: [],
    bank: [],
    createdAt: row.created_at ? String(row.created_at) : null,
    updatedAt: null,
  };
}

function matchesSearch(
  item: CatalystBankItem,
  params: CatalystBankSearchParams,
): boolean {
  const q = params.q?.trim().toLowerCase();
  const tag = params.tag?.trim().toLowerCase();
  if (tag && !item.tags.some((value) => value.toLowerCase() === tag)) return false;
  if (!q) return true;
  return [
    item.headline,
    item.body,
    item.agentNote ?? "",
    item.category ?? "",
    item.riskType ?? "",
    item.tags.join(" "),
    item.symbols.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function sanitizeTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0),
    ),
  ).slice(0, 24);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
