// [claude-code 2026-03-28] S9-T3: Side-by-side Brief+Calendar with needle divider, kill padding
// [claude-code 2026-03-11] T8: Tale of the Tape label for Sun+Mon<7AM, show only first brief item
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useBackend } from '../../lib/backend';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { useSchedule } from '../../contexts/ScheduleContext';
import type { ExecutiveKpi } from './mockExecutiveData';
import type { TradeIdeaDetail } from '../../lib/riskflow-feed';
import { KanbanTitle } from '../ui/KanbanTitle';
import { ExpandableTapeItem } from './ExpandableTapeItem';
import { SessionCalendarList } from './SessionCalendarList';
import TradeIdeaModal from '../TradeIdeaModal';
import { RegimeCard } from '../dashboard/RegimeCard';
import { RegimeTrackerModal } from '../regimes/RegimeTrackerModal';
import { SetupGuideCard, shouldShowSetupGuide } from '../onboarding/SetupGuideCard';
import { BlindspotsInterview } from '../onboarding/BlindspotsInterview';
import { RefreshCw } from 'lucide-react';
import { AutoRefreshToggle } from '../ui/AutoRefreshToggle';
import { useSettings } from '../../contexts/SettingsContext';

const DASHBOARD_PAGES = ['Briefing', 'RiskFlow'];

function briefTypeToLabel(bt: string): string {
  switch (bt) {
    case 'MDB': return 'Dawn Dispatch';
    case 'ADB': return 'Midday Dispatch';
    case 'PMDB': return 'Dusk Dispatch';
    case 'TOTT': return 'The Weekly Tribune';
    default: return 'Latest Brief';
  }
}

export function MainDashboard({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const backend = useBackend();
  const settings = useSettings();
  const { autoRefresh } = settings;
  const [activePage, setActivePage] = useState(0); // default to Briefing
  const containerRef = useRef<HTMLDivElement>(null);
  const [ntnText, setNtnText] = useState('');
  const { items: scheduleItems, loaded: scheduleLoaded } = useSchedule();
  const [kpis, setKpis] = useState<ExecutiveKpi[]>([]);
  const [ntnLoaded, setNtnLoaded] = useState(false);
  const [ntnRefreshing, setNtnRefreshing] = useState(false);
  const [kpisLoaded, setKpisLoaded] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(() => shouldShowSetupGuide());
  const [showInterview, setShowInterview] = useState(false);

  const handleInterviewComplete = useCallback(
    (data: { name: string; discord: string; instruments: string[]; roadblocks: string[]; customRoadblock: string; dailyTarget: string; weeklyGoal: string; accountSize: string }) => {
      const allRoadblocks = [...data.roadblocks];
      if (data.customRoadblock.trim()) allRoadblocks.push(data.customRoadblock.trim());

      localStorage.setItem('fintheon:interview-completed', 'true');
      localStorage.setItem('fintheon:interview-data', JSON.stringify(data));

      settings.setTraderName(data.name);
      settings.setDiscordUsername(data.discord);
      settings.setInstrumentsTraded(data.instruments);
      settings.setTradingRoadblocks(allRoadblocks);
      settings.setTradingGoals(`Daily: $${data.dailyTarget}, Weekly: $${data.weeklyGoal}, Account: $${data.accountSize}`);
      settings.setInterviewCompleted(true);

      fetch('/api/blindspots/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, roadblocks: allRoadblocks, goals: `Daily: $${data.dailyTarget}, Weekly: $${data.weeklyGoal}, Account: $${data.accountSize}`, instruments: data.instruments, discord: data.discord }),
      }).catch(() => {});

      fetch('/api/blindspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blindspots: allRoadblocks.map((rb) => ({ text: rb, severity: rb.toLowerCase().includes('overtrad') || rb.toLowerCase().includes('revenge') ? 'high' : 'medium' })) }),
      }).catch(() => {});

      setShowInterview(false);
    },
    [settings]
  );

  // Brief type windows: TOTT (Sun>=17:00 through Mon<7AM), PMDB (5:30PM through 6:29AM), ADB (11AM-5:29PM), MDB (6:30AM-10:59AM)
  const getBriefLabel = () => {
    const now = new Date();
    const day = now.getDay();
    const h = now.getHours();
    const t = h * 60 + now.getMinutes();
    // TOTT: Sunday >= 17:00 through Monday < 07:00
    if ((day === 0 && t >= 17 * 60) || (day === 1 && h < 7)) return 'The Weekly Tribune';
    // PMDB stays active overnight until MDB fires at 6:30 AM
    if (t < 6 * 60 + 30) return 'Dusk Dispatch';
    if (t >= 17 * 60 + 30) return 'Dusk Dispatch';
    if (t >= 11 * 60) return 'Midday Dispatch';
    return 'Dawn Dispatch';
  };
  const [briefLabel, setBriefLabel] = useState(getBriefLabel);

  // Daily Brief — rotates MDB/ADB/PMDB, label from backend
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await backend.notion.getMdbBrief();
        if (cancelled) return;
        setNtnText(res.items[0]?.detail ?? '');
        if (res.briefType) setBriefLabel(briefTypeToLabel(res.briefType));
        else setBriefLabel(getBriefLabel());
      } catch (error) {
        console.warn('[Dashboard] Brief fetch failed:', error);
      } finally {
        if (!cancelled) setNtnLoaded(true);
      }
    };
    void load();
    const interval = setInterval(() => {
      if (!autoRefresh) return;
      void load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backend, autoRefresh]);

  // Core KPIs from Daily P&L data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await backend.notion.getPerformance();
        if (cancelled) return;
        setKpis(res.kpis as ExecutiveKpi[]);
      } catch (error) {
        console.warn('[Dashboard] KPI fetch failed:', error);
        if (!cancelled) setKpis([]);
      } finally {
        if (!cancelled) setKpisLoaded(true);
      }
    };
    void load();
    const interval = setInterval(() => {
      if (!autoRefresh) return;
      void load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backend, autoRefresh]);

  // RiskFlow: same feed as RiskFlow panel and MinimalFeedSection (RiskFlowContext)
  const { alerts, markAllSeen, isSeen, refresh, refreshing } = useRiskFlow();

  // [claude-code 2026-03-27] S3: Brief refresh also triggers appwide feed refresh
  const refreshBrief = useCallback(async () => {
    setNtnRefreshing(true);
    try {
      // Trigger appwide feed refresh in parallel with brief refresh
      const feedRefreshPromise = refresh().catch(() => {});

      // Fetch brief
      let res = await backend.notion.getMdbBrief();
      if (!res.items[0]?.detail) {
        await fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')}/api/data/brief/generate`, { method: 'POST' }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
        res = await backend.notion.getMdbBrief();
      }
      setNtnText(res.items[0]?.detail ?? '');
      if (res.briefType) setBriefLabel(briefTypeToLabel(res.briefType));

      await feedRefreshPromise;
    } catch (error) {
      console.warn('[Dashboard] Brief refresh failed:', error);
    } finally {
      setNtnRefreshing(false);
    }
  }, [backend, refresh]);
  const [selectedIdea, setSelectedIdea] = useState<TradeIdeaDetail | null>(null);
  const [showRegimeTracker, setShowRegimeTracker] = useState(false);
  const tapeAlerts = useMemo(() => alerts.slice(0, 50), [alerts]);

  useEffect(() => {
    markAllSeen(tapeAlerts.map((a) => a.id));
  }, [markAllSeen, tapeAlerts]);

  const scrollToPage = useCallback((idx: number) => {
    setActivePage(idx);
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-dash-page]');
    if (pages[idx]) {
      pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Detect which page is in view on scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-dash-page]');
    const scrollTop = el.scrollTop;
    const containerH = el.clientHeight;
    let closest = 0;
    let minDist = Infinity;
    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const elTop = rect.top - el.getBoundingClientRect().top;
      const dist = Math.abs(elTop);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });
    setActivePage(closest);
  }, []);

  // Scroll to default page (Briefing) on mount
  useEffect(() => {
    const timer = setTimeout(() => scrollToPage(0), 50);
    return () => clearTimeout(timer);
  }, [scrollToPage]);

  return (
    <>
    {selectedIdea && (
      <TradeIdeaModal idea={selectedIdea} onClose={() => setSelectedIdea(null)} />
    )}
    {showRegimeTracker && (
      <RegimeTrackerModal onClose={() => setShowRegimeTracker(false)} />
    )}
    <div className="h-full w-full flex relative">
      {/* Main scrollable area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth snap-y snap-mandatory"
      >
        {/* Page 1: Briefing (default) — NTK Brief + Session Calendar + Core KPIs + Action Tape */}
        <div data-dash-page="0" className="min-h-full snap-start py-1 flex flex-col">
          {/* Setup Guide — first-time onboarding */}
          {showSetupGuide && (
            <div className="shrink-0 mb-5">
              <SetupGuideCard onDismiss={() => setShowSetupGuide(false)} onStartInterview={() => setShowInterview(true)} />
            </div>
          )}
          {/* Main content — Brief left, Calendar right */}
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 flex border border-[var(--fintheon-accent)]/12 rounded-xl overflow-hidden mx-1 my-1">
              {/* Left: Morning Daily Brief (55%) */}
              <div className="flex-[55] min-w-0 overflow-y-auto p-4 flex flex-col">
                <KanbanTitle
                  title={briefLabel}
                  tone="gold"
                  headerRight={
                    <div className="flex items-center gap-1">
                      <AutoRefreshToggle size="xs" />
                      <button
                        type="button"
                        onClick={refreshBrief}
                        disabled={ntnRefreshing}
                        className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
                        title="Refresh brief"
                      >
                        <RefreshCw className={`w-3 h-3 ${ntnRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  }
                />
                <textarea
                  value={ntnText}
                  readOnly
                  className="mt-2 flex-1 min-h-0 w-full bg-[#0b0b08] px-4 py-3 text-sm text-gray-200 border border-[var(--fintheon-accent)]/10 rounded focus:outline-none focus:border-[var(--fintheon-accent)]"
                  style={{ resize: 'vertical', minHeight: '80px' }}
                  placeholder={ntnLoaded ? 'Awaiting AI-generated brief...' : 'Loading brief...'}
                />
                {ntnLoaded && !ntnText.trim() && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Awaiting AI-generated brief...
                  </p>
                )}
              </div>

              {/* Needle divider — fades at top/bottom 25% */}
              <div className="w-px relative shrink-0">
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to bottom, transparent 0%, var(--fintheon-accent) 25%, var(--fintheon-accent) 75%, transparent 100%)',
                    opacity: 0.15,
                  }}
                />
              </div>

              {/* Right: Econ Calendar (45%) */}
              <div className="flex-[45] min-w-0 overflow-y-auto p-4 flex flex-col">
                <KanbanTitle
                  title="Session Calendar"
                  tone="cyan"
                  headerRight={
                    <span className="text-[9px] tracking-[0.22em] uppercase border rounded-full px-2 py-0.5 text-[#67e8f9] border-[#06b6d4]/30">
                      Upcoming Events
                    </span>
                  }
                />
                <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 relative">
                  {!scheduleLoaded ? (
                    <div className="text-xs text-zinc-500 py-3 px-1">Loading session calendar...</div>
                  ) : scheduleItems.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-3 px-1">
                      No economic events available. Start the backend or check Supabase connection.
                    </div>
                  ) : (
                    <SessionCalendarList items={scheduleItems} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Core KPIs — single horizontal row, static */}
          <div className="shrink-0 mb-5">
            <KanbanTitle title="Core KPIs" tone="emerald" />
            {!kpisLoaded ? (
              <div className="mt-2 text-xs text-zinc-500 px-1 py-3">Loading KPI data...</div>
            ) : kpis.length === 0 ? (
              <div className="mt-2 text-xs text-zinc-500 px-1 py-3">
                No performance data connected.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-3">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-[#0b0b08] px-4 py-3 border border-[var(--fintheon-accent)]/10 rounded"
                  >
                    <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500">{kpi.label}</div>
                    <div className="mt-1.5 text-2xl font-semibold text-white">{kpi.value}</div>
                    <div className="mt-1 text-xs text-gray-400">{kpi.meta}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 2.5: Regime Tracker preview */}
          <div className="shrink-0 mb-5">
            <RegimeCard onOpenTracker={() => setShowRegimeTracker(true)} />
          </div>

          {/* Row 3: RiskFlow — fills remaining space, expandable items, recency fade */}
          <div className="flex-1 min-h-0 flex flex-col">
            <KanbanTitle title="RiskFlow" tag="Alerts + Signals" tone="emerald" headerRight={
              <div className="flex items-center gap-1">
                <AutoRefreshToggle size="xs" />
                <button
                  type="button"
                  onClick={() => { void refresh(); }}
                  disabled={refreshing}
                  className="p-1 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                  title="Refresh feeds"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            } />
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 space-y-0">
              {tapeAlerts.length === 0 ? (
                <div className="text-xs text-gray-500 px-1 py-4">No actions in the feed right now.</div>
              ) : (
                tapeAlerts.map((alert, idx) => {
                  const total = tapeAlerts.length;
                  // S3: Fade starts at bottom 15% of the list — top 85% is fully readable
                  const fadeStart = Math.floor(total * 0.85);
                  const ratio = idx < fadeStart ? 0 : (idx - fadeStart) / Math.max(1, total - fadeStart - 1);
                  const baseOpacity = Math.max(0.35, 1 - ratio * 0.65);
                  const seen = isSeen(alert.id);
                  const opacity = seen ? Math.max(0.25, baseOpacity * 0.6) : baseOpacity;
                  const borderOpacity = Math.max(0.2, 0.4 - ratio * 0.2);
                  const isVivid = idx < fadeStart && !seen;

                  return (
                    <ExpandableTapeItem
                      key={alert.id}
                      alert={alert}
                      isVivid={isVivid}
                      opacity={opacity}
                      borderOpacity={borderOpacity}
                      seen={seen}
                      onOpenIdea={setSelectedIdea}
                      onNavigateToFeed={onNavigateTab ? () => onNavigateTab('riskflow') : undefined}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Page 2: Full RiskFlow */}
        <div data-dash-page="1" className="min-h-full snap-start py-1 px-1 flex flex-col">
          <KanbanTitle title="RiskFlow" tag="Full Feed" tone="emerald" headerRight={
              <div className="flex items-center gap-1">
                <AutoRefreshToggle size="xs" />
                <button
                  type="button"
                  onClick={() => { void refresh(); }}
                  disabled={refreshing}
                  className="p-1 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                  title="Refresh feeds"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            } />
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-0">
            {tapeAlerts.length === 0 ? (
              <div className="text-xs text-gray-500 px-1 py-8 text-center">No actions in the feed right now.</div>
            ) : (
              tapeAlerts.map((alert, idx) => {
                const total = tapeAlerts.length;
                // S3: Fade starts at bottom 15% — top 85% fully readable
                const fadeStart = Math.floor(total * 0.85);
                const ratio = idx < fadeStart ? 0 : (idx - fadeStart) / Math.max(1, total - fadeStart - 1);
                const baseOpacity = Math.max(0.35, 1 - ratio * 0.65);
                const seen = isSeen(alert.id);
                const opacity = seen ? Math.max(0.25, baseOpacity * 0.6) : baseOpacity;
                const borderOpacity = Math.max(0.2, 0.4 - ratio * 0.2);
                const isVivid = idx < fadeStart && !seen;

                return (
                  <ExpandableTapeItem
                    key={alert.id}
                    alert={alert}
                    isVivid={isVivid}
                    opacity={opacity}
                    borderOpacity={borderOpacity}
                    seen={seen}
                    onOpenIdea={setSelectedIdea}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Scroll-lock page indicators — vertical lines on the right */}
      <div className="shrink-0 w-6 flex flex-col items-center justify-center gap-3 py-8">
        {DASHBOARD_PAGES.map((label, idx) => (
          <button
            key={label}
            onClick={() => scrollToPage(idx)}
            className="group relative flex items-center justify-center"
            title={label}
          >
            <div
              className={`transition-all duration-300 rounded-full ${
                activePage === idx
                  ? 'w-[3px] h-8 bg-[var(--fintheon-accent)]'
                  : 'w-[2px] h-5 bg-gray-700 hover:bg-gray-500'
              }`}
            />
          </button>
        ))}
      </div>
    </div>

    {/* Blindspots Interview — triggered by SetupGuideCard CTA */}
    {showInterview && (
      <BlindspotsInterview
        visible={true}
        onComplete={handleInterviewComplete}
        onSkip={() => {
          localStorage.setItem('fintheon:interview-completed', 'skipped');
          setShowInterview(false);
        }}
        initialName={settings.traderName}
      />
    )}
    </>
  );
}
