// [claude-code 2026-03-29] S9-T5-T1: Add React Flow handles so edges (ropes) can connect
// [claude-code 2026-03-28] S8-T2: Collapsed summary card at bubble zoom level
// Single click → expand/collapse inline preview. Double-click → handled by React Flow (auto-zoom).
import { useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

export interface SummaryCardData {
  slug: string;
  title: string;
  color: string;
  count: number;
  topEvents: string[]; // top 3-5 event titles
}

export function NarrativeSummaryCard({ data }: NodeProps & { data: SummaryCardData }) {
  const { title, color, count, topEvents } = data;
  const [expanded, setExpanded] = useState(false);

  const visibleEvents = expanded ? topEvents.slice(0, 5) : topEvents.slice(0, 3);

  return (
    <div
      className="rounded-xl border cursor-pointer select-none transition-all duration-200"
      style={{
        width: 200,
        backgroundColor: `color-mix(in srgb, ${color} 6%, var(--fintheon-surface))`,
        borderColor: `${color}30`,
        boxShadow: `0 2px 16px ${color}10, 0 4px 12px rgba(0,0,0,0.25)`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(prev => !prev);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-[12px] font-semibold leading-tight flex-1"
            style={{ color, fontFamily: 'var(--font-heading)' }}
          >
            {title}
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              color: `${color}bb`,
              backgroundColor: `${color}12`,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {count}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          {visibleEvents.map((evt, i) => (
            <p
              key={i}
              className="text-[9px] leading-snug truncate"
              style={{
                color: 'var(--fintheon-muted)',
                fontFamily: 'var(--font-body)',
                opacity: 0.7 + (1 - i / visibleEvents.length) * 0.3,
              }}
            >
              {evt}
            </p>
          ))}
          {!expanded && topEvents.length > 3 && (
            <p
              className="text-[8px]"
              style={{ color: `${color}60`, fontFamily: 'var(--font-mono)' }}
            >
              +{topEvents.length - 3} more
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
