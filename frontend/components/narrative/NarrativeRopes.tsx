// [claude-code 2026-03-28] S5-T5: SVG rope renderer — curved bezier paths between connected cards
import { useMemo, useState } from 'react';
import type { RopeConnection } from '../../lib/narrative-rope-engine';
import type { CanvasViewport } from '../../lib/narrative-types';

interface CardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NarrativeRopesProps {
  connections: RopeConnection[];
  cardPositions: Map<string, CardRect>;
  viewport: CanvasViewport;
  hoveredCardId: string | null;
}

/** Check if a rect is within the visible viewport (frustum culling) */
function isVisible(rect: CardRect, vp: CanvasViewport, containerW: number, containerH: number): boolean {
  const sx = rect.x * vp.scale + vp.x;
  const sy = rect.y * vp.scale + vp.y;
  const sw = rect.width * vp.scale;
  const sh = rect.height * vp.scale;
  const margin = 100; // render slightly outside viewport for smooth edges
  return (
    sx + sw > -margin &&
    sy + sh > -margin &&
    sx < containerW + margin &&
    sy < containerH + margin
  );
}

/** Build cubic bezier path from right edge of source to left edge of target */
function buildPath(from: CardRect, to: CardRect): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  const y2 = to.y + to.height / 2;

  const dx = Math.abs(x2 - x1);
  const cpOffset = Math.max(40, dx * 0.4);

  return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
}

const ROPE_GREEN = '#22C55E';

export default function NarrativeRopes({
  connections,
  cardPositions,
  viewport,
  hoveredCardId,
}: NarrativeRopesProps) {
  const [hoveredRopeId, setHoveredRopeId] = useState<string | null>(null);

  // Filter to only connections where both cards have known positions and are visible
  const visibleRopes = useMemo(() => {
    // Approximate container size (full viewport)
    const cw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const ch = typeof window !== 'undefined' ? window.innerHeight : 1080;

    return connections.filter(conn => {
      const from = cardPositions.get(conn.fromId);
      const to = cardPositions.get(conn.toId);
      if (!from || !to) return false;
      return isVisible(from, viewport, cw, ch) || isVisible(to, viewport, cw, ch);
    });
  }, [connections, cardPositions, viewport]);

  if (visibleRopes.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none', overflow: 'visible', zIndex: 1 }}
    >
      <g
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {visibleRopes.map(conn => {
          const from = cardPositions.get(conn.fromId)!;
          const to = cardPositions.get(conn.toId)!;
          const path = buildPath(from, to);

          const isCardHovered =
            hoveredCardId === conn.fromId || hoveredCardId === conn.toId;
          const isRopeHovered = hoveredRopeId === conn.id;

          // Strength maps to opacity: 0.2 = 10%, 1.0 = 40% default
          const baseOpacity = 0.1 + conn.strength * 0.3;
          const opacity = isCardHovered || isRopeHovered ? 0.8 : baseOpacity;
          const strokeWidth = isCardHovered || isRopeHovered ? 3 : 2;

          return (
            <g key={conn.id}>
              {/* Visible rope */}
              <path
                d={path}
                fill="none"
                stroke={ROPE_GREEN}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
                className="animate-rope-draw"
                style={{
                  willChange: 'opacity',
                  transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
                  strokeDasharray: 1000,
                  '--rope-length': '1000',
                } as React.CSSProperties}
              />
              {/* Invisible fat hit area for hover */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                style={{ pointerEvents: 'stroke', cursor: 'default' }}
                onMouseEnter={() => setHoveredRopeId(conn.id)}
                onMouseLeave={() => setHoveredRopeId(null)}
              />
              {/* Tag tooltip on rope hover */}
              {isRopeHovered && (() => {
                const mx = (from.x + from.width + to.x) / 2;
                const my = (from.y + from.height / 2 + to.y + to.height / 2) / 2 - 16;
                return (
                  <foreignObject x={mx - 60} y={my - 10} width={120} height={24}>
                    <div
                      style={{
                        fontSize: '8px',
                        fontFamily: 'monospace',
                        color: ROPE_GREEN,
                        backgroundColor: 'rgba(5,4,2,0.9)',
                        border: `1px solid ${ROPE_GREEN}33`,
                        borderRadius: '3px',
                        padding: '2px 6px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {conn.sharedTags.join(' · ')}
                    </div>
                  </foreignObject>
                );
              })()}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
