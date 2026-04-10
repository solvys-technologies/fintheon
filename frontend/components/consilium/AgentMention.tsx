// [claude-code 2026-03-26] T3: Rich @tag effects — shimmer → glow → hover expand
import { useState, useEffect } from "react";
import { AGENT_MAP, AGENT_ACCENT_HEX, type BoardroomAgent } from "./AgentBadge";

interface AgentMentionProps {
  agent: BoardroomAgent;
  isNew?: boolean;
}

export function AgentMention({ agent, isNew = false }: AgentMentionProps) {
  const [shimmerActive, setShimmerActive] = useState(isNew);
  const [hovered, setHovered] = useState(false);
  const config = AGENT_MAP[agent] || AGENT_MAP["Unknown"];
  const accentHex = AGENT_ACCENT_HEX[agent] || "#6b6040";
  const Icon = config.icon;

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setShimmerActive(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex"
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all duration-300 ${
          shimmerActive ? "agent-mention-shimmer" : ""
        }`}
        style={{
          borderColor: `${accentHex}50`,
          backgroundColor: `${accentHex}15`,
          color: accentHex,
          boxShadow: `0 0 ${hovered ? "12px" : "6px"} ${accentHex}30`,
        }}
      >
        {hovered && <Icon size={12} style={{ color: accentHex }} />}
        <span>@{config.label}</span>
        {hovered && (
          <span className="text-[10px] opacity-60">{config.role}</span>
        )}
      </span>
    </span>
  );
}

export function EveryoneMention() {
  return (
    <span
      className="inline-flex items-center rounded-full border border-[#c79f4a]/40 bg-[#c79f4a]/15 px-2 py-0.5 text-xs font-medium text-[#c79f4a]"
      style={{ boxShadow: "0 0 8px #c79f4a30" }}
    >
      @everyone
    </span>
  );
}
