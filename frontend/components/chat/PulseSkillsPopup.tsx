// [claude-code 2026-03-11] Rewrite: expanded layout, smooth transitions matching MCP connectors popup
import { useState } from 'react';
import { X, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { SKILLS, type SkillId } from '../../lib/skills';

export { type SkillId, SKILLS };

interface PulseSkillsPopupProps {
  open: boolean;
  onClose: () => void;
  activeSkill?: string | null;
  onSelectSkill?: (id: string | null) => void;
  disabledSkills?: Record<string, { reason: string }>;
}

export function PulseSkillsPopup({ open, onClose, activeSkill, onSelectSkill, disabledSkills }: PulseSkillsPopupProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      className="w-full overflow-hidden rounded-xl border border-[var(--fintheon-accent)]/20 transition-all duration-200"
      style={{
        maxHeight: open ? '440px' : '0px',
        opacity: open ? 1 : 0,
        marginBottom: open ? '8px' : '0px',
        backgroundColor: '#0a0805',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Skills</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 font-medium">
            {SKILLS.length}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Scrollable skill list */}
      <div className="overflow-y-auto py-1" style={{ maxHeight: '380px' }}>
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
                  disabled ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                style={active && !disabled ? { backgroundColor: `${skill.color}15` } : undefined}
              >
                {/* Icon */}
                <div className="relative flex-shrink-0 mt-0.5">
                  {disabled ? (
                    <Lock size={15} className="text-gray-600" />
                  ) : (
                    <Icon size={15} style={{ color: active ? skill.color : '#6B7280' }} />
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
                    <span className={`text-[12px] font-semibold ${active && !disabled ? 'text-white' : disabled ? 'text-gray-600' : 'text-[var(--fintheon-text)]'}`}>
                      {skill.label}
                    </span>
                    {active && !disabled && (
                      <span className="text-[9px] px-1 py-0.5 rounded font-medium" style={{ backgroundColor: `${skill.color}20`, color: skill.color }}>
                        active
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] text-gray-500 leading-tight mt-0.5 transition-all duration-150 ${expanded ? '' : 'line-clamp-1'}`}>
                    {disabled ? disabled.reason : skill.description}
                  </p>
                </div>

                {/* Expand toggle */}
                <div
                  className="flex-shrink-0 mt-0.5 p-0.5 text-gray-600 hover:text-gray-400 transition-colors"
                  onClick={(e) => toggleExpand(e, skill.id)}
                >
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </div>
              </button>

              {/* Expanded details */}
              <div
                className="overflow-hidden transition-all duration-150"
                style={{ maxHeight: expanded ? '80px' : '0px', opacity: expanded ? 1 : 0 }}
              >
                <div className="px-3 pb-2 pl-[34px]">
                  <div className="flex flex-wrap gap-1">
                    {skill.keywords.map((kw) => (
                      <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
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

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[var(--fintheon-accent)]/10">
        <span className="text-[10px] text-gray-600">
          {activeSkill ? `Active: ${SKILLS.find(s => s.id === activeSkill)?.label ?? activeSkill}` : 'Click to activate a skill'}
        </span>
      </div>
    </div>
  );
}
