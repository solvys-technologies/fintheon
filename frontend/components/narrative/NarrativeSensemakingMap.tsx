import {
  Background,
  Controls,
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
import { useMemo, type ReactNode } from "react";
import type {
  SensemakingCatalyst,
  SensemakingOrientation,
  SensemakingNarrativeGroup,
  SensemakingResponse,
  SensemakingTimelineNode,
} from "./sensemaking-types";

interface NarrativeSensemakingMapProps {
  response: SensemakingResponse | null;
  orientation: SensemakingOrientation;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
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
}

interface HubNodeData {
  [key: string]: unknown;
  title: string;
  summary: string;
  count: number;
  color: string;
  timeSpan: string;
}

const nodeTypes: NodeTypes = { catalyst: CatalystFlowNode, hub: NarrativeHubFlowNode };

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
            NarrativeFlow will build a chronological map from anchored catalysts and related notable events.
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
      onNodeClick={(_, node) => onSelectNode(node.id)}
      fitView
      fitViewOptions={{ padding: 0.24 }}
      minZoom={0.35}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      style={{ background: "var(--fintheon-bg)" }}
    >
      <Background color="#c79f4a08" gap={42} size={1} />
      <Controls showInteractive={false} />
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
    const catalyst = catalystsById.get(node.catalystId);
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

  return { nodes: [...hubs, ...catalystNodes], edges: [...membershipEdges, ...timelineEdges] };
}

function CatalystFlowNode({
  data,
  selected,
}: NodeProps & { data: CatalystNodeData }) {
  const isAnchor = data.role === "anchor";
  return (
    <article
      className={`w-[280px] rounded-md border p-3 ${
        selected
          ? "border-[var(--fintheon-accent)]/70 bg-[var(--fintheon-accent)]/12"
          : isAnchor
            ? "border-[var(--fintheon-accent)]/45 bg-[var(--fintheon-accent)]/8"
            : "border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)]/85"
      }`}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/75">
          {isAnchor ? "Anchor" : "Notable"}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--fintheon-muted)]">
          {data.timeLabel} | IV {data.ivScore.toFixed(1)}
        </span>
      </div>
      <p className="line-clamp-3 text-sm font-medium leading-5 text-[var(--fintheon-text)]">
        {data.title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <NodeChip>{data.source}</NodeChip>
        <NodeChip>{data.category}</NodeChip>
        {data.symbols.slice(0, 3).map((symbol) => (
          <NodeChip key={symbol}>{symbol}</NodeChip>
        ))}
      </div>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-muted)]">
        {data.reason}
      </p>
      {data.narratives.length > 0 ? (
        <p className="mt-2 truncate text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/60">
          {data.narratives.join(" · ")}
        </p>
      ) : null}
    </article>
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

function NodeChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-[var(--fintheon-accent)]/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">
      {children}
    </span>
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
  if (orientation === "vertical") return { x: 260 + lane * 340, y: 240 + index * 210 };
  return { x: 340 + index * 350, y: 220 + lane * 210 };
}

function getHubPosition(index: number, orientation: SensemakingOrientation) {
  if (orientation === "vertical") return { x: index * 340, y: 0 };
  return { x: 0, y: index * 210 };
}

function catalystMap(response: SensemakingResponse): Map<string, SensemakingCatalyst> {
  return new Map(
    [...response.anchorCatalysts, ...response.relatedCatalysts].map((item) => [item.id, item]),
  );
}

function groupColor(index: number) {
  const colors = ["#c79f4a", "#34d399", "#93c5fd", "#f59e0b", "#a78bfa"];
  return colors[index % colors.length];
}
