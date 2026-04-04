// [claude-code 2026-04-04] Loading sequence, Save Layout button, 3-tier zoom (macro/narratives/themes), skip force sim on saved positions
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
  CROSS_NARRATIVE_ROPE,
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

// ── Persistent node positions (localStorage) ──────────────────
const POSITIONS_KEY = 'fintheon-narrative-positions';

function loadSavedPositions(): Map<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, { x: number; y: number }>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveNodePosition(nodeId: string, x: number, y: number) {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : {};
    obj[nodeId] = { x, y };
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(obj));
  } catch {
    // silent
  }
}

function clearSavedPositions() {
  localStorage.removeItem(POSITIONS_KEY);
}

const CANVAS_CSS = `
@keyframes hub-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.01); }
}
@keyframes card-enter {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes territory-ring-pulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 30px 2px currentColor; }
}
@keyframes spin-gold {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.narrative-hub-node.settled { animation: hub-breathe 6s ease-in-out infinite; }
.aggregate-card-scroll::-webkit-scrollbar { width: 4px; }
.aggregate-card-scroll::-webkit-scrollbar-track { background: transparent; }
.aggregate-card-scroll::-webkit-scrollbar-thumb { background: #c79f4a40; border-radius: 4px; }
.aggregate-card-scroll::-webkit-scrollbar-thumb:hover { background: #c79f4a70; }
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
      x: hub.x + (Math.random() - 0.5) * 120,
      y: hub.y + (Math.random() - 0.5) * 120,
    });

    simLinks.push({ source: card.id, target: `hub-${threadSlug}`, strength: 0.75 });
  }

  return { simNodes, simLinks };
}

function runForceSimulation(
  simNodes: SimNode[],
  simLinks: SimLink[],
  ticks = 350,
): Map<string, { x: number; y: number }> {
  // Exclude pinned nodes from simulation — they keep their saved positions
  const pinnedIds = new Set<string>();
  const saved = loadSavedPositions();
  for (const node of simNodes) {
    const savedPos = saved.get(node.id);
    if (savedPos) {
      node.fx = savedPos.x;
      node.fy = savedPos.y;
      pinnedIds.add(node.id);
    }
  }

  const simulation = forceSimulation<SimNode>(simNodes)
    .force('charge', forceManyBody<SimNode>().strength((node) => (node.nodeKind === 'hub' ? -400 : -50)))
    .force(
      'link',
      forceLink<SimNode, SimLink>(simLinks)
        .id((node) => node.id)
        .distance((link) => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          return source.nodeKind === 'hub' || target.nodeKind === 'hub' ? 100 : 70;
        })
        .strength((link) => link.strength),
    )
    .force('collide', forceCollide<SimNode>().radius((node) => (node.nodeKind === 'hub' ? 90 : 55)).strength(0.6))
    .force('clusterX', forceX<SimNode>((node) => HUB_POSITIONS[node.threadSlug]?.x ?? 0).strength((node) => (node.nodeKind === 'hub' ? 0.35 : 0.18)))
    .force('clusterY', forceY<SimNode>((node) => HUB_POSITIONS[node.threadSlug]?.y ?? 0).strength((node) => (node.nodeKind === 'hub' ? 0.35 : 0.18)))
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

    const diameter = territory.r * 2;
    nodes.push({
      id: `territory-${thread.slug}`,
      type: 'territory',
      position: { x: territory.x, y: territory.y },
      data: {
        title: thread.title,
        color: thread.color,
        count: cardsByThread.get(thread.slug)?.length ?? 0,
        size: diameter,
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
        stroke: CROSS_NARRATIVE_ROPE,
        strokeWidth: Math.min(2.5 + count * 0.3, 6),
        opacity: 0.08 + Math.min(count * 0.02, 0.12),
      },
      animated: true,
      className: 'narrative-rope-shimmer',
      label: count > 2 ? `${count}` : undefined,
      labelStyle: {
        fill: '#14B8A6',
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
        stroke: CROSS_NARRATIVE_ROPE,
        strokeWidth: Math.min(1 + count * 0.12, 2.5),
        opacity: 0.06 + Math.min(count * 0.01, 0.1),
      },
      animated: true,
      className: 'narrative-rope-shimmer',
    });
  }

  return { nodes, edges };
}

function buildMacroView(
  cardsByThread: Map<string, CatalystCard[]>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const thread of NARRATIVE_THREADS) {
    const territory = TERRITORY_LAYOUT[thread.slug];
    if (!territory) continue;

    const diameter = territory.r * 2;
    nodes.push({
      id: `territory-${thread.slug}`,
      type: 'territory',
      position: { x: territory.x, y: territory.y },
      data: {
        title: thread.shortTitle,
        color: thread.color,
        count: cardsByThread.get(thread.slug)?.length ?? 0,
        size: diameter,
      },
      draggable: true,
      selectable: false,
      zIndex: -1,
    });
  }

  return { nodes, edges };
}

function saveAllPositions(nodesList: Node[]) {
  try {
    const obj: Record<string, { x: number; y: number }> = {};
    for (const node of nodesList) {
      obj[node.id] = node.position;
    }
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(obj));
  } catch {
    // silent
  }
}

function hasSavedPositions(): boolean {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    if (!raw) return false;
    const obj = JSON.parse(raw);
    return Object.keys(obj).length > 10;
  } catch {
    return false;
  }
}

interface NarrativeForceCanvasProps {
  visibleLaneIds: Set<string>;
  activeTags: Set<string>;
  activeTool: CanvasTool;
  timeframeFilter?: string;
  onScaleChange?: (scale: number) => void;
  onSelectCard?: (id: string) => void;
  onEditCard?: (card: CatalystCard) => void;
  onZoomFnsReady?: (fns: { zoomTo: (level: number) => void; fitView: () => void }) => void;
}

function NarrativeFlowCanvas({
  visibleLaneIds,
  activeTags,
  activeTool,
  timeframeFilter,
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
  const [loadingPhase, setLoadingPhase] = useState<'loading' | 'settling' | 'ready'>(
    hasSavedPositions() ? 'ready' : 'loading',
  );
  const [transitioning, setTransitioning] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const zoomViewRef = useRef<SemanticNarrativeView>('narratives');
  const didFitRef = useRef(false);
  const persistedPositionsRef = useRef<Map<string, { x: number; y: number }>>(loadSavedPositions());

  useEffect(() => {
    onZoomFnsReady?.({
      zoomTo: (level: number) => reactFlow.zoomTo(level, { duration: 200 }),
      fitView: () => reactFlow.fitView({ padding: 0.1, duration: 300 }),
    });
  }, [onZoomFnsReady, reactFlow]);

  const filteredCatalysts = useMemo(() => {
    const TIMEFRAME_DAYS: Record<string, number> = {
      '1d': 1,
      '1w': 7,
      '2w': 14,
      '1m': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365,
    };
    const tfDays = timeframeFilter ? TIMEFRAME_DAYS[timeframeFilter] : undefined;
    const tfCutoff = tfDays ? Date.now() - tfDays * 86400000 : undefined;

    let catalysts = state.catalysts.filter((card) => {
      if (tfCutoff && card.date) {
        const cardTime = new Date(card.date).getTime();
        if (cardTime < tfCutoff) return false;
      }

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
  }, [state.catalysts, state.categoryFilter, state.filterSentiment, visibleLaneIds, activeTags, timeframeFilter]);

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
    const saved = loadSavedPositions();
    if (saved.size > 10) {
      setLoadingPhase('ready');
      return saved;
    }
    setLoadingPhase('loading');
    const { simNodes, simLinks } = buildSimData(filteredCatalysts);
    const result = runForceSimulation(simNodes, simLinks);
    setLoadingPhase('settling');
    setTimeout(() => setLoadingPhase('ready'), 400);
    return result;
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
      const apply = (result: { nodes: Node[]; edges: Edge[] }) => {
        setNodes(applyPersistedPositions(result.nodes));
        setEdges(result.edges);
      };

      if (view === 'macro') {
        apply(buildMacroView(cardsByThread));
        return;
      }
      if (view === 'narratives') {
        apply(buildNarrativeView(filteredCatalysts, cardsByThread));
        return;
      }
      apply(buildThemeView(positions, filteredCatalysts, cardsByThread, expandedGroups, toggleExpandedGroup));
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
      if (forcedView || transitioning) return;

      const semanticView = getSemanticZoom(viewport.zoom);
      if (semanticView === zoomViewRef.current) return;

      zoomViewRef.current = semanticView;
      setTransitioning(true);
      setCurrentView(semanticView);
      setTimeout(() => {
        rebuildView(semanticView);
        setTransitioning(false);
      }, 150);
    },
    [forcedView, onScaleChange, rebuildView, transitioning],
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

  const handleSaveLayout = useCallback(() => {
    saveAllPositions(nodes);
    persistedPositionsRef.current = new Map(nodes.map((n) => [n.id, n.position]));
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  }, [nodes]);

  const handleResetLayout = useCallback(() => {
    setExpandedGroups(new Set());
    persistedPositionsRef.current.clear();
    clearSavedPositions();
    setLoadingPhase('loading');
    const activeView = forcedView ?? currentView;
    setTimeout(() => {
      rebuildView(activeView);
      setLoadingPhase('settling');
      setTimeout(() => {
        setLoadingPhase('ready');
        reactFlow.fitView({ padding: 0.1, duration: 400 });
      }, 400);
    }, 50);
  }, [forcedView, currentView, rebuildView, reactFlow]);

  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    persistedPositionsRef.current.set(node.id, node.position);
    saveNodePosition(node.id, node.position.x, node.position.y);
  }, []);

  const activeView = forcedView ?? currentView;

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <style>{CANVAS_CSS}</style>

      {loadingPhase !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fintheon-bg)',
            opacity: loadingPhase === 'settling' ? 0 : 1,
            transition: 'opacity 400ms ease',
            pointerEvents: loadingPhase === 'settling' ? 'none' : 'auto',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              border: '2px solid #c79f4a20',
              borderTop: '2px solid #c79f4a',
              borderRadius: '50%',
              animation: 'spin-gold 0.8s linear infinite',
              marginBottom: 14,
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: '#c79f4a',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              opacity: 0.7,
            }}
          >
            Resolving narratives...
          </span>
        </div>
      )}

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
        style={{ backgroundColor: 'var(--fintheon-bg)', opacity: transitioning ? 0.4 : 1, transition: 'opacity 300ms ease' }}
        onMove={handleViewportMove}
        onNodeDragStop={handleNodeDragStop}
      >
        <Background color="#c79f4a06" gap={50} size={1} />

        {/* Narrative/Theme toggle moved to NarrativeFilterDropdown */}

        <Panel position="bottom-left">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                color: activeView === 'macro' ? '#c79f4a' : activeView === 'narratives' ? '#F59E0B' : '#8B5CF6',
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={handleSaveLayout}
              style={{
                padding: '4px 10px',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: saveFlash ? '#c79f4a' : 'var(--fintheon-muted)',
                background: 'color-mix(in srgb, #0a0a00 70%, transparent)',
                border: `1px solid ${saveFlash ? '#c79f4a30' : '#D4AF3710'}`,
                borderRadius: 6,
                cursor: 'pointer',
                opacity: saveFlash ? 1 : 0.6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { if (!saveFlash) e.currentTarget.style.opacity = '0.6'; }}
            >
              {saveFlash ? 'Saved' : 'Save Layout'}
            </button>
            <button
              onClick={handleResetLayout}
              style={{
                padding: '4px 10px',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fintheon-muted)',
                background: 'color-mix(in srgb, #0a0a00 70%, transparent)',
                border: '1px solid #D4AF3710',
                borderRadius: 6,
                cursor: 'pointer',
                opacity: 0.6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
            >
              Reset Layout
            </button>
          </div>
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
