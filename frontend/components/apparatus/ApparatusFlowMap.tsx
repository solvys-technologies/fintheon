// [claude-code 2026-03-28] S7: React Flow agent constellation — Rules of Engagement nucleus,
// orbiting agents with expandable cards, shimmer data-flow edges, active glow borders
import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow, Background, MiniMap, Panel,
  useNodesState, useEdgesState,
  type Node, type Edge, type NodeTypes,
  ReactFlowProvider, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Shield, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { AgentNode, AgentConnection, AgentMemory } from './types';
import { COMMANDMENTS } from './commandments-data';

// ─── Data ─────────────────────────────────────────────────────
const AGENTS: AgentNode[] = [
  { id: 'harper', label: 'Harper', role: 'CAO — Chief Approval Officer', accentColor: '#c79f4a', memories: [
    { id: 'h1', fact: 'All Trade Ideas must flow through Harper for gatekeeper validation', source: 'boardroom', timestamp: '2026-03-20T09:00:00', confidence: 1.0, version: 3 },
    { id: 'h2', fact: 'Morning Daily Brief delivered pre-market — macro overview + key levels', source: 'data', timestamp: '2026-03-20T06:30:00', confidence: 0.95, version: 2 },
    { id: 'h3', fact: 'Cross-desk risk aggregation flagged elevated NQ exposure', source: 'trade', timestamp: '2026-03-20T10:15:00', confidence: 0.88, version: 1 },
  ]},
  { id: 'oracle', label: 'Oracle', role: 'All-Seer — Prediction & Macro', accentColor: '#a89060', memories: [
    { id: 'o1', fact: 'Kalshi S&P prediction: 72% probability SPX closes above 5800', source: 'trade', timestamp: '2026-03-20T08:45:00', confidence: 0.72, version: 4 },
    { id: 'o2', fact: 'FOMC dot plot shift — 2 rate cuts priced for 2026 vs 3 prior', source: 'twitter', timestamp: '2026-03-19T16:00:00', confidence: 0.82, version: 1 },
  ]},
  { id: 'feucht', label: 'Feucht', role: 'Risk Desk — Futures Execution', accentColor: '#d4af37', memories: [
    { id: 'f1', fact: '/NQ morning flush model triggered — watching 20450 for entry', source: 'trade', timestamp: '2026-03-20T09:32:00', confidence: 0.78, version: 2 },
    { id: 'f2', fact: 'VIX at 14.2 — low vol regime, reducing position sizes', source: 'mirofish', timestamp: '2026-03-20T09:00:00', confidence: 0.91, version: 1 },
  ]},
  { id: 'consul', label: 'Consul', role: 'Fundamentals — Earnings & Thesis', accentColor: '#8a7a50', memories: [
    { id: 'c1', fact: 'NVDA earnings beat +12% — raised guidance on AI data center demand', source: 'data', timestamp: '2026-03-19T20:00:00', confidence: 0.92, version: 3 },
    { id: 'c2', fact: 'Mega-cap tech P/E compression: avg forward P/E dropped from 32x to 28x', source: 'mirofish', timestamp: '2026-03-20T06:00:00', confidence: 0.85, version: 2 },
  ]},
  { id: 'herald', label: 'Herald', role: 'Sentiment — Social & Mood', accentColor: '#b8963a', memories: [
    { id: 'he1', fact: 'NQ bearish skew 62% — put/call ratio elevated at 1.4', source: 'twitter', timestamp: '2026-03-20T10:00:00', confidence: 0.74, version: 2 },
    { id: 'he2', fact: 'AAII survey: extreme bearish (48%) — contrarian bullish signal', source: 'data', timestamp: '2026-03-20T08:30:00', confidence: 0.81, version: 1 },
  ]},
];

const CONNECTIONS: AgentConnection[] = [
  { from: 'harper', to: 'oracle', type: 'context', label: 'Approvals', detail: 'Kalshi position approvals, prediction market oversight' },
  { from: 'harper', to: 'feucht', type: 'context', label: 'Risk Gate', detail: 'Trade idea validation, risk limit enforcement' },
  { from: 'harper', to: 'consul', type: 'context', label: 'Thesis Review', detail: 'Fundamental thesis review, earnings calendar' },
  { from: 'harper', to: 'herald', type: 'context', label: 'Sentiment Intel', detail: 'Sentiment alerts, daily brief inputs' },
  { from: 'oracle', to: 'consul', type: 'context', label: 'Macro Overlay', detail: 'Prediction markets informed by fundamental analysis' },
  { from: 'feucht', to: 'consul', type: 'context', label: 'Earnings Flow', detail: 'Earnings catalysts informing futures positioning' },
  { from: 'oracle', to: 'feucht', type: 'conflict', label: 'NQ Conflict', detail: 'Oracle bullish vs Feucht flagging VIX risk' },
];

// Simulated active agents (in production, read from backend)
const ACTIVE_AGENTS = new Set(['harper', 'oracle', 'feucht']);
const DATA_FLOWING_EDGES = new Set(['harper-oracle', 'harper-feucht', 'oracle-feucht']);

// ─── Nucleus Node (Rules of Engagement) ───────────────────────
function NucleusNode({ data }: { data: { commandmentCount: number } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-full flex flex-col items-center justify-center text-center cursor-pointer transition-all"
      style={{
        width: expanded ? 320 : 160,
        height: expanded ? 320 : 160,
        background: 'radial-gradient(circle, #c79f4a15 0%, #05040200 70%)',
        border: '2px solid #c79f4a40',
        boxShadow: '0 0 40px #c79f4a15, 0 0 80px #c79f4a08',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Shield className="w-6 h-6 mb-1" style={{ color: '#c79f4a' }} />
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#c79f4a', fontFamily: 'var(--font-heading)' }}>
        Rules of
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#c79f4a', fontFamily: 'var(--font-heading)' }}>
        Engagement
      </span>
      <span className="text-[8px] mt-1 opacity-40" style={{ color: '#c79f4a', fontFamily: 'var(--font-mono)' }}>
        {data.commandmentCount} commandments
      </span>
      {expanded && (
        <div className="mt-2 max-h-[180px] overflow-y-auto px-3 text-left">
          {COMMANDMENTS.slice(0, 5).map(c => (
            <p key={c.number} className="text-[7px] mb-1" style={{ color: '#f0ead6', fontFamily: 'var(--font-body)' }}>
              <span style={{ color: c.blockLevel === 'hard' ? '#EF4444' : '#c79f4a' }}>
                C{c.number}:
              </span>{' '}
              {c.text}
            </p>
          ))}
          <p className="text-[7px] opacity-30" style={{ color: '#c79f4a' }}>+{COMMANDMENTS.length - 5} more</p>
        </div>
      )}
    </div>
  );
}

// ─── Agent Card Node ──────────────────────────────────────────
function AgentCardNode({ data }: { data: AgentNode & { isActive: boolean } }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = data.isActive;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        width: expanded ? 300 : 200,
        backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 95%, transparent)',
        border: `2px solid ${isActive ? data.accentColor : data.accentColor + '30'}`,
        boxShadow: isActive
          ? `0 0 20px ${data.accentColor}30, 0 0 40px ${data.accentColor}15`
          : `0 2px 8px rgba(0,0,0,0.3)`,
        animation: isActive ? 'agentGlow 2s ease-in-out infinite alternate' : undefined,
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ borderBottom: `1px solid ${data.accentColor}20` }}
      >
        <div className="flex items-center gap-2">
          {/* Active indicator dot */}
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: isActive ? data.accentColor : '#6B728060',
              boxShadow: isActive ? `0 0 6px ${data.accentColor}` : undefined,
            }}
          />
          <div>
            <p className="text-[11px] font-bold" style={{ color: data.accentColor, fontFamily: 'var(--font-heading)' }}>
              {data.label}
            </p>
            <p className="text-[7px] opacity-50" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>
              {data.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[7px] opacity-30" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-mono)' }}>
            {data.memories.length}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3 opacity-30" /> : <ChevronDown className="w-3 h-3 opacity-30" />}
        </div>
      </div>

      {/* Expanded memories */}
      {expanded && (
        <div className="max-h-[250px] overflow-y-auto px-3 py-2 space-y-2">
          {data.memories.map(mem => (
            <div key={mem.id} className="rounded-lg px-2.5 py-2 border" style={{ borderColor: `${data.accentColor}15`, backgroundColor: `${data.accentColor}05` }}>
              <p className="text-[9px] leading-relaxed" style={{ color: 'var(--fintheon-text)', fontFamily: 'var(--font-body)' }}>
                {mem.fact}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[7px] uppercase" style={{ color: `${data.accentColor}60`, fontFamily: 'var(--font-mono)' }}>
                  {mem.source} · v{mem.version}
                </span>
                {/* Confidence bar */}
                <div className="flex items-center gap-1">
                  <div className="w-12 h-[2px] rounded-full" style={{ backgroundColor: `${data.accentColor}15` }}>
                    <div className="h-full rounded-full" style={{ width: `${mem.confidence * 100}%`, backgroundColor: data.accentColor }} />
                  </div>
                  <span className="text-[6px]" style={{ color: `${data.accentColor}60`, fontFamily: 'var(--font-mono)' }}>
                    {Math.round(mem.confidence * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  nucleus: NucleusNode,
  agentCard: AgentCardNode,
};

// ─── Layout: nucleus center, agents in orbit ──────────────────
function buildLayout(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];

  // Nucleus at center
  nodes.push({
    id: 'nucleus',
    type: 'nucleus',
    position: { x: -80, y: -80 },
    data: { commandmentCount: COMMANDMENTS.length },
    draggable: true,
  });

  // Agents in orbital positions
  const radius = 350;
  const angleStep = (2 * Math.PI) / AGENTS.length;
  const startAngle = -Math.PI / 2; // Start from top

  for (let i = 0; i < AGENTS.length; i++) {
    const angle = startAngle + i * angleStep;
    const x = Math.cos(angle) * radius - 100;
    const y = Math.sin(angle) * radius - 60;

    nodes.push({
      id: AGENTS[i].id,
      type: 'agentCard',
      position: { x, y },
      data: { ...AGENTS[i], isActive: ACTIVE_AGENTS.has(AGENTS[i].id) },
      draggable: true,
    });
  }

  // Edges from connections
  const edges: Edge[] = CONNECTIONS.map(conn => {
    const edgeId = `${conn.from}-${conn.to}`;
    const isFlowing = DATA_FLOWING_EDGES.has(edgeId);
    const isConflict = conn.type === 'conflict';

    return {
      id: edgeId,
      source: conn.from,
      target: conn.to,
      type: 'default',
      animated: isFlowing, // shimmer effect for active data flow
      style: {
        stroke: isConflict ? '#EF4444' : '#c79f4a',
        strokeWidth: isFlowing ? 2.5 : 1.5,
        opacity: isFlowing ? 0.6 : 0.2,
        strokeDasharray: isConflict ? '5 3' : undefined,
      },
      label: conn.label,
      labelStyle: {
        fontSize: 8,
        fill: isConflict ? '#EF444480' : '#c79f4a60',
        fontFamily: 'var(--font-body)',
      },
      labelBgStyle: { fill: '#050402', fillOpacity: 0.85 },
      markerEnd: { type: MarkerType.ArrowClosed, color: isConflict ? '#EF444440' : '#c79f4a30' },
    };
  });

  // Add nucleus → agent edges (governance lines)
  for (const agent of AGENTS) {
    edges.push({
      id: `nucleus-${agent.id}`,
      source: 'nucleus',
      target: agent.id,
      type: 'default',
      style: { stroke: '#c79f4a', strokeWidth: 0.5, opacity: 0.1, strokeDasharray: '2 4' },
    });
  }

  return { nodes, edges };
}

// ─── Inner component ──────────────────────────────────────────
function ApparatusFlowInner() {
  const { nodes: initNodes, edges: initEdges } = useMemo(() => buildLayout(), []);
  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  return (
    <div className="w-full h-full" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      {/* CSS for glow animation */}
      <style>{`
        @keyframes agentGlow {
          0% { box-shadow: 0 0 15px var(--glow-color, #c79f4a30), 0 0 30px var(--glow-color, #c79f4a15); }
          100% { box-shadow: 0 0 25px var(--glow-color, #c79f4a50), 0 0 50px var(--glow-color, #c79f4a25); }
        }
      `}</style>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: 'var(--fintheon-bg)' }}
      >
        <Background color="#c79f4a08" gap={50} size={1} />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            if (node.id === 'nucleus') return '#c79f4a';
            const agent = AGENTS.find(a => a.id === node.id);
            return agent?.accentColor ?? '#6B7280';
          }}
          style={{ backgroundColor: '#050402', borderColor: '#c79f4a20', borderRadius: 8 }}
          maskColor="#05040280"
        />

        {/* Legend */}
        <Panel position="top-left">
          <div className="px-3 py-2 rounded-lg border" style={{ backgroundColor: 'color-mix(in srgb, var(--fintheon-surface) 90%, transparent)', borderColor: '#c79f4a15', backdropFilter: 'blur(12px)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#c79f4a', fontFamily: 'var(--font-heading)' }}>
              Agent Constellation
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-[2px] rounded" style={{ backgroundColor: '#c79f4a' }} />
                <span className="text-[7px]" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>Context flow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-[2px] rounded" style={{ backgroundColor: '#EF4444', borderTop: '1px dashed' }} />
                <span className="text-[7px]" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>Conflict / disagreement</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#c79f4a', boxShadow: '0 0 4px #c79f4a' }} />
                <span className="text-[7px]" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>Active agent</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3" style={{ color: '#c79f4a60' }} />
                <span className="text-[7px]" style={{ color: 'var(--fintheon-muted)', fontFamily: 'var(--font-body)' }}>Shimmer = data flowing</span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────
export function ApparatusFlowMap() {
  return (
    <ReactFlowProvider>
      <ApparatusFlowInner />
    </ReactFlowProvider>
  );
}
