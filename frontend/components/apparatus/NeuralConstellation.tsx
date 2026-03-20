// [claude-code 2026-03-20] Neural Constellation — SVG canvas with agent nodes, connections, pan/zoom
import { useState, useRef, useCallback, useEffect } from 'react';
import type { AgentNode, AgentConnection, AgentMemory } from './types';
import { MemoryCard } from './MemoryCard';

interface NeuralConstellationProps {
  agents: AgentNode[];
  connections: AgentConnection[];
}

const CANVAS_W = 900;
const CANVAS_H = 620;
const NODE_RADIUS = 32;
const GLOW_RADIUS = 48;

export function NeuralConstellation({ agents, connections }: NeuralConstellationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('[data-agent-node]')) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.4, Math.min(3, prev * delta)));
  }, []);

  // Convert normalized coords to canvas coords
  const toCanvas = (nx: number, ny: number) => ({
    cx: nx * CANVAS_W,
    cy: ny * CANVAS_H,
  });

  // Click outside to close expanded
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedAgent(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const getConnectionKey = (c: AgentConnection) => `${c.from}-${c.to}`;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050402] rounded-lg border border-[#c79f4a]/10">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        className="w-full h-full select-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          {/* Glow filter for agent nodes */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feFlood floodColor="#c79f4a" floodOpacity="0.4" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Red glow for conflict */}
          <filter id="conflict-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="#ef4444" floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Pulse animation */}
          <radialGradient id="pulse-grad">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background grid dots */}
          {Array.from({ length: 20 }, (_, i) =>
            Array.from({ length: 14 }, (_, j) => (
              <circle
                key={`grid-${i}-${j}`}
                cx={i * 48 + 24}
                cy={j * 48 + 24}
                r={0.8}
                fill="rgba(199,159,74,0.06)"
              />
            ))
          )}

          {/* Connection lines */}
          {connections.map(conn => {
            const fromAgent = agents.find(a => a.id === conn.from);
            const toAgent = agents.find(a => a.id === conn.to);
            if (!fromAgent || !toAgent) return null;
            const from = toCanvas(fromAgent.x, fromAgent.y);
            const to = toCanvas(toAgent.x, toAgent.y);
            const key = getConnectionKey(conn);
            const isConflict = conn.type === 'conflict';
            const isHovered = hoveredConnection === key;

            return (
              <g key={key}>
                {/* Wider invisible hit area */}
                <line
                  x1={from.cx} y1={from.cy}
                  x2={to.cx} y2={to.cy}
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setHoveredConnection(key);
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltipPos({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredConnection(null)}
                />
                {/* Visible line */}
                <line
                  x1={from.cx} y1={from.cy}
                  x2={to.cx} y2={to.cy}
                  stroke={isConflict ? '#ef4444' : '#c79f4a'}
                  strokeWidth={isHovered ? 2.5 : 1.2}
                  strokeOpacity={isHovered ? 0.9 : isConflict ? 0.5 : 0.25}
                  strokeDasharray={isConflict ? '6 4' : undefined}
                  filter={isConflict ? 'url(#conflict-glow)' : undefined}
                >
                  {/* Pulse animation on connection */}
                  <animate
                    attributeName="stroke-opacity"
                    values={isConflict ? '0.3;0.7;0.3' : '0.15;0.35;0.15'}
                    dur={isConflict ? '1.5s' : '3s'}
                    repeatCount="indefinite"
                  />
                </line>
              </g>
            );
          })}

          {/* Agent nodes */}
          {agents.map(agent => {
            const { cx, cy } = toCanvas(agent.x, agent.y);
            const Icon = agent.icon;
            const isExpanded = expandedAgent === agent.id;
            const hasConflict = connections.some(
              c => c.type === 'conflict' && (c.from === agent.id || c.to === agent.id)
            );

            return (
              <g key={agent.id} data-agent-node>
                {/* Outer pulse ring */}
                <circle cx={cx} cy={cy} r={GLOW_RADIUS} fill="url(#pulse-grad)">
                  <animate
                    attributeName="r"
                    values={`${GLOW_RADIUS};${GLOW_RADIUS + 8};${GLOW_RADIUS}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0.2;0.6"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Conflict indicator ring */}
                {hasConflict && (
                  <circle
                    cx={cx} cy={cy} r={NODE_RADIUS + 6}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    filter="url(#conflict-glow)"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values="0.3;0.8;0.3"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Main node circle */}
                <circle
                  cx={cx} cy={cy} r={NODE_RADIUS}
                  fill="#0a0a00"
                  stroke={isExpanded ? '#D4AF37' : '#c79f4a'}
                  strokeWidth={isExpanded ? 2.5 : 1.5}
                  filter="url(#node-glow)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setExpandedAgent(prev => prev === agent.id ? null : agent.id)}
                />

                {/* Agent icon (foreignObject for Lucide) */}
                <foreignObject
                  x={cx - 10} y={cy - 16}
                  width={20} height={20}
                  style={{ pointerEvents: 'none' }}
                >
                  <div className="flex items-center justify-center w-full h-full">
                    <Icon size={16} color={agent.accentColor} />
                  </div>
                </foreignObject>

                {/* Agent label */}
                <text
                  x={cx} y={cy + 14}
                  textAnchor="middle"
                  fill="#f0ead6"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="ui-monospace, monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {agent.label}
                </text>

                {/* Role subtitle */}
                <text
                  x={cx} y={cy + 24}
                  textAnchor="middle"
                  fill="rgba(240,234,214,0.35)"
                  fontSize={7}
                  fontFamily="ui-monospace, monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {agent.role}
                </text>

                {/* Expanded memory cards — radial layout */}
                {isExpanded && agent.memories.length > 0 && (
                  <g>
                    {agent.memories.map((mem, i) => {
                      const angle = (i / agent.memories.length) * Math.PI * 2 - Math.PI / 2;
                      const orbitR = 100 + (agent.memories.length > 4 ? 20 : 0);
                      const mx = cx + Math.cos(angle) * orbitR;
                      const my = cy + Math.sin(angle) * orbitR;

                      return (
                        <g key={mem.id}>
                          {/* Connection line from node to memory card */}
                          <line
                            x1={cx} y1={cy}
                            x2={mx} y2={my}
                            stroke="#c79f4a"
                            strokeWidth={0.5}
                            strokeOpacity={0.2}
                            strokeDasharray="2 2"
                          />
                          {/* Memory card via foreignObject */}
                          <foreignObject
                            x={mx - 80} y={my - 32}
                            width={160} height={64}
                          >
                            <MemoryCard memory={mem} />
                          </foreignObject>
                        </g>
                      );
                    })}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Connection tooltip (HTML overlay) */}
      {hoveredConnection && (() => {
        const conn = connections.find(c => getConnectionKey(c) === hoveredConnection);
        if (!conn) return null;
        return (
          <div
            className="absolute pointer-events-none z-50 px-3 py-2 rounded-md border max-w-[220px]"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 8,
              backgroundColor: 'rgba(10,10,0,0.95)',
              borderColor: conn.type === 'conflict' ? 'rgba(239,68,68,0.4)' : 'rgba(199,159,74,0.3)',
            }}
          >
            <div className={`text-[10px] font-semibold mb-0.5 ${conn.type === 'conflict' ? 'text-red-400' : 'text-[#c79f4a]'}`}>
              {conn.label}
            </div>
            <div className="text-[9px] text-[#f0ead6]/60">
              {conn.detail}
            </div>
          </div>
        );
      })()}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
          className="w-7 h-7 rounded border border-[#c79f4a]/20 bg-[#0a0a00]/90 text-[#c79f4a] text-xs flex items-center justify-center hover:bg-[#c79f4a]/10 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.4, prev * 0.8))}
          className="w-7 h-7 rounded border border-[#c79f4a]/20 bg-[#0a0a00]/90 text-[#c79f4a] text-xs flex items-center justify-center hover:bg-[#c79f4a]/10 transition-colors"
        >
          -
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="w-7 h-7 rounded border border-[#c79f4a]/20 bg-[#0a0a00]/90 text-[#c79f4a] text-[8px] flex items-center justify-center hover:bg-[#c79f4a]/10 transition-colors"
          title="Reset view"
        >
          1:1
        </button>
      </div>
    </div>
  );
}
