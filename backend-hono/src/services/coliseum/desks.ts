import { ensureDefaultNarrativeDesk } from "../narrative-sessions/default-desk.js";
import { getColiseumClient, isLocalDevActor } from "./db.js";

export async function resolveColiseumDeskId(
  deskId: string | null | undefined,
  actorId: string | null,
): Promise<string> {
  if (!deskId || deskId === "default" || deskId === "priced-in-capital") {
    const desk = await ensureDefaultNarrativeDesk(
      isLocalDevActor(actorId) ? actorId : null,
    );
    return desk.id;
  }

  return deskId;
}

export async function readDeskCreatedBy(
  deskId: string,
): Promise<string | null> {
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("narrative_desks")
    .select("created_by")
    .eq("id", deskId)
    .maybeSingle();

  if (error) throw new Error(`Desk lookup failed: ${error.message}`);
  return data?.created_by ? String(data.created_by) : null;
}
