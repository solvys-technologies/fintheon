// [claude-code 2026-03-27] SVG overlay for parent→child branch arrows + cross-lane rope distinction
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalystCard, Rope } from "../../lib/narrative-types";
import {
  computeCatenary,
  getCardAnchor,
  type Point,
} from "../../lib/narrative-catenary";

interface NarrativeConnectionOverlayProps {
  catalysts: CatalystCard[];
  ropes: Rope[];
  cardRefsMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  highlightMode: boolean;
}

interface BranchConnection {
  parent: CatalystCard;
  child: CatalystCard;
  highlight: string;
}

interface ComputedBranch {
  key: string;
  path: ReturnType<typeof computeCatenary>;
  highlight: string;
}

interface ComputedCrossRope {
  rope: Rope;
  path: ReturnType<typeof computeCatenary>;
  polarity: "reinforcing" | "contradicting";
}

export function NarrativeConnectionOverlay({
  catalysts,
  ropes,
  cardRefsMap,
  containerRef,
  highlightMode,
}: NarrativeConnectionOverlayProps) {
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  // Recalculate on scroll and resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const recalc = () => forceUpdate((n) => n + 1);
    const observer = new ResizeObserver(recalc);
    observer.observe(container);
    container.addEventListener("scroll", recalc, { passive: true });

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", recalc);
    };
  }, [containerRef]);

  // Identify parent→child branch connections
  const branchConnections = useMemo((): BranchConnection[] => {
    return catalysts
      .filter((c) => c.parentCardId && c.parentHighlight)
      .map((child) => {
        const parent = catalysts.find((p) => p.id === child.parentCardId);
        if (!parent) return null;
        return { parent, child, highlight: child.parentHighlight! };
      })
      .filter((b): b is BranchConnection => b !== null);
  }, [catalysts]);

  // Identify cross-lane ropes (endpoints in different categories)
  const crossLaneRopes = useMemo(() => {
    return ropes.filter((rope) => {
      const fromCard = catalysts.find((c) => c.id === rope.fromId);
      const toCard = catalysts.find((c) => c.id === rope.toId);
      if (!fromCard?.category || !toCard?.category) return false;
      return fromCard.category !== toCard.category;
    });
  }, [ropes, catalysts]);

  const getContainerRelativeAnchor = useCallback(
    (cardId: string, targetCenter: Point): Point | null => {
      const el = cardRefsMap.current[cardId];
      const container = containerRef.current;
      if (!el || !container) return null;

      const cardRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const anchor = getCardAnchor(cardRect, targetCenter);

      return {
        x: anchor.x - containerRect.left,
        y: anchor.y - containerRect.top,
      };
    },
    [cardRefsMap, containerRef],
  );

  const getCardCenter = useCallback(
    (cardId: string): Point | null => {
      const el = cardRefsMap.current[cardId];
      const container = containerRef.current;
      if (!el || !container) return null;

      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top + rect.height / 2 - containerRect.top,
      };
    },
    [cardRefsMap, containerRef],
  );

  // Compute branch arrow paths
  const computedBranches = useMemo((): ComputedBranch[] => {
    if (!containerRef.current) return [];

    return branchConnections
      .map(({ parent, child, highlight }): ComputedBranch | null => {
        const childCenter = getCardCenter(child.id);
        const parentCenter = getCardCenter(parent.id);
        if (!childCenter || !parentCenter) return null;

        const from = getContainerRelativeAnchor(parent.id, childCenter);
        const to = getContainerRelativeAnchor(child.id, parentCenter);
        if (!from || !to) return null;

        // Lighter sag for branch arrows vs ropes
        const path = computeCatenary(from, to, 0.2);
        return {
          key: `${parent.id}-${child.id}`,
          path,
          highlight,
        };
      })
      .filter((b): b is ComputedBranch => b !== null);
  }, [
    branchConnections,
    containerRef,
    getCardCenter,
    getContainerRelativeAnchor,
  ]);

  // Compute cross-lane rope paths
  const computedCrossRopes = useMemo((): ComputedCrossRope[] => {
    if (!containerRef.current) return [];

    return crossLaneRopes
      .map((rope): ComputedCrossRope | null => {
        const fromCenter = getCardCenter(rope.fromId);
        const toCenter = getCardCenter(rope.toId);
        if (!fromCenter || !toCenter) return null;

        const from = getContainerRelativeAnchor(rope.fromId, toCenter);
        const to = getContainerRelativeAnchor(rope.toId, fromCenter);
        if (!from || !to) return null;

        const path = computeCatenary(from, to);
        return { rope, path, polarity: rope.polarity };
      })
      .filter((r): r is ComputedCrossRope => r !== null);
  }, [crossLaneRopes, containerRef, getCardCenter, getContainerRelativeAnchor]);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10, width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        <marker
          id="branch-arrow"
          viewBox="0 0 8 8"
          refX={7}
          refY={4}
          markerWidth={8}
          markerHeight={8}
          orient="auto-start-reverse"
        >
          <polygon points="0 0, 8 4, 0 8" fill="var(--fintheon-accent)" />
        </marker>
      </defs>

      {/* Cross-lane ropes (behind branch arrows) */}
      {computedCrossRopes.map(({ rope, path, polarity }) => {
        const color =
          polarity === "reinforcing"
            ? "var(--fintheon-bullish)"
            : "var(--fintheon-bearish)";
        return (
          <g key={rope.id} className="pointer-events-auto">
            <path
              d={path.d}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="12 6"
              opacity={0.6}
              style={{ transition: "opacity 0.3s ease" }}
            />
          </g>
        );
      })}

      {/* Branch arrows (on top) */}
      {computedBranches.map(({ key, path, highlight }) => {
        const isHovered = hoveredBranch === key;
        const label =
          highlight.length > 30 ? highlight.slice(0, 30) + "…" : highlight;
        const labelWidth = Math.min(label.length * 5.5 + 12, 180);

        return (
          <g key={key} className="pointer-events-auto">
            {/* Invisible hit area */}
            <path
              d={path.d}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredBranch(key)}
              onMouseLeave={() => setHoveredBranch(null)}
            />
            {/* Visible arrow */}
            <path
              d={path.d}
              fill="none"
              stroke="var(--fintheon-accent)"
              strokeWidth={isHovered ? 2 : 1}
              markerEnd="url(#branch-arrow)"
              opacity={isHovered ? 1 : 0.7}
              style={{
                transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                ...(highlightMode
                  ? { animation: "branch-pulse 1.5s ease-in-out infinite" }
                  : {}),
              }}
            />
            {/* Label background + text */}
            <rect
              x={path.midpoint.x - labelWidth / 2}
              y={path.midpoint.y - 10}
              width={labelWidth}
              height={16}
              rx={3}
              fill="var(--fintheon-bg)"
              opacity={isHovered ? 0.9 : 0.8}
            />
            <text
              x={path.midpoint.x}
              y={path.midpoint.y + 2}
              textAnchor="middle"
              fill="var(--fintheon-muted)"
              fontSize={9}
              fontFamily="monospace"
              opacity={isHovered ? 1 : 0.7}
              style={{ transition: "opacity 0.2s ease" }}
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Pulse animation for highlight mode */}
      <style>{`
        @keyframes branch-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </svg>
  );
}
