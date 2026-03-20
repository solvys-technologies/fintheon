// [claude-code 2026-03-06] Diamond node where a catalyst affects multiple narrative lanes
import type { ConfluenceNode as ConfluenceNodeType } from '../../lib/narrative-types';
import type { Point } from '../../lib/narrative-catenary';

interface ConfluenceNodeProps {
  node: ConfluenceNodeType;
  position: Point;
  selected?: boolean;
  onClick: (id: string) => void;
}

export function ConfluenceNodeSVG({ node, position, selected, onClick }: ConfluenceNodeProps) {
  const size = 12; // half-size of the diamond

  return (
    <g
      onClick={() => onClick(node.id)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={position.x - size}
        y={position.y - size}
        width={size * 2}
        height={size * 2}
        transform={`rotate(45 ${position.x} ${position.y})`}
        fill="var(--fintheon-surface)"
        stroke="var(--fintheon-accent)"
        strokeOpacity={selected ? 0.8 : 0.4}
        strokeWidth={selected ? 1.5 : 1}
        rx={2}
      />
      {/* Backdrop blur approximation — subtle inner glow */}
      <rect
        x={position.x - size + 2}
        y={position.y - size + 2}
        width={(size - 2) * 2}
        height={(size - 2) * 2}
        transform={`rotate(45 ${position.x} ${position.y})`}
        fill="var(--fintheon-accent)"
        fillOpacity={selected ? 0.15 : 0.05}
        rx={1}
      />
      {/* Count badge for multi-lane confluences */}
      {node.narrativeIds.length > 2 && (
        <text
          x={position.x}
          y={position.y + 3.5}
          textAnchor="middle"
          fill="var(--fintheon-accent)"
          fontSize={9}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {node.narrativeIds.length}
        </text>
      )}
    </g>
  );
}
