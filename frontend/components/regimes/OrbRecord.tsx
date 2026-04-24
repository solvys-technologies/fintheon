// [claude-code 2026-04-15] T2: OrbRecord — ORB direction record with optional mini history bars
import { Diff, TrendingDown } from "lucide-react";
import type { TradingRegime } from "../../lib/regimes";

export function OrbRecord({
  record,
  orbHistory,
}: {
  record: TradingRegime["record"];
  orbHistory?: TradingRegime["orbHistory"];
}) {
  const total = record.bullishDays + record.bearishDays;
  const lastFive = orbHistory?.slice(-5);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-zinc-600 uppercase tracking-wider">
        ORB
      </span>
      <span className="flex items-center gap-0.5 text-[10px]">
        <Diff className="w-2.5 h-2.5 text-[var(--fintheon-bullish)]" />
        <span className="text-[var(--fintheon-bullish)] font-semibold">
          {record.bullishDays}
        </span>
      </span>
      <span className="text-zinc-700">/</span>
      <span className="flex items-center gap-0.5 text-[10px]">
        <span className="text-[var(--fintheon-bearish)] font-semibold">
          {record.bearishDays}
        </span>
        <TrendingDown className="w-2.5 h-2.5 text-[var(--fintheon-bearish)]" />
      </span>
      {total > 0 && (
        <span className="text-[9px] text-zinc-600 ml-0.5">
          ({Math.round((record.bullishDays / total) * 100)}%)
        </span>
      )}
      {lastFive && lastFive.length > 0 && (
        <div className="flex items-center gap-px ml-1">
          {lastFive.map((entry, i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{
                width: 3,
                height: 12,
                backgroundColor:
                  entry.direction === "bullish"
                    ? "var(--fintheon-bullish)"
                    : "var(--fintheon-bearish)",
              }}
              title={`${entry.date}: ${entry.direction} ${entry.changeBps > 0 ? "+" : ""}${entry.changeBps} bps`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
