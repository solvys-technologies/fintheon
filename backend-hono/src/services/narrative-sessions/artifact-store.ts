import { getSupabaseClient } from "../../config/supabase.js";
import type {
  NarrativeArtifactType,
  NarrativeSessionArtifact,
} from "./types.js";

export const narrativeArtifactTypes = [
  "flow",
  "timeline",
  "docs",
  "situation-map",
  "agent-work",
] as const;

export function isNarrativeArtifactType(
  value: string,
): value is NarrativeArtifactType {
  return narrativeArtifactTypes.includes(value as NarrativeArtifactType);
}

export async function putSessionArtifact(params: {
  sessionId: string;
  artifactType: NarrativeArtifactType;
  payload: Record<string, unknown>;
  createdBy: string | null;
}): Promise<NarrativeSessionArtifact> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const version = await readNextArtifactVersion(
    params.sessionId,
    params.artifactType,
  );
  const { data, error } = await sb
    .from("narrative_session_artifacts")
    .insert({
      session_id: params.sessionId,
      artifact_type: params.artifactType,
      payload: params.payload,
      version,
      created_by: params.createdBy,
    })
    .select(
      "id, session_id, artifact_type, payload, version, created_by, created_at",
    )
    .single();

  if (error) throw new Error(`Artifact save failed: ${error.message}`);
  return toArtifact(data);
}

export async function readSessionArtifacts(
  sessionId: string,
): Promise<NarrativeSessionArtifact[]> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data, error } = await sb
    .from("narrative_session_artifacts")
    .select(
      "id, session_id, artifact_type, payload, version, created_by, created_at",
    )
    .eq("session_id", sessionId)
    .order("artifact_type", { ascending: true })
    .order("version", { ascending: false });

  if (error) throw new Error(`Artifact read failed: ${error.message}`);
  return (data ?? []).map(toArtifact);
}

export function latestArtifacts(
  artifacts: NarrativeSessionArtifact[],
): Record<string, NarrativeSessionArtifact> {
  const latest: Record<string, NarrativeSessionArtifact> = {};
  for (const artifact of artifacts) {
    if (latest[artifact.artifactType]) continue;
    latest[artifact.artifactType] = artifact;
  }
  return latest;
}

async function readNextArtifactVersion(
  sessionId: string,
  artifactType: NarrativeArtifactType,
): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) throw new Error("Supabase is not configured");

  const { data, error } = await sb
    .from("narrative_session_artifacts")
    .select("version")
    .eq("session_id", sessionId)
    .eq("artifact_type", artifactType)
    .order("version", { ascending: false })
    .limit(1);

  if (error) throw new Error(`Artifact version read failed: ${error.message}`);
  return Number(data?.[0]?.version ?? 0) + 1;
}

function toArtifact(row: Record<string, unknown>): NarrativeSessionArtifact {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    artifactType: String(row.artifact_type) as NarrativeArtifactType,
    payload: (row.payload as Record<string, unknown>) ?? {},
    version: Number(row.version ?? 1),
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
  };
}
