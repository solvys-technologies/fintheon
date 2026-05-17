export type NarrativeEvidenceSource = "theme" | "riskflow" | "lounge";

export type NarrativeEvidenceStance = "supports" | "contradicts" | "neutral";

export type NarrativeRoutingStatus =
  | "candidate"
  | "needs_research"
  | "promoted"
  | "rejected"
  | "pinned";

export interface NarrativeEvidence {
  id: string;
  hypothesisId: string;
  sourceType: NarrativeEvidenceSource;
  source?: NarrativeEvidenceSource;
  sourceId: string;
  title: string;
  summary?: string;
  stance: NarrativeEvidenceStance;
  confidence: number;
  observedAt: string;
  symbols?: string[];
  tags?: string[];
}

export interface NarrativeDeliberationEntry {
  id: string;
  hypothesisId: string;
  agentId: string;
  agentName: string;
  stance: NarrativeEvidenceStance;
  summary: string;
  confidence: number;
  createdAt: string;
  sourceSessionId: string | null;
}

export interface NarrativeRoutingDecision {
  status: NarrativeRoutingStatus;
  rationale: string;
  nextAction: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface NarrativeDeliberationSummary {
  status: "pending" | "active" | "consensus";
  consensus: string | null;
  entries: NarrativeDeliberationEntry[];
}

export interface NarrativeHypothesis {
  id: string;
  title: string;
  thesis: string;
  confidence: number;
  corroborationScore: number;
  source: "fallback" | "lounge";
  themeId?: string | null;
  themeIds: string[];
  catalystIds: string[];
  symbols: string[];
  tags: string[];
  evidence: NarrativeEvidence[];
  deliberationSummary: NarrativeDeliberationSummary;
  routingDecision: NarrativeRoutingDecision;
  createdAt: string;
  updatedAt: string;
}

export interface NarrativeProjection {
  hypotheses: NarrativeHypothesis[];
  generatedAt: string;
  source: "fallback" | "lounge";
  fallbackReason: string | null;
}
