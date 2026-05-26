// [claude-code 2026-03-20] S3:T8f — Bloomberg-style chart, narrower blindspots, Missed Trades KPI, period filter
// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — top row rebuilt as two heatmap cards, KPI grid demoted below.
// [claude-code 2026-04-23] S30-T2 — BlindspotsRow promoted full-width; session/Hermes/notes consolidated into SessionJournalPanel.
// [claude-code 2026-05-21] SOL-60: Contracts metric, merged tab strip, Add Account modal, account-size state.
import { useState, useEffect, useCallback, useMemo } from "react";
import { BookOpen, User, Bot, RefreshCw, PlusCircle } from "lucide-react";
import { AddAccountModal } from "./AddAccountModal";
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
      const [entriesRes, summaryRes, kpisRes] = await Promise.all([
        backend.journal.listEntries({ limit: 90 }),
        backend.journal.getSummary(30),
        backend.data.getPerformance(),
      ]);
      setEntries(entriesRes.entries);
      setSummary(summaryRes);
      setKpis(kpisRes);
    } catch (err) {
      console.warn("Failed to fetch journal data:", err);
    } finally {
      setLoading(false);
    }
  }, [backend]);

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

  const tabs: { key: JournalTab; label: string; icon: typeof User }[] = [
    { key: "human", label: "Human", icon: User },
    { key: "agent", label: "Agent", icon: Bot },
  ];

  return (
    <div className="bg-[var(--fintheon-bg)] h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <span className="text-sm font-semibold text-[var(--fintheon-text)]">
            Performance
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[var(--fintheon-muted)] ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Merged control strip: Human/Agent | separator | Dashboard/Calendar | Add Account */}
      <div className="flex items-center px-3 pt-2 pb-1 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-(--fintheon-accent) text-black"
                  : "bg-(--fintheon-surface) text-(--fintheon-muted) hover:text-(--fintheon-text) border border-(--fintheon-accent)/10"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
        <div className="w-px h-4 bg-(--fintheon-accent)/20 mx-0.5" />
        {(["dashboard", "calendar"] as PerformanceView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
              view === v
                ? "bg-(--fintheon-accent)/15 text-(--fintheon-accent) border border-(--fintheon-accent)/30"
                : "text-(--fintheon-muted) hover:text-(--fintheon-text)"
            }`}
          >
            {v === "dashboard" ? "Dashboard" : "Calendar"}
          </button>
        ))}
        <button
          onClick={() => setShowAddAccount(true)}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-(--fintheon-muted) hover:text-(--fintheon-accent) transition-colors"
          title="Add account"
        >
          <PlusCircle className="w-3 h-3" />
          Account
        </button>
      </div>

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
          onSave={(size) => {
            setAccountSize(size);
            try {
              localStorage.setItem("fintheon:account-size", String(size));
            } catch {}
            setShowAddAccount(false);
          }}
          initialSize={accountSize}
        />
      )}
    </div>
  );
}
