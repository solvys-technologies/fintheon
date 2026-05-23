import {
  normalizeCatalystId,
  readSensemakingCatalysts,
} from "./catalyst-reader.js";
import type {
  SensemakingCatalyst,
  SensemakingNarrativeGroup,
  SensemakingRequest,
  SensemakingResponse,
  SensemakingTimelineEdge,
  SensemakingTimelineNode,
} from "./types.js";

export async function buildSensemakingMap(
  request: SensemakingRequest,
): Promise<SensemakingResponse> {
  const { anchors, pool } = await readSensemakingCatalysts(
    request.attachedHeadlineIds,
  );
  const anchorIds = new Set(anchors.map((item) => item.id));
  const related = pool
    .filter((item) => !anchorIds.has(item.id))
    .map((item) => scoreRelatedCatalyst(item, anchors))
    .filter((item) => item.relationScore >= 18)
    .sort(sortByRelationThenTime)
    .slice(0, 28);

  const catalysts = [...anchors, ...related].sort(sortByTime);
  const timelineNodes = catalysts.map(toTimelineNode);
  const timelineEdges = buildTimelineEdges(timelineNodes);
  const narrativeGroups = buildNarrativeGroups(catalysts);

  return {
    anchorCatalysts: anchors,
    relatedCatalysts: related,
    narrativeGroups,
    timelineNodes,
    timelineEdges,
    synthesisSummary: buildSummary(
      request.query,
      anchors,
      related,
      narrativeGroups,
      request.reasoningLevel ?? "standard",
    ),
    forecast: buildForecast(anchors, related),
    mermaidSource: buildMermaid(timelineNodes, timelineEdges, request.orientation),
    generatedAt: new Date().toISOString(),
  };
}

function scoreRelatedCatalyst(
  catalyst: SensemakingCatalyst,
  anchors: SensemakingCatalyst[],
): SensemakingCatalyst {
  let score = 0;
  const reasons = new Set<string>();

  for (const anchor of anchors) {
    const sharedNarratives = intersect(catalyst.narrativeThreads, anchor.narrativeThreads);
    const sharedSymbols = intersect(catalyst.symbols, anchor.symbols);
    const sharedTags = intersect(catalyst.tags, anchor.tags);

    if (sharedNarratives.length > 0) {
      score += 42;
      reasons.add(`same narrative: ${sharedNarratives.slice(0, 2).join(", ")}`);
    }
    if (sharedSymbols.length > 0) {
      score += 24;
      reasons.add(`shared symbols: ${sharedSymbols.slice(0, 3).join(", ")}`);
    }
    if (sharedTags.length > 0) {
      score += Math.min(sharedTags.length * 6, 18);
      reasons.add(`shared tags: ${sharedTags.slice(0, 3).join(", ")}`);
    }
    if (catalyst.category === anchor.category) {
      score += 8;
      reasons.add(`same category: ${catalyst.category}`);
    }
    if (isSameWeek(catalyst.publishedAt, anchor.publishedAt)) {
      score += 14;
      reasons.add("same week");
    }
  }

  return {
    ...catalyst,
    relationScore: Math.min(score, 100),
    relationReason:
      reasons.size > 0 ? Array.from(reasons).slice(0, 3).join(" · ") : "nearby RiskFlow catalyst",
  };
}

function toTimelineNode(catalyst: SensemakingCatalyst): SensemakingTimelineNode {
  return {
    id: `node-${normalizeCatalystId(catalyst.id)}`,
    catalystId: catalyst.id,
    role: catalyst.role,
    title: catalyst.headline,
    narrativeIds: catalyst.narrativeThreads,
    timestamp: catalyst.publishedAt,
    timeLabel: formatDate(catalyst.publishedAt),
    summary: catalyst.agentNote ?? catalyst.summary,
    relationReason: catalyst.relationReason,
  };
}

function buildTimelineEdges(
  nodes: SensemakingTimelineNode[],
): SensemakingTimelineEdge[] {
  return nodes.slice(1).map((node, index) => ({
    id: `edge-${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
    label: timeDelta(nodes[index].timestamp, node.timestamp),
  }));
}

function buildNarrativeGroups(
  catalysts: SensemakingCatalyst[],
): SensemakingNarrativeGroup[] {
  const groups = new Map<string, SensemakingCatalyst[]>();
  for (const catalyst of catalysts) {
    const ids = catalyst.narrativeThreads.length > 0 ? catalyst.narrativeThreads : [catalyst.category];
    for (const id of ids) groups.set(id, [...(groups.get(id) ?? []), catalyst]);
  }

  return Array.from(groups.entries()).map(([id, items]) => ({
    id,
    title: titleize(id),
    catalystIds: items.map((item) => item.id),
    summary: `${items.length} catalyst${items.length === 1 ? "" : "s"} tied through ${titleize(id)}.`,
    timeSpan: buildTimeSpan(items),
  }));
}

function buildSummary(
  query: string,
  anchors: SensemakingCatalyst[],
  related: SensemakingCatalyst[],
  groups: SensemakingNarrativeGroup[],
  reasoningLevel: SensemakingRequest["reasoningLevel"],
): string {
  if (anchors.length === 0) return "Attach at least one RiskFlow headline to build a narrative map.";
  const groupNames = groups.slice(0, 4).map((group) => group.title).join(", ");
  return `${anchors.length} attached headline${anchors.length === 1 ? "" : "s"} connect to ${related.length} related catalyst${related.length === 1 ? "" : "s"} across ${groupNames || "the same RiskFlow window"}. Intelligence level is ${reasoningLevel ?? "standard"}; the query focus is "${query || "market outcome"}", so the map orders evidence by time and separates anchors from surrounding notable events.`;
}

function buildForecast(
  anchors: SensemakingCatalyst[],
  related: SensemakingCatalyst[],
) {
  const evidenceCount = anchors.length + related.length;
  if (anchors.length === 0 || evidenceCount < 4) return null;
  const topSymbols = mode([...anchors, ...related].flatMap((item) => item.symbols));
  const confidence = Math.min(0.82, 0.35 + evidenceCount * 0.05);
  return {
    confidence: Number(confidence.toFixed(2)),
    outcome: topSymbols
      ? `Watch ${topSymbols} for follow-through as this narrative cluster reprices.`
      : "Watch the next session for follow-through as this catalyst cluster reprices.",
    rationale: `${evidenceCount} connected catalysts produced enough corroboration for a directional watch, not an automated trade call.`,
  };
}

function buildMermaid(
  nodes: SensemakingTimelineNode[],
  edges: SensemakingTimelineEdge[],
  orientation: "horizontal" | "vertical",
): string {
  const dir = orientation === "horizontal" ? "LR" : "TD";
  const lines = [`flowchart ${dir}`];
  for (const node of nodes) {
    lines.push(`  ${safeNodeId(node.id)}["${escapeMermaid(`${node.timeLabel} · ${node.title}`)}"]`);
  }
  for (const edge of edges) {
    lines.push(`  ${safeNodeId(edge.source)} -->|"${escapeMermaid(edge.label)}"| ${safeNodeId(edge.target)}`);
  }
  return lines.join("\n");
}

function intersect(a: string[], b: string[]): string[] {
  const set = new Set(b.map((item) => item.toLowerCase()));
  return a.filter((item) => set.has(item.toLowerCase()));
}

function isSameWeek(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= 7 * 86400000;
}

function sortByTime(a: SensemakingCatalyst, b: SensemakingCatalyst): number {
  return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
}

function sortByRelationThenTime(a: SensemakingCatalyst, b: SensemakingCatalyst): number {
  return b.relationScore - a.relationScore || sortByTime(a, b);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function timeDelta(a: string, b: string): string {
  const days = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
  return days === 0 ? "same day" : `${days}d`;
}

function buildTimeSpan(items: SensemakingCatalyst[]): string {
  const sorted = [...items].sort(sortByTime);
  return `${formatDate(sorted[0].publishedAt)} - ${formatDate(sorted[sorted.length - 1].publishedAt)}`;
}

function titleize(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function mode(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function safeNodeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, "'").slice(0, 96);
}
