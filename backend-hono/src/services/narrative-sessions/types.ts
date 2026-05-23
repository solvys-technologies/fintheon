import type { SensemakingResponse } from "../narrative-sensemaking/types.js";

export type NarrativeArtifactType =
  | "flow"
  | "timeline"
  | "docs"
  | "situation-map"
  | "agent-work";

export interface NarrativeDesk {
  id: string;
  name: string;
  slug: string;
  color: string;
  mapImageUrl: string | null;
  mapImagePrompt: string | null;
  mapImageUpdatedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeSession {
  id: string;
  deskId: string;
  title: string;
  color: string;
  status: string;
  createdBy: string | null;
  updatedBy: string | null;
  lastOpenedAt: string | null;
  generatedAt: string | null;
  coverImageUrl: string | null;
  coverImagePrompt: string | null;
  coverImageUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCatalystInput {
  riskflowItemId: string;
  role?: string;
  conflictScore?: number | null;
  conflictLabel?: string | null;
}

export interface SessionMessageInput {
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SessionLinkInput {
  url: string;
  title?: string | null;
  source?: string | null;
  summary?: string | null;
}

export interface SessionTagInput {
  tag: string;
  confidence?: number;
  source?: string;
}

export interface NarrativeSessionArtifact {
  id: string;
  sessionId: string;
  artifactType: NarrativeArtifactType;
  payload: Record<string, unknown>;
  version: number;
  createdBy: string | null;
  createdAt: string;
}

export interface NarrativeSessionDetail extends NarrativeSession {
  desk: NarrativeDesk | null;
  catalysts: Record<string, unknown>[];
  artifacts: Record<string, NarrativeSessionArtifact>;
  artifactVersions: NarrativeSessionArtifact[];
  messages: Record<string, unknown>[];
  workEvents: Record<string, unknown>[];
  links: Record<string, unknown>[];
  tags: Record<string, unknown>[];
}

export interface GeneratedSessionArtifacts {
  flow: Record<string, unknown>;
  timeline: Record<string, unknown>;
  docs: Record<string, unknown>;
  sensemaking: SensemakingResponse;
}
