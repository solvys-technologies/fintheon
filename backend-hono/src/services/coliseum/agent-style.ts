import { getColiseumClient, toStringArray } from "./db.js";
import { resolveColiseumDeskId } from "./desks.js";
import type { DeskAgentStyle } from "./types.js";

export interface AgentStyleUpdate {
  archetypeMix: string[];
  houseBias?: string | null;
  preferredEvidenceSources: string[];
  riskPosture?: string | null;
  timeHorizon?: string | null;
  forbiddenClaims: string[];
  customInstruction?: string | null;
}

export async function readDeskAgentStyle(
  deskId: string | null,
  actorId: string | null,
): Promise<DeskAgentStyle | null> {
  const resolvedDeskId = await resolveColiseumDeskId(deskId, actorId);
  return readDeskAgentStyleById(resolvedDeskId);
}

export async function readDeskAgentStyleById(
  deskId: string,
): Promise<DeskAgentStyle | null> {
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("coliseum_desk_agent_styles")
    .select("*")
    .eq("desk_id", deskId)
    .maybeSingle();

  if (error) throw new Error(`Desk style lookup failed: ${error.message}`);
  return data ? toAgentStyle(data) : null;
}

export async function saveDeskAgentStyle(input: {
  deskId: string;
  actorId: string;
  style: AgentStyleUpdate;
}): Promise<DeskAgentStyle> {
  const sb = getColiseumClient();
  const { data, error } = await sb
    .from("coliseum_desk_agent_styles")
    .upsert(
      {
        desk_id: input.deskId,
        archetype_mix: input.style.archetypeMix,
        house_bias: input.style.houseBias ?? null,
        preferred_evidence_sources: input.style.preferredEvidenceSources,
        risk_posture: input.style.riskPosture ?? null,
        time_horizon: input.style.timeHorizon ?? null,
        forbidden_claims: input.style.forbiddenClaims,
        custom_instruction: input.style.customInstruction ?? null,
        updated_by: input.actorId,
      },
      { onConflict: "desk_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`Desk style save failed: ${error.message}`);
  return toAgentStyle(data);
}

export async function buildDeskStyleContext(): Promise<string[]> {
  const deskId = await resolveColiseumDeskId("default", null);
  const style = await readDeskAgentStyleById(deskId);
  if (!style) return [];

  return [
    `- Archetype mix: ${style.archetypeMix.join(", ")}`,
    style.houseBias ? `- House bias: ${style.houseBias}` : "",
    style.riskPosture ? `- Risk posture: ${style.riskPosture}` : "",
    style.timeHorizon ? `- Horizon: ${style.timeHorizon}` : "",
    style.preferredEvidenceSources.length
      ? `- Preferred evidence: ${style.preferredEvidenceSources.join(", ")}`
      : "",
    style.forbiddenClaims.length
      ? `- Forbidden claims: ${style.forbiddenClaims.join("; ")}`
      : "",
    style.customInstruction ? `- Desk note: ${style.customInstruction}` : "",
  ].filter(Boolean);
}

function toAgentStyle(row: Record<string, unknown>): DeskAgentStyle {
  return {
    deskId: String(row.desk_id),
    archetypeMix: toStringArray(row.archetype_mix),
    houseBias: row.house_bias ? String(row.house_bias) : null,
    preferredEvidenceSources: toStringArray(row.preferred_evidence_sources),
    riskPosture: row.risk_posture ? String(row.risk_posture) : null,
    timeHorizon: row.time_horizon ? String(row.time_horizon) : null,
    forbiddenClaims: toStringArray(row.forbidden_claims),
    customInstruction: row.custom_instruction
      ? String(row.custom_instruction)
      : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
