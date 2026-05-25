import { getColiseumClient, isAuthedActor, isLocalDevActor } from "./db.js";
import { readDeskCreatedBy } from "./desks.js";
import type { PermissionResult } from "./types.js";

const PUBLISH_ROLES = new Set(["owner", "manager"]);
const DRAFT_ROLES = new Set(["owner", "manager", "member"]);

export async function readDeskPermission(
  deskId: string,
  userId: string | null,
): Promise<PermissionResult> {
  if (!isAuthedActor(userId)) {
    return { role: null, canDraft: false, canPublish: false };
  }

  const role = await readMembershipRole(deskId, userId);
  if (role) {
    return {
      role,
      canDraft: DRAFT_ROLES.has(role),
      canPublish: PUBLISH_ROLES.has(role),
    };
  }

  const createdBy = await readDeskCreatedBy(deskId);
  if (createdBy === userId || isLocalDevActor(userId)) {
    return { role: "owner", canDraft: true, canPublish: true };
  }

  return { role: null, canDraft: false, canPublish: false };
}

export async function requireCanDraft(
  deskId: string,
  userId: string | null,
): Promise<PermissionResult> {
  const permission = await readDeskPermission(deskId, userId);
  if (!permission.canDraft) throw new Error("Desk membership required.");
  return permission;
}

export async function requireCanPublish(
  deskId: string,
  userId: string | null,
): Promise<PermissionResult> {
  const permission = await readDeskPermission(deskId, userId);
  if (!permission.canPublish) throw new Error("Desk manager permission required.");
  return permission;
}

async function readMembershipRole(
  deskId: string,
  userId: string,
): Promise<string | null> {
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("narrative_desk_members")
    .select("role")
    .eq("desk_id", deskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Desk permission lookup failed: ${error.message}`);
  return data?.role ? String(data.role) : null;
}
