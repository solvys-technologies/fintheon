// [claude-code 2026-03-11] Rewrite: expanded layout, smooth transitions matching MCP connectors popup
// S38-T4: Added agent-created skills section with agent attribution + enable/disable toggle
import { useState, useEffect } from "react";
import { X, Lock, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { SKILLS, type SkillId } from "../../lib/skills";

export { type SkillId, SKILLS };

interface FintheonSkillsPopupProps {
  open: boolean;
  onClose: () => void;
  activeSkill?: string | null;
  onSelectSkill?: (id: string | null) => void;
  disabledSkills?: Record<string, { reason: string }>;
}

interface AgentSkillData {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tags: string[];
  agent_id: string;
  status: string;
  usage_count: number;
}

const AGENT_SKILLS_API = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export function FintheonSkillsPopup({
  open,
  onClose,
  activeSkill,
  onSelectSkill,
  disabledSkills,
}: FintheonSkillsPopupProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentSkills, setAgentSkills] = useState<AgentSkillData[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch(`${AGENT_SKILLS_API}/api/agent/skills?status=active`)
      .then((r) => r.json())
      .then((data) => setAgentSkills(data.skills ?? []))
      .catch(() => setAgentSkills([]));
  }, [open]);


  const handleClick = (skillId: string) => {
    if (disabledSkills?.[skillId]) return;
    if (onSelectSkill) {
      onSelectSkill(activeSkill === skillId ? null : skillId);
    }
  };

  const toggleExpand = (e: React.MouseEvent, skillId: string) => {
    e.stopPropagation();
    setExpandedId(expandedId === skillId ? null : skillId);
  };

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border transition-all duration-300 ease-in-out"
      style={{
        maxHeight: open ? "440px" : "0px",
        opacity: open ? 1 : 0,
        transform: open ? "translateY(0)" : "translateY(4px)",
        marginBottom: open ? "8px" : "0px",
        background: "var(--fintheon-glass-bg)",
        borderColor: "var(--fintheon-glass-border)",
        backdropFilter: "blur(20px) saturate(1.3)",
        WebkitBackdropFilter: "blur(20px) saturate(1.3)",
        boxShadow: "var(--fintheon-glass-shadow)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
            Skills
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium">
            {SKILLS.length + agentSkills.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Scrollable skill list */}
      <div className="overflow-y-auto py-1" style={{ maxHeight: "380px" }}>
        {SKILLS.map((skill) => {
          const Icon = skill.icon;
          const active = activeSkill === skill.id;
          const disabled = disabledSkills?.[skill.id];
          const expanded = expandedId === skill.id;

          return (
            <div key={skill.id}>
              <button
                onClick={() => handleClick(skill.id)}
                className={`w-full flex items-start gap-2.5 px-3 py-2 hover:bg-white/[0.025] transition-colors ${
                  disabled ? "opacity-40 cursor-not-allowed" : ""
                }`}
                style={
                  active && !disabled
                    ? { backgroundColor: `${skill.color}15` }
                    : undefined
                }
              >
                {/* Icon */}
                <div className="relative flex-shrink-0 mt-0.5">
                  {disabled ? (
                    <Lock size={15} className="text-gray-600" />
                  ) : (
                    <Icon
                      size={15}
                      style={{ color: active ? skill.color : "#6B7280" }}
                    />
                  )}
                  {active && !disabled && (
                    <div
                      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                      style={{ backgroundColor: skill.color }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[12px] font-semibold ${active && !disabled ? "text-white" : disabled ? "text-gray-600" : "text-[var(--fintheon-text)]"}`}
                    >
                      {skill.label}
                    </span>
                    {active && !disabled && (
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${skill.color}20`,
                          color: skill.color,
                        }}
                      >
                        active
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] text-gray-500 leading-tight mt-0.5 transition-all duration-150 ${expanded ? "" : "line-clamp-1"}`}
                  >
                    {disabled ? disabled.reason : skill.description}
                  </p>
                </div>

                {/* Expand toggle */}
                <div
                  className="flex-shrink-0 mt-0.5 p-0.5 text-gray-600 hover:text-gray-400 transition-colors"
                  onClick={(e) => toggleExpand(e, skill.id)}
                >
                  {expanded ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              <div
                className="overflow-hidden transition-all duration-150"
                style={{
                  maxHeight: expanded ? "80px" : "0px",
                  opacity: expanded ? 1 : 0,
                }}
              >
                <div className="px-3 pb-2 pl-[34px]">
                  <div className="flex flex-wrap gap-1">
                    {skill.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>


      {/* Agent-created skills divider */}
      {agentSkills.length > 0 && (
        <div className="px-3 py-1.5 border-t border-[var(--fintheon-accent)]/10">
          <div className="flex items-center gap-1.5">
            <Bot size={10} className="text-[var(--fintheon-accent)]" />
            <span className="text-[9px] font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">
              Agent-Created
            </span>
            <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]">
              {agentSkills.length}
            </span>
          </div>
        </div>
      )}

      {/* Agent-created skill items */}
      {agentSkills.map((skill) => {
        const isActive = activeSkill === `agent:${skill.id}`;
        const expanded = expandedId === skill.id;

        return (
          <div key={skill.id}>
            <button
              onClick={() => onSelectSkill?.(isActive ? null : `agent:${skill.id}`)}
              className={`w-full flex items-start gap-2.5 px-3 py-2 hover:bg-white/[0.025] transition-colors`}
              style={
                isActive
                  ? { backgroundColor: "var(--fintheon-accent)/10" }
                  : undefined
              }
            >
              <div className="relative flex-shrink-0 mt-0.5">
                <Bot
                  size={15}
                  style={{
                    color: isActive
                      ? "var(--fintheon-accent)"
                      : "#6B7280",
                  }}
                />
                {isActive && (
                  <div
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--fintheon-accent)" }}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[12px] font-semibold ${isActive ? "text-white" : "text-[var(--fintheon-text)]"}`}
                  >
                    {skill.name}
                  </span>
                  {isActive && (
                    <span
                      className="text-[9px] px-1 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: "var(--fintheon-accent)/20",
                        color: "var(--fintheon-accent)",
                      }}
                    >
                      active
                    </span>
                  )}
                </div>
                <p
                  className={`text-[11px] text-gray-500 leading-tight mt-0.5 transition-all duration-150 ${expanded ? "" : "line-clamp-1"}`}
                >
                  {skill.description}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] text-[var(--fintheon-accent)]/50">
                    Created by {skill.agent_id}
                  </span>
                </div>
              </div>

              <div
                className="flex-shrink-0 mt-0.5 p-0.5 text-gray-600 hover:text-gray-400 transition-colors"
                onClick={(e) => toggleExpand(e, skill.id)}
              >
                {expanded ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
              </div>
            </button>

            {expanded && (
              <div className="px-3 pb-2 pl-[34px]">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  className="text-[10px] text-gray-500 leading-relaxed font-mono"
                  style={{
                    maxHeight: "60px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {skill.prompt.slice(0, 200)}
                  {skill.prompt.length > 200 ? "…" : ""}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--fintheon-accent)]/10">
        <span className="text-[10px] text-gray-600">
          {activeSkill
            ? `Active: ${SKILLS.find((s) => s.id === activeSkill)?.label ?? activeSkill}`
            : "Click to activate a skill"}
        </span>
      </div>
    </div>
  );
}
