import { getColiseumClient, toStringArray } from "./db.js";
import { resolveColiseumDeskId } from "./desks.js";
import type { DeskProfile } from "./types.js";

export interface ProfileUpdate {
  displayName: string;
  bio: string;
  archetypes: string[];
  brokerClassification?: string | null;
  propFirmClassification?: string | null;
  affiliateUrl?: string | null;
  affiliateDisclosure?: string | null;
  affiliateRelationship?: string | null;
}

export async function readDeskProfile(
  deskId: string | null,
  actorId: string | null,
): Promise<DeskProfile> {
  const resolvedDeskId = await resolveColiseumDeskId(deskId, actorId);
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("coliseum_desk_profiles")
    .select("*")
    .eq("desk_id", resolvedDeskId)
    .maybeSingle();

  if (error) throw new Error(`Desk profile lookup failed: ${error.message}`);
  if (data) return toProfile(data);
  return defaultProfile(resolvedDeskId, actorId);
}

export async function saveDeskProfile(input: {
  deskId: string;
  actorId: string;
  profile: ProfileUpdate;
}): Promise<DeskProfile> {
  const sb = getColiseumClient();
  const row = {
    desk_id: input.deskId,
    display_name: input.profile.displayName,
    bio: input.profile.bio,
    archetypes: input.profile.archetypes,
    broker_classification: input.profile.brokerClassification ?? null,
    prop_firm_classification: input.profile.propFirmClassification ?? null,
    affiliate_url: input.profile.affiliateUrl ?? null,
    affiliate_disclosure: input.profile.affiliateDisclosure ?? null,
    affiliate_relationship: input.profile.affiliateRelationship ?? null,
    updated_by: input.actorId,
  };
  const { data, error } = await sb
    .from("coliseum_desk_profiles")
    .upsert(row, { onConflict: "desk_id" })
    .select("*")
    .single();

  if (error) throw new Error(`Desk profile save failed: ${error.message}`);
  return toProfile(data);
}

function defaultProfile(deskId: string, actorId: string | null): DeskProfile {
  const now = new Date().toISOString();
  return {
    deskId,
    displayName: "Priced In Capital",
    bio: "Desk-first macro and market narrative research.",
    archetypes: ["macro", "policy watcher"],
    brokerClassification: "self-directed",
    propFirmClassification: "none",
    affiliateUrl: null,
    affiliateDisclosure: null,
    affiliateRelationship: null,
    createdBy: actorId ?? "system",
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function toProfile(row: Record<string, unknown>): DeskProfile {
  return {
    deskId: String(row.desk_id),
    displayName: String(row.display_name ?? "Priced In Capital"),
    bio: String(row.bio ?? ""),
    archetypes: toStringArray(row.archetypes),
    brokerClassification: row.broker_classification
      ? String(row.broker_classification)
      : null,
    propFirmClassification: row.prop_firm_classification
      ? String(row.prop_firm_classification)
      : null,
    affiliateUrl: row.affiliate_url ? String(row.affiliate_url) : null,
    affiliateDisclosure: row.affiliate_disclosure
      ? String(row.affiliate_disclosure)
      : null,
    affiliateRelationship: row.affiliate_relationship
      ? String(row.affiliate_relationship)
      : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
