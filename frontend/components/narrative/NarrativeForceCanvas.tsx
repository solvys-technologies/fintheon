// [claude-code 2026-03-29] S9-T5-T1: Fix rope visibility — remove inline opacity that overrode rope-breathe CSS animation
// [claude-code 2026-03-28] S8-T2: Force-directed Observatory layout, hub nodes, zoom state machine, breathing motion
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force';
import type { Simulation, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { useNarrative } from '../../contexts/NarrativeContext';
import { computeRopeConnections, computeHubRopes } from '../../lib/narrative-rope-engine';
import { CATEGORY_COLORS, FORCE_CONFIG } from '../../lib/narrative-force-layout';
import type { CatalystCard, NarrativeCategory } from '../../lib/narrative-types';
import type { CanvasTool } from './NarrativeFloatingToolbar';
import { NarrativeHubNode } from './NarrativeHubNode';
import { NarrativeSummaryCard } from './NarrativeSummaryCard';
import { TemporalClusterNode } from './TemporalClusterNode';
import { CategoryClusterNode } from './CategoryClusterNode';
import { computeTemporalClusters, computeCategoryGroups } from '../../lib/narrative-hierarchy';
import { Lock } from 'lucide-react';

// ─── Breathing & entrance CSS (injected via <style>) ────────────
const BREATHING_CSS = `
@keyframes hub-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.01); }
}
@keyframes node-enter {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
.narrative-hub-node.settled { animation: hub-breathe 6s ease-in-out infinite; }
.node-entering { animation: node-enter 0.3s ease-out both; }
`;

// ─── The 10 narrative threads (must match migration 027 + TimelinePanel) ──
const NARRATIVE_THREADS = [
  { slug: 'middle-east-conflict', title: 'Middle Eastern Conflict', color: '#F59E0B' },
  { slug: 'liquidity-credit-contraction', title: 'Liquidity & Credit', color: '#8B5CF6' },
  { slug: 'ai-singularity', title: 'The Singularity', color: '#3B82F6' },
  { slug: 'usd-jpy-carry-trade', title: 'USD-JPY Carry Trade', color: '#EC4899' },
  { slug: 'trade-war', title: 'Trade War', color: '#EF4444' },
  { slug: 'us-china-relations', title: 'US-China Relations', color: '#14B8A6' },
  { slug: 'rate-cut-cycle', title: 'Rate Cut Cycle', color: '#34D399' },
  { slug: 'trump-presidency', title: 'Trump Presidency', color: '#F97316' },
  { slug: 'price-stability', title: 'Price Stability', color: '#FBBF24' },
  { slug: 'maximum-employment', title: 'Max Employment', color: '#A78BFA' },
];

const THREAD_COLOR_MAP = Object.fromEntries(NARRATIVE_THREADS.map(t => [t.slug, t.color]));
const VALID_SLUGS = new Set(NARRATIVE_THREADS.map(t => t.slug));
/** Ensure a card's narrative maps to a known thread slug; fall back to rate-cut-cycle */
function safeSlug(raw: string | undefined): string {
  if (!raw) return 'rate-cut-cycle';
  if (VALID_SLUGS.has(raw)) return raw;
  // Try slugifying: "Sector Rotation" → "sector-rotation"
  const slugified = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (VALID_SLUGS.has(slugified)) return slugified;
  return 'rate-cut-cycle';
}

// ─── Cluster proximity — initial hub positions ──────────────────
// Trump Presidency central, monetary cluster right, geopolitical left
const HUB_POSITIONS: Record<string, { x: number; y: number }> = {
  'trump-presidency':             { x: 0,    y: 0 },
  'rate-cut-cycle':               { x: 400,  y: -120 },
  'price-stability':              { x: 350,  y: 120 },
  'liquidity-credit-contraction': { x: 500,  y: 20 },
  'middle-east-conflict':         { x: -400, y: -120 },
  'trade-war':                    { x: -350, y: 120 },
  'us-china-relations':           { x: -250, y: -280 },
  'ai-singularity':               { x: 50,   y: -380 },
  'maximum-employment':           { x: 50,   y: 380 },
  'usd-jpy-carry-trade':          { x: 550,  y: -220 },
};

// ─── Zoom level helpers ─────────────────────────────────────────
type CanvasZoomLevel = 'fullCard' | 'miniCard' | 'temporalCluster' | 'narrativeThread' | 'categoryOverview';

function getCanvasZoomLevel(zoom: number): CanvasZoomLevel {
  if (zoom >= 0.7) return 'fullCard';
  if (zoom >= 0.4) return 'miniCard';
  if (zoom >= 0.2) return 'temporalCluster';
  if (zoom >= 0.1) return 'narrativeThread';
  return 'categoryOverview';
}

// ─── d3-force types ─────────────────────────────────────────────
interface SimNode extends SimulationNodeDatum {
  id: string;
  nodeKind: 'hub' | 'card';
  threadSlug: string;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  strength: number;
}

// ─── Severity color ─────────────────────────────────────────────
function severityColor(severity: string): string {
  if (severity === 'high') return '#EF4444';
  if (severity === 'medium') return '#c79f4a';
  return '#6B7280';
}

// ─── Event Card Node (fullCard zoom ≥ 0.7) ─────────────────────
function EventCardNode({ data }: { data: CatalystCard & { isLocked: boolean; staggerIndex: number; settled: boolean } }) {
  const cat = (data.category ?? 'macroeconomic') as NarrativeCategory;
  const catColor = CATEGORY_COLORS[cat] ?? '#6B7280';
  const isBullish = data.sentiment === 'bullish';
  const sentimentColor = isBullish ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)';
  const sevColor = severityColor(data.severity);

  return (
    <div
      className={data.settled ? '' : 'node-entering'}
      style={{ animationDelay: `${data.staggerIndex * 50}ms`, position: 'relative' }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        className="rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          width: 240,
          backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
          borderColor: `${sevColor}30`,
          borderWidth: data.severity === 'high' ? 1.5 : 1,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 2px 12px ${catColor}10`,
        }}
      >
        <div className="h-[3px]" style={{ backgroundColor: sevColor }} />
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <p className="flex-1 text-[11px] font-semibold leading-tight" style={{ color: 'var(--fintheon-text)', fontFamily: 'var(--font-body)' }}>
              {data.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {data.isLocked && <Lock className="w-2.5 h-2.5 opacity-20" style={{ color: 'var(--fintheon-muted)' }} />}
              <span className="text-[10px] font-bold" style={{ color: sentimentColor }}>
                {isBullish ? '▲' : '▼'}
              </span>
            </div>
          </div>
          {data.description && (
            <p className="text-[8px] leading-relaxed line-clamp-2" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>
              {data.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase"
              style={{ color: sentimentColor, backgroundColor: `color-mix(in srgb, ${sentimentColor} 12%, transparent)` }}>
              {data.sentiment}
            </span>
            {data.directionBias && data.directionBias !== 'neutral' && (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full font-medium uppercase" style={{ color: 'var(--fintheon-muted)', backgroundColor: 'var(--fintheon-surface)' }}>
                {data.directionBias === 'bullish' ? 'Cyclical' : 'Counter-Cyclical'}
              </span>
            )}
            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-medium uppercase"
              style={{ color: catColor, backgroundColor: `${catColor}15` }}>
              {data.category}
            </span>
          </div>
          {data.narrativeIds?.length > 0 && (
            <div className="flex items-center gap-1">
              {data.narrativeIds.slice(0, 4).map(inst => (
                <span key={inst} className="text-[7px] font-mono px-1 py-0.5 rounded"
                  style={{ color: 'var(--fintheon-accent)', backgroundColor: 'var(--fintheon-accent)/8', fontFamily: 'var(--font-mono)' }}>
                  {inst}
                </span>
              ))}
            </div>
          )}
          {data.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-0.5">
              {data.tags.slice(0, 5).map(t => (
                <span key={t} className="text-[6px] px-1 py-0.5 rounded"
                  style={{ color: `${catColor}80`, backgroundColor: `${catColor}08`, fontFamily: 'var(--font-mono)' }}>
                  #{t}
                </span>
              ))}
              {data.tags.length > 5 && (
                <span className="text-[6px] opacity-30" style={{ color: 'var(--fintheon-muted)' }}>+{data.tags.length - 5}</span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[7px] opacity-30" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-mono)' }}>
              {data.date}
            </span>
            <span className="text-[6px] opacity-20" style={{ color: 'var(--fintheon-muted)' }}>
              {data.source}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Card Node (miniCard zoom 0.3–0.7) ─────────────────────
function MiniEventCardNode({ data }: { data: CatalystCard & { isLocked: boolean } }) {
  const isBullish = data.sentiment === 'bullish';
  const sentimentColor = isBullish ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)';
  const sevColor = severityColor(data.severity);

  return (
    <div
      className="rounded-lg border px-2 py-1.5 cursor-grab active:cursor-grabbing"
      style={{
        width: 160,
        position: 'relative',
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
        borderColor: `${sevColor}30`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sevColor }} />
        <p className="flex-1 text-[10px] font-semibold leading-tight truncate"
          style={{ color: 'var(--fintheon-text)', fontFamily: 'var(--font-body)' }}>
          {data.title}
        </p>
        <span className="text-[9px] font-bold shrink-0" style={{ color: sentimentColor }}>
          {isBullish ? '▲' : '▼'}
        </span>
      </div>
    </div>
  );
}

// ─── Dot Node (extreme zoom-out < 0.15) ─────────────────────────
function DotNode({ data }: { data: { slug: string; title: string; color: string; count: number } }) {
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div className="w-5 h-5 rounded-full"
        style={{ backgroundColor: data.color, boxShadow: `0 0 16px ${data.color}50` }} />
      <span className="text-[9px] font-semibold whitespace-nowrap"
        style={{ color: data.color, fontFamily: 'var(--font-heading)' }}>
        {data.title}
      </span>
      <span className="text-[7px] font-mono" style={{ color: `${data.color}80` }}>
        {data.count}
      </span>
    </div>
  );
}

// ─── Node types registration ────────────────────────────────────
const nodeTypes: NodeTypes = {
  eventCard: EventCardNode,
  miniCard: MiniEventCardNode,
  narrativeHub: NarrativeHubNode,
  narrativeSummary: NarrativeSummaryCard,
  narrativeDot: DotNode,
  temporalCluster: TemporalClusterNode,
  categoryCluster: CategoryClusterNode,
};

// ─── Force simulation: compute positions synchronously ──────────
function buildSimData(catalysts: CatalystCard[]) {
  const simNodes: SimNode[] = [];
  const simLinks: SimLink[] = [];

  const cardsByThread = new Map<string, CatalystCard[]>();
  for (const c of catalysts) {
    const thread = safeSlug(c.narrative);
    const arr = cardsByThread.get(thread) ?? [];
    arr.push(c);
    cardsByThread.set(thread, arr);
  }

  // Hub nodes at cluster-initial positions
  for (const thread of NARRATIVE_THREADS) {
    const pos = HUB_POSITIONS[thread.slug] ?? { x: 0, y: 0 };
    simNodes.push({ id: `hub-${thread.slug}`, nodeKind: 'hub', threadSlug: thread.slug, x: pos.x, y: pos.y });
  }

  // Card nodes — jittered near their hub
  for (const card of catalysts) {
    const thread = safeSlug(card.narrative);
    const hubPos = HUB_POSITIONS[thread] ?? { x: 0, y: 0 };
    simNodes.push({
      id: card.id,
      nodeKind: 'card',
      threadSlug: thread,
      x: hubPos.x + (Math.random() - 0.5) * 250,
      y: hubPos.y + (Math.random() - 0.5) * 250,
    });
    // Card → hub link
    simLinks.push({ source: card.id, target: `hub-${thread}`, strength: 0.4 });
  }

  // Cross-narrative rope links (weak)
  const ropes = computeRopeConnections(catalysts, 200);
  for (const rope of ropes) {
    simLinks.push({ source: rope.fromId, target: rope.toId, strength: rope.strength * 0.1 });
  }

  return { simNodes, simLinks, cardsByThread };
}

function runForceSimulation(simNodes: SimNode[], simLinks: SimLink[], ticks = 300): Map<string, { x: number; y: number }> {
  const sim = forceSimulation<SimNode>(simNodes)
    .force('charge', forceManyBody<SimNode>().strength(d => d.nodeKind === 'hub' ? -400 : FORCE_CONFIG.charge))
    .force('link', forceLink<SimNode, SimLink>(simLinks)
      .id(d => (d as SimNode).id)
      .distance(d => {
        const s = d.source as SimNode;
        const t = d.target as SimNode;
        return (s.nodeKind === 'hub' || t.nodeKind === 'hub') ? 200 : 120;
      })
      .strength(d => (d as SimLink).strength))
    .force('collide', forceCollide<SimNode>().radius(d => d.nodeKind === 'hub' ? 110 : 135).strength(0.7))
    .force('clusterX', forceX<SimNode>(d => HUB_POSITIONS[d.threadSlug]?.x ?? 0)
      .strength(d => d.nodeKind === 'hub' ? 0.15 : FORCE_CONFIG.clusterStrength))
    .force('clusterY', forceY<SimNode>(d => HUB_POSITIONS[d.threadSlug]?.y ?? 0)
      .strength(d => d.nodeKind === 'hub' ? 0.15 : FORCE_CONFIG.clusterStrength))
    .alphaDecay(FORCE_CONFIG.alphaDecay)
    .velocityDecay(FORCE_CONFIG.velocityDecay)
    .stop();

  for (let i = 0; i < ticks; i++) sim.tick();

  const positions = new Map<string, { x: number; y: number }>();
  for (const n of simNodes) positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  return positions;
}

// ─── Build React Flow nodes for a given zoom level ──────────────
function buildNodesForZoom(
  positions: Map<string, { x: number; y: number }>,
  catalysts: CatalystCard[],
  zoomLevel: CanvasZoomLevel,
  settled: boolean,
): Node[] {
  const nodes: Node[] = [];
  const cardsByThread = new Map<string, CatalystCard[]>();
  for (const c of catalysts) {
    const thread = c.narrative ?? 'rate-cut-cycle';
    const arr = cardsByThread.get(thread) ?? [];
    arr.push(c);
    cardsByThread.set(thread, arr);
  }

  if (zoomLevel === 'categoryOverview') {
    const clusters = computeTemporalClusters(catalysts, positions);
    const groups = computeCategoryGroups(catalysts, clusters, positions);
    for (const group of groups) {
      nodes.push({
        id: group.id,
        type: 'categoryCluster',
        position: group.center,
        data: { ...group, settled },
        draggable: true,
      });
    }
    return nodes;
  }

  if (zoomLevel === 'narrativeThread') {
    for (const thread of NARRATIVE_THREADS) {
      const pos = positions.get(`hub-${thread.slug}`) ?? HUB_POSITIONS[thread.slug] ?? { x: 0, y: 0 };
      const cards = cardsByThread.get(thread.slug) ?? [];
      const sorted = [...cards].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      nodes.push({
        id: `hub-${thread.slug}`,
        type: 'narrativeSummary',
        position: pos,
        data: { slug: thread.slug, title: thread.title, color: thread.color, count: cards.length, topEvents: sorted.slice(0, 5).map(c => c.title) },
        draggable: true,
      });
    }
    return nodes;
  }

  if (zoomLevel === 'temporalCluster') {
    for (const thread of NARRATIVE_THREADS) {
      const pos = positions.get(`hub-${thread.slug}`) ?? HUB_POSITIONS[thread.slug] ?? { x: 0, y: 0 };
      nodes.push({
        id: `hub-${thread.slug}`,
        type: 'narrativeHub',
        position: pos,
        data: { slug: thread.slug, title: thread.title, color: thread.color, count: cardsByThread.get(thread.slug)?.length ?? 0, settled },
        draggable: true,
      });
    }
    const clusters = computeTemporalClusters(catalysts, positions);
    for (const cluster of clusters) {
      nodes.push({
        id: cluster.id,
        type: 'temporalCluster',
        position: cluster.center,
        data: { ...cluster, settled },
        draggable: true,
      });
    }
    return nodes;
  }

  // fullCard or miniCard — hubs + individual cards
  const cardType = zoomLevel === 'fullCard' ? 'eventCard' : 'miniCard';
  let staggerIndex = 0;

  for (const thread of NARRATIVE_THREADS) {
    const pos = positions.get(`hub-${thread.slug}`) ?? HUB_POSITIONS[thread.slug] ?? { x: 0, y: 0 };
    nodes.push({
      id: `hub-${thread.slug}`,
      type: 'narrativeHub',
      position: pos,
      data: { slug: thread.slug, title: thread.title, color: thread.color, count: cardsByThread.get(thread.slug)?.length ?? 0, settled },
      draggable: true,
    });
  }

  for (const card of catalysts) {
    const pos = positions.get(card.id);
    if (!pos) continue;
    nodes.push({
      id: card.id,
      type: cardType,
      position: pos,
      data: { ...card, isLocked: card.source !== 'user', staggerIndex: staggerIndex++, settled },
      draggable: true,
    });
  }

  return nodes;
}

// ─── Build edges based on zoom level ────────────────────────────
function buildEdges(catalysts: CatalystCard[], zoomLevel: CanvasZoomLevel, nodeIds: Set<string>): Edge[] {
  if (zoomLevel === 'categoryOverview') return [];

  const CROSS_NARRATIVE_GOLD = '#c79f4a';
  const edges: Edge[] = [];

  if (zoomLevel === 'narrativeThread') {
    // Hub-to-hub edges based on shared narrative threads
    const threadPairs = new Map<string, number>();
    for (const c of catalysts) {
      if (c.narrativeThreads && c.narrativeThreads.length > 1) {
        const threads = c.narrativeThreads;
        for (let i = 0; i < threads.length; i++) {
          for (let j = i + 1; j < threads.length; j++) {
            const key = [threads[i], threads[j]].sort().join('|');
            threadPairs.set(key, (threadPairs.get(key) ?? 0) + 1);
          }
        }
      }
    }
    for (const [key, count] of threadPairs) {
      const [a, b] = key.split('|');
      const hubA = `hub-${a}`;
      const hubB = `hub-${b}`;
      if (nodeIds.has(hubA) && nodeIds.has(hubB)) {
        edges.push({
          id: `summary-rope-${key}`,
          source: hubA,
          target: hubB,
          type: 'smoothstep',
          style: { stroke: CROSS_NARRATIVE_GOLD, strokeWidth: Math.min(1 + count * 0.3, 3), opacity: 0.2 + Math.min(count * 0.05, 0.3) },
        });
      }
    }
    return edges;
  }

  if (zoomLevel === 'temporalCluster') {
    // Hub-to-cluster ropes
    const clusters = computeTemporalClusters(catalysts, new Map());
    for (const cluster of clusters) {
      const hubId = `hub-${cluster.narrativeSlug}`;
      if (nodeIds.has(cluster.id) && nodeIds.has(hubId)) {
        edges.push({
          id: `edge-${cluster.id}-${hubId}`,
          source: cluster.id,
          target: hubId,
          type: 'smoothstep',
          className: 'rope-breathe',
          style: { stroke: THREAD_COLOR_MAP[cluster.narrativeSlug] ?? '#6B7280', strokeWidth: 1.5 },
        });
      }
    }
    // Also add cross-narrative ropes at cluster level for visibility
    const crossRopesCluster = computeRopeConnections(catalysts, 100);
    for (const rope of crossRopesCluster) {
      if (!nodeIds.has(rope.fromId) && !nodeIds.has(rope.toId)) continue;
      // Find the cluster or hub that contains each card
      const fromCluster = clusters.find(cl => cl.cards.some(c => c.id === rope.fromId));
      const toCluster = clusters.find(cl => cl.cards.some(c => c.id === rope.toId));
      const fromNode = fromCluster?.id ?? `hub-${rope.fromNarrative}`;
      const toNode = toCluster?.id ?? `hub-${rope.toNarrative}`;
      if (fromNode === toNode) continue;
      if (!nodeIds.has(fromNode) || !nodeIds.has(toNode)) continue;
      edges.push({
        id: `cluster-rope-${rope.id}`,
        source: fromNode,
        target: toNode,
        type: 'smoothstep',
        className: 'rope-breathe',
        style: { stroke: CROSS_NARRATIVE_GOLD, strokeWidth: 0.8 + rope.strength },
      });
    }
    return edges;
  }

  // fullCard / miniCard — hub-to-card + cross-catalyst ropes
  const hubRopes = computeHubRopes(catalysts);
  for (const rope of hubRopes) {
    const targetId = rope.toId.replace('group-', 'hub-');
    if (!nodeIds.has(rope.fromId) || !nodeIds.has(targetId)) continue;
    edges.push({
      id: rope.id,
      source: rope.fromId,
      target: targetId,
      type: 'smoothstep',
      animated: false,
      className: `rope-breathe rope-delay-${edges.length % 7}`,
      style: { stroke: THREAD_COLOR_MAP[rope.fromNarrative ?? ''] ?? '#6B7280', strokeWidth: 1.2 },
    });
  }

  const crossRopes = computeRopeConnections(catalysts, 200);
  for (const rope of crossRopes) {
    if (!nodeIds.has(rope.fromId) || !nodeIds.has(rope.toId)) continue;
    const ropeColor = rope.crossNarrative ? CROSS_NARRATIVE_GOLD : THREAD_COLOR_MAP[rope.fromNarrative ?? ''] ?? CROSS_NARRATIVE_GOLD;
    edges.push({
      id: rope.id,
      source: rope.fromId,
      target: rope.toId,
      type: 'smoothstep',
      animated: false,
      className: `rope-breathe rope-delay-${edges.length % 7}`,
      style: {
        stroke: ropeColor,
        strokeWidth: 0.8 + rope.strength * 2,
      },
      data: { sharedTags: rope.sharedTags, strength: rope.strength, ropeColor },
    });
  }

  return edges;
}

// ─── Inner canvas (needs ReactFlowProvider above) ───────────────
function NarrativeFlowCanvas({
  visibleLaneIds,
  activeTags,
  activeTool,
  timeframeFilter,
  onScaleChange,
  onSelectCard,
  onEditCard,
  onZoomFnsReady,
}: NarrativeForceCanvasProps) {
  const { state, dispatch } = useNarrative();
  const reactFlow = useReactFlow();
  const [settled, setSettled] = useState(false);
  const [ropeTooltip, setRopeTooltip] = useState<{ x: number; y: number; tags: string[]; strength: number } | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const zoomLevelRef = useRef<CanvasZoomLevel>('miniCard');
  const simNodesRef = useRef<SimNode[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const dragRafRef = useRef<number>(0);
  const draggedIdRef = useRef<string | null>(null);

  // Expose zoom functions to parent
  useEffect(() => {
    onZoomFnsReady?.({
      zoomTo: (level: number) => reactFlow.zoomTo(level, { duration: 200 }),
      fitView: () => reactFlow.fitView({ padding: 0.2, duration: 300 }),
    });
  }, [reactFlow, onZoomFnsReady]);

  // Filter catalysts (lane + category + tag + timeframe filters)
  const filteredCatalysts = useMemo(() => {
    const TIMEFRAME_DAYS: Record<string, number> = {
      '1d': 1, '1w': 7, '2w': 14, '1m': 30, '3m': 90, '6m': 180, '1y': 365,
    };
    const tfDays = timeframeFilter ? TIMEFRAME_DAYS[timeframeFilter] : undefined;
    const tfCutoff = tfDays ? Date.now() - tfDays * 86400000 : undefined;

    let cards = state.catalysts.filter(c => {
      // Timeframe filter
      if (tfCutoff && c.date) {
        const cardTime = new Date(c.date).getTime();
        if (cardTime < tfCutoff) return false;
      }
      // Lane / narrative thread filter
      if (visibleLaneIds.size > 0) {
        const thread = c.narrative ?? c.narrativeThreads?.[0];
        if (thread && !visibleLaneIds.has(thread)) return false;
      }
      // Category filter (empty set = show all)
      if (state.categoryFilter.size > 0 && c.category && !state.categoryFilter.has(c.category)) {
        return false;
      }
      return true;
    });
    if (activeTags.size > 0) {
      cards = cards.filter(c => c.tags?.some(t => activeTags.has(t)) ?? false);
    }
    return cards;
  }, [state.catalysts, state.categoryFilter, visibleLaneIds, activeTags, timeframeFilter]);

  // Compute initial layout
  const { initialNodes, initialEdges } = useMemo(() => {
    const { simNodes, simLinks } = buildSimData(filteredCatalysts);
    const positions = runForceSimulation(simNodes, simLinks);
    positionsRef.current = positions;
    simNodesRef.current = simNodes;

    const nodes = buildNodesForZoom(positions, filteredCatalysts, zoomLevelRef.current, false);
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = buildEdges(filteredCatalysts, zoomLevelRef.current, nodeIds);
    return { initialNodes: nodes, initialEdges: edges };
  }, [filteredCatalysts]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Rebuild when catalysts change — also create persistent simulation for drag physics
  useEffect(() => {
    const { simNodes, simLinks } = buildSimData(filteredCatalysts);
    const positions = runForceSimulation(simNodes, simLinks);
    positionsRef.current = positions;
    simNodesRef.current = simNodes;

    // Create persistent simulation (stopped) for drag spring physics
    const sim = forceSimulation<SimNode>(simNodes)
      .force('charge', forceManyBody<SimNode>().strength(d => d.nodeKind === 'hub' ? -400 : FORCE_CONFIG.charge))
      .force('link', forceLink<SimNode, SimLink>(simLinks)
        .id(d => (d as SimNode).id)
        .distance(d => {
          const s = d.source as SimNode;
          const t = d.target as SimNode;
          return (s.nodeKind === 'hub' || t.nodeKind === 'hub') ? 200 : 120;
        })
        .strength(d => (d as SimLink).strength))
      .force('collide', forceCollide<SimNode>().radius(d => d.nodeKind === 'hub' ? 110 : 135).strength(0.7))
      .force('clusterX', forceX<SimNode>(d => HUB_POSITIONS[d.threadSlug]?.x ?? 0)
        .strength(d => d.nodeKind === 'hub' ? 0.15 : FORCE_CONFIG.clusterStrength))
      .force('clusterY', forceY<SimNode>(d => HUB_POSITIONS[d.threadSlug]?.y ?? 0)
        .strength(d => d.nodeKind === 'hub' ? 0.15 : FORCE_CONFIG.clusterStrength))
      .alphaDecay(FORCE_CONFIG.alphaDecay)
      .velocityDecay(FORCE_CONFIG.velocityDecay)
      .stop();

    // Sync node positions to match computed layout
    for (const sn of simNodes) {
      const pos = positions.get(sn.id);
      if (pos) { sn.x = pos.x; sn.y = pos.y; sn.vx = 0; sn.vy = 0; }
    }

    simRef.current = sim;

    const newNodes = buildNodesForZoom(positions, filteredCatalysts, zoomLevelRef.current, false);
    const nodeIds = new Set(newNodes.map(n => n.id));
    const newEdges = buildEdges(filteredCatalysts, zoomLevelRef.current, nodeIds);
    setNodes(newNodes);
    setEdges(newEdges);
    setSettled(false);

    const timer = setTimeout(() => setSettled(true), Math.min(filteredCatalysts.length * 50 + 300, 3000));
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(dragRafRef.current);
      sim.stop();
    };
  }, [filteredCatalysts, setNodes, setEdges]);

  // ── Drag → spring physics ─────────────────────────────────────
  const onNodeDragStart = useCallback((_: any, node: Node) => {
    cancelAnimationFrame(dragRafRef.current);
    draggedIdRef.current = node.id;
    const sim = simRef.current;
    if (!sim) return;

    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode) { simNode.fx = node.position.x; simNode.fy = node.position.y; }

    sim.alpha(0.3);
    const dragTick = () => {
      sim.tick();
      for (const sn of simNodesRef.current) {
        positionsRef.current.set(sn.id, { x: sn.x ?? 0, y: sn.y ?? 0 });
      }
      setNodes(prev => prev.map(n => {
        if (n.id === draggedIdRef.current) return n;
        const pos = positionsRef.current.get(n.id);
        if (pos) return { ...n, position: pos };
        return n;
      }));
      if (sim.alpha() > 0.01) {
        dragRafRef.current = requestAnimationFrame(dragTick);
      }
    };
    dragRafRef.current = requestAnimationFrame(dragTick);
  }, [setNodes]);

  const onNodeDrag = useCallback((_: any, node: Node) => {
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode) { simNode.fx = node.position.x; simNode.fy = node.position.y; }
  }, []);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    const simNode = simNodesRef.current.find(n => n.id === node.id);
    if (simNode) { simNode.fx = null; simNode.fy = null; }
    draggedIdRef.current = null;
    // Let RAF continue until alpha settles (overshoot + settle)
  }, []);

  // ── Zoom state machine ────────────────────────────────────────
  const handleViewportMove = useCallback((_: any, viewport: { zoom: number }) => {
    onScaleChange?.(viewport.zoom);
    const newLevel = getCanvasZoomLevel(viewport.zoom);
    if (newLevel !== zoomLevelRef.current) {
      zoomLevelRef.current = newLevel;
      const newNodes = buildNodesForZoom(positionsRef.current, filteredCatalysts, newLevel, settled);
      const nodeIds = new Set(newNodes.map(n => n.id));
      const newEdges = buildEdges(filteredCatalysts, newLevel, nodeIds);
      setNodes(newNodes);
      setEdges(newEdges);
    }
  }, [filteredCatalysts, settled, onScaleChange, setNodes, setEdges]);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); reactFlow.zoomIn({ duration: 200 }); }
        else if (e.key === '-') { e.preventDefault(); reactFlow.zoomOut({ duration: 200 }); }
        else if (e.key === '0') { e.preventDefault(); reactFlow.fitView({ padding: 0.2, duration: 300 }); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [reactFlow]);

  // ── Node click / double-click ─────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'eventCard' || node.type === 'miniCard') {
      onSelectCard?.(node.id);
    }
  }, [onSelectCard]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Auto-zoom to narrative thread (from summary card)
    if (node.type === 'narrativeSummary' || node.type === 'narrativeDot') {
      const slug = (node.data as any).slug;
      const threadCardIds = filteredCatalysts
        .filter(c => (c.narrative ?? c.narrativeThreads?.[0]) === slug)
        .map(c => c.id);
      reactFlow.fitView({
        nodes: [{ id: `hub-${slug}` }, ...threadCardIds.map(id => ({ id }))],
        padding: 0.3,
        duration: 400,
      });
      return;
    }
    // Edit user-created cards
    if ((node.type === 'eventCard' || node.type === 'miniCard') && node.data?.source === 'user') {
      const card = state.catalysts.find(c => c.id === node.id);
      if (card) onEditCard?.(card);
    }
  }, [filteredCatalysts, reactFlow, state.catalysts, onEditCard]);

  // ── Rope hover tooltip ────────────────────────────────────────
  const onEdgeMouseEnter = useCallback((evt: React.MouseEvent, edge: Edge) => {
    const d = edge.data as { sharedTags?: string[]; strength?: number } | undefined;
    if (!d?.sharedTags?.length) return;
    const bounds = (evt.currentTarget as HTMLElement).getBoundingClientRect();
    setRopeTooltip({ x: evt.clientX - bounds.left, y: evt.clientY - bounds.top - 28, tags: d.sharedTags, strength: d.strength ?? 0 });
    setEdges(es => es.map(e => e.id === edge.id
      ? { ...e, style: { ...e.style, opacity: 0.5 + (d.strength ?? 0) * 0.3, strokeWidth: 1.5 + (d.strength ?? 0) * 2 } }
      : e));
  }, [setEdges]);

  const onEdgeMouseLeave = useCallback((_: React.MouseEvent, edge: Edge) => {
    setRopeTooltip(null);
    const nodeIdSet = new Set(nodes.map(n => n.id));
    const freshEdges = buildEdges(filteredCatalysts, zoomLevelRef.current, nodeIdSet);
    const original = freshEdges.find(e => e.id === edge.id);
    if (original) {
      setEdges(es => es.map(e => e.id === edge.id ? { ...e, style: original.style } : e));
    }
  }, [filteredCatalysts, nodes, setEdges]);

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <style>{BREATHING_CSS}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.45 }}
        minZoom={0.05}
        maxZoom={2}
        panOnDrag={activeTool === 'hand' || activeTool === 'select'}
        selectionOnDrag={activeTool === 'multi-select'}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--fintheon-bg)' }}
        onMove={handleViewportMove}
      >
        <Background color="#c79f4a10" gap={40} size={1} />
      </ReactFlow>

      {ropeTooltip && (
        <div className="absolute pointer-events-none z-50 px-2 py-1 rounded border"
          style={{
            left: ropeTooltip.x, top: ropeTooltip.y,
            backgroundColor: 'color-mix(in srgb, var(--fintheon-bg) 92%, transparent)',
            borderColor: 'var(--fintheon-accent)',
            backdropFilter: 'blur(8px)',
          }}>
          <span className="text-[8px] font-mono" style={{ color: 'var(--fintheon-accent)' }}>
            {ropeTooltip.tags.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Exported wrapper with ReactFlowProvider ────────────────────
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

export default function NarrativeForceCanvas(props: NarrativeForceCanvasProps) {
  return (
    <ReactFlowProvider>
      <NarrativeFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
