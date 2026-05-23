import { getSupabaseClient } from "../../config/supabase.js";
import type {
  SessionLinkInput,
  SessionMessageInput,
  SessionTagInput,
} from "./types.js";

export interface SessionCollections {
  catalysts: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  workEvents: Record<string, unknown>[];
  links: Record<string, unknown>[];
  tags: Record<string, unknown>[];
}

export async function readSessionCollections(
  sessionId: string,
): Promise<SessionCollections> {
  const [catalysts, messages, workEvents, links, tags] = await Promise.all([
    readRows("narrative_session_catalysts", sessionId, "created_at", true),
    readRows("narrative_session_messages", sessionId, "created_at", true),
    readRows("narrative_agent_work_events", sessionId, "created_at", true),
    readRows("narrative_session_links", sessionId, "created_at", false),
    readRows("narrative_session_tags", sessionId, "created_at", false),
  ]);

  return { catalysts, messages, workEvents, links, tags };
}

export async function addSessionMessage(params: {
  sessionId: string;
  message: SessionMessageInput;
  actorId: string | null;
}): Promise<Record<string, unknown>> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data, error } = await sb
    .from("narrative_session_messages")
    .insert({
      session_id: params.sessionId,
      role: params.message.role,
      content: params.message.content,
      metadata: params.message.metadata ?? {},
      created_by: params.actorId,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Message save failed: ${error.message}`);
  return data;
}

export async function readSessionWorkEvents(
  sessionId: string,
): Promise<Record<string, unknown>[]> {
  return readRows("narrative_agent_work_events", sessionId, "created_at", true);
}

export async function addSessionLinks(
  sessionId: string,
  links: SessionLinkInput[],
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb || links.length === 0) return;

  const rows = links.map((link) => ({ session_id: sessionId, ...link }));
  const { error } = await sb.from("narrative_session_links").insert(rows);
  if (error) throw new Error(`Session links save failed: ${error.message}`);
}

export async function addSessionTags(
  sessionId: string,
  tags: SessionTagInput[],
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb || tags.length === 0) return;

  const rows = tags.map((tag) => ({ session_id: sessionId, ...tag }));
  const { error } = await sb
    .from("narrative_session_tags")
    .upsert(rows, { onConflict: "session_id,tag,source" });
  if (error) throw new Error(`Session tags save failed: ${error.message}`);
}

export async function addWorkEvent(params: {
  sessionId: string;
  agentName: string;
  eventType: string;
  summary: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { error } = await sb.from("narrative_agent_work_events").insert({
    session_id: params.sessionId,
    agent_name: params.agentName,
    event_type: params.eventType,
    summary: params.summary,
    payload: params.payload,
  });
  if (error) throw new Error(`Work event save failed: ${error.message}`);
}

async function readRows(
  table: string,
  sessionId: string,
  orderColumn: string,
  ascending: boolean,
): Promise<Record<string, unknown>[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");
  const { data, error } = await sb
    .from(table)
    .select("*")
    .eq("session_id", sessionId)
    .order(orderColumn, { ascending });
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return data ?? [];
}
