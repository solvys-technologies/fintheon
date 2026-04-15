// [claude-code 2026-04-15] T4: Quick stats row — VIX, Balance, P&L instrument cards
import { useState, useEffect } from "react";
import { SurfaceCard } from "../shared/SurfaceCard";
import { SegmentedBar } from "../shared/SegmentedBar";
import { useVixStore } from "../../hooks/useVixTicker";
import { useAuth } from "../../contexts/AuthContext";
import { getMobileBackend } from "../../lib/backend";

const DAILY_TARGET = 500;

export function QuickStatsRow() {
  const vix = useVixStore();
  const { getAccessToken } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [dailyPnl, setDailyPnl] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const backend = getMobileBackend(getAccessToken);
    backend.account
      .get()
      .then((acc) => {
        if (!mounted) return;
        setBalance(acc.balance);
        setDailyPnl(acc.dailyPnl);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [getAccessToken]);

  const vixColor =
    vix.isStale || vix.value === 0
      ? "var(--text-disabled)"
      : vix.value > 30
        ? "var(--error)"
        : vix.value > 20
          ? "var(--warning)"
          : "var(--text-display)";

  const pnlColor =
    dailyPnl === null
      ? "var(--text-disabled)"
      : dailyPnl >= 0
        ? "var(--success)"
        : "var(--error)";

  const pnlProgress =
    dailyPnl !== null && dailyPnl > 0
      ? Math.min(100, (dailyPnl / DAILY_TARGET) * 100)
      : 0;

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <StatCard
        label="VIX"
        value={vix.isStale || vix.value === 0 ? "[--]" : vix.value.toFixed(1)}
        valueColor={vixColor}
        subtitle={
          vix.isStale || vix.value === 0
            ? ""
            : `${vix.changePercent >= 0 ? "+" : ""}${vix.changePercent.toFixed(1)}%`
        }
      />
      <StatCard
        label="BALANCE"
        value={balance !== null ? `$${balance.toLocaleString()}` : "[--]"}
        valueColor={
          balance !== null ? "var(--text-display)" : "var(--text-disabled)"
        }
      />
      <StatCard
        label="P&L"
        value={
          dailyPnl !== null
            ? `${dailyPnl >= 0 ? "+" : ""}$${Math.abs(dailyPnl).toLocaleString()}`
            : "[--]"
        }
        valueColor={pnlColor}
      >
        {dailyPnl !== null && dailyPnl > 0 && (
          <div style={{ marginTop: 4 }}>
            <SegmentedBar value={pnlProgress} size="compact" color={pnlColor} />
          </div>
        )}
      </StatCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor,
  subtitle,
  children,
}: {
  label: string;
  value: string;
  valueColor: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <SurfaceCard style={{ flex: 1 }}>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          display: "block",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 20,
          color: valueColor,
          display: "block",
          marginTop: 4,
          lineHeight: 1.2,
        }}
      >
        {value}
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: "var(--text-secondary)",
            display: "block",
            marginTop: 2,
          }}
        >
          {subtitle}
        </span>
      )}
      {children}
    </SurfaceCard>
  );
}
