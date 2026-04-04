// [claude-code 2026-04-04] Territory nodes are now circles with radial gradient + ring pulse animation
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';

export interface TerritoryNodeData {
  title: string;
  color: string;
  count: number;
  size: number;
}

export function TerritoryNode({ data }: NodeProps & { data: TerritoryNodeData }) {
  const { title, color, count, size } = data;

  return (
    <div
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%, ${color}0a 0%, ${color}04 60%, transparent 100%)`,
        border: `1.5px solid ${color}22`,
        borderRadius: '50%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        pointerEvents: 'none',
        /* no glow animation */
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0, width: 1, height: 1 }} />

      <div
        style={{
          textAlign: 'center',
          pointerEvents: 'none',
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          padding: '24px 18px',
          borderRadius: '50%',
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color,
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            opacity: 0.85,
            textShadow: 'none',
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
    </div>
  );
}
