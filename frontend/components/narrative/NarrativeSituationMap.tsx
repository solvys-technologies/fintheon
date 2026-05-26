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
import { Loader2, Network } from "lucide-react";
import { useMemo } from "react";
import type {
  NarrativeSituationMapResponse,
  SituationMapEdge,
  SituationMapNode,
} from "../../hooks/useNarrativeSituationMap";

interface NarrativeSituationMapProps {
  map: NarrativeSituationMapResponse | null;
  isLoading?: boolean;
  error?: string | null;
  onSelectCatalyst?: (id: string) => void;
}

interface MapNodeData {
  [key: string]: unknown;
  label: string;
  summary: string;
  color: string;
  kind: "narrative" | "catalyst";
  confidence?: number;
  conflictLabel?: string;
}

const nodeTypes: NodeTypes = { situation: SituationNode };

export function NarrativeSituationMap(props: NarrativeSituationMapProps) {
  return (
    <ReactFlowProvider>
      <NarrativeSituationMapInner {...props} />
    </ReactFlowProvider>
  );
}

function NarrativeSituationMapInner({
  map,
  isLoading = false,
  error = null,
  onSelectCatalyst,
}: NarrativeSituationMapProps) {
  const { nodes, edges } = useMemo(() => buildFlow(map), [map]);

  if (isLoading) return <MapState label="Loading situation map" isLoading />;
  if (error) return <MapState label={error} />;
  if (!map || nodes.length === 0)
    return <MapState label="No desk catalysts mapped yet." />;

  return (
    <section className="relative h-full min-h-[440px] overflow-hidden bg-[var(--fintheon-bg)]">
      <div className="absolute left-3 top-3 z-10 rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]/90 px-3 py-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
          Situation Map
        </p>
        <p className="mt-1 font-mono text-[11px] text-[var(--fintheon-muted)]">
          {map.nodes.filter((node) => node.kind === "catalyst").length}{" "}
          catalysts · {map.edges.length} links
        </p>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          const catalystId =
            node.data.kind === "catalyst"
              ? String(node.id).replace("catalyst-", "")
              : "";
          if (catalystId) onSelectCatalyst?.(catalystId);
        }}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        minZoom={0.24}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        style={{ background: "var(--fintheon-bg)" }}
      >
        <Background color="#c79f4a08" gap={44} size={1} />
      </ReactFlow>
    </section>
  );
}

function SituationNode({ data }: NodeProps & { data: MapNodeData }) {
  const isNarrative = data.kind === "narrative";
  return (
    <article
      className={`w-[248px] rounded-md border p-3 ${
        isNarrative
          ? "border-[var(--fintheon-accent)]/45 bg-[var(--fintheon-accent)]/10"
          : "border-[var(--fintheon-accent)]/14 bg-[var(--fintheon-surface)]/88"
      }`}
      style={{ boxShadow: `inset 0 0 0 1px ${data.color}33` }}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full border border-[var(--fintheon-accent)]/35"
          style={{ backgroundColor: data.color }}
        />
        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
          {isNarrative ? "Narrative" : (data.conflictLabel ?? "Catalyst")}
        </span>
      </div>
      <p className="line-clamp-3 text-sm font-medium leading-5 text-[var(--fintheon-text)]">
        {data.label}
      </p>
      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-[var(--fintheon-muted)]">
        {data.summary}
      </p>
      {typeof data.confidence === "number" ? (
        <p className="mt-2 font-mono text-[10px] text-[var(--fintheon-accent)]/75">
          {(data.confidence * 100).toFixed(0)}%
        </p>
      ) : null}
    </article>
  );
}

function MapState({
  label,
  isLoading = false,
}: {
  label: string;
  isLoading?: boolean;
}) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-[var(--fintheon-bg)]">
      <div className="flex items-center gap-2 text-xs text-[var(--fintheon-muted)]">
        {isLoading ? (
          <Loader2
            size={14}
            className="animate-spin text-[var(--fintheon-accent)]"
          />
        ) : (
          <Network size={14} className="text-[var(--fintheon-accent)]" />
        )}
        {label}
      </div>
    </div>
  );
}

function buildFlow(map: NarrativeSituationMapResponse | null): {
  nodes: Node<MapNodeData>[];
  edges: Edge[];
} {
  if (!map) return { nodes: [], edges: [] };
  return {
    nodes: map.nodes.map((node, index) => ({
      id: node.id,
      type: "situation",
      position: getPosition(node, index, map.nodes),
      data: toNodeData(node),
    })),
    edges: map.edges.map(toEdge),
  };
}

function toNodeData(node: SituationMapNode): MapNodeData {
  return {
    label: node.label,
    summary: node.summary,
    color: node.color,
    kind: node.kind,
    confidence: node.confidence,
    conflictLabel: node.conflictLabel,
  };
}

function toEdge(edge: SituationMapEdge): Edge {
  const isRelationship = edge.kind === "relationship";
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "#c79f4a" },
    style: {
      stroke: isRelationship
        ? "rgba(240,234,214,0.24)"
        : "rgba(199,159,74,0.38)",
      strokeDasharray: isRelationship ? "5 5" : undefined,
    },
    labelStyle: { fill: "#c79f4a", fontSize: 10 },
  };
}

function getPosition(
  node: SituationMapNode,
  index: number,
  nodes: SituationMapNode[],
) {
  if (node.kind === "narrative") return { x: 0, y: index * 180 };
  const catalystIndex = nodes
    .slice(0, index)
    .filter((item) => item.kind === "catalyst").length;
  return {
    x: 360 + (catalystIndex % 3) * 310,
    y: Math.floor(catalystIndex / 3) * 190,
  };
}
