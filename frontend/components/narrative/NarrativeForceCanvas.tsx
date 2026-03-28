// [claude-code 2026-03-28] S7: D3 force-directed mind map canvas for NarrativeFlow
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';
import { drag as d3Drag } from 'd3-drag';
import { useNarrative } from '../../contexts/NarrativeContext';
import { computeRopeConnections } from '../../lib/narrative-rope-engine';
import {
  CATEGORY_CENTERS, CATEGORY_COLORS, severityRadius,
  FORCE_CONFIG, ZOOM_THRESHOLDS, dateToX,
} from '../../lib/narrative-force-layout';
import type { CatalystCard, NarrativeCategory } from '../../lib/narrative-types';
import type { CanvasTool } from './NarrativeFloatingToolbar';

interface ForceNode extends CatalystCard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  radius: number;
}

interface ForceLink {
  source: string;
  target: string;
  sharedTags: string[];
  strength: number;
}

interface NarrativeForceCanvasProps {
  visibleLaneIds: Set<string>;
  activeTags: Set<string>;
  activeTool: CanvasTool;
  onScaleChange?: (scale: number) => void;
  onSelectCard?: (id: string) => void;
  onEditCard?: (card: CatalystCard) => void;
}

const SEVERITY_BORDER: Record<string, string> = {
  high: '#EF4444',
  medium: '#c79f4a',
  low: '#6B7280',
};

export default function NarrativeForceCanvas({
  visibleLaneIds,
  activeTags,
  activeTool,
  onScaleChange,
  onSelectCard,
  onEditCard,
}: NarrativeForceCanvasProps) {
  const { state } = useNarrative();
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const [currentScale, setCurrentScale] = useState(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Filter catalysts by visible lanes and active tags
  const filteredCatalysts = useMemo(() => {
    let cards = state.catalysts.filter(c => {
      const cat = c.category ?? c.narrativeIds?.[0];
      if (!cat) return true;
      return visibleLaneIds.has(cat);
    });
    if (activeTags.size > 0) {
      cards = cards.filter(c =>
        c.tags?.some(t => activeTags.has(t)) ?? false
      );
    }
    return cards;
  }, [state.catalysts, visibleLaneIds, activeTags]);

  // Compute rope connections
  const ropeConnections = useMemo(
    () => computeRopeConnections(filteredCatalysts, 100),
    [filteredCatalysts]
  );

  // Anchor date for temporal positioning
  const anchorDate = useMemo(() => new Date(), []);

  // Measure container
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Initialize D3 zoom
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event) => {
        select(g).attr('transform', event.transform.toString());
        setCurrentScale(event.transform.k);
        onScaleChange?.(event.transform.k);
      });

    select(svg).call(zoomBehavior);

    // Center view
    const initialTransform = zoomIdentity
      .translate(dimensions.width / 2, dimensions.height / 2)
      .scale(0.8);
    select(svg).call(zoomBehavior.transform, initialTransform);

    return () => {
      select(svg).on('.zoom', null);
    };
  }, [dimensions.width, dimensions.height, onScaleChange]);

  // Run force simulation
  useEffect(() => {
    if (filteredCatalysts.length === 0) return;

    const nodes: ForceNode[] = filteredCatalysts.map(c => {
      const cat = (c.category ?? 'macroeconomic') as NarrativeCategory;
      const center = CATEGORY_CENTERS[cat] ?? { x: 0, y: 0 };
      return {
        ...c,
        x: center.x + (Math.random() - 0.5) * 200 + dateToX(c.date, anchorDate),
        y: center.y + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        radius: severityRadius(c.severity),
      };
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    const links: { source: string; target: string; strength: number; sharedTags: string[] }[] =
      ropeConnections.map(c => ({
        source: c.fromId,
        target: c.toId,
        strength: c.strength,
        sharedTags: c.sharedTags,
      })).filter(l => nodeMap.has(l.source) && nodeMap.has(l.target));

    const sim = forceSimulation(nodes as any)
      .force('charge', forceManyBody().strength(FORCE_CONFIG.charge))
      .force('link', forceLink(links as any)
        .id((d: any) => d.id)
        .distance(FORCE_CONFIG.linkDistance)
        .strength(FORCE_CONFIG.linkStrength)
      )
      .force('collide', forceCollide<ForceNode>()
        .radius(d => d.radius + FORCE_CONFIG.collisionPadding)
      )
      .force('clusterX', forceX<ForceNode>()
        .x(d => {
          const cat = (d.category ?? 'macroeconomic') as NarrativeCategory;
          return (CATEGORY_CENTERS[cat]?.x ?? 0) + dateToX(d.date, anchorDate) * FORCE_CONFIG.temporalStrength * 100;
        })
        .strength(FORCE_CONFIG.clusterStrength)
      )
      .force('clusterY', forceY<ForceNode>()
        .y(d => {
          const cat = (d.category ?? 'macroeconomic') as NarrativeCategory;
          return CATEGORY_CENTERS[cat]?.y ?? 0;
        })
        .strength(FORCE_CONFIG.clusterStrength)
      )
      .alphaDecay(FORCE_CONFIG.alphaDecay)
      .velocityDecay(FORCE_CONFIG.velocityDecay);

    simRef.current = sim;

    // Render on tick
    const g = gRef.current;
    if (!g) return;
    const gSel = select(g);

    // Links
    const linkSel = gSel.selectAll<SVGPathElement, typeof links[number]>('.rope-link')
      .data(links, (d: any) => `${d.source}-${d.target}`)
      .join('path')
      .attr('class', 'rope-link')
      .attr('fill', 'none')
      .attr('stroke', '#c79f4a')
      .attr('stroke-width', 1.5)
      .attr('opacity', (d: any) => 0.1 + d.strength * 0.25);

    // Nodes
    const nodeSel = gSel.selectAll<SVGGElement, ForceNode>('.force-node')
      .data(nodes, (d: any) => d.id)
      .join('g')
      .attr('class', 'force-node')
      .style('cursor', 'pointer');

    // Node circles
    nodeSel.selectAll('circle').data(d => [d]).join('circle')
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => {
        const cat = (d.category ?? 'macroeconomic') as NarrativeCategory;
        return CATEGORY_COLORS[cat] ?? '#6B7280';
      })
      .attr('fill-opacity', 0.15)
      .attr('stroke', (d: any) => SEVERITY_BORDER[d.severity] ?? '#6B7280')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Node labels (visible at higher zoom)
    nodeSel.selectAll('text').data(d => [d]).join('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => d.radius + 12)
      .attr('fill', 'var(--fintheon-text)')
      .attr('fill-opacity', 0.6)
      .attr('font-size', '9px')
      .attr('font-family', 'var(--font-body)')
      .text((d: any) => d.title.length > 30 ? d.title.slice(0, 28) + '...' : d.title);

    // Severity dot in center
    nodeSel.selectAll('.severity-dot').data(d => [d]).join('circle')
      .attr('class', 'severity-dot')
      .attr('r', 3)
      .attr('fill', (d: any) => d.sentiment === 'bullish' ? 'var(--fintheon-bullish)' : d.sentiment === 'bearish' ? 'var(--fintheon-bearish)' : 'var(--fintheon-muted)');

    // Click handler
    nodeSel.on('click', (_event: any, d: ForceNode) => {
      setSelectedNodeId(d.id);
      onSelectCard?.(d.id);
    });

    // Double-click to edit
    nodeSel.on('dblclick', (_event: any, d: ForceNode) => {
      onEditCard?.(d);
    });

    // Hover
    nodeSel.on('mouseenter', (_event: any, d: ForceNode) => {
      setHoveredNodeId(d.id);
    });
    nodeSel.on('mouseleave', () => {
      setHoveredNodeId(null);
    });

    // Drag behavior
    const dragBehavior = d3Drag<SVGGElement, ForceNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSel.call(dragBehavior as any);

    // Tick update
    sim.on('tick', () => {
      linkSel.attr('d', (d: any) => {
        const sx = d.source.x ?? 0;
        const sy = d.source.y ?? 0;
        const tx = d.target.x ?? 0;
        const ty = d.target.y ?? 0;
        const dx = tx - sx;
        const cp = Math.max(40, Math.abs(dx) * 0.3);
        return `M${sx},${sy} C${sx + cp},${sy} ${tx - cp},${ty} ${tx},${ty}`;
      });

      nodeSel.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [filteredCatalysts, ropeConnections, anchorDate, onSelectCard, onEditCard]);

  // Render mode based on zoom level
  const renderMode = currentScale >= ZOOM_THRESHOLDS.fullCard ? 'full'
    : currentScale >= ZOOM_THRESHOLDS.miniCard ? 'mini'
    : currentScale >= ZOOM_THRESHOLDS.bubble ? 'bubble'
    : 'dot';

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--fintheon-bg)' }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: activeTool === 'hand' ? 'grab' : 'default' }}
      >
        <g ref={gRef}>
          {/* Category region labels (background) */}
          {Object.entries(CATEGORY_CENTERS).map(([cat, pos]) => (
            <text
              key={cat}
              x={pos.x}
              y={pos.y - 80}
              textAnchor="middle"
              fill={CATEGORY_COLORS[cat as NarrativeCategory] ?? '#6B7280'}
              fillOpacity={0.15}
              fontSize="14px"
              fontWeight="bold"
              fontFamily="var(--font-heading)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
            >
              {cat.replace('-', ' ')}
            </text>
          ))}
        </g>
      </svg>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-md bg-[var(--fintheon-surface)]/80 backdrop-blur-sm border border-[var(--fintheon-border)]/20">
        <span className="text-[10px] font-mono text-[var(--fintheon-muted)]/50">
          {Math.round(currentScale * 100)}% · {renderMode}
        </span>
      </div>

      {/* Hovered node tooltip */}
      {hoveredNodeId && (() => {
        const card = filteredCatalysts.find(c => c.id === hoveredNodeId);
        if (!card) return null;
        return (
          <div className="absolute top-4 left-4 max-w-xs p-3 rounded-lg bg-[var(--fintheon-surface)]/95 backdrop-blur-xl border border-[var(--fintheon-border)]/20 shadow-lg pointer-events-none">
            <p className="text-[11px] font-semibold text-[var(--fintheon-text)]">{card.title}</p>
            {card.description && (
              <p className="text-[9px] text-[var(--fintheon-muted)] mt-1 line-clamp-2">{card.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium uppercase"
                style={{
                  color: CATEGORY_COLORS[(card.category ?? 'macroeconomic') as NarrativeCategory],
                  backgroundColor: `${CATEGORY_COLORS[(card.category ?? 'macroeconomic') as NarrativeCategory]}20`,
                }}>
                {card.category}
              </span>
              <span className={`text-[8px] font-bold ${card.sentiment === 'bullish' ? 'text-green-400' : 'text-red-400'}`}>
                {card.sentiment === 'bullish' ? '▲' : '▼'} {card.severity}
              </span>
              <span className="text-[8px] text-[var(--fintheon-muted)]">{card.date}</span>
            </div>
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {card.tags.slice(0, 5).map(t => (
                  <span key={t} className="text-[7px] px-1 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]/60">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
