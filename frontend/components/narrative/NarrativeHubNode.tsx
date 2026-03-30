// [claude-code 2026-03-29] S9-T5-T1: Add React Flow handles so edges (ropes) can connect
// [claude-code 2026-03-28] S8-T2: Large hub node for each of the 10 narrative threads
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

export interface HubNodeData {
  slug: string;
  title: string;
  color: string;
  count: number;
  settled?: boolean;
}

export function NarrativeHubNode({ data }: NodeProps & { data: HubNodeData }) {
  const { title, color, count, settled } = data;

  return (
    <div
      className={`narrative-hub-node flex flex-col items-center justify-center rounded-2xl border cursor-grab active:cursor-grabbing select-none ${settled ? 'settled' : 'node-entering'}`}
      style={{
        width: 180,
        height: 100,
        backgroundColor: `color-mix(in srgb, ${color} 8%, var(--fintheon-surface))`,
        borderColor: `${color}35`,
        boxShadow: `0 0 24px ${color}15, 0 4px 16px rgba(0,0,0,0.3)`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        className="w-3 h-3 rounded-full mb-2"
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
      />
      <span
        className="text-[14px] font-semibold leading-tight text-center px-3"
        style={{ color, fontFamily: 'var(--font-heading)' }}
      >
        {title}
      </span>
      <span
        className="mt-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full"
        style={{
          color: `${color}cc`,
          backgroundColor: `${color}15`,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {count} event{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
