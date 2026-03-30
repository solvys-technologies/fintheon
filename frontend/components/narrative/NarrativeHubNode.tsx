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
      className={`narrative-hub-node cursor-grab active:cursor-grabbing select-none ${settled ? 'settled' : ''}`}
      style={{
        width: 140,
        height: 140,
        borderRadius: '50%',
        background: `radial-gradient(circle at center, ${color}18 0%, ${color}08 60%, transparent 100%)`,
        border: `2px solid ${color}30`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          fontFamily: 'var(--font-heading)',
          textAlign: 'center',
          lineHeight: '1.2',
          padding: '0 8px',
          textShadow: `0 0 20px ${color}30`,
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 10,
          color: `${color}80`,
          fontFamily: 'var(--font-mono)',
          marginTop: 4,
        }}
      >
        {count}
      </span>
    </div>
  );
}
