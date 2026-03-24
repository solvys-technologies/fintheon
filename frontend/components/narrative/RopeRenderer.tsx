// [claude-code 2026-03-06] SVG overlay layer rendering rope connections in week/month view
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Rope, CatalystCard, NarrativeLane, CatalystSentiment, ConfluenceNode as ConfluenceNodeType, NarrativeConflict } from '../../lib/narrative-types';
import { computeCatenary, getCardAnchor, getLaneAnchor, type Point } from '../../lib/narrative-catenary';
import { ConfluenceNodeSVG } from './ConfluenceNode';
import { ConflictBadge } from './ConflictBadge';

interface RopeRendererProps {
  ropes: Rope[];
  catalysts: CatalystCard[];
  lanes: NarrativeLane[];
  confluenceNodes?: ConfluenceNodeType[];
  conflicts?: NarrativeConflict[];
  cardRefs: Record<string, HTMLDivElement | null>;
  laneRefs: Record<string, HTMLDivElement | null>;
  containerRef: HTMLDivElement | null;
  filterSentiment: CatalystSentiment | 'all';
  replayMode: boolean;
  replayPosition: number;
  onSelectConflict?: (id: string) => void;
  onSelectConfluence?: (id: string) => void;
}

interface ComputedRope {
  rope: Rope;
  path: ReturnType<typeof computeCatenary>;
  filtered: boolean;
  isNew: boolean;
}

export function RopeRenderer({
  ropes,
  catalysts,
  lanes,
  confluenceNodes = [],
  conflicts = [],
  cardRefs,
  laneRefs,
  containerRef,
  filterSentiment,
  replayMode,
  replayPosition,
  onSelectConflict,
  onSelectConfluence,
}: RopeRendererProps) {
  const [hoveredRopeId, setHoveredRopeId] = useState<string | null>(null);
  const [newRopeIds, setNewRopeIds] = useState<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);
  const prevRopeIdsRef = useRef<Set<string>>(new Set());

  // Track newly added ropes for swing animation
  useEffect(() => {
    const currentIds = new Set(ropes.map(r => r.id));
    const added = new Set<string>();
    for (const id of currentIds) {
      if (!prevRopeIdsRef.current.has(id)) added.add(id);
    }
    if (added.size > 0) {
      setNewRopeIds(added);
      const timer = setTimeout(() => setNewRopeIds(new Set()), 600);
      return () => clearTimeout(timer);
    }
    prevRopeIdsRef.current = currentIds;
  }, [ropes]);

  // ResizeObserver to re-render when container resizes
  useEffect(() => {
    if (!containerRef) return;
    const observer = new ResizeObserver(() => forceUpdate(n => n + 1));
    observer.observe(containerRef);
    return () => observer.disconnect();
  }, [containerRef]);

  const getAnchorForEndpoint = useCallback(
    (id: string, type: 'catalyst' | 'lane', targetCenter: Point): Point | null => {
      if (type === 'catalyst') {
        const el = cardRefs[id];
        if (!el) return null;
        return getCardAnchor(el.getBoundingClientRect(), targetCenter);
      }
      const el = laneRefs[id];
      if (!el) return null;
      return getLaneAnchor(el.getBoundingClientRect(), targetCenter);
    },
    [cardRefs, laneRefs],
  );

  const getElementCenter = useCallback(
    (id: string, type: 'catalyst' | 'lane'): Point | null => {
      const el = type === 'catalyst' ? cardRefs[id] : laneRefs[id];
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    [cardRefs, laneRefs],
  );

  // Check if a rope matches the current sentiment filter
  const isRopeFiltered = useCallback(
    (rope: Rope): boolean => {
      if (filterSentiment === 'all') return false;
      // A rope is filtered out if neither connected catalyst matches the sentiment
      const fromCatalyst = catalysts.find(c => c.id === rope.fromId);
      const toCatalyst = catalysts.find(c => c.id === rope.toId);
      const matchesFrom = fromCatalyst?.sentiment === filterSentiment;
      const matchesTo = toCatalyst?.sentiment === filterSentiment;
      return !matchesFrom && !matchesTo;
    },
    [filterSentiment, catalysts],
  );

  // Compute rope rendering data with container-relative coords
  const computedRopes = useMemo((): ComputedRope[] => {
    if (!containerRef) return [];
    const containerRect = containerRef.getBoundingClientRect();

    return ropes
      .map((rope): ComputedRope | null => {
        // Get target centers first for anchor computation
        const toCenter = getElementCenter(rope.toId, rope.toType);
        const fromCenter = getElementCenter(rope.fromId, rope.fromType);
        if (!toCenter || !fromCenter) return null;

        const fromAnchor = getAnchorForEndpoint(rope.fromId, rope.fromType, toCenter);
        const toAnchor = getAnchorForEndpoint(rope.toId, rope.toType, fromCenter);
        if (!fromAnchor || !toAnchor) return null;

        // Convert to container-relative coordinates
        const from: Point = {
          x: fromAnchor.x - containerRect.left,
          y: fromAnchor.y - containerRect.top,
        };
        const to: Point = {
          x: toAnchor.x - containerRect.left,
          y: toAnchor.y - containerRect.top,
        };

        const path = computeCatenary(from, to);
        return {
          rope,
          path,
          filtered: isRopeFiltered(rope),
          isNew: newRopeIds.has(rope.id),
        };
      })
      .filter((r): r is ComputedRope => r !== null);
  }, [ropes, containerRef, getAnchorForEndpoint, getElementCenter, isRopeFiltered, newRopeIds]);

  // Conflict badge positions (container-relative)
  const conflictPositions = useMemo(() => {
    if (!containerRef) return [];
    const containerRect = containerRef.getBoundingClientRect();

    return conflicts.map(conflict => {
      const ropeData = computedRopes.find(cr => cr.rope.id === conflict.ropeId);
      const position = ropeData
        ? ropeData.path.midpoint
        : { x: containerRect.width / 2, y: containerRect.height / 2 };
      return { conflict, position };
    });
  }, [conflicts, computedRopes, containerRef]);

  // Confluence node positions
  const confluencePositions = useMemo(() => {
    if (!containerRef) return [];
    const containerRect = containerRef.getBoundingClientRect();

    return confluenceNodes.map(node => {
      const position: Point = {
        x: node.position.x - containerRect.left,
        y: node.position.y - containerRect.top,
      };
      return { node, position };
    });
  }, [confluenceNodes, containerRef]);

  const getRopeColor = (rope: Rope): string => {
    if (rope.polarity === 'contradicting') return 'var(--fintheon-bearish)';
    // Reinforcing — check target sentiment
    const toCatalyst = catalysts.find(c => c.id === rope.toId);
    if (toCatalyst?.sentiment === 'bullish') return 'var(--fintheon-bullish)';
    if (toCatalyst?.sentiment === 'bearish') return 'var(--fintheon-bearish)';
    return 'var(--fintheon-accent)';
  };

  return (
    <>
      {/* SVG rope layer */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 10,
          width: '100%',
          height: '100%',
          overflow: 'visible',
        }}
      >
        {computedRopes.map(({ rope, path, filtered, isNew }) => {
          const isHovered = hoveredRopeId === rope.id;
          const color = getRopeColor(rope);
          const opacity = isHovered ? 1 : filtered ? 0.15 : 0.7;

          // Replay: draw-in effect via stroke-dashoffset
          const replayDash = replayMode
            ? {
                strokeDasharray: path.length,
                strokeDashoffset: path.length * (1 - replayPosition),
              }
            : {};

          return (
            <g
              key={rope.id}
              className={isNew ? 'rope-swing' : undefined}
              style={
                isNew
                  ? { transformOrigin: `${path.d.split(' ')[1]}px ${path.d.split(' ')[2]}px` }
                  : undefined
              }
            >
              {/* Invisible wider hit area for hover */}
              <path
                d={path.d}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(rope.weight + 8, 12)}
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onMouseEnter={() => setHoveredRopeId(rope.id)}
                onMouseLeave={() => setHoveredRopeId(null)}
              />
              {/* Visible rope */}
              <path
                d={path.d}
                fill="none"
                stroke={color}
                strokeWidth={rope.weight}
                strokeDasharray={
                  !replayMode && rope.polarity === 'contradicting' ? '8 4' : undefined
                }
                opacity={opacity}
                style={{
                  transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: isHovered ? `drop-shadow(0 0 4px ${color})` : undefined,
                  ...replayDash,
                }}
              />
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredRopeId && (() => {
          const hovered = computedRopes.find(cr => cr.rope.id === hoveredRopeId);
          if (!hovered) return null;
          const { path, rope } = hovered;
          const label = rope.polarity === 'reinforcing' ? 'Reinforcing' : 'Contradicting';
          return (
            <g>
              <rect
                x={path.midpoint.x - 38}
                y={path.midpoint.y - 22}
                width={76}
                height={20}
                rx={4}
                fill="var(--fintheon-surface)"
                stroke="var(--fintheon-border)"
                strokeOpacity={0.3}
              />
              <text
                x={path.midpoint.x}
                y={path.midpoint.y - 9}
                textAnchor="middle"
                fill="var(--fintheon-text)"
                fontSize={10}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })()}

        {/* Confluence nodes */}
        {confluencePositions.map(({ node, position }) => (
          <ConfluenceNodeSVG
            key={node.id}
            node={node}
            position={position}
            onClick={onSelectConfluence || (() => {})}
          />
        ))}
      </svg>

      {/* DOM overlay for conflict badges */}
      {conflictPositions.map(({ conflict, position }) => (
        <ConflictBadge
          key={conflict.id}
          conflict={conflict}
          position={position}
          onClick={onSelectConflict || (() => {})}
        />
      ))}
    </>
  );
}
