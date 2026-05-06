// [claude-code 2026-05-05] S59-T3: PersonaBadge — compact native_home status indicator.
// Gold when intact, amber when missing fields, red when not loaded.
import { Shield, ShieldAlert, ShieldOff } from "lucide-react";

interface PersonaBadgeProps {
  status: "green" | "amber" | "red";
  compact?: boolean;
}

const STYLES: Record<string, { border: string; bg: string; text: string; label: string }> = {
  green: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    label: "Intact",
  },
  amber: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    label: "Partial",
  },
  red: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    text: "text-red-400",
    label: "Missing",
  },
};

const ICON = {
  green: Shield,
  amber: ShieldAlert,
  red: ShieldOff,
};

export function PersonaBadge({ status, compact = false }: PersonaBadgeProps) {
  const s = STYLES[status];
  const Icon = ICON[status];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border ${s.border} ${s.bg}`}
        title={`Persona: ${s.label}`}
      >
        <Icon size={9} className={s.text} />
        <span className={`text-[8px] font-mono uppercase tracking-wider ${s.text}`}>
          {s.label}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 border ${s.border} ${s.bg}`}
    >
      <Icon size={10} className={s.text} />
      <span className={`text-[9px] font-mono uppercase tracking-wider ${s.text}`}>
        Persona {s.label}
      </span>
    </span>
  );
}
