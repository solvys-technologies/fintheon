import type { WeekTotal, CalendarSelection } from "./types";

interface WeekTotalCellProps {
  weekData: WeekTotal | null;
  rowIndex: number;
  variant: "projectx" | "solvys";
  onClick: (sel: CalendarSelection) => void;
  weekStart: Date;
}

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`;
}

export function WeekTotalCell({
  weekData,
  rowIndex,
  variant,
  onClick,
  weekStart,
}: WeekTotalCellProps) {
  const isProjectX = variant === "projectx";
  const hasTrades = weekData && weekData.count > 0;
  const isProfit = hasTrades && weekData.pnl >= 0;

  let pnlColor = "var(--fintheon-muted)";
  if (hasTrades && isProjectX) {
    pnlColor = isProfit ? "#22c55e" : "#ef4444";
  } else if (hasTrades && !isProjectX) {
    pnlColor = isProfit ? "#c79f4a" : "#b4443a";
  }

  const handleClick = () => {
    const from = new Date(weekStart);
    from.setHours(0, 0, 0, 0);
    const to = new Date(weekStart);
    to.setDate(to.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    onClick({ kind: "week", from, to });
  };

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-end justify-between p-1.5 text-right transition-colors hover:bg-white/5"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        minHeight: "56px",
        aspectRatio: "1.6 / 1",
        background: hasTrades
          ? isProjectX
            ? isProfit
              ? "rgba(34,197,94,0.06)"
              : "rgba(239,68,68,0.06)"
            : isProfit
              ? "rgba(199,159,74,0.05)"
              : "rgba(180,68,58,0.06)"
          : "transparent",
      }}
    >
      <div className="text-[8px] text-[var(--fintheon-muted)] uppercase tracking-wide">
        Week {rowIndex + 1}
      </div>
      {hasTrades ? (
        <>
          <div
            className="text-[11px] font-mono font-semibold leading-tight"
            style={{ color: pnlColor }}
          >
            {formatPnl(weekData.pnl)}
          </div>
          <div className="text-[8px] text-[var(--fintheon-muted)]">
            {weekData.count} trades · {weekData.wins}W {weekData.losses}L
          </div>
        </>
      ) : (
        <div className="text-[9px] text-[var(--fintheon-muted)] opacity-40">
          —
        </div>
      )}
    </button>
  );
}
