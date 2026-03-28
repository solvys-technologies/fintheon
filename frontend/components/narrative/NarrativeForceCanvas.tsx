// [claude-code 2026-03-28] S7: React Flow mind map canvas — risk-type groups, full data cards, AI input
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type OnConnect,
  Panel,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useNarrative } from '../../contexts/NarrativeContext';
import { computeRopeConnections } from '../../lib/narrative-rope-engine';
import { CATEGORY_COLORS } from '../../lib/narrative-force-layout';
import type { CatalystCard, NarrativeCategory } from '../../lib/narrative-types';
import type { CanvasTool } from './NarrativeFloatingToolbar';
import { Loader2, Send, Lock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ─── Category Group Node ──────────────────────────────────────
function CategoryGroupNode({ data }: { data: { label: string; category: NarrativeCategory; count: number } }) {
  const color = CATEGORY_COLORS[data.category] ?? '#6B7280';
  return (
    <div
      className="rounded-2xl border-2 border-dashed p-4 min-w-[300px] min-h-[200px]"
      style={{
        borderColor: `${color}30`,
        backgroundColor: `${color}05`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color, fontFamily: 'var(--font-heading)' }}
        >
          {data.label}
        </span>
        <span className="text-[9px] font-mono opacity-40" style={{ color, fontFamily: 'var(--font-mono)' }}>
          {data.count}
        </span>
      </div>
    </div>
  );
}

// ─── Event Card Node (the main card) ──────────────────────────
function EventCardNode({ data }: { data: CatalystCard & { isLocked: boolean } }) {
  const cat = (data.category ?? 'macroeconomic') as NarrativeCategory;
  const catColor = CATEGORY_COLORS[cat] ?? '#6B7280';
  const isBullish = data.sentiment === 'bullish';
  const sentimentColor = isBullish ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)';

  return (
    <div
      className="rounded-lg border overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        width: 240,
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
        borderColor: `${catColor}30`,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 2px 12px ${catColor}10`,
      }}
    >
      {/* Severity bar */}
      <div
        className="h-[3px]"
        style={{
          backgroundColor: data.severity === 'high' ? '#EF4444'
            : data.severity === 'medium' ? '#c79f4a' : '#6B7280',
        }}
      />

      <div className="px-3 py-2 space-y-1.5">
        {/* Title + lock + sentiment */}
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

        {/* Description */}
        {data.description && (
          <p className="text-[8px] leading-relaxed line-clamp-2" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>
            {data.description}
          </p>
        )}

        {/* Sentiment + Cyclical row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase"
            style={{ color: sentimentColor, backgroundColor: `color-mix(in srgb, ${sentimentColor} 12%, transparent)` }}
          >
            {data.sentiment}
          </span>
          {data.directionBias && data.directionBias !== 'neutral' && (
            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-medium uppercase" style={{ color: 'var(--fintheon-muted)', backgroundColor: 'var(--fintheon-surface)' }}>
              {data.directionBias === 'bullish' ? 'Cyclical' : 'Counter-Cyclical'}
            </span>
          )}
          <span
            className="text-[7px] px-1.5 py-0.5 rounded-full font-medium uppercase"
            style={{ color: catColor, backgroundColor: `${catColor}15` }}
          >
            {data.category}
          </span>
        </div>

        {/* Instruments */}
        {data.narrativeIds && data.narrativeIds.length > 0 && (
          <div className="flex items-center gap-1">
            {data.narrativeIds.slice(0, 4).map(inst => (
              <span key={inst} className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ color: 'var(--fintheon-accent)', backgroundColor: 'var(--fintheon-accent)/8', fontFamily: 'var(--font-mono)' }}>
                {inst}
              </span>
            ))}
          </div>
        )}

        {/* Tags */}
        {data.tags && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5">
            {data.tags.slice(0, 5).map(t => (
              <span key={t} className="text-[6px] px-1 py-0.5 rounded" style={{ color: `${catColor}80`, backgroundColor: `${catColor}08`, fontFamily: 'var(--font-mono)' }}>
                #{t}
              </span>
            ))}
            {data.tags.length > 5 && (
              <span className="text-[6px] opacity-30" style={{ color: 'var(--fintheon-muted)' }}>+{data.tags.length - 5}</span>
            )}
          </div>
        )}

        {/* Date */}
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
  );
}

// ─── Node types registration ──────────────────────────────────
const nodeTypes: NodeTypes = {
  categoryGroup: CategoryGroupNode,
  eventCard: EventCardNode,
};

// ─── Layout helper: position nodes in grid within groups ──────
function layoutNodes(catalysts: CatalystCard[]): { nodes: Node[]; edges: Edge[] } {
  // Group by category
  const groups = new Map<NarrativeCategory, CatalystCard[]>();
  for (const c of catalysts) {
    const cat = (c.category ?? 'macroeconomic') as NarrativeCategory;
    const arr = groups.get(cat) ?? [];
    arr.push(c);
    groups.set(cat, arr);
  }

  const nodes: Node[] = [];
  const CARD_W = 260;
  const CARD_H = 180;
  const COLS = 6;
  const GROUP_PAD = 40;
  const GROUP_GAP = 80;

  let groupY = 0;

  // Sort categories for consistent layout
  const categoryOrder: NarrativeCategory[] = [
    'geopolitical', 'monetary', 'macroeconomic',
    'market-structure', 'earnings', 'supply-chain', 'black-swan',
  ];

  for (const cat of categoryOrder) {
    const cards = groups.get(cat);
    if (!cards || cards.length === 0) continue;

    // Sort cards by date
    const sorted = [...cards].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    const rows = Math.ceil(sorted.length / COLS);
    const groupW = COLS * CARD_W + GROUP_PAD * 2;
    const groupH = rows * CARD_H + GROUP_PAD * 2 + 30; // +30 for header

    // Group node
    const groupId = `group-${cat}`;
    nodes.push({
      id: groupId,
      type: 'categoryGroup',
      position: { x: 0, y: groupY },
      data: {
        label: cat.replace('-', ' '),
        category: cat,
        count: sorted.length,
      },
      style: { width: groupW, height: groupH },
      draggable: true,
    });

    // Child event nodes
    for (let i = 0; i < sorted.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      nodes.push({
        id: sorted[i].id,
        type: 'eventCard',
        position: {
          x: GROUP_PAD + col * CARD_W,
          y: GROUP_PAD + 30 + row * CARD_H,
        },
        parentId: groupId,
        extent: 'parent' as const,
        data: { ...sorted[i], isLocked: sorted[i].source !== 'user' },
        draggable: true,
      });
    }

    groupY += groupH + GROUP_GAP;
  }

  // Compute edges from rope connections
  const ropeConnections = computeRopeConnections(catalysts, 150);
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges: Edge[] = ropeConnections
    .filter(c => nodeIds.has(c.fromId) && nodeIds.has(c.toId))
    .map(c => ({
      id: c.id,
      source: c.fromId,
      target: c.toId,
      type: 'default',
      animated: c.strength > 0.5,
      style: {
        stroke: '#c79f4a',
        strokeWidth: 1 + c.strength * 1.5,
        opacity: 0.15 + c.strength * 0.3,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#c79f4a40' },
      label: c.sharedTags.slice(0, 2).join(' · '),
      labelStyle: { fontSize: 8, fill: '#c79f4a80', fontFamily: 'var(--font-mono)' },
      labelBgStyle: { fill: '#050402', fillOpacity: 0.8 },
    }));

  return { nodes, edges };
}

// ─── AI Input Box ─────────────────────────────────────────────
function AIInputBox({ onSubmit, loading }: { onSubmit: (text: string) => void; loading: boolean }) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
    setInput('');
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl border"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 90%, transparent)',
        borderColor: 'color-mix(in srgb, var(--fintheon-accent) 20%, transparent)',
        backdropFilter: 'blur(16px)',
        width: 400,
      }}
    >
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder="Describe an event or development..."
        className="flex-1 text-[11px] bg-transparent outline-none"
        style={{ color: 'var(--fintheon-text)', fontFamily: 'var(--font-body)' }}
        disabled={loading}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !input.trim()}
        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--fintheon-accent)]/10 disabled:opacity-30"
        style={{ color: 'var(--fintheon-accent)' }}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Inner canvas (needs ReactFlowProvider above) ─────────────
function NarrativeFlowCanvas({
  visibleLaneIds,
  activeTags,
  activeTool,
  onScaleChange,
  onSelectCard,
  onEditCard,
}: NarrativeForceCanvasProps) {
  const { state, dispatch } = useNarrative();
  const [aiLoading, setAiLoading] = useState(false);
  const reactFlow = useReactFlow();

  // Filter catalysts
  const filteredCatalysts = useMemo(() => {
    let cards = state.catalysts.filter(c => {
      const cat = c.category ?? c.narrativeIds?.[0];
      if (!cat) return true;
      return visibleLaneIds.size === 0 || visibleLaneIds.has(cat);
    });
    if (activeTags.size > 0) {
      cards = cards.filter(c => c.tags?.some(t => activeTags.has(t)) ?? false);
    }
    return cards;
  }, [state.catalysts, visibleLaneIds, activeTags]);

  // Layout nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => layoutNodes(filteredCatalysts),
    [filteredCatalysts]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when catalysts change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = layoutNodes(filteredCatalysts);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [filteredCatalysts, setNodes, setEdges]);

  // Handle node click
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'eventCard') {
      onSelectCard?.(node.id);
    }
  }, [onSelectCard]);

  // Handle node double-click (edit only user-created cards)
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'eventCard' && node.data?.source === 'user') {
      const card = state.catalysts.find(c => c.id === node.id);
      if (card) onEditCard?.(card);
    }
  }, [state.catalysts, onEditCard]);

  // AI input: score and generate new nodes
  const handleAIInput = useCallback(async (text: string) => {
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/narrative/score-riskflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: `user-${Date.now()}`,
            headline: text,
            summary: text,
            source: 'user',
            severity: 'medium',
            tags: [],
            publishedAt: new Date().toISOString(),
          }],
        }),
      });

      if (!res.ok) throw new Error(`Score failed: ${res.status}`);
      const { scored } = await res.json();

      if (scored && scored.length > 0) {
        for (const item of scored) {
          dispatch({
            type: 'ADD_CATALYST',
            catalyst: {
              title: item.suggestedTitle || text,
              description: item.suggestedDescription || text,
              date: new Date().toISOString().slice(0, 10),
              sentiment: item.sentiment ?? 'bearish',
              severity: item.severity ?? 'medium',
              source: 'agent',
              narrativeIds: item.tickers ?? [],
              isGhost: false,
              templateType: null,
              position: null,
              tags: item.themes ?? [],
              category: undefined,
              drillDepth: 0,
            },
          });
        }
      }
    } catch (err) {
      console.error('[NarrativeFlow] AI input scoring failed:', err);
      // Fallback: add as user event
      dispatch({
        type: 'ADD_CATALYST',
        catalyst: {
          title: text,
          description: '',
          date: new Date().toISOString().slice(0, 10),
          sentiment: 'bearish',
          severity: 'medium',
          source: 'user',
          narrativeIds: [],
          isGhost: false,
          templateType: null,
          position: null,
          tags: [],
          category: 'macroeconomic',
          drillDepth: 0,
        },
      });
    } finally {
      setAiLoading(false);
    }
  }, [dispatch]);

  return (
    <div className="w-full h-full" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        panOnDrag={activeTool === 'hand' || activeTool === 'select'}
        selectionOnDrag={activeTool === 'multi-select'}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--fintheon-bg)' }}
        onMove={(_, viewport) => onScaleChange?.(viewport.zoom)}
      >
        <Background color="#c79f4a10" gap={40} size={1} />
        <Controls
          position="top-right"
          showInteractive={false}
          style={{ backgroundColor: 'var(--fintheon-surface)', borderColor: '#c79f4a20', borderRadius: 8 }}
        />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            if (node.type === 'categoryGroup' && node.data && typeof node.data === 'object' && 'category' in node.data) {
              const cat = (node.data as { category: NarrativeCategory }).category;
              return CATEGORY_COLORS[cat] ?? '#6B7280';
            }
            return '#c79f4a40';
          }}
          style={{ backgroundColor: '#050402', borderColor: '#c79f4a20', borderRadius: 8 }}
          maskColor="#05040280"
        />

        {/* AI Input Panel — bottom center */}
        <Panel position="bottom-center" className="mb-16">
          <AIInputBox onSubmit={handleAIInput} loading={aiLoading} />
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ─── Exported wrapper with ReactFlowProvider ──────────────────
interface NarrativeForceCanvasProps {
  visibleLaneIds: Set<string>;
  activeTags: Set<string>;
  activeTool: CanvasTool;
  onScaleChange?: (scale: number) => void;
  onSelectCard?: (id: string) => void;
  onEditCard?: (card: CatalystCard) => void;
}

export default function NarrativeForceCanvas(props: NarrativeForceCanvasProps) {
  return (
    <ReactFlowProvider>
      <NarrativeFlowCanvas {...props} />
    </ReactFlowProvider>
  );
}
