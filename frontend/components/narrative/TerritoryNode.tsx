import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

export interface TerritoryNodeData {
  title: string;
  color: string;
  count: number;
  width: number;
  height: number;
}

export function TerritoryNode({ data }: NodeProps & { data: TerritoryNodeData }) {
  const { title, color, count, width, height } = data;

  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(135deg, ${color}08 0%, ${color}04 50%, transparent 100%)`,
        border: `1.5px solid ${color}22`,
        borderRadius: 6,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        pointerEvents: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0, width: 1, height: 1 }} />

      <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.85,
            textShadow: `0 0 60px ${color}30, 0 2px 20px ${color}15`,
            lineHeight: '1.15',
            padding: '0 18px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: `${color}70`,
            fontFamily: 'var(--font-mono)',
            marginTop: 10,
            letterSpacing: '0.04em',
          }}
        >
          {count} catalysts
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(to top, ${color}15, transparent)`,
          borderRadius: '0 0 6px 6px',
        }}
      />
    </div>
  );
}
