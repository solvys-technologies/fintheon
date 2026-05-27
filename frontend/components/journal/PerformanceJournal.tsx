// [claude-code 2026-03-20] S3:T8f — Bloomberg-style chart, narrower blindspots, Missed Trades KPI, period filter
// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — top row rebuilt as two heatmap cards, KPI grid demoted below.
// [claude-code 2026-04-23] S30-T2 — BlindspotsRow promoted full-width; session/Hermes/notes consolidated into SessionJournalPanel.
// [claude-code 2026-05-21] SOL-60: Contracts metric, merged tab strip, Add Account modal, account-size state.
import { useState, useEffect, useCallback, useMemo } from "react";
import { AddAccountModal } from "./AddAccountModal";
import { PerformanceToolbar } from "./PerformanceToolbar";
import { useBackend } from "../../lib/backend";
import { KPICard } from "./KPICard";
import { BlindspotsRow } from "./BlindspotsRow";
import { SessionJournalPanel } from "./SessionJournalPanel";
import { TradingCalendar } from "./TradingCalendar";
import { PerformanceHeatmapsRow } from "./performance/PerformanceHeatmapsRow";
import { PerformanceHistoryPage } from "./performance/PerformanceHistoryPage";
import type {
  JournalEntryItem,
  JournalSummaryResponse,
  PerformanceResponse,
} from "../../lib/services";

type JournalTab = "human" | "agent";
type PerformanceView = "dashboard" | "calendar";

export function PerformanceJournal() {
  const backend = useBackend();
  const [activeTab, setActiveTab] = useState<JournalTab>("human");
  const [view, setView] = useState<PerformanceView>("dashboard");
  const [entries, setEntries] = useState<JournalEntryItem[]>([]);
  const [summary, setSummary] = useState<JournalSummaryResponse | null>(null);
  const [kpis, setKpis] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [projectxStatus, setProjectxStatus] = useState<string>("checking");
  const [syncingProjectX, setSyncingProjectX] = useState(false);
  const [accountSize, setAccountSize] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("fintheon:account-size")) || 0;
    } catch {
      return 0;
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, summaryRes, kpisRes, pxStatus] = await Promise.all([
        backend.journal.listEntries({ limit: 90 }),
        backend.journal.getSummary(30),
        backend.data.getPerformance(),
        backend.projectx.getStatus().catch(() => null),
      ]);
      setEntries(entriesRes.entries);
      setSummary(summaryRes);
      setKpis(kpisRes);
      setProjectxStatus(pxStatus?.status ?? "unavailable");
    } catch (err) {
      console.warn("Failed to fetch journal data:", err);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  const refreshProjectX = useCallback(async () => {
    setSyncingProjectX(true);
    try {
      const result = await backend.projectx.syncProjectXAccounts("manual");
      setProjectxStatus(result.status);
      await fetchData();
    } catch (err) {
      console.warn("Failed to sync ProjectX:", err);
      setProjectxStatus("error");
    } finally {
      setSyncingProjectX(false);
    }
  }, [backend, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const findKpi = (label: string) =>
    kpis?.kpis?.find((k) =>
      k.label.toLowerCase().includes(label.toLowerCase()),
    );

  const netPnl = findKpi("P&L") ?? findKpi("pnl") ?? findKpi("Net");
  const winRate = findKpi("Win Rate") ?? findKpi("win");
  const trades = findKpi("Trades") ?? findKpi("trades");
  const contracts = findKpi("Contracts") ?? findKpi("contracts");
  const rawNotional = findKpi("Notional") ?? findKpi("notional");
  const notionalValue = (() => {
    if (!rawNotional?.value || rawNotional.value === "--") return "--";
    const raw = parseFloat(rawNotional.value.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(raw)) return rawNotional.value;
    if (accountSize > 0) return `${((raw / accountSize) * 100).toFixed(1)}%`;
    return rawNotional.value;
  })();

  const agentWinRate = summary?.avgWinRate ?? 0;
  const agentDecisions = entries
    .filter((e) => e.type === "agent")
    .reduce((s, e) => s + (e.proposalCount ?? 0), 0);
  const agentPnl = summary?.totalAgentPnl ?? 0;
  const missedTrades = summary?.missedTrades ?? 0;

  const humanKpis = [
    {
      label: "Net P&L",
      value: netPnl?.value ?? "--",
      subtitle: netPnl?.meta,
      accentColor: netPnl?.value?.startsWith("-") ? "#EF4444" : "#34D399",
      pieData: undefined,
    },
    {
      label: "Win Rate",
      value: winRate?.value ?? "--",
      subtitle: winRate?.meta,
      accentColor:
        parseFloat(winRate?.value ?? "0") >= 50 ? "#34D399" : "#EF4444",
      pieData: { value: parseFloat(winRate?.value ?? "0"), max: 100 },
    },
    {
      label: "Trades",
      value: trades?.value ?? "--",
      subtitle: "executions",
      accentColor: "var(--fintheon-accent)",
      pieData: undefined,
    },
    {
      label: "Contracts",
      value: contracts?.value ?? "--",
      subtitle: "total qty",
      accentColor: "var(--fintheon-accent)",
      pieData: undefined,
    },
    {
      label: "Notional",
      value: notionalValue,
      subtitle: accountSize > 0 ? "leverage-adj." : "gross",
      accentColor: "var(--fintheon-accent)",
      pieData: undefined,
    },
    {
      label: "Avg R:R",
      value: summary?.avgRR?.toFixed(2) ?? "--",
      subtitle: "30-day",
      accentColor: "var(--fintheon-accent)",
      pieData: undefined,
    },
  ];

  const agentKpis = [
    {
      label: "Agent Win Rate",
      value: `${agentWinRate.toFixed(1)}%`,
      subtitle: "30-day",
      accentColor: agentWinRate >= 50 ? "#34D399" : "#EF4444",
      pieData: { value: agentWinRate, max: 100 },
    },
    {
      label: "Agent Decisions",
      value: String(agentDecisions),
      subtitle: "proposals",
      accentColor: undefined,
      pieData: undefined,
    },
    {
      label: "Agent P&L",
      value: `${agentPnl >= 0 ? "+" : ""}$${agentPnl.toFixed(0)}`,
      subtitle: "30-day net",
      accentColor: agentPnl >= 0 ? "#34D399" : "#EF4444",
      pieData: undefined,
    },
    {
      label: "Missed Trades",
      value: String(missedTrades),
      subtitle: "would-be winners",
      accentColor: missedTrades > 0 ? "#EF4444" : "#34D399",
      pieData: undefined,
    },
  ];

  const orderedKpis =
    activeTab === "human"
      ? [...humanKpis, ...agentKpis]
      : [...agentKpis, ...humanKpis];

  const historyEntries = useMemo(() => {
    const typeFilter = activeTab === "human" ? "human" : "agent";
    const filtered = entries.filter((e) => e.type === typeFilter);
    const start = weekOffset * 5;
    return filtered.slice(start, start + 5);
  }, [entries, activeTab, weekOffset]);

  return (
    <div className="bg-[var(--fintheon-bg)] h-full flex flex-col">
      <PerformanceToolbar
        activeTab={activeTab}
        view={view}
        isRefreshing={loading || syncingProjectX}
        projectxStatus={projectxStatus}
        onRefresh={refreshProjectX}
        onTabChange={setActiveTab}
        onViewChange={setView}
        onAddAccount={() => setShowAddAccount(true)}
      />

      {view === "calendar" && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <TradingCalendar />
        </div>
      )}

      {view === "dashboard" && (
        <div className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth">
          <div className="min-h-full snap-start flex flex-col px-3 py-3 gap-3">
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[10px] text-[var(--fintheon-muted)]">
                Loading dashboard...
              </div>
            ) : (
              <>
                <PerformanceHeatmapsRow />

                <div className="grid grid-cols-3 gap-2">
                  {orderedKpis.map((kpi, i) => (
                    <KPICard
                      key={i}
                      label={kpi.label}
                      value={kpi.value}
                      subtitle={kpi.subtitle}
                      pieData={kpi.pieData}
                      accentColor={kpi.accentColor}
                    />
                  ))}
                </div>

                {/* T2: blindspots row here */}
                <BlindspotsRow />

                {/* T2: session panel here */}
                <SessionJournalPanel />
              </>
            )}
          </div>

          <PerformanceHistoryPage
            entries={entries}
            historyEntries={historyEntries}
            activeTab={activeTab}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
          />
        </div>
      )}

      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={async (size, _broker, projectx) => {
            setAccountSize(size);
            try {
              localStorage.setItem("fintheon:account-size", String(size));
            } catch {}
            if (projectx) {
              const result = await backend.projectx.connect(projectx);
              setProjectxStatus(result.message);
              window.dispatchEvent(
                new CustomEvent("projectx:connection-updated"),
              );
            }
            setShowAddAccount(false);
          }}
          initialSize={accountSize}
        />
      )}
    </div>
  );
}
