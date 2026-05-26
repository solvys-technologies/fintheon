import type { Theme } from "../../hooks/useThemes";
import type {
  SensemakingCatalyst,
  SensemakingResponse,
  SensemakingTimelineNode,
} from "../../components/narrative/sensemaking-types";

const now = Date.now();

export const mockThemes: Theme[] = [
  theme("energy-infrastructure", "Energy Infrastructure", 78, [
    "rf-grid",
    "rf-transformers",
  ]),
  theme("ai-power-demand", "AI Power Demand", 74, [
    "rf-ai-load",
    "rf-utilities",
  ]),
  theme("financing-permitting", "Financing & Permitting", 69, [
    "rf-muni",
    "rf-pipelines",
  ]),
];

export const mockDesk = {
  id: "desk-priced-in-capital",
  name: "Priced In Capital",
  slug: "priced-in-capital",
  color: "#c79f4a",
  mapImageUrl: null,
  mapImagePrompt: null,
  mapImageUpdatedAt: null,
};

export const mockHeadlines = [
  headline(
    "rf-grid",
    "Grid operators warn reserve margins are thinning into summer peak load",
    "Reliability desks are moving from abstract power demand risk to concrete reserve-margin pressure.",
    8.8,
    ["grid", "capacity"],
  ),
  headline(
    "rf-ai-load",
    "AI data-center load forces utilities to reprice five-year capex plans",
    "Hyperscaler demand is pulling forward generation, transmission, and interconnection spending.",
    8.6,
    ["AI", "power"],
  ),
  headline(
    "rf-transformers",
    "Transformer shortages extend substation buildout timelines",
    "Critical equipment bottlenecks keep power availability from scaling at software speed.",
    8.2,
    ["grid", "supply-chain"],
  ),
  headline(
    "rf-utilities",
    "Utility balance sheets absorb higher debt costs and storm-hardening spend",
    "Regulated returns are being tested by capex intensity, rate cases, and weather resilience.",
    7.6,
    ["utilities", "credit"],
  ),
  headline(
    "rf-pipelines",
    "Pipeline and LNG constraints reopen the energy-security premium",
    "Gas infrastructure is becoming the swing factor between cheap power and regional scarcity.",
    7.4,
    ["natural-gas", "LNG"],
  ),
  headline(
    "rf-muni",
    "Muni and project-finance spreads widen for infrastructure issuers",
    "Financing stress is starting to matter for what gets built, delayed, or repriced.",
    7.1,
    ["munis", "financing"],
  ),
];

export const sessionDetails: Record<string, any> = {
  "session-energy-crisis": session(
    "session-energy-crisis",
    "Energy demand shock meets aging grid capex",
    "#c79f4a",
    ["rf-grid", "rf-ai-load", "rf-transformers"],
  ),
  "session-ai-load": session(
    "session-ai-load",
    "AI load turns power availability into a macro constraint",
    "#34D399",
    ["rf-ai-load", "rf-utilities", "rf-grid"],
  ),
  "session-grid-supply": session(
    "session-grid-supply",
    "Transformer bottlenecks slow the infrastructure response",
    "#FBBF24",
    ["rf-transformers", "rf-grid", "rf-muni"],
  ),
  "session-financing": session(
    "session-financing",
    "Infrastructure financing stress separates winners from stranded projects",
    "#A78BFA",
    ["rf-muni", "rf-pipelines", "rf-utilities"],
  ),
};

export function buildSessionList() {
  return Object.values(sessionDetails).map((detail) => ({
    id: detail.id,
    title: detail.title,
    status: detail.status,
    color: detail.color,
    updatedAt: detail.updatedAt,
    catalystCount: detail.catalyst_count,
    desk: { name: "Priced In Capital" },
  }));
}

export function buildResponse(catalystIds: string[]): SensemakingResponse {
  const selected = catalystIds
    .map((id) => catalystFromHeadline(id))
    .filter(Boolean);
  const anchors = selected
    .slice(0, 3)
    .map((item) => ({ ...item, role: "anchor" as const }));
  const related = mockHeadlines
    .filter((item) => !catalystIds.includes(item.id))
    .slice(0, 3)
    .map((item) => ({
      ...catalystFromHeadline(item.id),
      role: "related" as const,
    }));
  const nodes = [...anchors, ...related].map(toNode);
  return {
    anchorCatalysts: anchors,
    relatedCatalysts: related,
    narrativeGroups: [
      group("energy-infrastructure", "Energy Infrastructure", nodes),
      group("ai-power-demand", "AI Power Demand", nodes),
      group("financing-permitting", "Financing & Permitting", nodes),
    ],
    timelineNodes: nodes,
    timelineEdges: nodes.slice(1).map((node, index) => ({
      id: `edge-${index}`,
      source: nodes[index].id,
      target: node.id,
      label: index === 0 ? "reprices" : "confirms",
    })),
    synthesisSummary:
      "The desk is testing whether the Energy & Infrastructure Crisis is now a durable macro constraint: AI load pulls power demand forward, grid equipment shortages slow supply, and financing/permitting stress decides which projects actually get built.",
    forecast: {
      confidence: 0.72,
      outcome:
        "Grid bottlenecks become the lead constraint unless generation, transmission, and project finance accelerate together.",
      rationale:
        "Demand is arriving faster than physical infrastructure can clear, so utilities, gas transport, equipment suppliers, and exposed regions should diverge.",
    },
    mermaidSource:
      "flowchart LR\n  load[AI load] --> grid[Grid bottlenecks]\n  grid --> capex[Utility capex]\n  capex --> finance[Financing stress]\n  gas[Gas infrastructure] --> grid",
    generatedAt: iso(8),
  };
}

export function makeSession(input: {
  id: string;
  title: string;
  color: string;
  catalystIds: string[];
}) {
  return session(input.id, input.title, input.color, input.catalystIds);
}

function session(
  id: string,
  title: string,
  color: string,
  catalystIds: string[],
) {
  const response = buildResponse(catalystIds);
  return {
    id,
    title,
    status: "active",
    color,
    updatedAt: iso(id.length * 11),
    updated_at: iso(id.length * 11),
    generatedAt: response.generatedAt,
    catalyst_count: catalystIds.length,
    catalysts: catalystIds.map((riskflow_item_id) => ({ riskflow_item_id })),
    artifacts: {
      flow: { payload: response },
      timeline: {
        payload: {
          nodes: response.timelineNodes,
          edges: response.timelineEdges,
        },
      },
      docs: {
        payload: {
          summary: response.synthesisSummary,
          forecast: response.forecast,
          links: [],
        },
      },
    },
    messages: [
      {
        id: `${id}-m1`,
        role: "user",
        content: "Map the catalyst chain and pressure test the thesis.",
        created_at: iso(24),
      },
      {
        id: `${id}-m2`,
        role: "desk",
        content:
          "Workspace organized around anchors, related catalysts, and forecast pressure points.",
        created_at: iso(18),
      },
    ],
    work_events: [
      {
        id: `${id}-w1`,
        agent: "Harper",
        summary: "Synthesized anchors into a desk-ready narrative map.",
        status: "complete",
        created_at: iso(12),
      },
      {
        id: `${id}-w2`,
        agent: "Oracle",
        summary: "Scored forecast confidence against the current IV fuse.",
        status: "complete",
        created_at: iso(10),
      },
    ],
    links: [],
  };
}

function catalystFromHeadline(id: string): SensemakingCatalyst {
  const item =
    mockHeadlines.find((candidate) => candidate.id === id) ?? mockHeadlines[0];
  return {
    ...item,
    category: item.tags.includes("financing")
      ? "credit"
      : item.tags.includes("power")
        ? "infrastructure"
        : "energy",
    sentiment: item.ivScore > 7.4 ? "bullish" : "neutral",
    promotedAt: iso(42),
    marketImpact:
      "Utilities, gas infrastructure, equipment suppliers, regional power spreads, and capex financing remain the active transmission chain.",
    agentNote: `${item.headline} is a primary read-through for the current desk thesis.`,
    role: "anchor",
    relationScore: Math.min(0.92, item.ivScore / 10),
    relationReason:
      "Linked through load growth, grid availability, infrastructure capex, and financing constraints.",
  };
}

function toNode(
  catalyst: SensemakingCatalyst,
  index: number,
): SensemakingTimelineNode {
  return {
    id: `node-${catalyst.id}`,
    catalystId: catalyst.id,
    role: catalyst.role,
    title: catalyst.headline,
    narrativeIds: catalyst.narrativeThreads,
    timestamp: catalyst.publishedAt,
    timeLabel: `${index + 1}h`,
    summary: catalyst.summary,
    relationReason: catalyst.relationReason,
  };
}

function headline(
  id: string,
  headlineText: string,
  summary: string,
  ivScore: number,
  tags: string[],
) {
  return {
    id,
    headline: headlineText,
    summary,
    source: "RiskFlow",
    severity: ivScore > 8 ? "high" : "medium",
    publishedAt: iso(ivScore * 17),
    ivScore,
    macroLevel: Math.round(ivScore / 2),
    symbols: ["/ES", "/NQ"],
    tags,
    narrativeThreads: [
      "energy-infrastructure",
      "ai-power-demand",
      "financing-permitting",
    ],
  };
}

function group(id: string, title: string, nodes: SensemakingTimelineNode[]) {
  return {
    id,
    title,
    catalystIds: nodes.slice(0, 4).map((node) => node.catalystId),
    summary: `${title} remains bound to the active desk read.`,
    timeSpan: "Last 48h",
  };
}

function theme(
  id: string,
  name: string,
  ipv: number,
  catalystIds: string[],
): Theme {
  return {
    id,
    name,
    ipv,
    catalystIds,
    status: "Active",
    createdAt: iso(420),
    updatedAt: iso(12),
    trajectory: [],
  };
}

function iso(minutesAgo: number) {
  return new Date(now - minutesAgo * 60_000).toISOString();
}
