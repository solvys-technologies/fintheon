// [claude-code 2026-03-19] Agent identity badge for Consilium panel
import {
  Crown,
  Eye,
  ChartLine,
  MagnifyingGlass,
  Megaphone,
  MessageCircle,
  Bot,
} from "lucide-react";

export type BoardroomAgent =
  | "Harper"
  | "Oracle"
  | "Feucht"
  | "Consul"
  | "Herald"
  | "Unknown";

interface AgentConfig {
  label: string;
  role: string;
  icon: typeof Crown;
  accentClass: string;
}

const AGENT_MAP: Record<BoardroomAgent, AgentConfig> = {
  Harper: {
    label: "Harper",
    role: "CAO",
    icon: Crown,
    accentClass: "text-[#D4AF37]",
  },
  Oracle: {
    label: "Oracle",
    role: "All-Seer",
    icon: Eye,
    accentClass: "text-[#D4AF37]",
  },
  Feucht: {
    label: "Feucht",
    role: "Risk Desk",
    icon: ChartLine,
    accentClass: "text-[#D4AF37]",
  },
  Consul: {
    label: "Consul",
    role: "Fundamentals",
    icon: MagnifyingGlass,
    accentClass: "text-[#D4AF37]",
  },
  Herald: {
    label: "Herald",
    role: "Sentiment",
    icon: Megaphone,
    accentClass: "text-[#D4AF37]",
  },
  Unknown: {
    label: "Agent",
    role: "Unknown",
    icon: MessageCircle,
    accentClass: "text-[#D4AF37]/60",
  },
};

interface AgentBadgeProps {
  agent: BoardroomAgent;
  size?: "sm" | "md";
  autonomous?: boolean;
  /** Override display label (e.g. custom CAO name) */
  displayName?: string;
}

export function AgentBadge({
  agent,
  size = "md",
  autonomous,
  displayName,
}: AgentBadgeProps) {
  const config = AGENT_MAP[agent] || AGENT_MAP["Unknown"];
  const Icon = config.icon;
  const iconSize = size === "sm" ? 12 : 16;
  const label = displayName || config.label;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`relative flex items-center justify-center rounded-full border border-[#c79f4a]/30 bg-[#0a0a00] ${size === "sm" ? "h-6 w-6" : "h-8 w-8"}`}
      >
        {autonomous && agent === "Harper" && (
          <Bot
            size={8}
            className="absolute -top-0.5 -right-0.5 text-emerald-400"
          />
        )}
        <Icon size={iconSize} className={config.accentClass} />
      </div>
      <div className="flex flex-col">
        <span
          className={`font-medium leading-tight ${config.accentClass} ${size === "sm" ? "text-xs" : "text-sm"}`}
        >
          {label}
        </span>
        {size === "md" && (
          <span className="text-[10px] uppercase tracking-wider text-[#f0ead6]/40">
            {config.role}
          </span>
        )}
      </div>
    </div>
  );
}

export const AGENT_ACCENT_HEX: Record<BoardroomAgent, string> = {
  Harper: "#D4AF37",
  Oracle: "#D4AF37",
  Feucht: "#D4AF37",
  Consul: "#D4AF37",
  Herald: "#D4AF37",
  Unknown: "#D4AF3760",
};

export { AGENT_MAP };
