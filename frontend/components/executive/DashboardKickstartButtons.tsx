import { RefreshCw } from "lucide-react";

interface IconButtonProps {
  isLoading: boolean;
  onClick: () => void;
}

export function RiskSignalsRefreshButton({
  isLoading,
  onClick,
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40 max-[767px]:p-1.5 max-[767px]:text-[var(--fintheon-accent)]/72"
      title="Refresh risk signals"
      aria-label="Refresh risk signals"
    >
      <RefreshCw
        className={`w-3 h-3 max-[767px]:h-4 max-[767px]:w-4 ${isLoading ? "animate-spin" : ""}`}
      />
    </button>
  );
}

export function DeskPlanAdvanceButton({ isLoading, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
      title="Plan next seven days"
      aria-label="Plan next seven days"
    >
      <span
        className={`inline-flex items-center gap-[1px] ${isLoading ? "desk-plan-advance-active" : ""}`}
        aria-hidden
      >
        <Triangle />
        <Triangle />
        <Triangle />
      </span>
      <style>{`
        @keyframes desk-plan-advance-drive {
          0% { transform: translateX(-1px); opacity: 0.48; }
          45% { opacity: 1; }
          100% { transform: translateX(2px); opacity: 0.72; }
        }
        .desk-plan-advance-active {
          animation: desk-plan-advance-drive 620ms ease-in-out infinite;
        }
      `}</style>
    </button>
  );
}

function Triangle() {
  return (
    <span
      style={{
        width: 0,
        height: 0,
        borderTop: "4px solid transparent",
        borderBottom: "4px solid transparent",
        borderLeft: "5px solid currentColor",
        display: "inline-block",
      }}
    />
  );
}
