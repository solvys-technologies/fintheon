import type { SensemakingCatalyst } from "../narrative-sensemaking/types.js";

export type CatalystConflictLabel =
  | "confirming"
  | "conflicting"
  | "noise"
  | "unclassified";

export interface NarrativeThreadSeed {
  slug: string;
  title: string;
  color: string;
  keywords: string[];
}

export interface NarrativeTagDecision {
  catalystId: string;
  tags: string[];
  narrativeSlugs: string[];
  confidence: number;
  conflictLabel: CatalystConflictLabel;
  reason: string;
}

export interface CatalystConflictDecision {
  catalystId: string;
  label: CatalystConflictLabel;
  confidence: number;
  reason: string;
}

export interface SituationMapNode {
  id: string;
  kind: "narrative" | "catalyst";
  label: string;
  color: string;
  summary: string;
  catalystId?: string;
  narrativeSlug?: string;
  confidence?: number;
  conflictLabel?: CatalystConflictLabel;
  publishedAt?: string;
}

export interface SituationMapEdge {
  id: string;
  source: string;
  target: string;
  kind: "membership" | "relationship";
  confidence: number;
  label: string;
}

export interface SituationMapResponse {
  deskId: string | null;
  generatedAt: string;
  nodes: SituationMapNode[];
  edges: SituationMapEdge[];
  decisions: NarrativeTagDecision[];
}

export interface ClassificationInput {
  catalysts: SensemakingCatalyst[];
  threads: NarrativeThreadSeed[];
  notes?: string[];
}

export const DEFAULT_FIRST_RUN_NARRATIVES: NarrativeThreadSeed[] = [
  {
    slug: "rate-cut-cycle",
    title: "Rate Cut Cycle",
    color: "#34D399",
    keywords: ["rate cut", "fed cut", "fomc", "powell", "dovish"],
  },
  {
    slug: "price-stability",
    title: "Price Stability",
    color: "#FBBF24",
    keywords: ["cpi", "ppi", "pce", "inflation", "price stability"],
  },
  {
    slug: "maximum-employment",
    title: "Max Employment",
    color: "#A78BFA",
    keywords: ["nfp", "jobs", "unemployment", "payroll", "employment"],
  },
];
