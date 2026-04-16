// [claude-code 2026-03-20] S3:T8f — Bloomberg-style chart, narrower blindspots, Missed Trades KPI, period filter
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  User,
  Bot,
  RefreshCw,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { useBackend } from "../../lib/backend";
import { useERSafe } from "../../contexts/ERContext";
import { KPICard } from "./KPICard";
import {
  BloombergChart,
  type ChartPeriod,
  type ChartMetric,
} from "./BloombergChart";
import { ERTrendChart } from "./ERTrendChart";
import { DayHistoryCard } from "./DayHistoryCard";
import { SessionNotesPanel } from "./HumanPsychTab";
import type {
  JournalEntryItem,
  JournalSummaryResponse,
  PerformanceResponse,
  BlindspotItem,
} from "../../lib/services";

type JournalTab = "human" | "agent";

export function PerformanceJournal() {
  const backend = useBackend();
  const er = useERSafe();
  const [activeTab, setActiveTab] = useState<JournalTab>("human");
  const [entries, setEntries] = useState<JournalEntryItem[]>([]);
  const [summary, setSummary] = useState<JournalSummaryResponse | null>(null);
  const [kpis, setKpis] = useState<PerformanceResponse | null>(null);
  const [blindspots, setBlindspots] = useState<BlindspotItem[]>([]);
  const [blindspotSource, setBlindspotSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30D");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("pnl");
  const [weekOffset, setWeekOffset] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, summaryRes, kpisRes, blindRes] = await Promise.all([
        backend.journal.listEntries({ limit: 90 }),
        backend.journal.getSummary(30),
        backend.data.getPerformance(),
        backend.blindspots.getBlindspots(),
      ]);
      setEntries(entriesRes.entries);
      setSummary(summaryRes);
      setKpis(kpisRes);
      setBlindspots(blindRes.blindspots);
      setBlindspotSource(blindRes.source);
    } catch (err) {
      console.warn("Failed to fetch journal data:", err);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Derived data ---
  const findKpi = (label: string) =>
    kpis?.kpis?.find((k) =>
      k.label.toLowerCase().includes(label.toLowerCase()),
    );

  const netPnl = findKpi("P&L") ?? findKpi("pnl") ?? findKpi("Net");
  const winRate = findKpi("Win Rate") ?? findKpi("win");
  const trades = findKpi("Trades") ?? findKpi("trades");

  // Agent stats from summary
  const agentWinRate = summary?.avgWinRate ?? 0;
  const agentDecisions = entries
    .filter((e) => e.type === "agent")
    .reduce((s, e) => s + (e.proposalCount ?? 0), 0);
  const agentPnl = summary?.totalAgentPnl ?? 0;
  const missedTrades = summary?.missedTrades ?? 0;

  // Discipline
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .split("T")[0];
  const weekEntries = entries.filter(
    (e) => e.type === "human" && e.date >= weekAgo,
  );
  const avgDiscipline =
    weekEntries.length > 0
      ? Math.round(
          weekEntries.reduce((s, e) => s + (e.disciplineScore ?? 0), 0) /
            weekEntries.length,
        )
      : 0;
  const todayInfractions = er?.infractionCount ?? 0;

  // P&L daily data filtered by period
  const pnlDailyData = useMemo(() => {
    const agentEntries = entries
      .filter((e) => e.type === "agent" && typeof e.totalPnl === "number")
      .slice(0, 90)
      .reverse();

    const periodDays: Record<ChartPeriod, number> = {
      "7D": 7,
      "30D": 30,
      "90D": 90,
      YTD: Math.ceil(
        (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
          86400000,
      ),
      ALL: 9999,
    };
    const limit = periodDays[chartPeriod];
    return agentEntries.slice(-limit).map((e) => e.totalPnl ?? 0);
  }, [entries, chartPeriod]);

  // ER trend data
  const erTrendData = useMemo(() => {
    const fromEntries = entries
      .filter((e) => e.type === "human" && e.erTrend?.length)
      .slice(0, 7)
      .reverse()
      .flatMap((e) => e.erTrend ?? []);
    const liveSnapshots = er?.getRecentSnapshots?.() ?? [];
    const live = liveSnapshots.map((s) => s.score).reverse();
    return fromEntries.length > 0 ? fromEntries : live;
  }, [entries, er]);

  // --- KPI cards ---
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
      label: "Trades Taken",
      value: trades?.value ?? "--",
      subtitle: trades?.meta,
      accentColor: undefined,
      pieData: undefined,
    },
    {
      label: "Avg R:R",
      value: summary?.avgRR?.toFixed(2) ?? "--",
      subtitle: "30-day",
      accentColor:
        (summary?.avgRR ?? 0) >= 1.5 ? "#34D399" : "var(--fintheon-accent)",
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

  // --- Page 2: day history ---
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
      {/* Header */}
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

      {/* Tab Toggle */}
      <div className="flex px-3 pt-2 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
                isActive
                  ? "bg-[var(--fintheon-accent)] text-black"
                  : "bg-[var(--fintheon-surface)] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] border border-[var(--fintheon-accent)]/10"
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scroll-lock container */}
      <div className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth">
        {/* PAGE 1 */}
        <div className="min-h-full snap-start flex flex-col px-3 py-3 gap-3">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[10px] text-[var(--fintheon-muted)]">
              Loading dashboard...
            </div>
          ) : (
            <>
              {/* KPI Cards — 4x2 grid */}
              <div className="grid grid-cols-4 gap-2">
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

              {/* Middle split: Bloomberg chart (78%) + Blindspots (~22%) */}
              <div className="flex gap-3 min-h-0">
                {/* Left: Bloomberg chart fills container */}
                <div className="flex-[78] min-w-0">
                  {chartMetric === "pnl" ? (
                    <BloombergChart
                      data={pnlDailyData}
                      period={chartPeriod}
                      metric={chartMetric}
                      onPeriodChange={setChartPeriod}
                      onMetricChange={setChartMetric}
                    />
                  ) : (
                    <BloombergChart
                      data={pnlDailyData}
                      period={chartPeriod}
                      metric={chartMetric}
                      onPeriodChange={setChartPeriod}
                      onMetricChange={setChartMetric}
                    />
                  )}
                </div>

                {/* Right ~22%: Blindspots (narrower) */}
                <div className="flex-[22] min-w-0">
                  <div className="bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/20 rounded-lg p-2.5 h-full">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Eye className="w-3 h-3 text-[var(--fintheon-accent)]" />
                      <span className="text-[10px] font-semibold text-[var(--fintheon-text)]">
                        Blindspots
                      </span>
                    </div>
                    {blindspots.length > 0 ? (
                      <div className="space-y-1.5">
                        {blindspots.slice(0, 4).map((spot) => (
                          <div key={spot.id} className="flex items-start gap-1">
                            <span
                              className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${spot.severity === "high" ? "bg-red-400" : "bg-[var(--fintheon-accent)]"}`}
                            />
                            <span className="text-[9px] text-[var(--fintheon-text)] leading-tight">
                              {spot.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[9px] text-[var(--fintheon-muted)] py-3 text-center">
                        {blindspotSource === "error" ||
                        blindspotSource === "empty"
                          ? "No blindspot data"
                          : "No blindspots detected"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom split: Session + Notes */}
              <SessionNotesPanel
                entries={entries}
                onRefresh={fetchData}
                todayInfractions={todayInfractions}
                avgDiscipline={avgDiscipline}
              />
            </>
          )}
        </div>

        {/* PAGE 2 */}
        <div className="min-h-full snap-start flex flex-col px-3 py-3 gap-3">
          {/* Week picker */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--fintheon-text)]">
              {activeTab === "human" ? "Session History" : "Agent History"}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                disabled={weekOffset >= Math.floor(entries.length / 5)}
                className="px-2 py-0.5 text-[10px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] disabled:opacity-30"
              >
                Older
              </button>
              <button
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                disabled={weekOffset === 0}
                className="px-2 py-0.5 text-[10px] bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/15 rounded text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] disabled:opacity-30"
              >
                Newer
              </button>
            </div>
          </div>

          {/* Day cards */}
          {historyEntries.length > 0 ? (
            <div className="space-y-2">
              {historyEntries.map((entry) => (
                <DayHistoryCard
                  key={entry.id}
                  date={entry.date}
                  pnl={entry.totalPnl ?? 0}
                  notes={entry.notes}
                  erScore={
                    entry.erTrend?.length
                      ? entry.erTrend[entry.erTrend.length - 1]
                      : undefined
                  }
                  isAgentView={activeTab === "agent"}
                  agentName={entry.agentName}
                  winRate={entry.winRate}
                  proposalCount={entry.proposalCount}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-[10px] text-[var(--fintheon-muted)]">
              No history entries
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
