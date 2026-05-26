import {
  Background,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import type {
  SensemakingCatalyst,
  SensemakingOrientation,
  SensemakingNarrativeGroup,
  SensemakingResponse,
  SensemakingTimelineNode,
} from "./sensemaking-types";
import { NarrativeLinkedCatalystCard } from "./NarrativeLinkedCatalystCard";

interface NarrativeSensemakingMapProps {
  response: SensemakingResponse | null;
  orientation: SensemakingOrientation;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onOpenResearchRail?: (id: string) => void;
}

interface CatalystNodeData {
  [key: string]: unknown;
  title: string;
  role: string;
  timeLabel: string;
  source: string;
  ivScore: number;
  category: string;
  symbols: string[];
  tags: string[];
  narratives: string[];
  reason: string;
  catalyst: SensemakingCatalyst;
}

interface HubNodeData {
  [key: string]: unknown;
  title: string;
  summary: string;
  count: number;
  color: string;
  timeSpan: string;
}

const nodeTypes: NodeTypes = {
  catalyst: CatalystFlowNode,
  hub: NarrativeHubFlowNode,
};

export function NarrativeSensemakingMap(props: NarrativeSensemakingMapProps) {
  return (
    <ReactFlowProvider>
      <NarrativeSensemakingMapInner {...props} />
    </ReactFlowProvider>
  );
}

function NarrativeSensemakingMapInner({
  response,
  orientation,
  selectedNodeId,
  onSelectNode,
  onOpenResearchRail,
}: NarrativeSensemakingMapProps) {
  const { nodes, edges } = useMemo(
    () => buildFlow(response, orientation, selectedNodeId),
    [response, orientation, selectedNodeId],
  );

  if (!response || nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-[var(--fintheon-text)]">
            Attach RiskFlow headlines to start.
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--fintheon-muted)]">
            NarrativeFlow will build a chronological map from anchored catalysts
            and related notable events.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      className="narrative-react-flow-canvas"
      onNodeClick={(_, node) => {
        onSelectNode(node.id);
        onOpenResearchRail?.(node.id);
      }}
      fitView
      fitViewOptions={{ padding: 0.24 }}
      minZoom={0.35}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      style={{ background: "var(--fintheon-bg)" }}
    >
      <Background color="#c79f4a08" gap={42} size={1} />
    </ReactFlow>
  );
}

function buildFlow(
  response: SensemakingResponse | null,
  orientation: SensemakingOrientation,
  selectedNodeId: string | null,
): { nodes: Node<CatalystNodeData | HubNodeData>[]; edges: Edge[] } {
  if (!response) return { nodes: [], edges: [] };

  const catalystsById = catalystMap(response);
  const lanes = laneMap(response.timelineNodes);
  const hubs = response.narrativeGroups.map((group, index) => ({
    id: `hub:${group.id}`,
    type: "hub",
    position: getHubPosition(index, orientation),
    data: {
      title: group.title,
      summary: group.summary,
      count: group.catalystIds.length,
      color: groupColor(index),
      timeSpan: group.timeSpan,
    },
  }));
  const catalystNodes = response.timelineNodes.map((node, index) => {
    const catalyst =
      catalystsById.get(node.catalystId) ?? fallbackCatalyst(node);
    return {
      id: node.id,
      type: "catalyst",
      position: getPosition(node, index, lanes, orientation),
      selected: node.id === selectedNodeId,
      data: {
        title: node.title,
        role: node.role,
        timeLabel: node.timeLabel,
        source: catalyst?.source ?? "RiskFlow",
        ivScore: catalyst?.ivScore ?? 0,
        category: catalyst?.category ?? "market",
        symbols: catalyst?.symbols ?? [],
        tags: catalyst?.tags ?? [],
        narratives: node.narrativeIds,
        reason: node.relationReason,
        catalyst,
      },
    };
  });

  const timelineEdges = response.timelineEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#c79f4a" },
    style: { stroke: "rgba(199,159,74,0.35)", strokeWidth: 1.2 },
    labelStyle: { fill: "#c79f4a", fontSize: 10 },
    labelBgStyle: { fill: "rgba(6,5,4,0.92)", fillOpacity: 1 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgBorderRadius: 2,
  }));
  const membershipEdges = response.timelineNodes.flatMap((node) =>
    node.narrativeIds.slice(0, 3).map((narrativeId) => ({
      id: `membership:${narrativeId}:${node.id}`,
      source: `hub:${narrativeId}`,
      target: node.id,
      type: "smoothstep",
      style: { stroke: "rgba(199,159,74,0.18)", strokeDasharray: "4 5" },
    })),
  );

  return {
    nodes: [...hubs, ...catalystNodes],
    edges: [...membershipEdges, ...timelineEdges],
  };
}

function CatalystFlowNode({
  data,
  selected,
}: NodeProps & { data: CatalystNodeData }) {
  return (
    <div className="narrative-flow-node-card relative">
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <NarrativeLinkedCatalystCard
        catalyst={data.catalyst}
        selected={selected}
      />
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-muted)]">
        {data.reason}
      </p>
      {data.narratives.length > 0 ? (
        <p className="mt-2 truncate text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/60">
          {data.narratives.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function NarrativeHubFlowNode({ data }: NodeProps & { data: HubNodeData }) {
  return (
    <section
      className="flex h-[150px] w-[150px] flex-col items-center justify-center rounded-full border bg-[var(--fintheon-bg)]/90 p-4 text-center"
      style={{ borderColor: `${data.color}55` }}
    >
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <p
        className="line-clamp-2 text-[13px] font-semibold leading-4"
        style={{ color: data.color }}
      >
        {data.title}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
        {data.count} catalysts
      </p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-3 text-[var(--fintheon-muted)]/80">
        {data.timeSpan}
      </p>
    </section>
  );
}

function laneMap(nodes: SensemakingTimelineNode[]): Map<string, number> {
  const lanes = new Map<string, number>();
  for (const node of nodes) {
    const key = node.narrativeIds[0] ?? "unthreaded";
    if (!lanes.has(key)) lanes.set(key, lanes.size);
  }
  return lanes;
}

function getPosition(
  node: SensemakingTimelineNode,
  index: number,
  lanes: Map<string, number>,
  orientation: SensemakingOrientation,
) {
  const lane = lanes.get(node.narrativeIds[0] ?? "unthreaded") ?? 0;
  if (orientation === "vertical")
    return { x: 260 + lane * 340, y: 240 + index * 210 };
  return { x: 340 + index * 350, y: 220 + lane * 210 };
}

function getHubPosition(index: number, orientation: SensemakingOrientation) {
  if (orientation === "vertical") return { x: index * 340, y: 0 };
  return { x: 0, y: index * 210 };
}

function catalystMap(
  response: SensemakingResponse,
): Map<string, SensemakingCatalyst> {
  return new Map(
    [...response.anchorCatalysts, ...response.relatedCatalysts].map((item) => [
      item.id,
      item,
    ]),
  );
}

function fallbackCatalyst(node: SensemakingTimelineNode): SensemakingCatalyst {
  return {
    id: node.catalystId,
    headline: node.title,
    summary: node.summary,
    source: "NarrativeFlow",
    category: "market-structure",
    sentiment: "neutral",
    ivScore: 0,
    publishedAt: node.timestamp,
    promotedAt: null,
    symbols: [],
    tags: [],
    narrativeThreads: node.narrativeIds,
    marketImpact: null,
    agentNote: node.relationReason,
    role: node.role,
    relationScore: 0.5,
    relationReason: node.relationReason,
  };
}

function groupColor(index: number) {
  const colors = ["#c79f4a", "#34d399", "#93c5fd", "#f59e0b", "#a78bfa"];
  return colors[index % colors.length];
}
