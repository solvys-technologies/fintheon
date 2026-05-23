import { buildSensemakingMap } from "../narrative-sensemaking/sensemaker.js";
import type { GeneratedSessionArtifacts } from "./types.js";

export async function generateSessionArtifacts(params: {
  catalystIds: string[];
  query: string;
}): Promise<GeneratedSessionArtifacts> {
  const sensemaking = await buildSensemakingMap({
    query: params.query,
    attachedHeadlineIds: params.catalystIds,
    orientation: "horizontal",
    renderMode: "flow",
  });

  return {
    sensemaking,
    flow: {
      anchorCatalysts: sensemaking.anchorCatalysts,
      relatedCatalysts: sensemaking.relatedCatalysts,
      narrativeGroups: sensemaking.narrativeGroups,
      mermaidSource: sensemaking.mermaidSource,
      synthesisSummary: sensemaking.synthesisSummary,
      forecast: sensemaking.forecast,
      generatedAt: sensemaking.generatedAt,
    },
    timeline: {
      nodes: sensemaking.timelineNodes,
      edges: sensemaking.timelineEdges,
      generatedAt: sensemaking.generatedAt,
    },
    docs: {
      title: buildDocumentTitle(sensemaking.anchorCatalysts[0]?.headline),
      summary: sensemaking.synthesisSummary,
      forecast: sensemaking.forecast,
      links: [],
      generatedAt: sensemaking.generatedAt,
    },
  };
}

export function buildSessionTitle(params: {
  requestedTitle?: string | null;
  generatedHeadline?: string | null;
}): string {
  const requested = params.requestedTitle?.trim();
  if (requested) return requested.slice(0, 120);

  const headline = params.generatedHeadline?.trim();
  if (headline) return headline.slice(0, 120);

  return "Narrative Desk Session";
}

function buildDocumentTitle(headline: string | null | undefined): string {
  if (!headline) return "Narrative Session Brief";
  return `Narrative Brief: ${headline.slice(0, 96)}`;
}
