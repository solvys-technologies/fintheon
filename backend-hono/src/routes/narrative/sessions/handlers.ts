import type { Context } from "hono";
import {
  isNarrativeArtifactType,
  putSessionArtifact,
} from "../../../services/narrative-sessions/artifact-store.js";
import {
  addSessionLinks,
  addSessionMessage,
  readSessionWorkEvents,
} from "../../../services/narrative-sessions/history-store.js";
import {
  attachSessionCatalysts,
  createNarrativeSession,
  deleteNarrativeSession,
  getNarrativeSessionDetail,
  listNarrativeSessions,
  removeSessionCatalyst,
  replaceSessionCatalysts,
  updateNarrativeSession,
} from "../../../services/narrative-sessions/session-store.js";
import type { SessionLinkInput } from "../../../services/narrative-sessions/types.js";
import {
  artifactSchema,
  attachCatalystsSchema,
  createSessionSchema,
  messageSchema,
  updateSessionSchema,
} from "./validation.js";

export async function handleListSessions(c: Context): Promise<Response> {
  try {
    const sessions = await listNarrativeSessions({
      deskId: c.req.query("deskId") ?? null,
      actorId: getActorId(c),
    });
    return c.json({ sessions });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleCreateSession(c: Context): Promise<Response> {
  const parsed = createSessionSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);

  const catalystIds = Array.from(new Set(parsed.data.catalystIds));
  if (catalystIds.length < 3) {
    return c.json(
      { error: "Attach at least 3 RiskFlow catalysts to begin." },
      400,
    );
  }

  try {
    const session = await createNarrativeSession({
      ...parsed.data,
      catalystIds,
      actorId: getActorId(c),
    });
    return c.json({ session }, 201);
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleGetSession(c: Context): Promise<Response> {
  try {
    const session = await getNarrativeSessionDetail(c.req.param("id"));
    return c.json({ session });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleUpdateSession(c: Context): Promise<Response> {
  const parsed = updateSessionSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);

  try {
    const session = await updateNarrativeSession({
      sessionId: c.req.param("id"),
      ...parsed.data,
      actorId: getActorId(c),
    });
    return c.json({ session });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleDeleteSession(c: Context): Promise<Response> {
  try {
    const result = await deleteNarrativeSession(c.req.param("id"));
    return c.json(result);
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleAttachCatalysts(c: Context): Promise<Response> {
  const parsed = attachCatalystsSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);

  const catalysts = normalizeCatalystBody(parsed.data);
  try {
    const rows = await attachSessionCatalysts({
      sessionId: c.req.param("id"),
      catalysts,
      actorId: getActorId(c),
    });
    return c.json({ catalysts: rows });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleReplaceCatalysts(c: Context): Promise<Response> {
  const parsed = attachCatalystsSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);

  const catalysts = normalizeCatalystBody(parsed.data);
  try {
    const rows = await replaceSessionCatalysts({
      sessionId: c.req.param("id"),
      catalysts,
      actorId: getActorId(c),
    });
    return c.json({ catalysts: rows });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleRemoveCatalyst(c: Context): Promise<Response> {
  try {
    const result = await removeSessionCatalyst({
      sessionId: c.req.param("id"),
      riskflowItemId: c.req.param("riskflowItemId"),
    });
    return c.json(result);
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleAddMessage(c: Context): Promise<Response> {
  const parsed = messageSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);

  try {
    const message = await addSessionMessage({
      sessionId: c.req.param("id"),
      message: parsed.data,
      actorId: getActorId(c),
    });
    return c.json({ message }, 201);
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handleGetWorkEvents(c: Context): Promise<Response> {
  try {
    const workEvents = await readSessionWorkEvents(c.req.param("id"));
    return c.json({ workEvents });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

export async function handlePutArtifact(c: Context): Promise<Response> {
  const artifactType = c.req.param("type");
  if (!isNarrativeArtifactType(artifactType)) {
    return c.json({ error: "Unsupported narrative artifact type" }, 400);
  }
  const parsed = artifactSchema.safeParse(await readJson(c));
  if (!parsed.success) return validationError(c, parsed.error.issues);

  try {
    const sessionId = c.req.param("id");
    const artifact = await putSessionArtifact({
      sessionId,
      artifactType,
      payload: parsed.data.payload,
      createdBy: getActorId(c),
    });
    if (artifactType === "docs")
      await addSessionLinks(sessionId, extractLinks(parsed.data.payload));
    return c.json({ artifact });
  } catch (err) {
    return handleSessionError(c, err);
  }
}

async function readJson(c: Context): Promise<unknown> {
  return c.req.json().catch(() => ({}));
}

function getActorId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anon" || userId === "anonymous") return null;
  return userId;
}

function validationError(c: Context, issues: unknown): Response {
  return c.json({ error: "validation failed", issues }, 400);
}

function normalizeCatalystBody(data: {
  catalystIds: string[];
  catalysts: {
    riskflowItemId: string;
    role?: string;
    conflictScore?: number | null;
    conflictLabel?: string | null;
  }[];
}) {
  return [
    ...data.catalysts,
    ...data.catalystIds.map((riskflowItemId) => ({ riskflowItemId })),
  ];
}

function handleSessionError(c: Context, err: unknown): Response {
  const message =
    err instanceof Error ? err.message : "Narrative session failed";
  const status = message.includes("not configured") ? 503 : 500;
  console.error("[NarrativeSessions]", message);
  return c.json({ error: message }, status);
}

function extractLinks(payload: Record<string, unknown>): SessionLinkInput[] {
  const links = Array.isArray(payload.links) ? payload.links : [];
  return links
    .filter((link): link is Record<string, unknown> =>
      Boolean(link && typeof link === "object"),
    )
    .map((link) => ({
      url: String(link.url ?? ""),
      title: link.title ? String(link.title) : null,
      source: link.source ? String(link.source) : "docs",
      summary: link.summary ? String(link.summary) : null,
    }))
    .filter(
      (link) =>
        link.url.startsWith("http://") || link.url.startsWith("https://"),
    );
}
