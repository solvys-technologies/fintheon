import { getSupabaseClient } from "../../config/supabase.js";
import { ensureDeskVault } from "../file-room/paths.js";
import type { NarrativeDesk } from "./types.js";

const DEFAULT_DESK = {
  name: "Priced In Capital",
  slug: "priced-in-capital",
  color: "#c79f4a",
};
const deskFields =
  "id, name, slug, color, map_image_url, map_image_prompt, map_image_updated_at, created_by, created_at, updated_at";

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
    .select(deskFields)
    .single();

  if (error) throw new Error(`Default desk unavailable: ${error.message}`);
  const desk = toDesk(data);
  await ensureDeskVault(desk);
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
    .select(deskFields)
    .eq("id", deskId)
    .single();

  if (error) throw new Error(`Desk not found: ${error.message}`);
  const desk = toDesk(data);
  await ensureDeskVault(desk);
  return desk;
}

export async function updateNarrativeDeskMap(params: {
  deskId?: string | null;
  actorId: string | null;
  mapImageUrl?: string | null;
  mapImagePrompt?: string | null;
}): Promise<NarrativeDesk> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const desk = await resolveNarrativeDesk(
    params.deskId ?? null,
    params.actorId,
  );
  const patch: Record<string, unknown> = {};
  if (params.mapImageUrl !== undefined)
    patch.map_image_url = params.mapImageUrl;
  if (params.mapImagePrompt !== undefined)
    patch.map_image_prompt = params.mapImagePrompt;
  if (params.mapImageUrl !== undefined || params.mapImagePrompt !== undefined) {
    patch.map_image_updated_at = new Date().toISOString();
  }

  const { data, error } = await sb
    .from("narrative_desks")
    .update(patch)
    .eq("id", desk.id)
    .select(deskFields)
    .single();

  if (error) throw new Error(`DeskMap update failed: ${error.message}`);
  return toDesk(data);
}

export function toDesk(row: Record<string, unknown>): NarrativeDesk {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    color: String(row.color ?? "#c79f4a"),
    mapImageUrl: row.map_image_url ? String(row.map_image_url) : null,
    mapImagePrompt: row.map_image_prompt ? String(row.map_image_prompt) : null,
    mapImageUpdatedAt: row.map_image_updated_at
      ? String(row.map_image_updated_at)
      : null,
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
  if (error)
    throw new Error(`Default desk membership failed: ${error.message}`);
}
