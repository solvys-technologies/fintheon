export type SensemakingOrientation = "horizontal" | "vertical";
export type SensemakingRenderMode = "flow" | "mermaid";
export type SensemakingCatalystRole = "anchor" | "related";

export interface NarrativeHeadlineOption {
  id: string;
  headline: string;
  summary: string;
  source: string;
  severity: string;
  publishedAt: string;
  ivScore?: number;
  macroLevel?: number;
  symbols: string[];
  tags: string[];
  narrativeThreads: string[];
}

export interface SensemakingCatalyst {
  id: string;
  headline: string;
  summary: string;
  source: string;
  category: string;
  sentiment: string;
  ivScore: number;
  publishedAt: string;
  promotedAt: string | null;
  symbols: string[];
  tags: string[];
  narrativeThreads: string[];
  marketImpact: string | null;
  agentNote: string | null;
  role: SensemakingCatalystRole;
  relationScore: number;
  relationReason: string;
}

export interface SensemakingNarrativeGroup {
  id: string;
  title: string;
  catalystIds: string[];
  summary: string;
  timeSpan: string;
}

export interface SensemakingTimelineNode {
  id: string;
  catalystId: string;
  role: SensemakingCatalystRole;
  title: string;
  narrativeIds: string[];
  timestamp: string;
  timeLabel: string;
  summary: string;
  relationReason: string;
}

export interface SensemakingTimelineEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface SensemakingResponse {
  anchorCatalysts: SensemakingCatalyst[];
  relatedCatalysts: SensemakingCatalyst[];
  narrativeGroups: SensemakingNarrativeGroup[];
  timelineNodes: SensemakingTimelineNode[];
  timelineEdges: SensemakingTimelineEdge[];
  synthesisSummary: string;
  forecast: { confidence: number; outcome: string; rationale: string } | null;
  mermaidSource: string;
  generatedAt: string;
}
