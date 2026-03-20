// [claude-code 2026-03-06] Dismissible skill badge pill for active skill display
import { X } from 'lucide-react';
import { SKILLS } from './PulseSkillsPopup';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SkillBadgeProps {
  skillId: string;
  onDismiss: () => void;
}

export function SkillBadge({ skillId, onDismiss }: SkillBadgeProps) {
  const skill = SKILLS.find((s) => s.id === skillId);
  if (!skill) return null;

  const Icon = skill.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{
        border: `1px solid ${skill.color}4D`,
        backgroundColor: `${skill.color}1A`,
        height: '28px',
      }}
    >
      <Icon size={12} style={{ color: skill.color }} />
      <span className="text-xs font-medium" style={{ color: skill.color }}>
        {skill.label}
      </span>
      <button
        onClick={onDismiss}
        className="flex items-center justify-center transition-colors"
        style={{ color: `${skill.color}99` }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = skill.color; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = `${skill.color}99`; }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
