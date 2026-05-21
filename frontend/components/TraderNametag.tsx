// [claude-code 2026-03-14] Compact nametag with ER emotional pulse (green=stable, red=tilt)
// [claude-code 2026-05-19] SOL-71: fixed "neutral" default (false-positive tilt pulse), palette to Solvys gold, added lockout state.
import { useERSafe } from "../contexts/ERContext";

interface TraderNametagProps {
  name: string;
  disablePulse?: boolean;
}

export function TraderNametag({ name, disablePulse }: TraderNametagProps) {
  if (!name) return null;

  const er = useERSafe();
  const resonance = er?.resonanceState ?? "poised"; // "poised" is the correct default (not "neutral")
  const isLockedOut = er?.isLockedOut ?? false;
  const showPulse = !disablePulse && resonance !== "poised";

  const pulseClass = isLockedOut
    ? "nametag-pulse-lockout"
    : showPulse
      ? resonance === "steadfast"
        ? "nametag-pulse-stable"
        : "nametag-pulse-tilt"
      : "";

  return (
    <div
      className={`relative bg-(--fintheon-bg) border border-(--fintheon-accent)/20 rounded-md px-2 h-7 flex items-center overflow-hidden ${pulseClass}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(199,159,74,0.25)" }}
    >
      <span className="relative z-10 text-[10px] font-semibold tracking-[0.14em] text-(--fintheon-accent) uppercase select-none">
        {name}
      </span>
      <div
        className="absolute inset-0 z-0 nametag-shimmer"
        style={{
          background:
            "linear-gradient(135deg, rgba(199,159,74,0.15) 0%, transparent 50%, rgba(199,159,74,0.08) 100%)",
          backgroundSize: "200% 100%",
        }}
      />
      <style>{`
        @keyframes nametag-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .nametag-shimmer {
          animation: nametag-shimmer 3s ease-in-out infinite;
        }
        @keyframes nametag-er-stable {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(199, 159, 74, 0.15); }
        }
        @keyframes nametag-er-tilt {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(199, 159, 74, 0.08); }
        }
        @keyframes nametag-er-lockout {
          0%, 100% { border-color: rgba(199, 159, 74, 0.2); }
          50% { border-color: rgba(199, 159, 74, 0.65); }
        }
        .nametag-pulse-stable {
          animation: nametag-er-stable 2.5s ease-in-out infinite;
        }
        .nametag-pulse-tilt {
          animation: nametag-er-tilt 1.8s ease-in-out infinite;
        }
        .nametag-pulse-lockout {
          animation: nametag-er-lockout 1.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .nametag-pulse-stable, .nametag-pulse-tilt, .nametag-pulse-lockout,
          .nametag-shimmer { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
