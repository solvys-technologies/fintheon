import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

export interface HubNodeData {
  slug: string;
  title: string;
  color: string;
  count: number;
  settled?: boolean;
}

export function NarrativeHubNode({ data }: NodeProps & { data: HubNodeData }) {
  const { title, color, count, settled } = data;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`narrative-hub-node cursor-grab active:cursor-grabbing select-none ${settled ? "settled" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 140,
        height: 140,
        borderRadius: "50%",
        background: "rgba(10, 10, 0, 0.65)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1.5px solid ${color}20`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: isHovered ? `0 0 24px ${color}40` : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 1, height: 1 }}
      />
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          fontFamily: "var(--font-heading)",
          textAlign: "center",
          lineHeight: "1.2",
          padding: "0 8px",
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: 10,
          color: `${color}80`,
          fontFamily: "var(--font-mono)",
          marginTop: 4,
        }}
      >
        {count}
      </span>
    </div>
  );
}
