import { getSupabaseClient } from "../../config/supabase.js";
import { normalizeCatalystId } from "../narrative-sensemaking/catalyst-reader.js";
import {
  putSessionArtifact,
  readSessionArtifacts,
  latestArtifacts,
} from "./artifact-store.js";
import { resolveNarrativeDesk, toDesk } from "./default-desk.js";
import {
  addSessionLinks,
  addSessionMessage,
  addSessionTags,
  addWorkEvent,
  readSessionCollections,
} from "./history-store.js";
import {
  buildSessionTitle,
  generateSessionArtifacts,
} from "./session-generator.js";
import type {
  NarrativeSession,
  NarrativeSessionDetail,
  SessionCatalystInput,
  SessionLinkInput,
  SessionTagInput,
} from "./types.js";

export async function listNarrativeSessions(params: {
  deskId?: string | null;
  actorId: string | null;
}): Promise<NarrativeSession[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const desk = await resolveNarrativeDesk(
    params.deskId ?? null,
    params.actorId,
  );
  const { data, error } = await sb
    .from("narrative_sessions")
    .select(sessionFields)
    .eq("desk_id", desk.id)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Session list failed: ${error.message}`);
  return (data ?? []).map(toSession);
}

export async function createNarrativeSession(params: {
  deskId?: string | null;
  title?: string | null;
  color?: string | null;
  query: string;
  catalystIds: string[];
  actorId: string | null;
  links?: SessionLinkInput[];
  tags?: SessionTagInput[];
}): Promise<NarrativeSessionDetail> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const desk = await resolveNarrativeDesk(
    params.deskId ?? null,
    params.actorId,
  );
  const generated = await generateSessionArtifacts({
    catalystIds: params.catalystIds,
    query: params.query,
  });
  const title = buildSessionTitle({
    requestedTitle: params.title,
    generatedHeadline: generated.sensemaking.anchorCatalysts[0]?.headline,
  });
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("narrative_sessions")
    .insert({
      desk_id: desk.id,
      title,
      color: params.color ?? desk.color,
      status: "active",
      created_by: params.actorId,
      updated_by: params.actorId,
      last_opened_at: now,
      generated_at: generated.sensemaking.generatedAt,
    })
    .select(sessionFields)
    .single();

  if (error) throw new Error(`Session create failed: ${error.message}`);
  const session = toSession(data);
  await attachSessionCatalysts({
    sessionId: session.id,
    catalysts: params.catalystIds.map((riskflowItemId) => ({ riskflowItemId })),
    actorId: params.actorId,
  });
  await Promise.all([
    putSessionArtifact({
      sessionId: session.id,
      artifactType: "flow",
      payload: generated.flow,
      createdBy: params.actorId,
    }),
    putSessionArtifact({
      sessionId: session.id,
      artifactType: "timeline",
      payload: generated.timeline,
      createdBy: params.actorId,
    }),
    putSessionArtifact({
      sessionId: session.id,
      artifactType: "docs",
      payload: generated.docs,
      createdBy: params.actorId,
    }),
  ]);
  if (params.query.trim()) {
    await addSessionMessage({
      sessionId: session.id,
      message: { role: "user", content: params.query },
      actorId: params.actorId,
    });
  }
  await addWorkEvent({
    sessionId: session.id,
    agentName: "NarrativeFlow",
    eventType: "session-generated",
    summary: "Generated initial flow, timeline, and docs artifacts.",
    payload: { catalystCount: params.catalystIds.length },
  });
  await addSessionLinks(session.id, params.links ?? []);
  await addSessionTags(
    session.id,
    buildTags(params.tags, generated.sensemaking.narrativeGroups),
  );
  return getNarrativeSessionDetail(session.id);
}

export async function getNarrativeSessionDetail(
  sessionId: string,
): Promise<NarrativeSessionDetail> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  await sb
    .from("narrative_sessions")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", sessionId);
  const { data: sessionRow, error } = await sb
    .from("narrative_sessions")
    .select(
      `${sessionFields}, narrative_desks(id, name, slug, color, map_image_url, map_image_prompt, map_image_updated_at, created_by, created_at, updated_at)`,
    )
    .eq("id", sessionId)
    .single();

  if (error) throw new Error(`Session read failed: ${error.message}`);
  const [collections, artifacts] = await Promise.all([
    readSessionCollections(sessionId),
    readSessionArtifacts(sessionId),
  ]);

  return {
    ...toSession(sessionRow),
    desk: toJoinedDesk(sessionRow.narrative_desks),
    catalysts: collections.catalysts,
    artifacts: latestArtifacts(artifacts),
    artifactVersions: artifacts,
    messages: collections.messages,
    workEvents: collections.workEvents,
    links: collections.links,
    tags: collections.tags,
  };
}

export async function updateNarrativeSession(params: {
  sessionId: string;
  title?: string;
  color?: string;
  status?: string;
  coverImageUrl?: string | null;
  coverImagePrompt?: string | null;
  actorId: string | null;
}): Promise<NarrativeSessionDetail> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const patch: Record<string, unknown> = { updated_by: params.actorId };
  if (params.title) patch.title = params.title;
  if (params.color) patch.color = params.color;
  if (params.status) patch.status = params.status;
  if (params.coverImageUrl !== undefined)
    patch.cover_image_url = params.coverImageUrl;
  if (params.coverImagePrompt !== undefined)
    patch.cover_image_prompt = params.coverImagePrompt;
  if (
    params.coverImageUrl !== undefined ||
    params.coverImagePrompt !== undefined
  ) {
    patch.cover_image_updated_at = new Date().toISOString();
  }

  const { error } = await sb
    .from("narrative_sessions")
    .update(patch)
    .eq("id", params.sessionId);
  if (error) throw new Error(`Session update failed: ${error.message}`);
  return getNarrativeSessionDetail(params.sessionId);
}

export async function deleteNarrativeSession(
  sessionId: string,
): Promise<{ id: string; deleted: true }> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { error } = await sb
    .from("narrative_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw new Error(`Session delete failed: ${error.message}`);
  return { id: sessionId, deleted: true };
}

export async function attachSessionCatalysts(params: {
  sessionId: string;
  catalysts: SessionCatalystInput[];
  actorId: string | null;
}): Promise<Record<string, unknown>[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");
  if (params.catalysts.length === 0) return [];

  const rows = params.catalysts.map((item) => ({
    session_id: params.sessionId,
    riskflow_item_id: normalizeCatalystId(item.riskflowItemId),
    role: item.role ?? "anchor",
    conflict_score: item.conflictScore ?? null,
    conflict_label: item.conflictLabel ?? null,
    selected_by: params.actorId,
  }));
  const { data, error } = await sb
    .from("narrative_session_catalysts")
    .upsert(rows, { onConflict: "session_id,riskflow_item_id" })
    .select("*");

  if (error) throw new Error(`Catalyst attach failed: ${error.message}`);
  return data ?? [];
}

export async function replaceSessionCatalysts(params: {
  sessionId: string;
  catalysts: SessionCatalystInput[];
  actorId: string | null;
}): Promise<Record<string, unknown>[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { error } = await sb
    .from("narrative_session_catalysts")
    .delete()
    .eq("session_id", params.sessionId);
  if (error) throw new Error(`Catalyst replace failed: ${error.message}`);

  const rows = await attachSessionCatalysts(params);
  await addWorkEvent({
    sessionId: params.sessionId,
    agentName: "NarrativeFlow",
    eventType: "catalysts-refined",
    summary: "Replaced the session catalyst list.",
    payload: { catalystCount: rows.length },
  });
  return rows;
}

export async function removeSessionCatalyst(params: {
  sessionId: string;
  riskflowItemId: string;
}): Promise<{ riskflowItemId: string; removed: true }> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const riskflowItemId = normalizeCatalystId(params.riskflowItemId);
  const { error } = await sb
    .from("narrative_session_catalysts")
    .delete()
    .eq("session_id", params.sessionId)
    .eq("riskflow_item_id", riskflowItemId);
  if (error) throw new Error(`Catalyst remove failed: ${error.message}`);

  return { riskflowItemId, removed: true };
}

function buildTags(
  requested: SessionTagInput[] | undefined,
  groups: { id: string }[],
): SessionTagInput[] {
  const generated = groups.slice(0, 8).map((group) => ({
    tag: group.id,
    confidence: 0.7,
    source: "sensemaking",
  }));
  return [...(requested ?? []), ...generated];
}

function toJoinedDesk(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return toDesk(row as Record<string, unknown>);
}

const sessionFields =
  "id, desk_id, title, color, status, created_by, updated_by, last_opened_at, generated_at, cover_image_url, cover_image_prompt, cover_image_updated_at, created_at, updated_at";

function toSession(row: Record<string, unknown>): NarrativeSession {
  return {
    id: String(row.id),
    deskId: String(row.desk_id),
    title: String(row.title),
    color: String(row.color ?? "#c79f4a"),
    status: String(row.status ?? "active"),
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    lastOpenedAt: row.last_opened_at ? String(row.last_opened_at) : null,
    generatedAt: row.generated_at ? String(row.generated_at) : null,
    coverImageUrl: row.cover_image_url ? String(row.cover_image_url) : null,
    coverImagePrompt: row.cover_image_prompt
      ? String(row.cover_image_prompt)
      : null,
    coverImageUpdatedAt: row.cover_image_updated_at
      ? String(row.cover_image_updated_at)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
