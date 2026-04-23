import type { DayAggregate, CalendarSelection } from "./types";

interface CalendarCellProps {
  date: Date;
  currentMonth: number;
  data: DayAggregate | null;
  isToday: boolean;
  isSelected: boolean;
  variant: "projectx" | "solvys";
  onClick: (sel: CalendarSelection) => void;
}

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`;
}

export function CalendarCell({
  date,
  currentMonth,
  data,
  isToday,
  isSelected,
  variant,
  onClick,
}: CalendarCellProps) {
  const isCurrentMonth = date.getMonth() === currentMonth;
  const isProjectX = variant === "projectx";
  const hasTrades = data && data.count > 0;
  const isProfit = hasTrades && data.pnl >= 0;

  let cellBg = "transparent";
  let pnlColor = "transparent";
  const borderColor = isSelected
    ? isProjectX
      ? "#3b82f6"
      : "#c79f4a"
    : "rgba(255,255,255,0.08)";

  if (hasTrades && isProjectX) {
    cellBg = isProfit ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
    pnlColor = isProfit ? "#22c55e" : "#ef4444";
  } else if (hasTrades && !isProjectX) {
    cellBg = isProfit ? "rgba(199,159,74,0.08)" : "rgba(180,68,58,0.12)";
    pnlColor = isProfit ? "#c79f4a" : "#b4443a";
  }

  const handleClick = () => {
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(date);
    to.setHours(23, 59, 59, 999);
    onClick({ kind: "day", from, to });
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex flex-col p-1.5 text-left transition-colors hover:bg-white/5"
      style={{
        background: cellBg,
        border: `1px solid ${borderColor}`,
        opacity: isCurrentMonth ? 1 : 0.3,
        minHeight: "56px",
        aspectRatio: "1.6 / 1",
      }}
    >
      <div className="flex items-center gap-1 mb-auto">
        {isToday ? (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: "#3b82f6" }}
          >
            {date.getDate()}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--fintheon-muted)]">
            {date.getDate()}
          </span>
        )}
      </div>

      {hasTrades && (
        <>
          <div
            className="text-[11px] font-mono font-semibold leading-tight"
            style={{ color: pnlColor }}
          >
            {formatPnl(data.pnl)}
          </div>
          <div className="text-[8px] text-[var(--fintheon-muted)] leading-tight">
            {data.count} trade{data.count !== 1 ? "s" : ""}
          </div>
        </>
      )}
    </button>
  );
}
