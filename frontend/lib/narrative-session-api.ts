import type {
  NarrativeAgentWorkEvent,
  NarrativeTranscriptEntry,
  NarrativeWorkspaceLink,
  NarrativeWorkspaceSession,
} from "../components/narrative/NarrativeSessionWorkspace";
import type { NarrativeSessionSummary } from "../components/narrative/NarrativeSessionHistory";
import type {
  SensemakingResponse,
  SensemakingTimelineEdge,
  SensemakingTimelineNode,
} from "../components/narrative/sensemaking-types";
import type { ReasoningLevel } from "../components/chat/reasoning";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface CreateNarrativeSessionPayload {
  query: string;
  catalystIds: string[];
  narrativeSlugs: string[];
  title: string;
  color: string;
  reasoningLevel?: ReasoningLevel;
}

export interface NarrativeSessionBundle {
  session: NarrativeWorkspaceSession;
  response: SensemakingResponse | null;
}

export async function fetchNarrativeSessions(): Promise<NarrativeSessionSummary[]> {
  const data = await requestJson<{ sessions?: RawSession[] }>("/api/narrative/sessions");
  return (data.sessions ?? []).map(toSessionSummary);
}

export async function createNarrativeSession(
  payload: CreateNarrativeSessionPayload,
): Promise<NarrativeSessionBundle> {
  const data = await requestJson<{ session?: RawSessionDetail }>("/api/narrative/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: payload.query,
      catalystIds: payload.catalystIds,
      title: payload.title,
      color: payload.color,
      reasoningLevel: payload.reasoningLevel,
      tags: payload.narrativeSlugs.map((tag) => ({
        tag,
        confidence: 1,
        source: "human",
      })),
    }),
  });
  return toSessionBundle(requireSession(data.session));
}

export async function fetchNarrativeSession(id: string): Promise<NarrativeSessionBundle> {
  const data = await requestJson<{ session?: RawSessionDetail }>(
    `/api/narrative/sessions/${encodeURIComponent(id)}`,
  );
  return toSessionBundle(requireSession(data.session));
}

export async function updateNarrativeSession(input: {
  id: string;
  title: string;
  color: string;
}): Promise<NarrativeSessionBundle> {
  const data = await requestJson<{ session?: RawSessionDetail }>(
    `/api/narrative/sessions/${encodeURIComponent(input.id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title, color: input.color }),
    },
  );
  return toSessionBundle(requireSession(data.session));
}

export async function refineNarrativeSession(input: {
  sessionId: string;
  query: string;
  catalystIds: string[];
  orientation: string;
  renderMode: string;
  reasoningLevel?: ReasoningLevel;
}): Promise<NarrativeSessionBundle> {
  const response = await requestJson<SensemakingResponse>("/api/narrative/sensemaking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: input.query,
      attachedHeadlineIds: input.catalystIds,
      orientation: input.orientation,
      renderMode: input.renderMode,
      reasoningLevel: input.reasoningLevel,
    }),
  });

  await Promise.all([
    addNarrativeSessionMessage(input.sessionId, input.query),
    saveNarrativeArtifact(input.sessionId, "flow", {
      anchorCatalysts: response.anchorCatalysts,
      relatedCatalysts: response.relatedCatalysts,
      narrativeGroups: response.narrativeGroups,
      mermaidSource: response.mermaidSource,
      synthesisSummary: response.synthesisSummary,
      forecast: response.forecast,
      generatedAt: response.generatedAt,
    }),
    saveNarrativeArtifact(input.sessionId, "timeline", {
      nodes: response.timelineNodes,
      edges: response.timelineEdges,
      generatedAt: response.generatedAt,
    }),
    saveNarrativeArtifact(input.sessionId, "docs", {
      title: `Narrative Brief: ${response.anchorCatalysts[0]?.headline ?? "Desk Session"}`,
      summary: response.synthesisSummary,
      forecast: response.forecast,
      generatedAt: response.generatedAt,
      links: [],
    }),
  ]);

  return fetchNarrativeSession(input.sessionId);
}

async function addNarrativeSessionMessage(sessionId: string, content: string): Promise<void> {
  if (!content.trim()) return;
  await requestJson(`/api/narrative/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content, metadata: { source: "workspace-composer" } }),
  });
}

async function saveNarrativeArtifact(
  sessionId: string,
  type: "flow" | "timeline" | "docs",
  payload: Record<string, unknown>,
): Promise<void> {
  await requestJson(
    `/api/narrative/sessions/${encodeURIComponent(sessionId)}/artifacts/${type}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    },
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? `Narrative session ${response.status}`);
  }
  return data as T;
}

function requireSession(session: RawSessionDetail | undefined): RawSessionDetail {
  if (!session) throw new Error("Narrative session response was empty");
  return session;
}

function toSessionSummary(session: RawSession): NarrativeSessionSummary {
  return {
    id: String(session.id),
    title: String(session.title ?? "Untitled narrative"),
    updatedAt: String(session.updatedAt ?? session.updated_at ?? new Date().toISOString()),
    catalystCount: toNumber(session.catalystCount ?? session.catalyst_count),
    color: String(session.color ?? "#c79f4a"),
    deskLabel: String(session.desk?.name ?? "Priced In Capital"),
  };
}

function toSessionBundle(detail: RawSessionDetail): NarrativeSessionBundle {
  const response = toSensemakingResponse(detail);
  return {
    response,
    session: {
      id: String(detail.id),
      title: String(detail.title ?? "Untitled narrative"),
      status: String(detail.status ?? "active"),
      color: String(detail.color ?? "#c79f4a"),
      generatedAt: String(
        detail.generatedAt ?? detail.generated_at ?? response?.generatedAt ?? new Date().toISOString(),
      ),
      catalystIds: toCatalystIds(detail.catalysts),
      report: readText(detail.artifacts?.docs?.payload, ["report", "summary", "title"]),
      synthesis: response?.synthesisSummary ?? readText(detail.artifacts?.docs?.payload, ["summary"]),
      webLinks: toLinks(detail),
      workEvents: toWorkEvents(detail.workEvents ?? detail.work_events),
      transcript: toTranscript(detail.messages),
    },
  };
}

function toCatalystIds(value: unknown): string[] {
  return toArray(value)
    .map((item) => String(item.riskflow_item_id ?? item.riskflowItemId ?? ""))
    .filter(Boolean);
}

function toSensemakingResponse(detail: RawSessionDetail): SensemakingResponse | null {
  const flow = detail.artifacts?.flow?.payload;
  if (!flow) return null;
  const timeline = detail.artifacts?.timeline?.payload;
  return {
    anchorCatalysts: toArray(flow.anchorCatalysts) as unknown as SensemakingResponse["anchorCatalysts"],
    relatedCatalysts: toArray(flow.relatedCatalysts) as unknown as SensemakingResponse["relatedCatalysts"],
    narrativeGroups: toArray(flow.narrativeGroups) as unknown as SensemakingResponse["narrativeGroups"],
    timelineNodes: toArray(
      timeline?.nodes ?? flow.timelineNodes,
    ) as unknown as SensemakingTimelineNode[],
    timelineEdges: toArray(
      timeline?.edges ?? flow.timelineEdges,
    ) as unknown as SensemakingTimelineEdge[],
    synthesisSummary: String(flow.synthesisSummary ?? ""),
    forecast: isRecord(flow.forecast)
      ? {
          confidence: toNumber(flow.forecast.confidence),
          outcome: String(flow.forecast.outcome ?? ""),
          rationale: String(flow.forecast.rationale ?? ""),
        }
      : null,
    mermaidSource: String(flow.mermaidSource ?? ""),
    generatedAt: String(flow.generatedAt ?? detail.generatedAt ?? detail.generated_at ?? new Date().toISOString()),
  };
}

function toLinks(detail: RawSessionDetail): NarrativeWorkspaceLink[] {
  const linkedRows = toArray(detail.links).map((link) => ({
    label: String(link.title ?? link.label ?? link.url ?? "Report link"),
    href: String(link.url ?? link.href ?? ""),
    source: link.source ? String(link.source) : undefined,
  }));
  const docLinks = toArray(detail.artifacts?.docs?.payload?.links).map((link) => ({
    label: String(link.title ?? link.label ?? link.url ?? "Report link"),
    href: String(link.url ?? link.href ?? ""),
    source: link.source ? String(link.source) : undefined,
  }));
  return [...linkedRows, ...docLinks].filter((link) => link.href.startsWith("http"));
}

function toWorkEvents(value: unknown): NarrativeAgentWorkEvent[] {
  return toArray(value).map((event, index) => ({
    id: String(event.id ?? `work-${index}`),
    agent: String(event.agent ?? event.agent_name ?? "NarrativeFlow"),
    summary: String(event.summary ?? "Updated narrative workspace."),
    status: event.status ? String(event.status) : String(event.event_type ?? "complete"),
    timestamp: event.timestamp ? String(event.timestamp) : String(event.created_at ?? ""),
  }));
}

function toTranscript(value: unknown): NarrativeTranscriptEntry[] {
  return toArray(value).map((entry, index) => ({
    id: String(entry.id ?? `message-${index}`),
    speaker: String(entry.speaker ?? entry.role ?? "desk"),
    text: String(entry.text ?? entry.content ?? ""),
    timestamp: entry.timestamp ? String(entry.timestamp) : String(entry.created_at ?? ""),
  }));
}

function readText(value: unknown, keys: string[]): string | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    const text = value[key];
    if (typeof text === "string" && text.trim()) return text;
  }
  return undefined;
}

function toArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

interface RawSession extends Record<string, unknown> {
  id?: unknown;
  title?: unknown;
  color?: unknown;
  desk?: { name?: unknown };
}
interface RawSessionDetail extends RawSession {
  artifacts?: Record<string, { payload?: Record<string, unknown> }>;
  catalysts?: unknown;
  messages?: unknown;
  workEvents?: unknown;
  work_events?: unknown;
  links?: unknown;
}
