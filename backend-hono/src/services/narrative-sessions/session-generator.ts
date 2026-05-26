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
  if (requested) return toFormalSessionTitle(requested);

  const headline = params.generatedHeadline?.trim();
  if (headline) return toFormalSessionTitle(headline);

  return "Narrative Desk Session";
}

function buildDocumentTitle(headline: string | null | undefined): string {
  if (!headline) return "Narrative Session Brief";
  return `Narrative Brief: ${headline.slice(0, 96)}`;
}

function toFormalSessionTitle(value: string): string {
  const quoted = value.match(/['"]([^'"]{3,80})['"]/);
  if (quoted?.[1]) return trimTitleWords(cleanTitleText(quoted[1]));

  if (/\bTACO\b|Trump Always Chickens Out/i.test(value)) {
    return "Axios TACO Accord";
  }

  const lead = cleanTitleText(
    value
      .replace(/^(track|monitor|watch|analyze|build|create)\s+(the\s+)?/i, "")
      .split(/[:.!?]/)[0] ?? value,
  );
  return trimTitleWords(lead || "Narrative Desk Session");
}

function cleanTitleText(value: string): string {
  return value
    .replace(/\bnarrative\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the\s+/i, "");
}

function trimTitleWords(value: string): string {
  const words = value.split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length === 0) return "Narrative Desk Session";
  return words
    .map((word) =>
      /^[A-Z0-9]{2,}$/.test(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
