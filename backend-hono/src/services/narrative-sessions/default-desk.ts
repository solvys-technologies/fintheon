import { getSupabaseClient } from "../../config/supabase.js";
import type { NarrativeDesk } from "./types.js";

const DEFAULT_DESK = {
  name: "Priced In Capital",
  slug: "priced-in-capital",
  color: "#c79f4a",
};

export async function ensureDefaultNarrativeDesk(
  createdBy: string | null,
): Promise<NarrativeDesk> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data, error } = await sb
    .from("narrative_desks")
    .upsert(
      { ...DEFAULT_DESK, created_by: createdBy ?? "system" },
      { onConflict: "slug" },
    )
    .select("id, name, slug, color, created_by, created_at, updated_at")
    .single();

  if (error) throw new Error(`Default desk unavailable: ${error.message}`);
  const desk = toDesk(data);
  if (createdBy) await ensureDeskMembership(desk.id, createdBy, "owner");
  return desk;
}

export async function resolveNarrativeDesk(
  deskId: string | null,
  actorId: string | null,
): Promise<NarrativeDesk> {
  if (!deskId) return ensureDefaultNarrativeDesk(actorId);

  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data, error } = await sb
    .from("narrative_desks")
    .select("id, name, slug, color, created_by, created_at, updated_at")
    .eq("id", deskId)
    .single();

  if (error) throw new Error(`Desk not found: ${error.message}`);
  return toDesk(data);
}

export function toDesk(row: Record<string, unknown>): NarrativeDesk {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    color: String(row.color ?? "#c79f4a"),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function ensureDeskMembership(
  deskId: string,
  userId: string,
  role: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("narrative_desk_members")
    .upsert({ desk_id: deskId, user_id: userId, role });
  if (error) throw new Error(`Default desk membership failed: ${error.message}`);
}
