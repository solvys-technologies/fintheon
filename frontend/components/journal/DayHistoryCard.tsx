// [claude-code 2026-03-16] T4: Day-by-day history card for Page 2 of journal dashboard

interface DayHistoryCardProps {
  date: string; // ISO date string e.g. "2026-03-16"
  pnl: number;
  notes?: string;
  erScore?: number;
  instrumentClose?: { name: string; points: number; pctChange: number };
  isAgentView?: boolean;
  agentName?: string;
  winRate?: number;
  proposalCount?: number;
}

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const day = d.getDate();
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return { day: String(day).padStart(2, "0"), weekday, month };
}

export function DayHistoryCard({
  date,
  pnl,
  notes,
  erScore,
  instrumentClose,
  isAgentView,
  agentName,
  winRate,
  proposalCount,
}: DayHistoryCardProps) {
  const { day, weekday, month } = formatDate(date);
  const pnlColor = pnl >= 0 ? "#34D399" : "#EF4444";
  const pnlStr = `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const erColor =
    erScore != null
      ? erScore >= 7
        ? "#34D399"
        : erScore >= 4
          ? "var(--fintheon-accent)"
          : "#EF4444"
      : "var(--fintheon-muted)";

  return (
    <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/10 rounded-lg p-3 flex gap-3">
      {/* Left column */}
      <div className="flex flex-col items-start min-w-[80px]">
        {/* Date */}
        <div className="text-2xl font-bold font-mono text-[var(--fintheon-accent)] leading-none">
          {day}
        </div>
        <div className="text-[9px] text-[var(--fintheon-muted)] mt-0.5">
          {weekday} {month}
        </div>

        {/* P&L */}
        <div
          className="text-base font-bold font-mono mt-2"
          style={{ color: pnlColor }}
        >
          {pnlStr}
        </div>

        {/* Instrument close */}
        {instrumentClose && (
          <div
            className="text-[10px] font-mono mt-1"
            style={{ color: "var(--fintheon-accent)" }}
          >
            {instrumentClose.name}{" "}
            <span
              style={{
                color: instrumentClose.points >= 0 ? "#34D399" : "#EF4444",
              }}
            >
              {instrumentClose.points >= 0 ? "+" : ""}
              {instrumentClose.points} pts
            </span>
            <span className="text-[var(--fintheon-muted)]">
              {" "}
              ({instrumentClose.pctChange >= 0 ? "+" : ""}
              {instrumentClose.pctChange.toFixed(1)}%)
            </span>
          </div>
        )}

        {/* Agent-specific stats */}
        {isAgentView && (
          <div className="mt-1.5 text-[9px] text-[var(--fintheon-muted)]">
            {agentName && (
              <div className="text-[var(--fintheon-accent)]">{agentName}</div>
            )}
            {proposalCount != null && <div>{proposalCount} proposals</div>}
            {winRate != null && (
              <div
                className="font-mono"
                style={{ color: winRate >= 50 ? "#34D399" : "#EF4444" }}
              >
                {winRate.toFixed(0)}% win
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right column — notes */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div className="text-[11px] text-[var(--fintheon-text)] text-right leading-relaxed line-clamp-4">
          {notes || (
            <span className="text-[var(--fintheon-muted)] italic">
              No notes recorded
            </span>
          )}
        </div>

        {/* ER score badge (bottom-right) */}
        {erScore != null && (
          <div className="flex justify-end mt-2">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border"
              style={{
                color: erColor,
                borderColor: erColor,
                backgroundColor: `${erColor}10`,
              }}
            >
              ER {erScore.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
