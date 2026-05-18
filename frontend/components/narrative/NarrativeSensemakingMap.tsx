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
import { useMemo } from "react";
import type {
  SensemakingOrientation,
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
  narratives: string[];
  reason: string;
}

const nodeTypes: NodeTypes = { catalyst: CatalystFlowNode };

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
): { nodes: Node<CatalystNodeData>[]; edges: Edge[] } {
  if (!response) return { nodes: [], edges: [] };

  const lanes = laneMap(response.timelineNodes);
  const nodes = response.timelineNodes.map((node, index) => ({
    id: node.id,
    type: "catalyst",
    position: getPosition(node, index, lanes, orientation),
    selected: node.id === selectedNodeId,
    data: {
      title: node.title,
      role: node.role,
      timeLabel: node.timeLabel,
      narratives: node.narrativeIds,
      reason: node.relationReason,
    },
  }));

  const edges = response.timelineEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#c79f4a" },
    style: { stroke: "rgba(199,159,74,0.36)" },
    labelStyle: { fill: "#c79f4a", fontSize: 10 },
  }));

  return { nodes, edges };
}

function CatalystFlowNode({
  data,
  selected,
}: NodeProps & { data: CatalystNodeData }) {
  const isAnchor = data.role === "anchor";
  return (
    <article
      className={`w-[250px] rounded-md border p-3 ${
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
          {data.timeLabel}
        </span>
      </div>
      <p className="line-clamp-3 text-sm font-medium leading-5 text-[var(--fintheon-text)]">
        {data.title}
      </p>
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
  if (orientation === "vertical") return { x: lane * 300, y: index * 190 };
  return { x: index * 320, y: lane * 185 };
}
