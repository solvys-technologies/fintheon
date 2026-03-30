import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useNarrative } from '../../contexts/NarrativeContext';
import type { CatalystCard } from '../../lib/narrative-types';
import {
  CROSS_NARRATIVE_GOLD,
  HUB_POSITIONS,
  NARRATIVE_THREADS,
  TERRITORY_LAYOUT,
  THREAD_MAP,
  getMonthKey,
  getSemanticZoom,
  safeSlug,
  type SemanticNarrativeView,
} from '../../lib/narrative-territory-layout';
import type { CanvasTool } from './NarrativeFloatingToolbar';
import { AggregateCardNode } from './AggregateCardNode';
import { NarrativeHubNode } from './NarrativeHubNode';
import { TerritoryNode } from './TerritoryNode';

const CANVAS_CSS = `
@keyframes hub-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.01); }
}
@keyframes card-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.narrative-hub-node.settled { animation: hub-breathe 6s ease-in-out infinite; }
`;

interface SimNode extends SimulationNodeDatum {
  id: string;
  nodeKind: 'hub' | 'card';
  threadSlug: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  strength: number;
}

const nodeTypes: NodeTypes = {
  territory: TerritoryNode,
  narrativeHub: NarrativeHubNode,
  aggregate: AggregateCardNode,
};

function buildSimData(catalysts: CatalystCard[]) {
  const simNodes: SimNode[] = [];
  const simLinks: SimLink[] = [];

  for (const thread of NARRATIVE_THREADS) {
    const position = HUB_POSITIONS[thread.slug] ?? { x: 0, y: 0 };
    simNodes.push({
      id: `hub-${thread.slug}`,
      nodeKind: 'hub',
      threadSlug: thread.slug,
      x: position.x,
      y: position.y,
    });
  }

  for (const card of catalysts) {
    const threadSlug = safeSlug(card.narrative ?? card.narrativeThreads?.[0]);
    const hub = HUB_POSITIONS[threadSlug] ?? { x: 0, y: 0 };

    simNodes.push({
      id: card.id,
      nodeKind: 'card',
      threadSlug,
      x: hub.x + (Math.random() - 0.5) * 200,
      y: hub.y + (Math.random() - 0.5) * 200,
    });

    simLinks.push({ source: card.id, target: `hub-${threadSlug}`, strength: 0.4 });
  }

  return { simNodes, simLinks };
}

function runForceSimulation(
  simNodes: SimNode[],
  simLinks: SimLink[],
  ticks = 350,
): Map<string, { x: number; y: number }> {
  const simulation = forceSimulation<SimNode>(simNodes)
    .force('charge', forceManyBody<SimNode>().strength((node) => (node.nodeKind === 'hub' ? -500 : -60)))
    .force(
      'link',
      forceLink<SimNode, SimLink>(simLinks)
        .id((node) => node.id)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          return source.nodeKind === 'hub' || target.nodeKind === 'hub' ? 180 : 100;
        })
        .strength((link) => link.strength),
    )
    .force('collide', forceCollide<SimNode>().radius((node) => (node.nodeKind === 'hub' ? 100 : 120)).strength(0.5))
    .force('clusterX', forceX<SimNode>((node) => HUB_POSITIONS[node.threadSlug]?.x ?? 0).strength((node) => (node.nodeKind === 'hub' ? 0.3 : 0.1)))
    .force('clusterY', forceY<SimNode>((node) => HUB_POSITIONS[node.threadSlug]?.y ?? 0).strength((node) => (node.nodeKind === 'hub' ? 0.3 : 0.1)))
    .alphaDecay(0.012)
    .velocityDecay(0.35)
    .stop();

  for (let i = 0; i < ticks; i += 1) {
    simulation.tick();
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }

  return positions;
}

function crossNarrativeEdges(catalysts: CatalystCard[]): Map<string, number> {
  const threadPairs = new Map<string, number>();

  for (const catalyst of catalysts) {
    if (!catalyst.narrativeThreads || catalyst.narrativeThreads.length < 2) continue;

    for (let i = 0; i < catalyst.narrativeThreads.length; i += 1) {
      for (let j = i + 1; j < catalyst.narrativeThreads.length; j += 1) {
        const threadA = safeSlug(catalyst.narrativeThreads[i]);
        const threadB = safeSlug(catalyst.narrativeThreads[j]);
        const key = [threadA, threadB].sort().join('|');
        threadPairs.set(key, (threadPairs.get(key) ?? 0) + 1);
      }
    }
  }

  return threadPairs;
}

function buildNarrativeView(
  catalysts: CatalystCard[],
  cardsByThread: Map<string, CatalystCard[]>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const thread of NARRATIVE_THREADS) {
    const territory = TERRITORY_LAYOUT[thread.slug];
    if (!territory) continue;

    nodes.push({
      id: `territory-${thread.slug}`,
      type: 'territory',
      position: { x: territory.x, y: territory.y },
      data: {
        title: thread.title,
        color: thread.color,
        count: cardsByThread.get(thread.slug)?.length ?? 0,
        width: territory.w,
        height: territory.h,
      },
      draggable: true,
      selectable: false,
      zIndex: -1,
    });
  }

  for (const [key, count] of crossNarrativeEdges(catalysts)) {
    const [threadA, threadB] = key.split('|');
    const territoryA = TERRITORY_LAYOUT[threadA];
    const territoryB = TERRITORY_LAYOUT[threadB];
    if (!territoryA || !territoryB) continue;

    edges.push({
      id: `narrative-rope-${key}`,
      source: `territory-${threadA}`,
      target: `territory-${threadB}`,
      type: 'default',
      style: {
        stroke: CROSS_NARRATIVE_GOLD,
        strokeWidth: Math.min(1 + count * 0.15, 3.5),
        opacity: 0.08 + Math.min(count * 0.02, 0.2),
        strokeDasharray: '6 4',
      },
      animated: false,
      label: count > 2 ? `${count}` : undefined,
      labelStyle: {
        fill: CROSS_NARRATIVE_GOLD,
        fontSize: 9,
        fontFamily: 'var(--font-mono)',
        opacity: 0.4,
      },
      labelBgStyle: { fill: '#050402', fillOpacity: 0.8 },
    });
  }

  return { nodes, edges };
}

function buildThemeView(
  positions: Map<string, { x: number; y: number }>,
  catalysts: CatalystCard[],
  cardsByThread: Map<string, CatalystCard[]>,
  expandedGroups: Set<string>,
  onToggleGroup: (id: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const thread of NARRATIVE_THREADS) {
    const hub = HUB_POSITIONS[thread.slug];
    if (!hub) continue;

    nodes.push({
      id: `hub-${thread.slug}`,
      type: 'narrativeHub',
      position: hub,
      data: {
        slug: thread.slug,
        title: thread.title,
        color: thread.color,
        count: cardsByThread.get(thread.slug)?.length ?? 0,
        settled: true,
      },
      draggable: true,
    });
  }

  const groups = new Map<string, CatalystCard[]>();
  for (const catalyst of catalysts) {
    const threadSlug = safeSlug(catalyst.narrative ?? catalyst.narrativeThreads?.[0]);
    const month = getMonthKey(catalyst.date);
    const groupKey = `${threadSlug}::${month}`;
    const list = groups.get(groupKey) ?? [];
    list.push(catalyst);
    groups.set(groupKey, list);
  }

  for (const [groupKey, groupCards] of groups) {
    const [threadSlug, month] = groupKey.split('::');
    const thread = THREAD_MAP[threadSlug];
    if (!thread) continue;

    let cx = 0;
    let cy = 0;
    let count = 0;

    for (const card of groupCards) {
      const position = positions.get(card.id);
      if (!position) continue;
      cx += position.x;
      cy += position.y;
      count += 1;
    }

    if (count > 0) {
      cx /= count;
      cy /= count;
    } else {
      const hub = HUB_POSITIONS[threadSlug] ?? { x: 0, y: 0 };
      cx = hub.x;
      cy = hub.y;
    }

    const groupId = `agg-${groupKey}`;

    nodes.push({
      id: groupId,
      type: 'aggregate',
      position: { x: cx, y: cy },
      data: {
        label: `${thread.shortTitle} — ${month}`,
        cards: groupCards,
        narrativeColor: thread.color,
        expanded: expandedGroups.has(groupId),
        onToggle: onToggleGroup,
        groupId,
      },
      draggable: true,
    });

    edges.push({
      id: `theme-edge-${groupId}`,
      source: groupId,
      target: `hub-${threadSlug}`,
      type: 'default',
      style: { stroke: thread.color, strokeWidth: 1, opacity: 0.15 },
    });
  }

  for (const [key, count] of crossNarrativeEdges(catalysts)) {
    const [threadA, threadB] = key.split('|');
    edges.push({
      id: `hub-rope-${key}`,
      source: `hub-${threadA}`,
      target: `hub-${threadB}`,
      type: 'default',
      style: {
        stroke: CROSS_NARRATIVE_GOLD,
        strokeWidth: Math.min(1 + count * 0.12, 2.5),
        opacity: 0.08 + Math.min(count * 0.015, 0.15),
        strokeDasharray: '4 3',
      },
    });
  }

  return { nodes, edges };
}

interface NarrativeForceCanvasProps {
  visibleLaneIds: Set<string>;
  activeTags: Set<string>;
  activeTool: CanvasTool;
  onScaleChange?: (scale: number) => void;
  onSelectCard?: (id: string) => void;
  onEditCard?: (card: CatalystCard) => void;
  onZoomFnsReady?: (fns: { zoomTo: (level: number) => void; fitView: () => void }) => void;
}

function NarrativeFlowCanvas({
  visibleLaneIds,
  activeTags,
  activeTool,
  onScaleChange,
  onZoomFnsReady,
}: NarrativeForceCanvasProps) {
  const { state } = useNarrative();
  const reactFlow = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [currentView, setCurrentView] = useState<SemanticNarrativeView>('narratives');
  const [forcedView, setForcedView] = useState<SemanticNarrativeView | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const zoomViewRef = useRef<SemanticNarrativeView>('narratives');
  const didFitRef = useRef(false);
  const persistedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    onZoomFnsReady?.({
      zoomTo: (level: number) => reactFlow.zoomTo(level, { duration: 200 }),
      fitView: () => reactFlow.fitView({ padding: 0.1, duration: 300 }),
    });
  }, [onZoomFnsReady, reactFlow]);

  const filteredCatalysts = useMemo(() => {
    let catalysts = state.catalysts.filter((card) => {
      const primaryThread = safeSlug(card.narrative ?? card.narrativeThreads?.[0]);

      if (visibleLaneIds.size > 0 && !visibleLaneIds.has(primaryThread)) {
        return false;
      }

      if (state.categoryFilter.size > 0 && card.category && !state.categoryFilter.has(card.category)) {
        return false;
      }

      if (state.filterSentiment !== 'all' && card.sentiment !== state.filterSentiment) {
        return false;
      }

      return true;
    });

    if (activeTags.size > 0) {
      catalysts = catalysts.filter((card) => card.tags?.some((tag) => activeTags.has(tag)) ?? false);
    }

    return catalysts;
  }, [state.catalysts, state.categoryFilter, state.filterSentiment, visibleLaneIds, activeTags]);

  const cardsByThread = useMemo(() => {
    const map = new Map<string, CatalystCard[]>();

    for (const catalyst of filteredCatalysts) {
      const threadSlug = safeSlug(catalyst.narrative ?? catalyst.narrativeThreads?.[0]);
      const list = map.get(threadSlug) ?? [];
      list.push(catalyst);
      map.set(threadSlug, list);
    }

    return map;
  }, [filteredCatalysts]);

  const positions = useMemo(() => {
    const { simNodes, simLinks } = buildSimData(filteredCatalysts);
    return runForceSimulation(simNodes, simLinks);
  }, [filteredCatalysts]);

  const toggleExpandedGroup = useCallback((groupId: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const applyPersistedPositions = useCallback((nextNodes: Node[]): Node[] => (
    nextNodes.map((node) => {
      const persisted = persistedPositionsRef.current.get(node.id);
      if (!persisted) return node;
      return { ...node, position: persisted };
    })
  ), []);

  const rebuildView = useCallback(
    (view: SemanticNarrativeView) => {
      if (view === 'narratives') {
        const result = buildNarrativeView(filteredCatalysts, cardsByThread);
        setNodes(applyPersistedPositions(result.nodes));
        setEdges(result.edges);
        return;
      }

      const result = buildThemeView(
        positions,
        filteredCatalysts,
        cardsByThread,
        expandedGroups,
        toggleExpandedGroup,
      );
      setNodes(applyPersistedPositions(result.nodes));
      setEdges(result.edges);
    },
    [applyPersistedPositions, cardsByThread, expandedGroups, filteredCatalysts, positions, setEdges, setNodes, toggleExpandedGroup],
  );

  useEffect(() => {
    const activeView = forcedView ?? currentView;
    rebuildView(activeView);
  }, [rebuildView, forcedView, currentView]);

  useEffect(() => {
    didFitRef.current = false;
  }, [filteredCatalysts]);

  useEffect(() => {
    for (const node of nodes) {
      persistedPositionsRef.current.set(node.id, node.position);
    }
  }, [nodes]);

  useEffect(() => {
    if (nodes.length === 0 || didFitRef.current) return;

    didFitRef.current = true;
    requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.08, duration: 0 });
      setTimeout(() => reactFlow.fitView({ padding: 0.08, duration: 450 }), 250);
    });
  }, [nodes.length, reactFlow]);

  const handleViewportMove = useCallback(
    (_event: unknown, viewport: { zoom: number }) => {
      onScaleChange?.(viewport.zoom);
      if (forcedView) return;

      const semanticView = getSemanticZoom(viewport.zoom);
      if (semanticView === zoomViewRef.current) return;

      zoomViewRef.current = semanticView;
      setCurrentView(semanticView);
      rebuildView(semanticView);
    },
    [forcedView, onScaleChange, rebuildView],
  );

  const handleForceView = useCallback(
    (view: SemanticNarrativeView) => {
      if (view === forcedView) {
        setForcedView(null);
        const semanticView = getSemanticZoom(reactFlow.getZoom());
        zoomViewRef.current = semanticView;
        setCurrentView(semanticView);
        rebuildView(semanticView);
        return;
      }

      setForcedView(view);
      zoomViewRef.current = view;
      setCurrentView(view);
      rebuildView(view);
      setTimeout(() => reactFlow.fitView({ padding: 0.08, duration: 450 }), 150);
    },
    [forcedView, reactFlow, rebuildView],
  );

  const handleResetLayout = useCallback(() => {
    setExpandedGroups(new Set());
    persistedPositionsRef.current.clear();
    const activeView = forcedView ?? currentView;
    rebuildView(activeView);
    setTimeout(() => reactFlow.fitView({ padding: 0.1, duration: 400 }), 80);
  }, [forcedView, currentView, rebuildView, reactFlow]);

  const activeView = forcedView ?? currentView;

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <style>{CANVAS_CSS}</style>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.15 }}
        minZoom={0.04}
        maxZoom={1.8}
        panOnDrag={activeTool === 'hand' || activeTool === 'select'}
        selectionOnDrag={activeTool === 'multi-select'}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--fintheon-bg)' }}
        onMove={handleViewportMove}
      >
        <Background color="#c79f4a06" gap={50} size={1} />

        <Panel position="top-center">
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: 'color-mix(in srgb, #0a0a00 90%, transparent)',
              backdropFilter: 'blur(20px)',
              border: '1px solid #D4AF3720',
              borderRadius: 10,
              padding: 4,
            }}
          >
            {(['narratives', 'themes'] as const).map((view) => (
              <button
                key={view}
                onClick={() => handleForceView(view)}
                style={{
                  fontSize: 11,
                  fontWeight: activeView === view ? 700 : 500,
                  fontFamily: 'var(--font-heading)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '7px 18px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  color: activeView === view ? '#050402' : 'var(--fintheon-muted)',
                  background: activeView === view ? 'var(--fintheon-accent)' : 'transparent',
                }}
              >
                {view}
              </button>
            ))}

            <div style={{ width: 1, background: '#D4AF3720', margin: 4 }} />

            <button
              onClick={handleResetLayout}
              style={{
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--font-heading)',
                padding: '7px 14px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fintheon-muted)',
                background: 'transparent',
              }}
            >
              Reset
            </button>
          </div>
        </Panel>

        <Panel position="bottom-left">
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: '6px 12px',
              background: 'color-mix(in srgb, #0a0a00 85%, transparent)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #D4AF3712',
              borderRadius: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: 'var(--fintheon-accent)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}
            >
              {filteredCatalysts.length} catalysts
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--fintheon-muted)',
                fontFamily: 'var(--font-mono)',
                opacity: 0.5,
              }}
            >
              {NARRATIVE_THREADS.length} narratives
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: activeView === 'narratives' ? '#F59E0B' : '#8B5CF6',
              }}
            >
              {activeView} view
            </span>
            {forcedView && (
              <span
                style={{
                  fontSize: 8,
                  color: 'var(--fintheon-accent)',
                  fontFamily: 'var(--font-mono)',
                  opacity: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                locked
              </span>
            )}
          </div>
        </Panel>

        <Panel position="bottom-right">
          <div
            style={{
              padding: '10px 14px',
              background: 'color-mix(in srgb, #0a0a00 85%, transparent)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #D4AF3712',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <span
              style={{
                fontSize: 8,
                color: 'var(--fintheon-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 2,
                opacity: 0.5,
              }}
            >
              Narratives
            </span>

            {NARRATIVE_THREADS.map((thread) => (
              <div key={thread.slug} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: thread.color }} />
                <span
                  style={{
                    fontSize: 10,
                    color: thread.color,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                    opacity: 0.8,
                  }}
                >
                  {thread.shortTitle}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--fintheon-muted)',
                    fontFamily: 'var(--font-mono)',
                    opacity: 0.4,
                  }}
                >
                  {cardsByThread.get(thread.slug)?.length ?? 0}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function NarrativeForceCanvas(props: NarrativeForceCanvasProps) {
  return (
    <ReactFlowProvider>
      <NarrativeFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
