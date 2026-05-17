import { agentBus } from "../agent-bus/bus.js";
import type {
  HermesAgentId,
  NarrativeHypothesisUpdatedEvent,
} from "../agent-bus/types.js";
import type {
  NarrativeDeliberationEntry,
  NarrativeEvidenceStance,
  NarrativeRoutingStatus,
} from "./types.js";

export interface LoungeBridgeBase {
  dagId: string;
  hypothesisId: string;
  sessionId?: string | null;
  createdAt?: string;
}

export interface LoungeBriefEvent extends LoungeBridgeBase {
  briefId?: string;
  title: string;
  summary: string;
  confidence?: number;
}

export interface LoungeReflectionEvent extends LoungeBridgeBase {
  reflectionId?: string;
  agentId: HermesAgentId | string;
  agentName?: string;
  stance?: NarrativeEvidenceStance;
  reflection: string;
  confidence?: number;
}

export interface LoungeConsensusEvent extends LoungeBridgeBase {
  consensusId?: string;
  consensus: string;
  confidence?: number;
}

export interface LoungeRoutingEvent extends LoungeBridgeBase {
  routingId?: string;
  status: NarrativeRoutingStatus;
  rationale: string;
  decidedBy?: HermesAgentId | string | null;
  confidence?: number;
}

export function publishLoungeBriefUpdate(
  event: LoungeBriefEvent,
): NarrativeHypothesisUpdatedEvent {
  return publishHypothesisUpdate({
    ...event,
    entry: createEntry({
      id: event.briefId ?? `brief:${event.dagId}:${event.hypothesisId}`,
      event,
      agentId: "herald",
      agentName: "Herald",
      stance: "neutral",
      summary: `${event.title}: ${event.summary}`,
      confidence: event.confidence,
    }),
  });
}

export function publishLoungeReflectionUpdate(
  event: LoungeReflectionEvent,
): NarrativeHypothesisUpdatedEvent {
  return publishHypothesisUpdate({
    ...event,
    entry: createEntry({
      id: event.reflectionId ?? `reflection:${event.dagId}:${event.agentId}`,
      event,
      agentId: event.agentId,
      agentName: event.agentName ?? labelAgent(event.agentId),
      stance: event.stance ?? "neutral",
      summary: event.reflection,
      confidence: event.confidence,
    }),
  });
}

export function publishLoungeConsensusUpdate(
  event: LoungeConsensusEvent,
): NarrativeHypothesisUpdatedEvent {
  return publishHypothesisUpdate({
    ...event,
    consensus: event.consensus,
    entry: createEntry({
      id: event.consensusId ?? `consensus:${event.dagId}:${event.hypothesisId}`,
      event,
      agentId: "harper",
      agentName: "Harper",
      stance: "supports",
      summary: event.consensus,
      confidence: event.confidence,
    }),
  });
}

export function publishLoungeRoutingUpdate(
  event: LoungeRoutingEvent,
): NarrativeHypothesisUpdatedEvent {
  const agentId = event.decidedBy ?? "harper";
  return publishHypothesisUpdate({
    ...event,
    routingStatus: event.status,
    entry: createEntry({
      id: event.routingId ?? `routing:${event.dagId}:${event.hypothesisId}`,
      event,
      agentId,
      agentName: labelAgent(agentId),
      stance: event.status === "rejected" ? "contradicts" : "neutral",
      summary: event.rationale,
      confidence: event.confidence,
    }),
  });
}

function publishHypothesisUpdate(input: {
  dagId: string;
  hypothesisId: string;
  sessionId?: string | null;
  createdAt?: string;
  entry: NarrativeDeliberationEntry;
  consensus?: string | null;
  routingStatus?: NarrativeRoutingStatus;
}): NarrativeHypothesisUpdatedEvent {
  const payload: NarrativeHypothesisUpdatedEvent = {
    type: "hypothesis-updated",
    dagId: input.dagId,
    hypothesisId: input.hypothesisId,
    updatedAt: input.createdAt ?? new Date().toISOString(),
    sourceSessionId: input.sessionId ?? null,
    deliberationEntry: input.entry,
    consensus: input.consensus,
    routingStatus: input.routingStatus,
  };

  agentBus.publish<NarrativeHypothesisUpdatedEvent>("surface.narrative", {
    dagId: input.dagId,
    agentId: coerceAgentId(input.entry.agentId),
    surface: "narrative",
    payload,
  });

  return payload;
}

function createEntry(input: {
  id: string;
  event: LoungeBridgeBase;
  agentId: HermesAgentId | string;
  agentName: string;
  stance: NarrativeEvidenceStance;
  summary: string;
  confidence?: number;
}): NarrativeDeliberationEntry {
  return {
    id: input.id,
    hypothesisId: input.event.hypothesisId,
    agentId: input.agentId,
    agentName: input.agentName,
    stance: input.stance,
    summary: input.summary,
    confidence: clampConfidence(input.confidence),
    createdAt: input.event.createdAt ?? new Date().toISOString(),
    sourceSessionId: input.event.sessionId ?? null,
  };
}

function coerceAgentId(agentId: string): HermesAgentId {
  if (agentId === "oracle") return "oracle";
  if (agentId === "feucht") return "feucht";
  if (agentId === "consul") return "consul";
  if (agentId === "herald") return "herald";
  return "harper";
}

function labelAgent(agentId: string): string {
  if (agentId === "oracle") return "Oracle";
  if (agentId === "feucht") return "Feucht";
  if (agentId === "consul") return "Consul";
  if (agentId === "herald") return "Herald";
  if (agentId === "harper") return "Harper";
  return agentId;
}

function clampConfidence(value?: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
