// [claude-code 2026-04-20] S28-T3: Agent-themed loading spinners for the icon bank.
// Renders the orchestrator icon for a given agent inside an animated ring so
// loading surfaces can carry agent identity instead of a generic Loader2.
import { Crown, Eye, Zap, Scroll, Megaphone } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SpinnerAgent = "harper" | "oracle" | "feucht" | "consul" | "herald";

type SpinnerVariant = "orbit" | "scan" | "flicker" | "rotate" | "broadcast";

interface SpinnerConfig {
  label: string;
  icon: LucideIcon;
  variant: SpinnerVariant;
}

const SPINNER_MAP: Record<SpinnerAgent, SpinnerConfig> = {
  harper: { label: "Harper", icon: Crown, variant: "orbit" },
  oracle: { label: "Oracle", icon: Eye, variant: "scan" },
  feucht: { label: "Feucht", icon: Zap, variant: "flicker" },
  consul: { label: "Consul", icon: Scroll, variant: "rotate" },
  herald: { label: "Herald", icon: Megaphone, variant: "broadcast" },
};

interface AgentSpinnerProps {
  agent: SpinnerAgent;
  size?: number;
  className?: string;
  title?: string;
}

export function AgentSpinner({
  agent,
  size = 24,
  className = "",
  title,
}: AgentSpinnerProps) {
  const config = SPINNER_MAP[agent];
  const Icon = config.icon;
  const iconSize = Math.max(10, Math.round(size * 0.5));
  const stroke = Math.max(1.25, size / 24);

  return (
    <span
      role="status"
      aria-label={title ?? `${config.label} thinking`}
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={`absolute inset-0 agent-spinner-ring agent-spinner-ring-${config.variant}`}
        aria-hidden="true"
      >
        <circle
          cx={16}
          cy={16}
          r={14}
          fill="none"
          stroke="var(--fintheon-accent)"
          strokeOpacity={0.18}
          strokeWidth={stroke}
        />
        <circle
          cx={16}
          cy={16}
          r={14}
          fill="none"
          stroke="var(--fintheon-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray="22 66"
          style={{
            filter: "drop-shadow(0 0 3px var(--fintheon-accent))",
          }}
        />
      </svg>
      <Icon
        size={iconSize}
        className={`agent-spinner-glyph agent-spinner-glyph-${config.variant} text-[var(--fintheon-accent)]`}
        aria-hidden="true"
      />
      <style>{`
        .agent-spinner-ring { transform-origin: center; }
        .agent-spinner-ring-orbit { animation: agentSpinOrbit 1.8s linear infinite; }
        .agent-spinner-ring-scan { animation: agentSpinScan 1.6s ease-in-out infinite; }
        .agent-spinner-ring-flicker { animation: agentSpinFlicker 0.9s steps(6, end) infinite; }
        .agent-spinner-ring-rotate { animation: agentSpinRotate 2.4s linear infinite; }
        .agent-spinner-ring-broadcast { animation: agentSpinBroadcast 1.4s ease-out infinite; }

        .agent-spinner-glyph { position: relative; z-index: 1; }
        .agent-spinner-glyph-orbit { animation: agentPulseSoft 1.8s ease-in-out infinite; }
        .agent-spinner-glyph-scan { animation: agentPulseSharp 1.6s ease-in-out infinite; }
        .agent-spinner-glyph-flicker { animation: agentPulseFlicker 0.9s steps(4, end) infinite; }
        .agent-spinner-glyph-rotate { animation: agentPulseSoft 2.4s ease-in-out infinite; }
        .agent-spinner-glyph-broadcast { animation: agentPulseBroadcast 1.4s ease-out infinite; }

        @keyframes agentSpinOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes agentSpinScan {
          0% { transform: rotate(-20deg); }
          50% { transform: rotate(200deg); }
          100% { transform: rotate(340deg); }
        }
        @keyframes agentSpinFlicker {
          0%, 100% { transform: rotate(0deg); opacity: 1; }
          16% { transform: rotate(60deg); opacity: 0.6; }
          33% { transform: rotate(120deg); opacity: 1; }
          50% { transform: rotate(180deg); opacity: 0.55; }
          66% { transform: rotate(240deg); opacity: 1; }
          83% { transform: rotate(300deg); opacity: 0.8; }
        }
        @keyframes agentSpinRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes agentSpinBroadcast {
          0% { transform: rotate(-15deg) scale(0.96); opacity: 0.75; }
          60% { transform: rotate(180deg) scale(1.02); opacity: 1; }
          100% { transform: rotate(345deg) scale(0.96); opacity: 0.8; }
        }

        @keyframes agentPulseSoft {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes agentPulseSharp {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes agentPulseFlicker {
          0%, 100% { opacity: 0.9; }
          25% { opacity: 0.4; }
          50% { opacity: 1; }
          75% { opacity: 0.55; }
        }
        @keyframes agentPulseBroadcast {
          0% { opacity: 0.7; transform: scale(0.94); }
          50% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 0.75; transform: scale(0.94); }
        }
      `}</style>
    </span>
  );
}

export const AGENT_SPINNER_AGENTS: SpinnerAgent[] = [
  "harper",
  "oracle",
  "feucht",
  "consul",
  "herald",
];
